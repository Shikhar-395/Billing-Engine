import { createAuthClient } from 'better-auth/react';
import { customSessionClient } from 'better-auth/client/plugins';

export interface SessionTenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  };
}

export interface AuthSessionData {
  session: {
    id: string;
    expiresAt: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    emailVerified: boolean;
  };
  memberships: SessionTenantMembership[];
  currentTenantId: string | null;
  onboardingComplete: boolean;
}

export const authClient = createAuthClient({
  plugins: [customSessionClient()],
});

export function useAuthSession() {
  const result = authClient.useSession();

  return {
    ...result,
    data: (result.data ?? null) as AuthSessionData | null,
  };
}
