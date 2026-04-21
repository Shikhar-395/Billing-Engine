import { Request, Response, NextFunction } from 'express';
import { AppError, RateLimitError, ValidationError } from '../utils/errors.js';
import type { ApiResponse } from '../types/index.js';

/**
 * Global error handler.
 * Converts AppError instances to structured JSON responses.
 * Unknown errors return a generic 500 response.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log all errors in dev, only non-operational in prod
  if (process.env.NODE_ENV === 'development' || !(err instanceof AppError)) {
    console.error('❌ Error:', err);
  }

  if (err instanceof RateLimitError) {
    res.set('Retry-After', String(err.retryAfter));
  }

  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err instanceof ValidationError ? err.details : undefined,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Prisma known error handling
  if ((err as any).code === 'P2002') {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A record with this value already exists',
        details: (err as any).meta?.target,
      },
    };
    res.status(409).json(response);
    return;
  }

  if ((err as any).code === 'P2025') {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Record not found',
      },
    };
    res.status(404).json(response);
    return;
  }

  // Generic fallback
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
    },
  };
  res.status(500).json(response);
}
