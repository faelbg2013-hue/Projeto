import type { AuthUser } from '@ravion/types';
import type { Request } from 'express';

export const ACCESS_COOKIE = 'ravion_access';
export const REFRESH_COOKIE = 'ravion_refresh';
export const TENANT_SLUG_HEADER = 'x-tenant-slug';

export type RequestWithUser = Request & {
  cookies?: Record<string, string | undefined>;
  user?: AuthUser;
};

export function readAccessToken(request: RequestWithUser): string | undefined {
  const header = request.header('authorization');
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token.length > 0) {
      return token;
    }
  }
  const cookie = request.cookies?.[ACCESS_COOKIE];
  return cookie && cookie.length > 0 ? cookie : undefined;
}

export function readRefreshToken(
  request: RequestWithUser,
  bodyToken: string | undefined,
): string | undefined {
  if (bodyToken && bodyToken.length > 0) {
    return bodyToken;
  }
  const cookie = request.cookies?.[REFRESH_COOKIE];
  return cookie && cookie.length > 0 ? cookie : undefined;
}
