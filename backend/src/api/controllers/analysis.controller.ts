import { Request, Response } from 'express';
import { AnalysisService } from '../../application/services/analysis.service';
import { sendSuccess, buildPaginationMeta } from '../../shared/response';
import {
  TriggerAnalysisDto, UpdateArtifactDto,
  RateArtifactDto, AnalysisHistoryQuery, SaveAnalysisDto,
} from '../../application/dtos/analysis.dto';
import { logger } from '../../shared/logger';

/**
 * AnalysisController
 *
 * Handles all HTTP concerns for the analysis + artifact surface.
 * All business logic lives in AnalysisService.
 *
 * Routes:
 *   POST   /projects/:projectId/requirements/:requirementId/analyze
 *   GET    /projects/:projectId/requirements/:requirementId/analysis
 *   GET    /projects/:projectId/requirements/:requirementId/analysis/status
 *   GET    /projects/:projectId/requirements/:requirementId/analysis/history
 *   POST   /projects/:projectId/requirements/:requirementId/analysis/save
 *   PUT    /projects/:projectId/requirements/:requirementId/artifacts/:artifactId
 *   POST   /projects/:projectId/requirements/:requirementId/artifacts/:artifactId/rate
 */
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  // ── Trigger ───────────────────────────────────────────────────────────────

  /**
   * POST /requirements/:requirementId/analyze
   *
   * Enqueues an async AI analysis job.
   * Returns HTTP 202 Accepted with the jobId so the client can poll.
   */
  trigger = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as TriggerAnalysisDto;

    logger.info('Analysis trigger requested', {
      requirementId: req.params.requirementId,
      userId:        req.user!.sub,
      forceNew:      dto.forceNew,
      hasContext:    !!dto.context,
      hasTechStack:  !!dto.techStack,
      hasDomain:     !!dto.domain,
    });

    const result = await this.analysisService.trigger(
      req.params.requirementId,
      req.user!.sub,
      dto,
    );

    res.status(202).json({ success: true, data: result });
  };

  // ── Latest completed analysis ─────────────────────────────────────────────

  /**
   * GET /requirements/:requirementId/analysis
   *
   * Returns the latest COMPLETED analysis with all 14 artifact types.
   */
  getLatest = async (req: Request, res: Response): Promise<void> => {
    const analysis = await this.analysisService.getLatestByRequirement(
      req.params.requirementId,
      req.user!.sub,
    );
    sendSuccess(res, analysis);
  };

  // ── Status polling ────────────────────────────────────────────────────────

  /**
   * GET /requirements/:requirementId/analysis/status
   *
   * Returns the latest analysis status + progress percentage.
   * Designed to be polled by the frontend at configurable intervals.
   */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    const status = await this.analysisService.getStatus(req.params.requirementId);
    sendSuccess(res, status);
  };

  // ── Requirement history ───────────────────────────────────────────────────

  /**
   * GET /requirements/:requirementId/analysis/history
   *
   * All past analysis runs for this requirement (summary only, no artifacts).
   */
  getHistory = async (req: Request, res: Response): Promise<void> => {
    const history = await this.analysisService.getRequirementHistory(
      req.params.requirementId,
    );
    sendSuccess(res, history);
  };

  // ── Save (bookmark) ───────────────────────────────────────────────────────

  /**
   * POST /requirements/:requirementId/analysis/save
   *
   * Bookmarks the latest completed analysis for this user.
   */
  save = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as SaveAnalysisDto;
    await this.analysisService.saveAnalysis(
      req.params.requirementId,
      req.user!.sub,
      dto,
    );
    sendSuccess(res, { message: 'Analysis saved successfully' });
  };

  // ── Update artifact ───────────────────────────────────────────────────────

  /**
   * PUT /requirements/:requirementId/artifacts/:artifactId
   *
   * Replaces the content of an AI-generated artifact with user-edited content.
   * Sets is_edited=true and records the editor's identity.
   */
  updateArtifact = async (req: Request, res: Response): Promise<void> => {
    const dto      = req.body as UpdateArtifactDto;
    const artifact = await this.analysisService.updateArtifact(
      req.params.artifactId,
      req.user!.sub,
      dto,
    );

    logger.info('Artifact updated', {
      artifactId: req.params.artifactId,
      userId:     req.user!.sub,
    });

    sendSuccess(res, artifact);
  };

  // ── Rate artifact ─────────────────────────────────────────────────────────

  /**
   * POST /requirements/:requirementId/artifacts/:artifactId/rate
   *
   * Records a 1–5 star rating on an artifact for AI quality feedback.
   */
  rateArtifact = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as RateArtifactDto;
    await this.analysisService.rateArtifact(
      req.params.artifactId,
      req.user!.sub,
      dto.rating,
    );
    sendSuccess(res, { message: 'Rating recorded' });
  };
}
