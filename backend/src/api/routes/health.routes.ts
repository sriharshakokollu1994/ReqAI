import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { db } from '../../infrastructure/database/connection';
import { redis } from '../../infrastructure/cache/redis';

const router = Router();
const controller = new HealthController(db, redis);

router.get('/',      controller.check);
router.get('/live',  controller.live);
router.get('/ready', controller.ready);

export default router;
