import { Request, Response, NextFunction } from 'express';
import type { ParsedQs } from 'qs';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Generic Zod validation middleware factory.
 *
 * Usage:
 *   router.post('/plans', validate(createPlanSchema), handler)
 *
 * Validates req.body against the provided Zod schema.
 * On failure, throws a ValidationError with structured field errors.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed; // Replace with parsed + coerced values
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors = err.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        }));
        next(new ValidationError('Validation failed', fieldErrors));
      } else {
        next(err);
      }
    }
  };
}

/**
 * Validates query parameters.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed as ParsedQs;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors = err.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        }));
        next(new ValidationError('Query validation failed', fieldErrors));
      } else {
        next(err);
      }
    }
  };
}
