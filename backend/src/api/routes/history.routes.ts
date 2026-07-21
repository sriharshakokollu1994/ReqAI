import { Router } from 'express';
import { HistoryController } from '../controllers/history.controller';
import { ExportController } from '../controllers/export.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/authenticate.middleware';
import { AnalysisHistoryQuerySchema } from '../../application/dtos/analysis.dto';
import { AnalysisService } from '../../application/services/analysis.service';
import { ExportService } from '../../application/services/export.service';
import { AnalysisRepository } from '../../infrastructure/repositories/analysis.repository';
import { db } from '../../infrastructure/database/connection';
import { queue } from '../../infrastructure/queue/queue';

const router = Router();
const analysisService  = new AnalysisService(new AnalysisRepository(db), queue);
const exportService    = new ExportService(new AnalysisRepository(db));
const histController   = new HistoryController(analysisService);
const exportController = new ExportController(exportService);

// ─── History ──────────────────────────────────────────────────────────────────
router.get('/',                    authenticate, validate(AnalysisHistoryQuerySchema, 'query'), histController.list);
router.get('/saved',               authenticate, validate(AnalysisHistoryQuerySchema, 'query'), histController.saved);
router.delete('/saved/:analysisId',authenticate, histController.unsave);

// ─── Export (accessible from history context) ─────────────────────────────────
router.get('/export/:analysisId/pdf',      authenticate, exportController.exportPdf);
router.get('/export/:analysisId/markdown', authenticate, exportController.exportMarkdown);
router.get('/export/:analysisId/json',     authenticate, exportController.exportJson);

export default router;
