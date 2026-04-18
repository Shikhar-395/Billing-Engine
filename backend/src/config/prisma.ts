import { PrismaClient, Prisma } from '@prisma/client';

const AUDITED_MODELS = ['Subscription', 'Invoice', 'Plan', 'Tenant', 'Payment'];

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // ── Audit Log via Prisma Extension ──────────────────────
    // Intercepts update operations on sensitive models and captures
    // before/after JSON snapshots into the AuditLog table.
    // NOTE: We use $extends instead of deprecated $use middleware.
    const extendedPrisma = prisma.$extends({
      query: {
        $allModels: {
          async update({ model, args, query }: { model: string; args: any; query: any }) {
            if (!AUDITED_MODELS.includes(model)) {
              return query(args);
            }

            // Capture "before" snapshot
            let before: any = null;
            try {
              before = await (prisma as any)[lowercaseFirst(model)].findUnique({
                where: args.where,
              });
            } catch {
              // If we can't read before, just proceed
            }

            const result = await query(args);

            // Write audit log — fire-and-forget to avoid blocking the response
            if (before && prisma) {
              prisma.auditLog
                .create({
                  data: {
                    tenantId:
                      result.tenantId || before.tenantId || args.where?.tenantId || 'system',
                    action: `${model.toLowerCase()}.updated`,
                    entityType: model,
                    entityId: result.id || args.where?.id || 'unknown',
                    before: before as any,
                    after: result as any,
                  },
                })
                .catch((err: Error) => {
                  console.error('Failed to write audit log:', err.message);
                });
            }

            return result;
          },
        },
      },
    });

    // Replace prisma with extended version — cast back since extensions
    // return a compatible type
    prisma = extendedPrisma as unknown as PrismaClient;

    console.log('✅ Prisma client initialized with audit extension');
  }

  return prisma;
}

export async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    console.log('🔌 Prisma disconnected');
  }
}

function lowercaseFirst(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}
