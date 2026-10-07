import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';

const password = 'senha-segura-123';

describe('refresh session rotation', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenant = {
    id: randomUUID(),
    name: 'Contexto sessão',
    slug: `fase13-session-${suffix}`,
  };
  const email = `sessao.${suffix}@example.com`;

  let app: INestApplication;
  let userId = '';

  beforeAll(async () => {
    process.env.AUTH_LOGIN_LIMIT = '100';
    process.env.AUTH_REFRESH_LIMIT = '100';
    process.env.THROTTLE_LIMIT = '500';
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.create({ data: { ...tenant, isActive: true } });
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: 'Sessão',
        email,
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    userId = user.id;
    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.userSession.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
    await prisma.$disconnect();
  });

  async function login(): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenant.slug)
      .send({ email, password })
      .expect(200);

    expect(response.body.user.tenantId).toBe(tenant.id);
    expect(typeof response.body.accessToken).toBe('string');
    expect(typeof response.body.refreshToken).toBe('string');
    return {
      accessToken: response.body.accessToken as string,
      refreshToken: response.body.refreshToken as string,
    };
  }

  it('rotates a valid refresh and rejects the previous token', async () => {
    const current = await login();
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: current.refreshToken })
      .expect(200);

    expect(refreshed.body.user.tenantId).toBe(tenant.id);
    expect(refreshed.body.refreshToken).not.toBe(current.refreshToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: current.refreshToken })
      .expect(401);
    const next = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(200);

    expect(next.body.user.id).toBe(userId);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);
  });

  it('rejects an unknown, expired, or revoked refresh without opening another session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'a'.repeat(32) })
      .expect(401);

    const expired = await login();
    await prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: expired.refreshToken })
      .expect(401);

    const active = await login();
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: active.refreshToken })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: active.refreshToken })
      .expect(401);

    const openSessions = await prisma.userSession.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(openSessions).toBe(0);
  });

  it('keeps the access token usable after logout and ignores a tenant id in the body', async () => {
    const current = await login();
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: current.refreshToken })
      .expect(204);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(200);
    expect(me.body.tenantId).toBe(tenant.id);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: current.refreshToken, tenantId: randomUUID() })
      .expect(400);
  });

  it('lets exactly one of two concurrent refreshes win', async () => {
    const current = await login();
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: current.refreshToken }),
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: current.refreshToken }),
    ]);

    const statuses = [first.status, second.status].sort((left, right) => left - right);
    expect(statuses).toEqual([200, 401]);

    const openSessions = await prisma.userSession.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(openSessions).toBe(1);

    const winner = first.status === 200 ? first : second;
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: winner.body.refreshToken })
      .expect(200);
  });

  it('rolls back the rotation when the new session cannot be issued', async () => {
    const current = await login();
    const before = await prisma.userSession.count({
      where: { userId, revokedAt: null },
    });
    const jwt = app.get(JwtService);
    const spy = vi.spyOn(jwt, 'signAsync').mockImplementationOnce(async () => {
      throw new Error('forced signing failure');
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: current.refreshToken })
      .expect(500);

    spy.mockRestore();
    const after = await prisma.userSession.count({
      where: { userId, revokedAt: null },
    });
    expect(after).toBe(before);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: current.refreshToken })
      .expect(200);
  });

  it('omits bearer tokens from the JSON when the client asks for cookies', async () => {
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenant.slug)
      .send({ email, password, tokenDelivery: 'cookie' })
      .expect(200);

    expect(response.body.user.tenantId).toBe(tenant.id);
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();
    const cookies = response.headers['set-cookie'];
    const serialized = Array.isArray(cookies) ? cookies.join('\n') : '';
    expect(serialized).toContain('ravion_access');
    expect(serialized).toContain('HttpOnly');
    expect(serialized).toContain('ravion_refresh');

    await agent.get('/api/v1/auth/me').expect(200);
  });
});
