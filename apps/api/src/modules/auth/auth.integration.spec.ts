import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createIntegrationPrisma } from '../../config/integration-database';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';

const password = 'senha-segura-123';

describe('authentication and tenant isolation', () => {
  const prisma = createIntegrationPrisma();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = {
    id: randomUUID(),
    name: 'Contexto A',
    slug: `fase2-a-${suffix}`,
  };
  const tenantB = {
    id: randomUUID(),
    name: 'Contexto B',
    slug: `fase2-b-${suffix}`,
  };
  const tenantInactive = {
    id: randomUUID(),
    name: 'Contexto inativo',
    slug: `fase2-off-${suffix}`,
  };
  const sharedEmail = `ana.${suffix}@example.com`;
  const adminEmail = `admin.${suffix}@example.com`;
  const professionalEmail = `pro.${suffix}@example.com`;
  const inactiveEmail = `inativo.${suffix}@example.com`;
  const tenantIds = [tenantA.id, tenantB.id, tenantInactive.id];

  let app: INestApplication;
  let adminToken = '';
  let victimId = '';
  let disposableId = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
        { ...tenantInactive, isActive: false },
      ],
    });
    const users = await Promise.all([
      prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Admin A',
          email: adminEmail,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Profissional A',
          email: professionalEmail,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Inativo A',
          email: inactiveEmail,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: false,
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Descartável A',
          email: `descartavel.${suffix}@example.com`,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantB.id,
          name: 'Ana B',
          email: sharedEmail,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantInactive.id,
          name: 'Usuário inativo',
          email: `off.${suffix}@example.com`,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
      }),
    ]);
    victimId = users[4]?.id ?? '';
    disposableId = users[3]?.id ?? '';
    process.env.AUTH_LOGIN_LIMIT = '100';
    process.env.AUTH_REGISTER_LIMIT = '20';
    process.env.AUTH_REFRESH_LIMIT = '100';
    process.env.DEFAULT_PUBLIC_TENANT_ID = tenantA.id;
    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: adminEmail, password });
    if (adminLogin.status !== 200) {
      throw new Error(`Admin login failed with ${adminLogin.status}`);
    }
    adminToken = adminLogin.body.accessToken as string;
    if (process.env.DEFAULT_PUBLIC_TENANT_ID !== tenantA.id) {
      throw new Error('Public tenant id was not applied before the app booted');
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma.userSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.pointsTransaction.deleteMany({
      where: { tenantId: { in: tenantIds }, reversalOfTransactionId: { not: null } },
    });
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalScheduleException.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalTimeBlock.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalSchedule.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professional.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.client.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.service.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('creates a tenant and a user inside it', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Ana Costa', email: `novo.${suffix}@example.com`, password })
      .expect(201);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantA.id } });
    expect(tenant?.slug).toBe(tenantA.slug);
    expect(response.body.user).toMatchObject({
      tenantId: tenantA.id,
      email: `novo.${suffix}@example.com`,
      role: UserRole.CLIENT,
      isActive: true,
    });
    expect(response.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const profile = await prisma.client.findUnique({
      where: { userId: response.body.user.id as string },
    });
    expect(profile).toMatchObject({ tenantId: tenantA.id, isActive: true });
    const cookies = response.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join(';') : String(cookies ?? '');
    expect(cookieHeader).toContain('ravion_access');
    expect(cookieHeader).toContain('HttpOnly');
  });

  it('rejects a public registration that tries to choose role or tenant', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Intruso',
        email: `intruso.${suffix}@example.com`,
        password,
        role: UserRole.ADMIN,
        tenantId: tenantB.id,
      })
      .expect(400);
  });

  it('rejects a duplicate email inside the same tenant', async () => {
    const email = `dup.${suffix}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Primeira', email, password })
      .expect(201);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Segunda', email, password })
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Não foi possível concluir o cadastro.',
    });
  });

  it('allows the same email in another tenant and logs each user into the right context', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Ana A', email: sharedEmail, password })
      .expect(201);

    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: sharedEmail, password })
      .expect(200);
    const loginB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantB.slug)
      .send({ email: sharedEmail, password })
      .expect(200);

    expect(loginA.body.user.tenantId).toBe(tenantA.id);
    expect(loginB.body.user.tenantId).toBe(tenantB.id);
    expect(loginA.body.user.id).not.toBe(loginB.body.user.id);
  });

  it('does not reveal whether an email exists when the password or the tenant is wrong', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: adminEmail, password: 'senha-errada-123' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: `ausente.${suffix}@example.com`, password })
      .expect(401);
    const missingSlug = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(401);

    for (const response of [wrongPassword, unknownEmail, missingSlug]) {
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Credenciais inválidas',
        error: 'Unauthorized',
      });
    }
  });

  it('rejects an inactive user and an inactive tenant with the same credentials error', async () => {
    const inactiveUser = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: inactiveEmail, password })
      .expect(401);
    const inactiveTenant = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantInactive.slug)
      .send({ email: `off.${suffix}@example.com`, password })
      .expect(401);

    expect(inactiveUser.body.message).toBe('Credenciais inválidas');
    expect(inactiveTenant.body.message).toBe('Credenciais inválidas');
  });

  it('returns the authenticated user and rotates the refresh session', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: professionalEmail, password })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(me.body).toEqual({
      id: login.body.user.id,
      tenantId: tenantA.id,
      name: 'Profissional A',
      email: professionalEmail,
      role: UserRole.PROFESSIONAL,
      isActive: true,
    });

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);
  });

  it('keeps the session in an HttpOnly cookie for the PWA', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: adminEmail, password })
      .expect(200);

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.email).toBe(adminEmail);

    await agent.post('/api/v1/auth/logout').send({}).expect(204);
    await agent.post('/api/v1/auth/refresh').send({}).expect(401);
  });

  it('protects routes with AuthGuard and RoleGuard', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    const client = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: sharedEmail, password })
      .expect(200);
    const professional = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: professionalEmail, password })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${client.body.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${professional.body.accessToken}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.every((user: { tenantId: string }) => user.tenantId === tenantA.id)).toBe(
      true,
    );
    expect(list.body.some((user: { id: string }) => user.id === victimId)).toBe(false);
  });

  it('denies reading, updating, and deleting a user from another tenant', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: victimId } });

    await request(app.getHttpServer())
      .get(`/api/v1/users/${victimId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${victimId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Invadido' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/users/${victimId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: victimId } });
    expect(after.name).toBe(before.name);
    expect(after.tenantId).toBe(tenantB.id);

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${disposableId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/v1/users/${disposableId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
