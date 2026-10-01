import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';

const password = 'senha-segura-123';

describe('tenant settings', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Config A', slug: `cfg-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Config B', slug: `cfg-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];
  const adminAEmail = `admin.a.${suffix}@example.com`;
  const adminBEmail = `admin.b.${suffix}@example.com`;
  const clientEmail = `client.${suffix}@example.com`;
  const professionalEmail = `pro.${suffix}@example.com`;

  let app: INestApplication;
  let adminAToken = '';
  let adminBToken = '';
  let clientToken = '';
  let professionalToken = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          tenantId: tenantA.id,
          name: 'Admin A',
          email: adminAEmail,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
        {
          tenantId: tenantB.id,
          name: 'Admin B',
          email: adminBEmail,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
        {
          tenantId: tenantA.id,
          name: 'Cliente A',
          email: clientEmail,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
        {
          tenantId: tenantA.id,
          name: 'Profissional A',
          email: professionalEmail,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      ],
    });
    process.env.DEFAULT_PUBLIC_TENANT_ID = tenantA.id;
    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
    adminAToken = await login(app, tenantA.slug, adminAEmail);
    adminBToken = await login(app, tenantB.slug, adminBEmail);
    clientToken = await login(app, tenantA.slug, clientEmail);
    professionalToken = await login(app, tenantA.slug, professionalEmail);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.tenantSetting.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.userSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('returns the authenticated tenant settings to an admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ settings: {} });
  });

  it('persists nothing for an empty patch and reads the same document back', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: {} });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ settings: {} });
    const stored = await prisma.tenantSetting.findMany({ where: { tenantId: tenantA.id } });
    expect(stored).toEqual([]);
  });

  it('rejects an arbitrary key and does not store it', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: { horario: '09:00' } });

    expect(response.status).toBe(400);
    expect(response.body.tenantId).toBeUndefined();
    const stored = await prisma.tenantSetting.findMany({ where: { tenantId: tenantA.id } });
    expect(stored).toEqual([]);
  });

  it('rejects a tenantId sent by the client', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ tenantId: tenantB.id, settings: {} });

    expect(response.status).toBe(400);
  });

  it('keeps each tenant value isolated and refuses a duplicate key', async () => {
    await prisma.tenantSetting.create({
      data: { tenantId: tenantA.id, key: 'probe', value: 'azul' },
    });
    await prisma.tenantSetting.create({
      data: { tenantId: tenantB.id, key: 'probe', value: 'vermelho' },
    });
    await expect(
      prisma.tenantSetting.create({
        data: { tenantId: tenantA.id, key: 'probe', value: 'outro' },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    const readA = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`);
    const readB = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminBToken}`);
    expect(readA.status).toBe(200);
    expect(readB.status).toBe(200);
    expect(readA.body).toEqual({ settings: {} });
    expect(readB.body).toEqual({ settings: {} });
    expect(JSON.stringify(readA.body)).not.toContain('vermelho');
    expect(JSON.stringify(readB.body)).not.toContain('azul');

    const attack = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: { probe: 'invadido' } });
    expect(attack.status).toBe(400);

    const storedA = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: tenantA.id, key: 'probe' } },
    });
    const storedB = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: tenantB.id, key: 'probe' } },
    });
    expect(storedA?.value).toBe('azul');
    expect(storedB?.value).toBe('vermelho');
  });

  it('denies client and professional administrative access', async () => {
    const clientRead = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${clientToken}`);
    const professionalRead = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${professionalToken}`);
    const clientWrite = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ settings: {} });
    const anonymous = await request(app.getHttpServer()).get('/api/v1/settings');

    expect(clientRead.status).toBe(403);
    expect(professionalRead.status).toBe(403);
    expect(clientWrite.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });
});

async function login(app: INestApplication, slug: string, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Tenant-Slug', slug)
    .send({ email, password });
  expect(response.status).toBe(200);
  return response.body.accessToken as string;
}
