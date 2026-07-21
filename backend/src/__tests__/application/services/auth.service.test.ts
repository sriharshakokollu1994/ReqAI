/**
 * Unit tests — AuthService
 *
 * All external dependencies are mocked:
 *  - UserRepository  → jest.fn() stubs per test
 *  - Redis client    → jest.fn() stubs per test
 *  - bcrypt          → real (low rounds via env.setup.ts BCRYPT_ROUNDS=4)
 *  - jsonwebtoken    → real
 *  - crypto          → real
 *
 * Tests cover:
 *  register, login, refreshToken, logout, getById,
 *  forgotPassword, resetPassword, changePassword
 */

import bcrypt from 'bcrypt';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from '../../../domain/errors/AppError';
import { AuthService } from '../../../application/services/auth.service';

// ── Minimal user fixture ─────────────────────────────────────────────────────

const NOW = new Date('2024-01-01T00:00:00Z');

function makeUser(overrides: Partial<ReturnType<typeof makeUser>> = {}): any {
  return {
    id:                'user-uuid-001',
    email:             'alice@example.com',
    passwordHash:      '', // will be set per test
    firstName:         'Alice',
    lastName:          'Doe',
    role:              'BUSINESS_ANALYST',
    isActive:          true,
    isEmailVerified:   false,
    lockedUntil:       null,
    failedLoginCount:  0,
    resetTokenExpires: null,
    avatarUrl:         null,
    jobTitle:          null,
    department:        null,
    createdAt:         NOW,
    updatedAt:         NOW,
    ...overrides,
  };
}

// ── Mock factory helpers ──────────────────────────────────────────────────────

function makeUserRepo(overrides: Partial<Record<string, jest.Mock>> = {}): any {
  return {
    findByEmail:          jest.fn(),
    findById:             jest.fn(),
    create:               jest.fn(),
    updateLoginAttempts:  jest.fn(),
    updateLastLogin:      jest.fn(),
    storeRefreshToken:    jest.fn(),
    revokeRefreshToken:   jest.fn(),
    setResetToken:        jest.fn(),
    findByResetToken:     jest.fn(),
    updatePassword:       jest.fn(),
    ...overrides,
  };
}

function makeRedis(overrides: Partial<Record<string, jest.Mock>> = {}): any {
  return {
    setEx: jest.fn(),
    get:   jest.fn(),
    del:   jest.fn(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let userRepo: ReturnType<typeof makeUserRepo>;
  let redis:    ReturnType<typeof makeRedis>;
  let service:  AuthService;

  beforeEach(() => {
    userRepo = makeUserRepo();
    redis    = makeRedis();
    service  = new AuthService(userRepo, redis);
  });

  // ── register ───────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('creates a new user and returns AuthUserDto', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      const user = makeUser({ email: 'alice@example.com' });
      userRepo.create.mockResolvedValue(user);

      const result = await service.register({
        email:     'alice@example.com',
        password:  'Password123!',
        firstName: 'Alice',
        lastName:  'Doe',
      });

      expect(userRepo.findByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@example.com', role: 'BUSINESS_ANALYST' }),
      );
      expect(result.email).toBe('alice@example.com');
      expect(result.id).toBe('user-uuid-001');
    });

    it('hashes the password before storing it', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockImplementation(async (data: any) => makeUser({ passwordHash: data.passwordHash }));

      await service.register({
        email:     'alice@example.com',
        password:  'Password123!',
        firstName: 'Alice',
        lastName:  'Doe',
      });

      const [createCallArg] = userRepo.create.mock.calls[0];
      const isHashed = await bcrypt.compare('Password123!', createCallArg.passwordHash);
      expect(isHashed).toBe(true);
    });

    it('throws ConflictError when email is already registered', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register({
          email:     'alice@example.com',
          password:  'Password123!',
          firstName: 'Alice',
          lastName:  'Doe',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    let passwordHash: string;

    beforeEach(async () => {
      passwordHash = await bcrypt.hash('Password123!', 4);
    });

    it('returns access token, refresh token, and user DTO on success', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash }));
      userRepo.updateLoginAttempts.mockResolvedValue(undefined);
      userRepo.updateLastLogin.mockResolvedValue(undefined);
      userRepo.storeRefreshToken.mockResolvedValue(undefined);
      redis.setEx.mockResolvedValue('OK');

      const result = await service.login(
        { email: 'alice@example.com', password: 'Password123!' },
        '127.0.0.1',
        'jest-test-agent',
      );

      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.user.email).toBe('alice@example.com');
    });

    it('throws UnauthorizedError for unknown email', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'unknown@example.com', password: 'x' }, '', ''),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for inactive account', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser({ isActive: false, passwordHash }));
      await expect(
        service.login({ email: 'alice@example.com', password: 'Password123!' }, '', ''),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for wrong password', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash }));
      userRepo.updateLoginAttempts.mockResolvedValue(undefined);
      await expect(
        service.login({ email: 'alice@example.com', password: 'WrongPass!' }, '', ''),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('increments failed login count on wrong password', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash, failedLoginCount: 2 }));
      userRepo.updateLoginAttempts.mockResolvedValue(undefined);

      await expect(
        service.login({ email: 'alice@example.com', password: 'WrongPass!' }, '', ''),
      ).rejects.toThrow(UnauthorizedError);

      expect(userRepo.updateLoginAttempts).toHaveBeenCalledWith('user-uuid-001', 3, null);
    });

    it('sets lockedUntil when failed count reaches threshold (5)', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash, failedLoginCount: 4 }));
      userRepo.updateLoginAttempts.mockResolvedValue(undefined);

      await expect(
        service.login({ email: 'alice@example.com', password: 'WrongPass!' }, '', ''),
      ).rejects.toThrow(UnauthorizedError);

      const [, , lockedUntil] = userRepo.updateLoginAttempts.mock.calls[0];
      expect(lockedUntil).toBeInstanceOf(Date);
      expect((lockedUntil as Date).getTime()).toBeGreaterThan(Date.now());
    });

    it('throws UnauthorizedError for locked account', async () => {
      const futureDate = new Date(Date.now() + 900_000); // 15 min in future
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash, lockedUntil: futureDate }));
      await expect(
        service.login({ email: 'alice@example.com', password: 'Password123!' }, '', ''),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('resets failedLoginCount to 0 on successful login', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash, failedLoginCount: 3 }));
      userRepo.updateLoginAttempts.mockResolvedValue(undefined);
      userRepo.updateLastLogin.mockResolvedValue(undefined);
      userRepo.storeRefreshToken.mockResolvedValue(undefined);
      redis.setEx.mockResolvedValue('OK');

      await service.login(
        { email: 'alice@example.com', password: 'Password123!' },
        '127.0.0.1',
        'agent',
      );

      expect(userRepo.updateLoginAttempts).toHaveBeenCalledWith('user-uuid-001', 0, null);
    });

    it('stores refresh token hash in Redis with 7-day TTL', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser({ passwordHash }));
      userRepo.updateLoginAttempts.mockResolvedValue(undefined);
      userRepo.updateLastLogin.mockResolvedValue(undefined);
      userRepo.storeRefreshToken.mockResolvedValue(undefined);
      redis.setEx.mockResolvedValue('OK');

      await service.login(
        { email: 'alice@example.com', password: 'Password123!' },
        '127.0.0.1',
        'agent',
      );

      const [redisKey, ttl] = redis.setEx.mock.calls[0];
      expect(redisKey).toMatch(/^refresh:/);
      expect(ttl).toBe(7 * 24 * 60 * 60); // 604800 seconds
    });
  });

  // ── refreshToken ───────────────────────────────────────────────────────────

  describe('refreshToken()', () => {
    it('issues a new access + refresh token pair', async () => {
      const userId = 'user-uuid-001';
      redis.get.mockResolvedValue(userId);
      userRepo.findById.mockResolvedValue(makeUser({ id: userId }));
      redis.del.mockResolvedValue(1);
      userRepo.revokeRefreshToken.mockResolvedValue(undefined);
      userRepo.storeRefreshToken.mockResolvedValue(undefined);
      redis.setEx.mockResolvedValue('OK');

      const result = await service.refreshToken('raw-refresh-token-value');

      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.newRefreshToken).toBe('string');
      expect(result.newRefreshToken).not.toBe('raw-refresh-token-value');
    });

    it('throws UnauthorizedError when token is not in Redis', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.refreshToken('stale-token')).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when user is inactive', async () => {
      redis.get.mockResolvedValue('user-uuid-001');
      userRepo.findById.mockResolvedValue(makeUser({ isActive: false }));
      await expect(service.refreshToken('valid-token')).rejects.toThrow(UnauthorizedError);
    });

    it('revokes the old token from Redis on rotation', async () => {
      redis.get.mockResolvedValue('user-uuid-001');
      userRepo.findById.mockResolvedValue(makeUser());
      redis.del.mockResolvedValue(1);
      userRepo.revokeRefreshToken.mockResolvedValue(undefined);
      userRepo.storeRefreshToken.mockResolvedValue(undefined);
      redis.setEx.mockResolvedValue('OK');

      await service.refreshToken('some-token');

      expect(redis.del).toHaveBeenCalledTimes(1);
      expect(userRepo.revokeRefreshToken).toHaveBeenCalledWith(
        expect.any(String), // hash of 'some-token'
        'rotation',
      );
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('deletes token from Redis and marks it revoked in DB', async () => {
      redis.del.mockResolvedValue(1);
      userRepo.revokeRefreshToken.mockResolvedValue(undefined);

      await service.logout('raw-token');

      expect(redis.del).toHaveBeenCalledTimes(1);
      expect(userRepo.revokeRefreshToken).toHaveBeenCalledWith(
        expect.any(String),
        'logout',
      );
    });
  });

  // ── getById ────────────────────────────────────────────────────────────────

  describe('getById()', () => {
    it('returns AuthUserDto for existing user', async () => {
      userRepo.findById.mockResolvedValue(makeUser());
      const result = await service.getById('user-uuid-001');
      expect(result.id).toBe('user-uuid-001');
      expect(result.email).toBe('alice@example.com');
    });

    it('throws NotFoundError for unknown user id', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────────────────

  describe('forgotPassword()', () => {
    it('sets a reset token for an existing user', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser());
      userRepo.setResetToken.mockResolvedValue(undefined);

      await service.forgotPassword('alice@example.com');

      expect(userRepo.setResetToken).toHaveBeenCalledWith(
        'user-uuid-001',
        expect.any(String), // hash
        expect.any(Date),
      );
    });

    it('silently succeeds for unknown email (no enumeration)', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      await expect(service.forgotPassword('ghost@example.com')).resolves.toBeUndefined();
      expect(userRepo.setResetToken).not.toHaveBeenCalled();
    });
  });

  // ── resetPassword ──────────────────────────────────────────────────────────

  describe('resetPassword()', () => {
    it('updates password when token is valid and not expired', async () => {
      const futureExpiry = new Date(Date.now() + 3_600_000);
      userRepo.findByResetToken.mockResolvedValue(
        makeUser({ resetTokenExpires: futureExpiry }),
      );
      userRepo.updatePassword.mockResolvedValue(undefined);

      await service.resetPassword('valid-token', 'NewPassword123!');

      expect(userRepo.updatePassword).toHaveBeenCalledWith('user-uuid-001', expect.any(String));
    });

    it('throws BadRequestError when token is expired', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      userRepo.findByResetToken.mockResolvedValue(
        makeUser({ resetTokenExpires: pastExpiry }),
      );

      await expect(service.resetPassword('expired-token', 'NewPassword!')).rejects.toThrow(
        BadRequestError,
      );
    });

    it('throws BadRequestError when token is not found', async () => {
      userRepo.findByResetToken.mockResolvedValue(null);
      await expect(service.resetPassword('bad-token', 'NewPassword!')).rejects.toThrow(
        BadRequestError,
      );
    });
  });

  // ── changePassword ─────────────────────────────────────────────────────────

  describe('changePassword()', () => {
    it('updates password when current password is correct', async () => {
      const passwordHash = await bcrypt.hash('CurrentPass!', 4);
      userRepo.findById.mockResolvedValue(makeUser({ passwordHash }));
      userRepo.updatePassword.mockResolvedValue(undefined);

      await service.changePassword('user-uuid-001', {
        currentPassword: 'CurrentPass!',
        newPassword:     'NewPass123!',
      });

      expect(userRepo.updatePassword).toHaveBeenCalledWith(
        'user-uuid-001',
        expect.any(String),
      );
    });

    it('throws UnauthorizedError when current password is wrong', async () => {
      const passwordHash = await bcrypt.hash('CurrentPass!', 4);
      userRepo.findById.mockResolvedValue(makeUser({ passwordHash }));

      await expect(
        service.changePassword('user-uuid-001', {
          currentPassword: 'WrongCurrent!',
          newPassword:     'NewPass123!',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws NotFoundError for unknown user', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(
        service.changePassword('ghost-id', {
          currentPassword: 'x',
          newPassword:     'y',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
