import { Request, Response } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/response';
import {
  RegisterDto, LoginDto, ForgotPasswordDto,
  ResetPasswordDto, ChangePasswordDto,
} from '../../application/dtos/auth.dto';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * @openapi
   * /auth/register:
   *   post:
   *     tags: [Authentication]
   *     summary: Register a new user account
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RegisterRequest'
   *     responses:
   *       201:
   *         description: User created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthUserResponse'
   *       409:
   *         $ref: '#/components/responses/Conflict'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   */
  register = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as RegisterDto;
    const user = await this.authService.register(dto);
    sendCreated(res, user);
  };

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     tags: [Authentication]
   *     summary: Authenticate user and receive JWT tokens
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LoginRequest'
   *     responses:
   *       200:
   *         description: Login successful
   *         headers:
   *           Set-Cookie:
   *             schema:
   *               type: string
   *             description: httpOnly refresh token cookie
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LoginResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   */
  login = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as LoginDto;
    const result = await this.authService.login(dto, req.ip ?? '', req.headers['user-agent'] ?? '');
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
      path:     '/api/v1/auth/refresh',
    });
    sendSuccess(res, {
      accessToken: result.accessToken,
      tokenType:   'Bearer' as const,
      expiresIn:   15 * 60,
      user:        result.user,
    });
  };

  /**
   * @openapi
   * /auth/refresh:
   *   post:
   *     tags: [Authentication]
   *     summary: Refresh access token using httpOnly cookie
   *     responses:
   *       200:
   *         description: New access token issued
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RefreshResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  refresh = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    const result = await this.authService.refreshToken(refreshToken ?? '');
    res.cookie('refreshToken', result.newRefreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/api/v1/auth/refresh',
    });
    sendSuccess(res, {
      accessToken: result.accessToken,
      tokenType:   'Bearer' as const,
      expiresIn:   15 * 60,
    });
  };

  /**
   * @openapi
   * /auth/logout:
   *   post:
   *     tags: [Authentication]
   *     summary: Invalidate refresh token and clear session
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       204:
   *         description: Logged out successfully
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
    sendNoContent(res);
  };

  /**
   * @openapi
   * /auth/me:
   *   get:
   *     tags: [Authentication]
   *     summary: Get current authenticated user profile
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Current user profile
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthUserResponse'
   */
  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.getById(req.user!.sub);
    sendSuccess(res, user);
  };

  /**
   * @openapi
   * /auth/forgot-password:
   *   post:
   *     tags: [Authentication]
   *     summary: Request a password reset email
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ForgotPasswordRequest'
   *     responses:
   *       200:
   *         description: If email exists, a reset link has been sent
   */
  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as ForgotPasswordDto;
    await this.authService.forgotPassword(dto.email);
    // Always return 200 to avoid email enumeration
    sendSuccess(res, { message: 'If that email is registered, a reset link has been sent.' });
  };

  /**
   * @openapi
   * /auth/reset-password:
   *   post:
   *     tags: [Authentication]
   *     summary: Reset password using a valid reset token
   *     responses:
   *       200:
   *         description: Password reset successfully
   *       400:
   *         description: Invalid or expired reset token
   */
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body as { token: string; password: string };
    await this.authService.resetPassword(token, password);
    sendSuccess(res, { message: 'Password has been reset successfully.' });
  };

  /**
   * @openapi
   * /auth/change-password:
   *   post:
   *     tags: [Authentication]
   *     summary: Change password for authenticated user
   *     security:
   *       - bearerAuth: []
   */
  changePassword = async (req: Request, res: Response): Promise<void> => {
    const dto = req.body as ChangePasswordDto;
    await this.authService.changePassword(req.user!.sub, dto);
    sendNoContent(res);
  };
}
