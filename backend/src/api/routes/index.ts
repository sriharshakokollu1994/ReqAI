/**
 * API Routes Index
 *
 * All routes are mounted under /api/v1 (set in app.ts).
 *
 * Mount map:
 *   /api/v1/auth                                    → auth.routes.ts
 *   /api/v1/projects/:projectId/requirements        → requirement.routes.ts
 *   /api/v1/history                                 → history.routes.ts
 *   /api/v1/export                                  → export.routes.ts
 *   /api/v1/health                                  → health.routes.ts
 */

import { Router } from 'express';
import authRoutes        from './auth.routes';
import requirementRoutes from './requirement.routes';
import historyRoutes     from './history.routes';
import exportRoutes      from './export.routes';
import healthRoutes      from './health.routes';
import adminRoutes       from './admin.routes';
import usersRoutes       from './users.routes';

const router = Router();

router.use('/auth',                               authRoutes);
router.use('/projects/:projectId/requirements',   requirementRoutes);
router.use('/history',                            historyRoutes);
router.use('/export',                             exportRoutes);
router.use('/health',                             healthRoutes);
router.use('/admin',                              adminRoutes);
router.use('/users',                              usersRoutes);

export default router;
