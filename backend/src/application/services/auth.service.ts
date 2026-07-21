import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { RedisClientType } from '../../infrastructure/cache/redis';
import {
  RegisterDto, LoginDto, AuthUserDto,
  LoginResponseDto, ChangePasswordDto,
} from '../dtos/auth.dto';
import {
  ConflictError, UnauthorizedError, NotFoundError,
  BadRequestError,
} from '../../domain/errors/AppError';
import { JwtPayload } from '../../api/middlewares/authenticate.middleware';
import { getEmailService } from '../../infrastructure/notifications/email.service';

const REFRESH_PREFIX = 'refresh:';
const LOCK_THRESHOLD = 5;

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly redis: RedisClientType,
  ) {}

  async register(dto: RegisterDto): Promise<AuthUserDto> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, env.BCRYPT_ROUNDS);
    const user = await this.userRepo.create({
      email:      dto.email,
      passwordHash,
      firstName:  dto.firstName,
      lastName:   dto.lastName,
      jobTitle:   dto.jobTitle,
      department: dto.department,
      role:       'BUSINESS_ANALYST',
    });
    return this.toDto(user);
  }

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUserDto;
  }> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user || !user.isActive) throw new UnauthorizedError('Invalid email or password');

    // Account lock check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError('Account is temporarily locked. Please try again later.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash ?? '');
    if (!valid) {
      const newCount = user.failedLoginCount + 1;
      const lockedUntil = newCount >= LOCK_THRESHOLD
        ? new Date(Date.now() + 15 * 60 * 1000) // 15-min lockout
        : null;
      await this.userRepo.updateLoginAttempts(user.id, newCount, lockedUntil);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Reset on success
    await this.userRepo.updateLoginAttempts(user.id, 0, null);
    await this.userRepo.updateLastLogin(user.id);

    const accessToken  = this.signAccessToken(user.id, user.role);
    const refreshToken = crypto.randomUUID();
    const tokenHash    = this.hashToken(refreshToken);

    await this.userRepo.storeRefreshToken({ userId: user.id, tokenHash, ip, userAgent });
    const ttl = 7 * 24 * 60 * 60; // 7 days in seconds
    await this.redis.setEx(`${REFRESH_PREFIX}${tokenHash}`, ttl, user.id);

    return { accessToken, refreshToken, user: this.toDto(user) };
  }

  async refreshToken(rawToken: string): Promise<{
    accessToken: string;
    newRefreshToken: string;
  }> {
    if (!rawToken) throw new UnauthorizedError('Refresh token missing');
    const tokenHash = this.hashToken(rawToken);

    const userId = await this.redis.get(`${REFRESH_PREFIX}${tokenHash}`);
    if (!userId) throw new UnauthorizedError('Invalid or expired refresh token');

    const user = await this.userRepo.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedError('User account is inactive');

    // Rotate: revoke old, issue new
    await this.redis.del(`${REFRESH_PREFIX}${tokenHash}`);
    await this.userRepo.revokeRefreshToken(tokenHash, 'rotation');

    const newRefreshToken = crypto.randomUUID();
    const newTokenHash    = this.hashToken(newRefreshToken);
    await this.userRepo.storeRefreshToken({ userId: user.id, tokenHash: newTokenHash });
    await this.redis.setEx(`${REFRESH_PREFIX}${newTokenHash}`, 7 * 24 * 60 * 60, user.id);

    return {
      accessToken:    this.signAccessToken(user.id, user.role),
      newRefreshToken,
    };
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.redis.del(`${REFRESH_PREFIX}${tokenHash}`);
    await this.userRepo.revokeRefreshToken(tokenHash, 'logout');
  }

  async getById(userId: string): Promise<AuthUserDto> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    return this.toDto(user);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return; // Silently succeed — no email enumeration

    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expires   = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.userRepo.setResetToken(user.id, tokenHash, expires);

    // Send password reset email (fire-and-forget — non-fatal)
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
    getEmailService().sendPasswordReset({
      firstName:        user.firstName,
      email:            user.email,
      resetToken:       rawToken,
      resetUrl,
      expiresInMinutes: 60,
    }).catch((err) => {
      // Log but don't surface — the token is stored regardless
      logger.error('AuthService: failed to send password reset email', { error: err?.message });
    });
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const user = await this.userRepo.findByResetToken(tokenHash);
    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      throw new BadRequestError('Reset token is invalid or has expired');
    }
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await this.userRepo.updatePassword(user.id, passwordHash);

    // Notify user their password was changed (fire-and-forget)
    getEmailService().sendPasswordChanged({
      firstName:  user.firstName,
      email:      user.email,
      loginUrl:   `${env.FRONTEND_URL}/login`,
      changedAt:  new Date(),
    }).catch(() => { /* non-fatal */ });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash ?? '');
    if (!valid) throw new UnauthorizedError('Current password is incorrect');
    const passwordHash = await bcrypt.hash(dto.newPassword, env.BCRYPT_ROUNDS);
    await this.userRepo.updatePassword(userId, passwordHash);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private signAccessToken(userId: string, role: string): string {
    return jwt.sign({ sub: userId, role } as Partial<JwtPayload>,
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any },
    );
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private toDto(user: any): AuthUserDto {
    return {
      id:              user.id,
      email:           user.email,
      firstName:       user.firstName,
      lastName:        user.lastName,
      role:            user.role,
      isEmailVerified: user.isEmailVerified,
      avatarUrl:       user.avatarUrl ?? undefined,
      jobTitle:        user.jobTitle  ?? undefined,
      department:      user.department ?? undefined,
      createdAt:       user.createdAt.toISOString(),
    };
  }
}
