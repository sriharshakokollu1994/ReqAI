/**
 * Unit tests — RequirementService
 *
 * All external dependencies mocked via jest.fn().
 *
 * Tests cover:
 *  list, create (including parentId validation), getById, update, delete,
 *  getVersionHistory, createLink, createFromFile
 */

import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../../domain/errors/AppError';
import { RequirementService } from '../../../application/services/requirement.service';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2024-06-01T00:00:00Z');

function makeReq(overrides: Record<string, any> = {}): any {
  return {
    id:            'req-uuid-001',
    projectId:     'proj-uuid-001',
    title:         'User Authentication',
    body:          'As a user I want to log in',
    type:          'FUNCTIONAL',
    priority:      'HIGH',
    status:        'DRAFT',
    source:        null,
    sourceFileUrl: null,
    tags:          [],
    version:       1,
    wordCount:     8,
    parentId:      null,
    createdBy:     'user-uuid-001',
    updatedBy:     null,
    analyzedAt:    null,
    approvedAt:    null,
    createdAt:     NOW,
    updatedAt:     NOW,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<Record<string, jest.Mock>> = {}): any {
  return {
    list:              jest.fn(),
    findById:          jest.fn(),
    create:            jest.fn(),
    update:            jest.fn(),
    softDelete:        jest.fn(),
    getVersionHistory: jest.fn(),
    createLink:        jest.fn(),
    isProjectMember:   jest.fn(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('RequirementService', () => {
  let repo:    ReturnType<typeof makeRepo>;
  let service: RequirementService;

  const PROJECT_ID = 'proj-uuid-001';
  const USER_ID    = 'user-uuid-001';

  beforeEach(() => {
    repo    = makeRepo();
    service = new RequirementService(repo);
  });

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns paginated requirements for a project member', async () => {
      repo.isProjectMember.mockResolvedValue(true);
      repo.list.mockResolvedValue({ data: [makeReq()], total: 1 });

      const result = await service.list(PROJECT_ID, USER_ID, { page: 1, limit: 20 } as any);

      expect(repo.isProjectMember).toHaveBeenCalledWith(PROJECT_ID, USER_ID);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('splits comma-separated tags into array', async () => {
      repo.isProjectMember.mockResolvedValue(true);
      repo.list.mockResolvedValue({ data: [], total: 0 });

      await service.list(PROJECT_ID, USER_ID, { tags: 'auth, security, core' } as any);

      const [listArg] = repo.list.mock.calls[0];
      expect(listArg.tags).toEqual(['auth', 'security', 'core']);
    });

    it('throws ForbiddenError for non-members', async () => {
      repo.isProjectMember.mockResolvedValue(false);
      await expect(service.list(PROJECT_ID, USER_ID, {} as any)).rejects.toThrow(ForbiddenError);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a requirement and returns RequirementDto', async () => {
      repo.isProjectMember.mockResolvedValue(true);
      repo.create.mockResolvedValue(makeReq());

      const result = await service.create(PROJECT_ID, USER_ID, {
        title: 'Auth Requirement',
        body:  'Some body text',
      } as any);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PROJECT_ID, createdBy: USER_ID }),
      );
      expect(result.id).toBe('req-uuid-001');
    });

    it('validates parentId exists in same project', async () => {
      repo.isProjectMember.mockResolvedValue(true);
      repo.findById.mockResolvedValue(makeReq({ projectId: 'different-project' }));

      await expect(
        service.create(PROJECT_ID, USER_ID, {
          title:    'Child',
          body:     'Child body',
          parentId: 'req-uuid-002',
        } as any),
      ).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when parentId does not exist', async () => {
      repo.isProjectMember.mockResolvedValue(true);
      repo.findById.mockResolvedValue(null); // parent not found

      await expect(
        service.create(PROJECT_ID, USER_ID, {
          title:    'Child',
          body:     'Child body',
          parentId: 'nonexistent-parent',
        } as any),
      ).rejects.toThrow(BadRequestError);
    });
  });

  // ── getById ────────────────────────────────────────────────────────────────

  describe('getById()', () => {
    it('returns RequirementDto for an accessible requirement', async () => {
      repo.findById.mockResolvedValue(makeReq());
      repo.isProjectMember.mockResolvedValue(true);

      const result = await service.getById('req-uuid-001', USER_ID);
      expect(result.id).toBe('req-uuid-001');
      expect(result.title).toBe('User Authentication');
    });

    it('throws NotFoundError for unknown id', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getById('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when user is not a project member', async () => {
      repo.findById.mockResolvedValue(makeReq());
      repo.isProjectMember.mockResolvedValue(false);
      await expect(service.getById('req-uuid-001', USER_ID)).rejects.toThrow(ForbiddenError);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the updated RequirementDto', async () => {
      const updated = makeReq({ title: 'Updated Title' });
      repo.findById.mockResolvedValue(makeReq());
      repo.isProjectMember.mockResolvedValue(true);
      repo.update.mockResolvedValue(updated);

      const result = await service.update('req-uuid-001', USER_ID, { title: 'Updated Title' } as any);
      expect(result.title).toBe('Updated Title');
    });

    it('throws NotFoundError for unknown requirement', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('nonexistent', USER_ID, {} as any)).rejects.toThrow(NotFoundError);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('soft-deletes the requirement', async () => {
      repo.findById.mockResolvedValue(makeReq());
      repo.isProjectMember.mockResolvedValue(true);
      repo.softDelete.mockResolvedValue(undefined);

      await service.delete('req-uuid-001', USER_ID);

      expect(repo.softDelete).toHaveBeenCalledWith('req-uuid-001');
    });

    it('throws NotFoundError for unknown requirement', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });
  });

  // ── getVersionHistory ──────────────────────────────────────────────────────

  describe('getVersionHistory()', () => {
    it('returns mapped version DTOs', async () => {
      const versions = [
        {
          id:            'ver-001',
          requirementId: 'req-uuid-001',
          version:       1,
          title:         'v1 title',
          body:          'v1 body',
          changedBy:     USER_ID,
          changeSummary: 'initial',
          createdAt:     NOW,
        },
      ];
      repo.getVersionHistory.mockResolvedValue(versions);

      const result = await service.getVersionHistory('req-uuid-001');
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe(1);
      expect(result[0].createdAt).toBe(NOW.toISOString());
    });
  });

  // ── createLink ─────────────────────────────────────────────────────────────

  describe('createLink()', () => {
    it('creates a link between two requirements in the same project', async () => {
      repo.findById
        .mockResolvedValueOnce(makeReq({ id: 'req-001' }))
        .mockResolvedValueOnce(makeReq({ id: 'req-002' }));
      repo.createLink.mockResolvedValue(undefined);

      await service.createLink('req-001', USER_ID, {
        targetId: 'req-002',
        linkType: 'DEPENDS_ON',
      } as any);

      expect(repo.createLink).toHaveBeenCalledWith('req-001', 'req-002', 'DEPENDS_ON', USER_ID);
    });

    it('throws BadRequestError when requirements are in different projects', async () => {
      repo.findById
        .mockResolvedValueOnce(makeReq({ projectId: 'proj-A' }))
        .mockResolvedValueOnce(makeReq({ projectId: 'proj-B' }));

      await expect(
        service.createLink('req-001', USER_ID, { targetId: 'req-002', linkType: 'DEPENDS_ON' } as any),
      ).rejects.toThrow(BadRequestError);
    });

    it('throws NotFoundError when source does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(
        service.createLink('nonexistent', USER_ID, { targetId: 'req-002', linkType: 'RELATES_TO' } as any),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ── createFromFile ─────────────────────────────────────────────────────────

  describe('createFromFile()', () => {
    function makeFile(mimetype: string, content: string): Express.Multer.File {
      return {
        mimetype,
        buffer:       Buffer.from(content),
        originalname: 'req.txt',
        fieldname:    'file',
        encoding:     '7bit',
        size:         content.length,
        destination:  '',
        filename:     '',
        path:         '',
        stream:       null as any,
      };
    }

    it('creates a requirement from a text file', async () => {
      repo.isProjectMember.mockResolvedValue(true);
      repo.create.mockResolvedValue(makeReq({ title: 'req.txt' }));

      const file = makeFile('text/plain', 'This is a requirement body with enough text.');
      const result = await service.createFromFile(PROJECT_ID, USER_ID, file, 'Upload Title');
      expect(result.id).toBe('req-uuid-001');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'upload:req.txt' }),
      );
    });

    it('throws BadRequestError for unsupported file types', async () => {
      repo.isProjectMember.mockResolvedValue(true);
      const file = makeFile('application/msword', 'content');
      await expect(
        service.createFromFile(PROJECT_ID, USER_ID, file, 'Title'),
      ).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError for empty file content', async () => {
      repo.isProjectMember.mockResolvedValue(true);
      const file = makeFile('text/plain', 'short');
      await expect(
        service.createFromFile(PROJECT_ID, USER_ID, file, 'Title'),
      ).rejects.toThrow(BadRequestError);
    });
  });
});
