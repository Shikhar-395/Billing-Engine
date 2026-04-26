import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { customSession } from 'better-auth/plugins';
import { getPrisma } from './config/prisma.js';
import { env } from './config/env.js';
import { sendAppEmail } from './services/email/mailer.js';

export const auth = betterAuth({
  appName: 'BillFlow',
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    env.BETTER_AUTH_URL,
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4000',
    'http://localhost:4000',
  ],
  database: prismaAdapter(getPrisma(), {
    provider: 'postgresql',
    transaction: true,
  }),
  user: {
    modelName: 'User',
  },
  session: {
    modelName: 'Session',
  },
  account: {
    modelName: 'Account',
  },
  verification: {
    modelName: 'Verification',
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendAppEmail({
        type: 'VERIFICATION',
        recipient: user.email,
        userId: user.id,
        subject: 'Verify your BillFlow email address',
        textBody: [
          `Verify the email address for ${user.email}.`,
          '',
          `Open: ${url}`,
        ].join('\n'),
        actionUrl: url,
        metadata: {
          userId: user.id,
        },
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      await sendAppEmail({
        type: 'PASSWORD_RESET',
        recipient: user.email,
        userId: user.id,
        subject: 'Reset your BillFlow password',
        textBody: [
          `A password reset was requested for ${user.email}.`,
          '',
          `Open: ${url}`,
        ].join('\n'),
        actionUrl: url,
        metadata: {
          userId: user.id,
        },
      });
    },
  },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            prompt: 'select_account',
          },
        }
      : undefined,
  plugins: [
    customSession(async ({ session, user }) => {
      const memberships = await getPrisma().tenantMembership.findMany({
        where: { userId: user.id },
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

      return {
        session,
        user,
        memberships,
        currentTenantId: memberships[0]?.tenantId ?? null,
        onboardingComplete: memberships.length > 0,
      };
    }),
  ],
});
