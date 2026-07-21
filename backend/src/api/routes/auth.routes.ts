import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/authenticate.middleware';
import {
  RegisterSchema, LoginSchema, ForgotPasswordSchema,
  ResetPasswordSchema, ChangePasswordSchema,
} from '../../application/dtos/auth.dto';
import { AuthService } from '../../application/services/auth.service';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { db } from '../../infrastructure/database/connection';
import { redis } from '../../infrastructure/cache/redis';

const router = Router();
const controller = new AuthController(
  new AuthService(new UserRepository(db), redis),
);

router.post('/register',         validate(RegisterSchema),         controller.register);
router.post('/login',            validate(LoginSchema),            controller.login);
router.post('/refresh',                                            controller.refresh);
router.post('/logout',           authenticate,                     controller.logout);
router.get ('/me',               authenticate,                     controller.me);
router.post('/forgot-password',  validate(ForgotPasswordSchema),   controller.forgotPassword);
router.post('/reset-password',   validate(ResetPasswordSchema),    controller.resetPassword);
router.post('/change-password',  authenticate, validate(ChangePasswordSchema), controller.changePassword);

export default router;
