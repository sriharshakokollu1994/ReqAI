import { Queue } from 'bull';
import { AnalysisRepository } from '../../infrastructure/repositories/analysis.repository';
import {
  TriggerAnalysisDto, UpdateArtifactDto, RateArtifactDto,
  AnalysisDto, ArtifactDto, AnalysisStatusDto,
  AnalysisHistoryQuery, AnalysisHistoryItemDto,
  TriggerAnalysisResponseDto, SaveAnalysisDto,
} from '../dtos/analysis.dto';
import {
  NotFoundError, ConflictError, ForbiddenError, BadRequestError, ServiceUnavailableError,
} from '../../domain/errors/AppError';
import { env } from '../../config/env';

const STATUS_PROGRESS: Record<string, number> = {
  QUEUED:     5,
  PROCESSING: 50,
  COMPLETED:  100,
  FAILED:     100,
  CANCELLED:  100,
};

type AnalysisQueue = Pick<Queue, 'add'>;

export class AnalysisService {
  constructor(
    private readonly repo: AnalysisRepository,
    private readonly queue: AnalysisQueue,
  ) {}

  async trigger(
    requirementId: string,
    userId: string,
    dto: TriggerAnalysisDto,
  ): Promise<TriggerAnalysisResponseDto> {
    // Check there is no active analysis already running
    const existing = await this.repo.findLatestByRequirement(requirementId);
    if (existing && ['QUEUED', 'PROCESSING'].includes(existing.status) && !dto.forceNew) {
      throw new ConflictError('An analysis is already in progress for this requirement');
    }

    const analysis = await this.repo.create({
      requirementId,
      triggeredBy:   userId,
      aiProvider:    env.AI_PROVIDER,
      aiModel:       env.OPENAI_MODEL,
      promptVersion: 'v2',
    });

    let job;
    try {
      job = await this.queue.add(
        'analyze-requirement',
        {
          analysisId:   analysis.id,
          requirementId,
          context:      dto.context,
          techStack:    dto.techStack,
          domain:       dto.domain,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
    } catch {
      throw new ServiceUnavailableError(
        'Analysis queue is unavailable. Start Redis and retry the analysis request.',
      );
    }

    await this.repo.updateJobId(analysis.id, String(job.id));

    return {
      analysisId: analysis.id,
      status:     'queued',
      jobId:      String(job.id),
      message:    'Analysis job queued. Poll /analysis/:requirementId/status for updates.',
    };
  }

  async getLatestByRequirement(requirementId: string, userId: string): Promise<AnalysisDto> {
    const analysis = await this.repo.findLatestCompleted(requirementId);
    if (!analysis) throw new NotFoundError('Analysis for requirement', requirementId);
    return this.toDto(analysis);
  }

  async getStatus(requirementId: string): Promise<AnalysisStatusDto> {
    const analysis = await this.repo.findLatestByRequirement(requirementId);
    if (!analysis) throw new NotFoundError('Analysis for requirement', requirementId);

    return {
      analysisId:  analysis.id,
      status:      analysis.status,
      progress:    STATUS_PROGRESS[analysis.status] ?? 0,
      message:     this.statusMessage(analysis.status),
      completedAt: analysis.completedAt ? analysis.completedAt.toISOString() : null,
    };
  }

  async getRequirementHistory(requirementId: string): Promise<AnalysisDto[]> {
    const analyses = await this.repo.findAllByRequirement(requirementId);
    return analyses.map((a) => this.toDto(a));
  }

  async getHistory(userId: string, query: AnalysisHistoryQuery): Promise<{
    data: AnalysisHistoryItemDto[];
    total: number;
  }> {
    return this.repo.listHistory(userId, query);
  }

  async getSavedAnalyses(userId: string, query: AnalysisHistoryQuery): Promise<{
    data: AnalysisHistoryItemDto[];
    total: number;
  }> {
    return this.repo.listSaved(userId, query);
  }

  async saveAnalysis(requirementId: string, userId: string, dto: SaveAnalysisDto): Promise<void> {
    const analysis = await this.repo.findLatestCompleted(requirementId);
    if (!analysis) throw new NotFoundError('Completed analysis for requirement', requirementId);
    await this.repo.saveForUser(analysis.id, userId, dto.note);
  }

  async unsaveAnalysis(analysisId: string, userId: string): Promise<void> {
    await this.repo.unsaveForUser(analysisId, userId);
  }

  async updateArtifact(artifactId: string, userId: string, dto: UpdateArtifactDto): Promise<ArtifactDto> {
    const artifact = await this.repo.findArtifactById(artifactId);
    if (!artifact) throw new NotFoundError('Artifact', artifactId);
    const updated = await this.repo.updateArtifact(artifactId, {
      content:  dto.content,
      editedBy: userId,
      editedAt: new Date(),
    });
    return this.toArtifactDto(updated);
  }

  async rateArtifact(artifactId: string, userId: string, rating: number): Promise<void> {
    const artifact = await this.repo.findArtifactById(artifactId);
    if (!artifact) throw new NotFoundError('Artifact', artifactId);
    await this.repo.rateArtifact(artifactId, rating);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private statusMessage(status: string): string {
    const messages: Record<string, string> = {
      QUEUED:     'Analysis is queued and will begin shortly',
      PROCESSING: 'AI is analysing the requirement',
      COMPLETED:  'Analysis complete — artifacts are ready',
      FAILED:     'Analysis failed — please try again',
      CANCELLED:  'Analysis was cancelled',
    };
    return messages[status] ?? 'Unknown status';
  }

  private toDto(a: any): AnalysisDto {
    return {
      id:               a.id,
      requirementId:    a.requirementId,
      triggeredBy:      a.triggeredBy,
      status:           a.status,
      jobId:            a.jobId           ?? null,
      aiProvider:       a.aiProvider,
      aiModel:          a.aiModel,
      promptVersion:    a.promptVersion,
      tokensPrompt:     a.tokensPrompt    ?? null,
      tokensCompletion: a.tokensCompletion ?? null,
      tokensTotal:      a.tokensTotal     ?? null,
      costUsd:          a.costUsd         ? Number(a.costUsd) : null,
      durationMs:       a.durationMs      ?? null,
      errorCode:        a.errorCode       ?? null,
      errorMessage:     a.errorMessage    ?? null,
      retryCount:       a.retryCount,
      queuedAt:         a.queuedAt.toISOString(),
      startedAt:        a.startedAt       ? a.startedAt.toISOString()   : null,
      completedAt:      a.completedAt     ? a.completedAt.toISOString() : null,
      artifacts:        (a.artifacts ?? []).map((ar: any) => this.toArtifactDto(ar)),
    };
  }

  private toArtifactDto(ar: any): ArtifactDto {
    return {
      id:              ar.id,
      analysisId:      ar.analysisId,
      artifactType:    ar.artifactType,
      content:         ar.content,
      isEdited:        ar.isEdited,
      editedBy:        ar.editedBy     ?? null,
      editedAt:        ar.editedAt     ? ar.editedAt.toISOString() : null,
      confidenceScore: ar.confidenceScore ? Number(ar.confidenceScore) : null,
      userRating:      ar.userRating   ?? null,
      createdAt:       ar.createdAt.toISOString(),
      updatedAt:       ar.updatedAt.toISOString(),
    };
  }
}
