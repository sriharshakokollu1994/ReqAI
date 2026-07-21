/**
 * Unit tests — AnalysisService
 *
 * All external dependencies mocked via jest.fn().
 *
 * Tests cover:
 *  trigger (conflict detection, promptVersion, forceNew),
 *  getStatus (progress mapping), getLatestByRequirement,
 *  getRequirementHistory, saveAnalysis, unsaveAnalysis,
 *  updateArtifact, rateArtifact
 */

import {
  NotFoundError,
  ConflictError,
} from '../../../domain/errors/AppError';
import { AnalysisService } from '../../../application/services/analysis.service';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2024-06-01T00:00:00Z');

function makeAnalysis(overrides: Record<string, any> = {}): any {
  return {
    id:               'analysis-uuid-001',
    requirementId:    'req-uuid-001',
    triggeredBy:      'user-uuid-001',
    status:           'COMPLETED',
    jobId:            'job-123',
    aiProvider:       'OPENAI',
    aiModel:          'gpt-4o',
    promptVersion:    'v2',
    tokensPrompt:     1500,
    tokensCompletion: 800,
    tokensTotal:      2300,
    costUsd:          '0.046000',
    durationMs:       3400,
    errorCode:        null,
    errorMessage:     null,
    retryCount:       0,
    queuedAt:         NOW,
    startedAt:        NOW,
    completedAt:      NOW,
    artifacts:        [],
    ...overrides,
  };
}

function makeArtifact(overrides: Record<string, any> = {}): any {
  return {
    id:              'artifact-uuid-001',
    analysisId:      'analysis-uuid-001',
    artifactType:    'SUMMARY',
    content:         { title: 'Auth System', overview: '...' },
    isEdited:        false,
    editedBy:        null,
    editedAt:        null,
    confidenceScore: '0.950',
    userRating:      null,
    createdAt:       NOW,
    updatedAt:       NOW,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<Record<string, jest.Mock>> = {}): any {
  return {
    findLatestByRequirement: jest.fn(),
    findLatestCompleted:     jest.fn(),
    findAllByRequirement:    jest.fn(),
    create:                  jest.fn(),
    updateJobId:             jest.fn(),
    listHistory:             jest.fn(),
    listSaved:               jest.fn(),
    saveForUser:             jest.fn(),
    unsaveForUser:           jest.fn(),
    findArtifactById:        jest.fn(),
    updateArtifact:          jest.fn(),
    rateArtifact:            jest.fn(),
    ...overrides,
  };
}

function makeQueue(overrides: Partial<Record<string, jest.Mock>> = {}): any {
  return {
    add: jest.fn(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('AnalysisService', () => {
  let repo:    ReturnType<typeof makeRepo>;
  let queue:   ReturnType<typeof makeQueue>;
  let service: AnalysisService;

  const REQ_ID  = 'req-uuid-001';
  const USER_ID = 'user-uuid-001';

  beforeEach(() => {
    repo    = makeRepo();
    queue   = makeQueue();
    service = new AnalysisService(repo, queue);
  });

  // ── trigger ────────────────────────────────────────────────────────────────

  describe('trigger()', () => {
    it('creates analysis record and enqueues Bull job', async () => {
      repo.findLatestByRequirement.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeAnalysis({ status: 'QUEUED' }));
      queue.add.mockResolvedValue({ id: 'job-456' });
      repo.updateJobId.mockResolvedValue(undefined);

      const result = await service.trigger(REQ_ID, USER_ID, { forceNew: false } as any);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ promptVersion: 'v2' }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'analyze-requirement',
        expect.objectContaining({ analysisId: 'analysis-uuid-001', requirementId: REQ_ID }),
        expect.objectContaining({ attempts: 3 }),
      );
      expect(result.status).toBe('queued');
      expect(typeof result.analysisId).toBe('string');
    });

    it('passes techStack and domain to the queue job payload', async () => {
      repo.findLatestByRequirement.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeAnalysis({ status: 'QUEUED' }));
      queue.add.mockResolvedValue({ id: 'job-789' });
      repo.updateJobId.mockResolvedValue(undefined);

      await service.trigger(REQ_ID, USER_ID, {
        forceNew:  false,
        context:   'Some context',
        techStack: 'Node.js, PostgreSQL',
        domain:    'fintech',
      } as any);

      const [, jobPayload] = queue.add.mock.calls[0];
      expect(jobPayload.techStack).toBe('Node.js, PostgreSQL');
      expect(jobPayload.domain).toBe('fintech');
    });

    it('throws ConflictError when an analysis is already in progress', async () => {
      repo.findLatestByRequirement.mockResolvedValue(makeAnalysis({ status: 'PROCESSING' }));

      await expect(
        service.trigger(REQ_ID, USER_ID, { forceNew: false } as any),
      ).rejects.toThrow(ConflictError);
    });

    it('bypasses conflict check when forceNew is true', async () => {
      repo.findLatestByRequirement.mockResolvedValue(makeAnalysis({ status: 'PROCESSING' }));
      repo.create.mockResolvedValue(makeAnalysis({ status: 'QUEUED' }));
      queue.add.mockResolvedValue({ id: 'job-999' });
      repo.updateJobId.mockResolvedValue(undefined);

      const result = await service.trigger(REQ_ID, USER_ID, { forceNew: true } as any);
      expect(result.status).toBe('queued');
    });

    it('updates job ID on the analysis record after enqueueing', async () => {
      repo.findLatestByRequirement.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeAnalysis({ status: 'QUEUED' }));
      queue.add.mockResolvedValue({ id: 'job-abc' });
      repo.updateJobId.mockResolvedValue(undefined);

      await service.trigger(REQ_ID, USER_ID, { forceNew: false } as any);

      expect(repo.updateJobId).toHaveBeenCalledWith('analysis-uuid-001', 'job-abc');
    });
  });

  // ── getStatus ──────────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it.each([
      ['QUEUED',     5],
      ['PROCESSING', 50],
      ['COMPLETED',  100],
      ['FAILED',     100],
      ['CANCELLED',  100],
    ])('maps status %s to progress %d', async (status, expectedProgress) => {
      repo.findLatestByRequirement.mockResolvedValue(makeAnalysis({ status, completedAt: null }));

      const result = await service.getStatus(REQ_ID);
      expect(result.status).toBe(status);
      expect(result.progress).toBe(expectedProgress);
    });

    it('throws NotFoundError when no analysis exists for requirement', async () => {
      repo.findLatestByRequirement.mockResolvedValue(null);
      await expect(service.getStatus(REQ_ID)).rejects.toThrow(NotFoundError);
    });

    it('includes completedAt ISO string when analysis is done', async () => {
      repo.findLatestByRequirement.mockResolvedValue(makeAnalysis({ status: 'COMPLETED' }));
      const result = await service.getStatus(REQ_ID);
      expect(result.completedAt).toBe(NOW.toISOString());
    });

    it('returns null completedAt for QUEUED analysis', async () => {
      repo.findLatestByRequirement.mockResolvedValue(
        makeAnalysis({ status: 'QUEUED', completedAt: null }),
      );
      const result = await service.getStatus(REQ_ID);
      expect(result.completedAt).toBeNull();
    });
  });

  // ── getLatestByRequirement ─────────────────────────────────────────────────

  describe('getLatestByRequirement()', () => {
    it('returns AnalysisDto for the latest completed analysis', async () => {
      repo.findLatestCompleted.mockResolvedValue(makeAnalysis());
      const result = await service.getLatestByRequirement(REQ_ID, USER_ID);
      expect(result.id).toBe('analysis-uuid-001');
      expect(result.promptVersion).toBe('v2');
    });

    it('throws NotFoundError when no completed analysis exists', async () => {
      repo.findLatestCompleted.mockResolvedValue(null);
      await expect(service.getLatestByRequirement(REQ_ID, USER_ID)).rejects.toThrow(NotFoundError);
    });
  });

  // ── getRequirementHistory ──────────────────────────────────────────────────

  describe('getRequirementHistory()', () => {
    it('returns all analyses mapped to AnalysisDto array', async () => {
      repo.findAllByRequirement.mockResolvedValue([makeAnalysis(), makeAnalysis({ id: 'a-002' })]);
      const result = await service.getRequirementHistory(REQ_ID);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no analyses exist', async () => {
      repo.findAllByRequirement.mockResolvedValue([]);
      const result = await service.getRequirementHistory(REQ_ID);
      expect(result).toEqual([]);
    });
  });

  // ── saveAnalysis / unsaveAnalysis ──────────────────────────────────────────

  describe('saveAnalysis()', () => {
    it('saves the latest completed analysis for the user', async () => {
      repo.findLatestCompleted.mockResolvedValue(makeAnalysis());
      repo.saveForUser.mockResolvedValue(undefined);

      await service.saveAnalysis(REQ_ID, USER_ID, { note: 'Good analysis' });

      expect(repo.saveForUser).toHaveBeenCalledWith('analysis-uuid-001', USER_ID, 'Good analysis');
    });

    it('throws NotFoundError when no completed analysis exists', async () => {
      repo.findLatestCompleted.mockResolvedValue(null);
      await expect(service.saveAnalysis(REQ_ID, USER_ID, {})).rejects.toThrow(NotFoundError);
    });
  });

  describe('unsaveAnalysis()', () => {
    it('delegates unsave to the repository', async () => {
      repo.unsaveForUser.mockResolvedValue(undefined);
      await service.unsaveAnalysis('analysis-uuid-001', USER_ID);
      expect(repo.unsaveForUser).toHaveBeenCalledWith('analysis-uuid-001', USER_ID);
    });
  });

  // ── updateArtifact ─────────────────────────────────────────────────────────

  describe('updateArtifact()', () => {
    it('updates artifact content and returns ArtifactDto', async () => {
      const artifact = makeArtifact();
      const updated  = makeArtifact({ isEdited: true, editedBy: USER_ID, editedAt: NOW });
      repo.findArtifactById.mockResolvedValue(artifact);
      repo.updateArtifact.mockResolvedValue(updated);

      const result = await service.updateArtifact('artifact-uuid-001', USER_ID, {
        content: { title: 'Updated Title' },
      });

      expect(result.isEdited).toBe(true);
      expect(result.editedBy).toBe(USER_ID);
    });

    it('throws NotFoundError for unknown artifact id', async () => {
      repo.findArtifactById.mockResolvedValue(null);
      await expect(
        service.updateArtifact('nonexistent', USER_ID, { content: {} }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ── rateArtifact ───────────────────────────────────────────────────────────

  describe('rateArtifact()', () => {
    it('saves user rating for a valid artifact', async () => {
      repo.findArtifactById.mockResolvedValue(makeArtifact());
      repo.rateArtifact.mockResolvedValue(undefined);

      await service.rateArtifact('artifact-uuid-001', USER_ID, 4);
      expect(repo.rateArtifact).toHaveBeenCalledWith('artifact-uuid-001', 4);
    });

    it('throws NotFoundError for unknown artifact', async () => {
      repo.findArtifactById.mockResolvedValue(null);
      await expect(service.rateArtifact('nonexistent', USER_ID, 5)).rejects.toThrow(NotFoundError);
    });
  });
});
