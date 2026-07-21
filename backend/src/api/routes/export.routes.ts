import { Router } from 'express';
import { ExportController }   from '../controllers/export.controller';
import { ExportService }      from '../../application/services/export.service';
import { AnalysisRepository } from '../../infrastructure/repositories/analysis.repository';
import { authenticate }       from '../middlewares/authenticate.middleware';
import { db }                 from '../../infrastructure/database/connection';

const router = Router();

const controller = new ExportController(
  new ExportService(new AnalysisRepository(db)),
);

/**
 * All export routes require authentication.
 *
 * GET /api/v1/export/:analysisId/pdf       — PDF document
 * GET /api/v1/export/:analysisId/docx      — Word document (.docx)
 * GET /api/v1/export/:analysisId/markdown  — Markdown text file
 * GET /api/v1/export/:analysisId/json      — Structured JSON data
 *
 * Unified alias (matches any of the four formats):
 * GET /api/v1/export/:analysisId/:format
 */

router.use(authenticate);

router.get('/:analysisId/pdf',       controller.exportPdf);
router.get('/:analysisId/docx',      controller.exportDocx);
router.get('/:analysisId/markdown',  controller.exportMarkdown);
router.get('/:analysisId/json',      controller.exportJson);

// Unified catch-all — same as the four above but lets the frontend use
// a single URL template: /export/:analysisId/:format
router.get('/:analysisId/:format',   controller.exportByFormat);

export default router;
