import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { UserRole, type AuthUser } from '@ravion/types';
import { describe, expect, it, vi } from 'vitest';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthGuard } from './auth.guard';
import type { RequestWithUser } from './request-auth';
import { RolesGuard } from './roles.guard';

const actor: AuthUser = {
  id: 'user-a',
  tenantId: 'tenant-a',
  name: 'Ana Costa',
  email: 'ana@example.com',
  role: UserRole.CLIENT,
  isActive: true,
};

function asRequest(request: {
  header?: (name: string) => string | undefined;
  user?: AuthUser;
}): RequestWithUser {
  return request as unknown as RequestWithUser;
}

function contextFor(request: RequestWithUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('AuthGuard', () => {
  it('allows a public route without a token', async () => {
    const reflector = { getAllAndOverride: vi.fn(() => true) } as unknown as Reflector;
    const guard = new AuthGuard(reflector, {} as JwtService, {} as PrismaService);

    await expect(
      guard.canActivate(contextFor(asRequest({ header: () => undefined }))),
    ).resolves.toBe(true);
  });

  it('rejects a protected route without a bearer token or cookie', async () => {
    const reflector = { getAllAndOverride: vi.fn(() => false) } as unknown as Reflector;
    const guard = new AuthGuard(reflector, {} as JwtService, {} as PrismaService);

    await expect(
      guard.canActivate(contextFor(asRequest({ header: () => undefined }))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('loads the user from the database and ignores a mismatched tenant', async () => {
    const request = asRequest({ header: () => 'Bearer access-token' });
    const reflector = { getAllAndOverride: vi.fn(() => false) } as unknown as Reflector;
    const jwtService = {
      verifyAsync: vi.fn(async () => ({
        sub: actor.id,
        tenantId: 'tenant-b',
        role: UserRole.ADMIN,
      })),
    } as unknown as JwtService;
    const prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          ...actor,
          passwordHash: 'hash',
          tenant: { isActive: true },
        })),
      },
    } as unknown as PrismaService;
    const guard = new AuthGuard(reflector, jwtService, prisma);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('uses the role stored for the user, including an inactive tenant', async () => {
    const request = asRequest({ header: () => 'Bearer access-token' });
    const reflector = { getAllAndOverride: vi.fn(() => false) } as unknown as Reflector;
    const jwtService = {
      verifyAsync: vi.fn(async () => ({
        sub: actor.id,
        tenantId: actor.tenantId,
        role: UserRole.CLIENT,
      })),
    } as unknown as JwtService;
    const prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          ...actor,
          role: UserRole.ADMIN,
          passwordHash: 'hash',
          tenant: { isActive: false },
        })),
      },
    } as unknown as PrismaService;
    const guard = new AuthGuard(reflector, jwtService, prisma);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });

  it('attaches the database user when the token and the tenant are valid', async () => {
    const request = asRequest({ header: () => 'Bearer access-token' });
    const reflector = { getAllAndOverride: vi.fn(() => false) } as unknown as Reflector;
    const jwtService = {
      verifyAsync: vi.fn(async () => ({
        sub: actor.id,
        tenantId: actor.tenantId,
        role: UserRole.CLIENT,
      })),
    } as unknown as JwtService;
    const prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          ...actor,
          role: UserRole.PROFESSIONAL,
          passwordHash: 'secret-hash',
          tenant: { isActive: true },
        })),
      },
    } as unknown as PrismaService;
    const guard = new AuthGuard(reflector, jwtService, prisma);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ ...actor, role: UserRole.PROFESSIONAL });
    expect(request.user).not.toHaveProperty('passwordHash');
  });
});

describe('RoleGuard', () => {
  it('allows a route that does not declare roles', () => {
    const reflector = { getAllAndOverride: vi.fn(() => undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor(asRequest({ header: () => undefined })))).toBe(true);
  });

  it('denies a client on an admin route', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => [UserRole.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request = asRequest({ header: () => undefined, user: actor });

    expect(() => guard.canActivate(contextFor(request))).toThrow(ForbiddenException);
  });

  it('allows the declared role', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => [UserRole.ADMIN, UserRole.PROFESSIONAL]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request = asRequest({
      header: () => undefined,
      user: { ...actor, role: UserRole.PROFESSIONAL },
    });

    expect(guard.canActivate(contextFor(request))).toBe(true);
  });
});
