import type { AuthUser } from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient, ApiClientError } from './api';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

interface AuthSessionResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthUser>;
  login(input: LoginInput): Promise<AuthUser>;
  logout(): Promise<void>;
  refresh(): Promise<AuthUser>;
  me(): Promise<AuthUser>;
}

export function createAuthService(client: ApiClient, tenantSlug: string): AuthService {
  return {
    async register(input) {
      const session = await client.post<AuthSessionResponse>('/api/v1/auth/register', input);
      return session.user;
    },
    async login(input) {
      const session = await client.post<AuthSessionResponse>('/api/v1/auth/login', input, {
        'X-Tenant-Slug': tenantSlug,
      });
      return session.user;
    },
    async logout() {
      await client.post<void>('/api/v1/auth/logout', {});
    },
    async refresh() {
      const session = await client.post<AuthSessionResponse>('/api/v1/auth/refresh', {});
      return session.user;
    },
    async me() {
      try {
        return await client.get<AuthUser>('/api/v1/auth/me');
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.statusCode !== 401) {
          throw error;
        }
      }
      return this.refresh();
    },
  };
}

export const authService = createAuthService(new ApiClient(env.apiUrl), env.tenantSlug);
