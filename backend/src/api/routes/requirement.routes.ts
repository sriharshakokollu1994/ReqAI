import { Router } from 'express';
import { RequirementController } from '../controllers/requirement.controller';
import { AnalysisController } from '../controllers/analysis.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate, authorize } from '../middlewares/authenticate.middleware';
import {
  CreateRequirementSchema, UpdateRequirementSchema,
  RequirementQuerySchema, LinkRequirementSchema,
} from '../../application/dtos/requirement.dto';
import {
  TriggerAnalysisSchema, UpdateArtifactSchema,
  RateArtifactSchema, AnalysisHistoryQuerySchema, SaveAnalysisSchema,
} from '../../application/dtos/analysis.dto';
import { RequirementService } from '../../application/services/requirement.service';
import { AnalysisService } from '../../application/services/analysis.service';
import { RequirementRepository } from '../../infrastructure/repositories/requirement.repository';
import { AnalysisRepository } from '../../infrastructure/repositories/analysis.repository';
import { db } from '../../infrastructure/database/connection';
import { queue } from '../../infrastructure/queue/queue';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router({ mergeParams: true });

const requirementService = new RequirementService(new RequirementRepository(db));
const analysisService    = new AnalysisService(new AnalysisRepository(db), queue);
const reqController      = new RequirementController(requirementService);
const anaController      = new AnalysisController(analysisService);

// ─── Requirements CRUD ─────────────────────────────────────────────────────────
router.get   ('/',        authenticate, validate(RequirementQuerySchema, 'query'), reqController.list);
router.post  ('/',        authenticate, authorize('ADMIN','BUSINESS_ANALYST'),
                          validate(CreateRequirementSchema), reqController.create);
router.get   ('/:requirementId',  authenticate, reqController.getById);
router.put   ('/:requirementId',  authenticate, authorize('ADMIN','BUSINESS_ANALYST'),
                                  validate(UpdateRequirementSchema), reqController.update);
router.delete('/:requirementId',  authenticate, authorize('ADMIN','BUSINESS_ANALYST'),
                                  reqController.delete);

// ─── Version history ───────────────────────────────────────────────────────────
router.get('/:requirementId/versions', authenticate, reqController.getVersionHistory);

// ─── Links ─────────────────────────────────────────────────────────────────────
router.post('/:requirementId/links', authenticate, authorize('ADMIN','BUSINESS_ANALYST'),
  validate(LinkRequirementSchema), reqController.createLink);

// ─── File upload ───────────────────────────────────────────────────────────────
router.post('/upload', authenticate, authorize('ADMIN','BUSINESS_ANALYST'),
  upload.single('file'), reqController.upload);

// ─── Analysis (nested under requirement) ──────────────────────────────────────
router.post('/:requirementId/analyze',
  authenticate,
  authorize('ADMIN', 'BUSINESS_ANALYST'),
  validate(TriggerAnalysisSchema),
  anaController.trigger,
);
router.get ('/:requirementId/analysis',        authenticate, anaController.getLatest);
router.get ('/:requirementId/analysis/status', authenticate, anaController.getStatus);
router.get ('/:requirementId/analysis/history',authenticate, anaController.getHistory);
router.post('/:requirementId/analysis/save',   authenticate,
  validate(SaveAnalysisSchema), anaController.save);

// ─── Artifacts ─────────────────────────────────────────────────────────────────
router.put ('/:requirementId/artifacts/:artifactId',
  authenticate,
  authorize('ADMIN','BUSINESS_ANALYST'),
  validate(UpdateArtifactSchema),
  anaController.updateArtifact,
);
router.post('/:requirementId/artifacts/:artifactId/rate',
  authenticate,
  validate(RateArtifactSchema),
  anaController.rateArtifact,
);

export default router;
