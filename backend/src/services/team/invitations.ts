import { MembershipRole, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { getPrisma } from '../../config/prisma.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import { sendAppEmail } from '../email/mailer.js';

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function invitationUrl(token: string) {
  return `${env.BETTER_AUTH_URL}/accept-invitation?token=${token}`;
}

export async function createInvitation(input: {
  tenantId: string;
  invitedByUserId: string;
  email: string;
  role: MembershipRole;
}) {
  const prisma = getPrisma();
  const email = normalizeEmail(input.email);

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    throw new NotFoundError('Tenant', input.tenantId);
  }

  const invitedUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (invitedUser) {
    const existingMembership = await prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: input.tenantId,
          userId: invitedUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictError('That user is already a member of this workspace');
    }
  }

  await prisma.tenantInvitation.updateMany({
    where: {
      tenantId: input.tenantId,
      email,
      status: 'PENDING',
    },
    data: {
      status: 'CANCELLED',
    },
  });

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const invitation = await prisma.tenantInvitation.create({
    data: {
      tenantId: input.tenantId,
      invitedByUserId: input.invitedByUserId,
      email,
      role: input.role,
      token,
      expiresAt,
    },
    include: {
      inviter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  const url = invitationUrl(token);
  await sendAppEmail({
    type: 'INVITATION',
    recipient: email,
    tenantId: input.tenantId,
    subject: `Join ${tenant.name} on BillFlow`,
    textBody: [
      `${invitation.inviter.name} invited you to join ${tenant.name} on BillFlow.`,
      '',
      `Role: ${input.role}`,
      `Accept invitation: ${url}`,
    ].join('\n'),
    actionUrl: url,
    metadata: {
      invitationId: invitation.id,
      tenantName: tenant.name,
      role: input.role,
    },
  });

  return invitation;
}

export async function getInvitationByToken(token: string) {
  const prisma = getPrisma();
  const invitation = await prisma.tenantInvitation.findUnique({
    where: { token },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      inviter: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation');
  }

  if (invitation.status === 'PENDING' && invitation.expiresAt < new Date()) {
    await prisma.tenantInvitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    });
    return {
      ...invitation,
      status: 'EXPIRED' as const,
    };
  }

  return invitation;
}

export async function acceptInvitation(input: {
  token: string;
  userId: string;
  userEmail: string;
}) {
  const prisma = getPrisma();
  const email = normalizeEmail(input.userEmail);

  const invitation = await getInvitationByToken(input.token);

  if (invitation.status !== 'PENDING') {
    throw new ConflictError(`Invitation is ${invitation.status.toLowerCase()}`);
  }

  if (normalizeEmail(invitation.email) !== email) {
    throw new ForbiddenError(
      'This invitation was sent to a different email address'
    );
  }

  return prisma.$transaction(async (tx) => {
    const existingMembership = await tx.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: invitation.tenantId,
          userId: input.userId,
        },
      },
    });

    if (!existingMembership) {
      await tx.tenantMembership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: input.userId,
          role: invitation.role,
        },
      });
    }

    const acceptedInvitation = await tx.tenantInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedByUserId: input.userId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return acceptedInvitation;
  });
}

export async function cancelInvitation(input: {
  tenantId: string;
  invitationId: string;
}) {
  const prisma = getPrisma();
  const invitation = await prisma.tenantInvitation.findFirst({
    where: {
      id: input.invitationId,
      tenantId: input.tenantId,
    },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation', input.invitationId);
  }

  if (invitation.status !== 'PENDING') {
    throw new ConflictError('Only pending invitations can be cancelled');
  }

  return prisma.tenantInvitation.update({
    where: { id: invitation.id },
    data: {
      status: 'CANCELLED',
    },
  });
}

export async function listInvitations(tenantId: string) {
  const prisma = getPrisma();
  const now = new Date();

  await prisma.tenantInvitation.updateMany({
    where: {
      tenantId,
      status: 'PENDING',
      expiresAt: { lt: now },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return prisma.tenantInvitation.findMany({
    where: { tenantId },
    include: {
      inviter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      acceptedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listMembers(tenantId: string) {
  const prisma = getPrisma();

  return prisma.tenantMembership.findMany({
    where: { tenantId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          createdAt: true,
        },
      },
    },
    orderBy: [
      { role: 'asc' },
      { createdAt: 'asc' },
    ],
  });
}

export async function updateMemberRole(input: {
  tenantId: string;
  membershipId: string;
  role: MembershipRole;
}) {
  const prisma = getPrisma();

  const membership = await prisma.tenantMembership.findFirst({
    where: {
      id: input.membershipId,
      tenantId: input.tenantId,
    },
  });

  if (!membership) {
    throw new NotFoundError('Membership', input.membershipId);
  }

  if (membership.role === 'OWNER' && input.role !== 'OWNER') {
    const ownerCount = await prisma.tenantMembership.count({
      where: {
        tenantId: input.tenantId,
        role: 'OWNER',
      },
    });

    if (ownerCount <= 1) {
      throw new ValidationError(
        'This workspace must keep at least one owner'
      );
    }
  }

  return prisma.tenantMembership.update({
    where: { id: membership.id },
    data: { role: input.role },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function removeMember(input: {
  tenantId: string;
  membershipId: string;
  currentUserId: string;
}) {
  const prisma = getPrisma();

  const membership = await prisma.tenantMembership.findFirst({
    where: {
      id: input.membershipId,
      tenantId: input.tenantId,
    },
  });

  if (!membership) {
    throw new NotFoundError('Membership', input.membershipId);
  }

  if (membership.role === 'OWNER') {
    const ownerCount = await prisma.tenantMembership.count({
      where: {
        tenantId: input.tenantId,
        role: 'OWNER',
      },
    });

    if (ownerCount <= 1) {
      throw new ValidationError(
        'This workspace must keep at least one owner'
      );
    }
  }

  await prisma.tenantMembership.delete({
    where: { id: membership.id },
  });

  return {
    deleted: true,
    membershipId: membership.id,
    removedSelf: membership.userId === input.currentUserId,
  };
}
