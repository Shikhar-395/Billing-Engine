import { createAuthClient } from 'better-auth/react';
import { customSessionClient } from 'better-auth/client/plugins';
import { useQuery } from '@tanstack/react-query';

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

export interface AuthProviders {
  google: boolean;
}

export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [customSessionClient()],
});

export function useAuthSession() {
  const result = authClient.useSession();

  return {
    ...result,
    data: (result.data ?? null) as AuthSessionData | null,
  };
}

export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth-providers'],
    queryFn: async (): Promise<AuthProviders> => {
      const response = await fetch('/api/v1/auth/providers', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Unable to load auth providers.');
      }

      const payload = (await response.json()) as {
        data?: AuthProviders;
      };

      return payload.data ?? { google: false };
    },
    staleTime: 60000,
  });
}
