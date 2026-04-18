import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { TenantContext } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

/**
 * JWT authentication middleware.
 * Extracts tenant context from the JWT and attaches it to req.tenant.
 *
 * In development mode, if no Authorization header is present, allows
 * a X-Tenant-Id header for testing convenience.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // Dev-mode bypass: allow X-Tenant-Id header for testing
  if (!authHeader && env.NODE_ENV === 'development') {
    const devTenantId = req.headers['x-tenant-id'] as string;
    if (devTenantId) {
      req.tenant = { tenantId: devTenantId, role: 'admin' };
      return next();
    }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      tenantId: string;
      role: 'admin' | 'member' | 'viewer';
    };

    req.tenant = {
      tenantId: decoded.tenantId,
      role: decoded.role,
    };

    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

/**
 * Role guard factory. Use after `authenticate` middleware.
 *
 * Usage: router.post('/plans', authenticate, requireRole('admin'), handler)
 */
export function requireRole(...roles: TenantContext['role'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.tenant.role)) {
      return next(new ForbiddenError(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}
