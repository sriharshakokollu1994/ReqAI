/**
 * Unit tests — AppError class hierarchy
 *
 * Verifies that every error subclass:
 *  - extends AppError
 *  - carries the correct HTTP status code
 *  - carries the correct error code string
 *  - sets isOperational = true
 *  - preserves the original message
 */

import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  BadRequestError,
  ServiceUnavailableError,
} from '../../../domain/errors/AppError';

describe('AppError', () => {
  it('creates an error with all properties set', () => {
    const err = new AppError('something went wrong', 500, 'INTERNAL', true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL');
    expect(err.isOperational).toBe(true);
  });

  it('defaults isOperational to true', () => {
    const err = new AppError('oops', 500, 'CODE');
    expect(err.isOperational).toBe(true);
  });

  it('can set isOperational to false (programmer error)', () => {
    const err = new AppError('fatal', 500, 'FATAL', false);
    expect(err.isOperational).toBe(false);
  });

  it('maintains correct prototype chain for instanceof checks', () => {
    const err = new AppError('test', 400, 'TEST');
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

describe('NotFoundError', () => {
  it('includes resource and id in message', () => {
    const err = new NotFoundError('User', 'abc-123');
    expect(err.message).toBe("User with id 'abc-123' not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.isOperational).toBe(true);
  });

  it('omits id from message when not provided', () => {
    const err = new NotFoundError('Analysis');
    expect(err.message).toBe('Analysis not found');
  });

  it('is an instance of AppError', () => {
    expect(new NotFoundError('X')).toBeInstanceOf(AppError);
  });
});

describe('UnauthorizedError', () => {
  it('has status 401 and UNAUTHORIZED code', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Authentication required');
  });

  it('accepts a custom message', () => {
    const err = new UnauthorizedError('Token expired');
    expect(err.message).toBe('Token expired');
  });
});

describe('ForbiddenError', () => {
  it('has status 403 and FORBIDDEN code', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Insufficient permissions');
  });
});

describe('ValidationError', () => {
  it('has status 422 and VALIDATION_ERROR code', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual([]);
  });

  it('carries structured validation details', () => {
    const details = [
      { field: 'email', message: 'Must be a valid email' },
      { field: 'password', message: 'Must be at least 8 characters' },
    ];
    const err = new ValidationError('Validation failed', details);
    expect(err.details).toHaveLength(2);
    expect(err.details[0].field).toBe('email');
    expect(err.details[1].field).toBe('password');
  });
});

describe('ConflictError', () => {
  it('has status 409 and CONFLICT code', () => {
    const err = new ConflictError('Email already registered');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Email already registered');
  });
});

describe('BadRequestError', () => {
  it('has status 400 and BAD_REQUEST code', () => {
    const err = new BadRequestError('Missing required field');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('Missing required field');
  });
});

describe('ServiceUnavailableError', () => {
  it('has status 503 and SERVICE_UNAVAILABLE code', () => {
    const err = new ServiceUnavailableError('AI provider is down');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('SERVICE_UNAVAILABLE');
    expect(err.message).toBe('AI provider is down');
  });
});
