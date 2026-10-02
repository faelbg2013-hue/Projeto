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

  it('saves business hours for the authenticated tenant and reads them back', async () => {
    const hours = week({ sunday: closedDay() });
    const saved = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: { business_hours: hours } });

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ settings: { business_hours: hours } });

    const read = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ settings: { business_hours: hours } });

    const stored = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: tenantA.id, key: 'business_hours' } },
    });
    expect(stored?.tenantId).toBe(tenantA.id);
    expect(JSON.parse(stored?.value ?? 'null')).toEqual(hours);
  });

  it('keeps business hours inside the authenticated tenant', async () => {
    const hoursB = week({ saturday: { enabled: true, open: '07:15', close: '11:45' } });
    const savedB = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ settings: { business_hours: hoursB } });
    expect(savedB.status).toBe(200);

    const readA = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`);
    const readB = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${adminBToken}`);
    expect(readA.body.settings.business_hours.saturday.close).toBe('12:00');
    expect(readA.body.settings.business_hours.sunday).toEqual(closedDay());
    expect(readB.body.settings.business_hours.saturday.close).toBe('11:45');
    expect(readB.body.settings.business_hours.sunday.open).toBe('09:00');
    expect(JSON.stringify(readA.body)).not.toContain('11:45');
    expect(JSON.stringify(readB.body)).not.toContain('12:00');

    const attack = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ tenantId: tenantB.id, settings: { business_hours: hoursB } });
    expect(attack.status).toBe(400);
    const storedB = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: tenantB.id, key: 'business_hours' } },
    });
    expect(JSON.parse(storedB?.value ?? 'null')).toEqual(hoursB);
  });

  it('rejects an unknown day, an invalid time, a reversed interval, an open day without time and a partial week', async () => {
    const before = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: tenantA.id, key: 'business_hours' } },
    });

    const unknownDay = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: { business_hours: { ...week(), holiday: closedDay() } } });
    const invalidTime = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: { business_hours: week({ monday: { enabled: true, open: '25:00', close: '18:00' } }) } });
    const reversed = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: { business_hours: week({ monday: { enabled: true, open: '18:00', close: '08:00' } }) } });
    const equal = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: { business_hours: week({ monday: { enabled: true, open: '10:00', close: '10:00' } }) } });
    const openWithoutTime = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: { business_hours: week({ monday: { enabled: true, open: null, close: null } }) } });
    const { sunday: _sunday, ...partial } = week();
    const incomplete = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ settings: { business_hours: partial } });

    expect(unknownDay.status).toBe(400);
    expect(invalidTime.status).toBe(400);
    expect(reversed.status).toBe(400);
    expect(equal.status).toBe(400);
    expect(openWithoutTime.status).toBe(400);
    expect(incomplete.status).toBe(400);

    const after = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId: tenantA.id, key: 'business_hours' } },
    });
    expect(after?.value).toBe(before?.value);
  });
});

function closedDay() {
  return { enabled: false, open: null, close: null };
}

function week(overrides: Record<string, { enabled: boolean; open: string | null; close: string | null }> = {}) {
  const open = { enabled: true, open: '08:00', close: '18:00' };
  return {
    monday: { ...open },
    tuesday: { ...open },
    wednesday: { ...open },
    thursday: { ...open },
    friday: { ...open },
    saturday: { enabled: true, open: '08:00', close: '12:00' },
    sunday: { enabled: true, open: '09:00', close: '13:00' },
    ...overrides,
  };
}

async function login(app: INestApplication, slug: string, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Tenant-Slug', slug)
    .send({ email, password });
  expect(response.status).toBe(200);
  return response.body.accessToken as string;
}
