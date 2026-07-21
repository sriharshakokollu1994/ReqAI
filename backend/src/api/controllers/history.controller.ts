import { Request, Response } from 'express';
import { AnalysisService } from '../../application/services/analysis.service';
import { AnalysisHistoryQuery } from '../../application/dtos/analysis.dto';
import { sendSuccess, buildPaginationMeta } from '../../shared/response';

export class HistoryController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * @openapi
   * /history:
   *   get:
   *     tags: [History]
   *     summary: Get paginated analysis history across all projects
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/Page'
   *       - $ref: '#/components/parameters/Limit'
   *       - name: projectId
   *         in: query
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter by project
   *       - name: status
   *         in: query
   *         schema:
   *           $ref: '#/components/schemas/AnalysisStatus'
   *       - name: provider
   *         in: query
   *         schema:
   *           $ref: '#/components/schemas/AIProvider'
   *       - name: from
   *         in: query
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter analyses from this date (ISO 8601)
   *       - name: to
   *         in: query
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Filter analyses up to this date (ISO 8601)
   *       - name: sortBy
   *         in: query
   *         schema:
   *           type: string
   *           enum: [completedAt, createdAt, tokensTotal, costUsd]
   *           default: completedAt
   *       - name: sortDir
   *         in: query
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *     responses:
   *       200:
   *         description: Paginated analysis history
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HistoryListResponse'
   */
  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AnalysisHistoryQuery;
    const { data, total } = await this.analysisService.getHistory(req.user!.sub, query);
    sendSuccess(res, data, 200, buildPaginationMeta(query.page, query.limit, total));
  };

  /**
   * @openapi
   * /history/saved:
   *   get:
   *     tags: [History]
   *     summary: Get user's bookmarked / saved analyses
   *     security:
   *       - bearerAuth: []
   */
  saved = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AnalysisHistoryQuery;
    const { data, total } = await this.analysisService.getSavedAnalyses(req.user!.sub, query);
    sendSuccess(res, data, 200, buildPaginationMeta(query.page, query.limit, total));
  };

  /**
   * @openapi
   * /history/saved/{analysisId}:
   *   delete:
   *     tags: [History]
   *     summary: Remove an analysis from saved bookmarks
   *     security:
   *       - bearerAuth: []
   */
  unsave = async (req: Request, res: Response): Promise<void> => {
    await this.analysisService.unsaveAnalysis(req.params.analysisId, req.user!.sub);
    sendSuccess(res, { message: 'Analysis removed from saved' });
  };
}
