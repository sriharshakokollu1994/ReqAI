import { Router }          from 'express';
import { UserController }  from '../controllers/user.controller';
import { UserService }     from '../../application/services/user.service';
import { UserRepository }  from '../../infrastructure/repositories/user.repository';
import { db }              from '../../infrastructure/database/connection';
import { authenticate }    from '../middlewares/authenticate.middleware';
import { validate }        from '../middlewares/validate.middleware';
import { UpdateProfileSchema } from '../../application/dtos/user.dto';

const router     = Router();
const controller = new UserController(
  new UserService(new UserRepository(db)),
);

// All user profile routes require authentication
router.use(authenticate);

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get  ('/me', controller.getMe);
router.patch('/me', validate(UpdateProfileSchema), controller.updateMe);

export default router;
