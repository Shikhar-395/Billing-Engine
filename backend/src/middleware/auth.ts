import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { MembershipRole } from '@prisma/client';
import { auth } from '../auth.js';
import { getPrisma } from '../config/prisma.js';
import { TenantContext } from '../types/index.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

function normalizeRole(role: MembershipRole): TenantContext['role'] {
  switch (role) {
    case 'OWNER':
      return 'owner';
    case 'ADMIN':
      return 'admin';
    case 'MEMBER':
      return 'member';
    case 'VIEWER':
      return 'viewer';
    default:
      return 'viewer';
  }
}

async function readSession(req: Request) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    return null;
  }

  return {
    session: {
      id: session.session.id,
      expiresAt: session.session.expiresAt,
    },
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      emailVerified: session.user.emailVerified,
    },
  };
}

export async function authenticateSession(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await readSession(req);

    if (!session) {
      return next(new UnauthorizedError('Authentication required'));
    }

    req.auth = session;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired session'));
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await readSession(req);

    if (!session) {
      return next(new UnauthorizedError('Authentication required'));
    }

    req.auth = session;

    const requestedTenantId =
      typeof req.headers['x-tenant-id'] === 'string'
        ? req.headers['x-tenant-id']
        : undefined;

    const memberships = await getPrisma().tenantMembership.findMany({
      where: { userId: req.auth.user.id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (memberships.length === 0) {
      return next(
        new ForbiddenError(
          'Complete onboarding before accessing billing data'
        )
      );
    }

    const activeMembership = requestedTenantId
      ? memberships.find(
          (membership) => membership.tenantId === requestedTenantId
        )
      : memberships[0];

    if (!activeMembership) {
      return next(
        new ForbiddenError('You do not have access to this tenant')
      );
    }

    req.tenant = {
      userId: req.auth.user.id,
      email: req.auth.user.email,
      tenantId: activeMembership.tenantId,
      role: normalizeRole(activeMembership.role),
    };

    next();
  } catch {
    next(new UnauthorizedError('Authentication required'));
  }
}

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
