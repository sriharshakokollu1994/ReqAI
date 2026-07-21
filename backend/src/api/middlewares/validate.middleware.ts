import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../domain/errors/AppError';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Zod validation middleware.
 *
 * Parses `req[target]` against `schema`.
 * On success, replaces the raw value with the parsed + coerced value.
 * On failure, forwards a `ValidationError` (HTTP 422) with structured field-level details.
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = (result.error as ZodError).errors.map((e) => ({
        field:   e.path.join('.') || target,
        message: e.message,
      }));
      return next(new ValidationError('Request validation failed', details));
    }
    // Replace raw value with coerced/defaulted output from Zod
    (req as any)[target] = result.data;
    next();
  };
}
