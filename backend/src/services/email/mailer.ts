import type { DevEmailType, Prisma } from '@prisma/client';
import { getPrisma } from '../../config/prisma.js';

export interface AppEmailInput {
  type: DevEmailType;
  recipient: string;
  subject: string;
  textBody: string;
  actionUrl?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function sendAppEmail(input: AppEmailInput) {
  const prisma = getPrisma();

  return prisma.devEmail.create({
    data: {
      type: input.type,
      recipient: input.recipient,
      subject: input.subject,
      textBody: input.textBody,
      actionUrl: input.actionUrl,
      tenantId: input.tenantId,
      userId: input.userId,
      metadata: input.metadata,
    },
  });
}

export async function listDevEmailsVisibleToUser(input: {
  userId: string;
  userEmail: string;
  tenantId?: string;
  limit?: number;
}) {
  const prisma = getPrisma();

  return prisma.devEmail.findMany({
    where: {
      OR: [
        { userId: input.userId },
        { recipient: input.userEmail },
        ...(input.tenantId ? [{ tenantId: input.tenantId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit ?? 100,
  });
}
