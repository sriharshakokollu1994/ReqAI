import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env }                         from '../../config/env';
import { UnauthorizedError, ForbiddenError } from '../../domain/errors/AppError';
import { UserRole, roleRank }          from '../../domain/types/UserRole';

// ─── JWT payload shape ────────────────────────────────────────────────────────

export interface JwtPayload {
  sub:  string;   // userId (UUID)
  role: string;   // UserRole value
  iat:  number;
  exp:  number;
}

// ─── Express augmentation ────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── authenticate — verify Bearer JWT ────────────────────────────────────────

/**
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches the decoded payload to `req.user`.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Access token expired'));
    }
    next(new UnauthorizedError('Invalid access token'));
  }
}

// ─── authorize — exact role membership check ─────────────────────────────────

/**
 * Middleware factory — allows only users with one of the specified roles.
 * Must be used AFTER authenticate.
 *
 * @example
 *   router.delete('/:id', authenticate, authorize('ADMIN'), controller.delete);
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (roles.length > 0 && !roles.includes(req.user.role as UserRole)) {
      return next(
        new ForbiddenError(`Role '${req.user.role}' is not permitted for this action`),
      );
    }
    next();
  };
}

// ─── requireMinRole — hierarchy-based role check ─────────────────────────────

/**
 * Middleware factory — allows users whose role rank is >= the required minimum.
 * ADMIN always passes; use this for "at least PROJECT_MANAGER" type rules.
 *
 * Role hierarchy (low → high):
 *   DEVELOPER < QA_ENGINEER < BUSINESS_ANALYST < ARCHITECT < PROJECT_MANAGER < ADMIN
 *
 * @example
 *   router.get('/', authenticate, requireMinRole('PROJECT_MANAGER'), controller.list);
 */
export function requireMinRole(minRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());

    if (roleRank(req.user.role) < roleRank(minRole)) {
      return next(
        new ForbiddenError(
          `This action requires at least the '${minRole}' role`,
        ),
      );
    }
    next();
  };
}

// ─── requireSelf — self-ownership check ──────────────────────────────────────

/**
 * Middleware — allows access only if `req.params.id` matches the requesting user's
 * own id. ADMINs bypass this check entirely.
 *
 * @example
 *   router.patch('/users/:id/profile', authenticate, requireSelf, controller.update);
 */
export function requireSelf(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(new UnauthorizedError());

  // ADMINs can access any resource
  if (req.user.role === 'ADMIN') return next();

  if (req.params.id !== req.user.sub) {
    return next(new ForbiddenError('You can only access your own resources'));
  }
  next();
}
