import type { AuthUser } from '@ravion/types';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiClientError } from './api';
import { createAuthService } from './auth.service';

const user: AuthUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  name: 'Ana Costa',
  email: 'ana@example.com',
  role: 'CLIENT',
  isActive: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createAuthService', () => {
  it('returns only the user and does not persist tokens', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fetchFn: typeof fetch = vi.fn(async () => {
      return jsonResponse({
        user,
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
        expiresIn: 900,
      });
    });
    const service = createAuthService(new ApiClient('http://api.test', fetchFn), 'web');

    await expect(service.login({ email: user.email, password: 'senha-segura' })).resolves.toEqual(
      user,
    );
    expect(setItem).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/api/v1/auth/login',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-Tenant-Slug': 'web' }),
      }),
    );
    setItem.mockRestore();
  });

  it('does not send a tenant slug on public registration', async () => {
    const fetchFn: typeof fetch = vi.fn(async () => {
      return jsonResponse(
        { user, accessToken: 'access-secret', refreshToken: 'refresh-secret', expiresIn: 900 },
        201,
      );
    });
    const service = createAuthService(new ApiClient('http://api.test', fetchFn), 'web');

    await service.register({ name: user.name, email: user.email, password: 'senha-segura' });

    const init = vi.mocked(fetchFn).mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get('X-Tenant-Slug')).toBeNull();
  });

  it('renews the session when the access cookie is no longer accepted', async () => {
    const fetchFn: typeof fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ statusCode: 401, message: 'Não autenticado', error: 'Unauthorized' }, 401),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          user,
          accessToken: 'next-access',
          refreshToken: 'next-refresh',
          expiresIn: 900,
        }),
      );
    const service = createAuthService(new ApiClient('http://api.test', fetchFn), 'web');

    await expect(service.me()).resolves.toEqual(user);
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      'http://api.test/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('surfaces the API error message', async () => {
    const fetchFn: typeof fetch = vi.fn(async () => {
      return jsonResponse(
        { statusCode: 401, message: 'Credenciais inválidas', error: 'Unauthorized' },
        401,
      );
    });
    const service = createAuthService(new ApiClient('http://api.test', fetchFn), 'web');

    await expect(service.login({ email: user.email, password: 'errada' })).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });
});
