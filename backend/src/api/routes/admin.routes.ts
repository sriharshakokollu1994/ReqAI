import { Router }          from 'express';
import { AdminController } from '../controllers/admin.controller';
import { AdminService }    from '../../application/services/admin.service';
import { UserRepository }  from '../../infrastructure/repositories/user.repository';
import { db }              from '../../infrastructure/database/connection';
import { authenticate, authorize }   from '../middlewares/authenticate.middleware';
import { validate }        from '../middlewares/validate.middleware';
import {
  AdminListUsersQuerySchema,
  ChangeRoleSchema,
  ChangeStatusSchema,
} from '../../application/dtos/admin.dto';

const router     = Router();
const controller = new AdminController(
  new AdminService(new UserRepository(db)),
);

// Every admin route requires authentication + ADMIN role
router.use(authenticate, authorize('ADMIN'));

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get   ('/',              validate(AdminListUsersQuerySchema, 'query'), controller.listUsers);
router.get   ('/:id',                                                         controller.getUser);
router.patch ('/:id/role',      validate(ChangeRoleSchema),                  controller.changeRole);
router.patch ('/:id/status',    validate(ChangeStatusSchema),                controller.changeStatus);
router.delete('/:id',                                                         controller.deleteUser);

export default router;
