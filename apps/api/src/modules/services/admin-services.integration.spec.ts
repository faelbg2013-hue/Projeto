import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createIntegrationPrisma } from '../../config/integration-database';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';

const password = 'senha-segura-123';

describe('admin service catalog', () => {
  const prisma = createIntegrationPrisma();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Servicos A', slug: `fase125-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Servicos B', slug: `fase125-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];
  const adminEmail = `admin.svc.${suffix}@example.com`;
  const clientEmail = `cliente.svc.${suffix}@example.com`;
  const professionalEmail = `pro.svc.${suffix}@example.com`;
  const corte = `Corte masculino ${suffix}`;
  const inactiveName = `Inativo ${suffix}`;
  const foreignName = `Externo ${suffix}`;
  const twinName = `Gemeos ${suffix}`;

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let inactiveId = '';
  let foreignId = '';
  let clientId = '';
  let professionalId = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
      ],
    });
    const admin = await prisma.user.create({
      data: user(tenantA.id, 'Admin Servicos', adminEmail, passwordHash, UserRole.ADMIN),
    });
    const clientUser = await prisma.user.create({
      data: user(tenantA.id, 'Ana Servicos', clientEmail, passwordHash, UserRole.CLIENT),
    });
    const professionalUser = await prisma.user.create({
      data: user(tenantA.id, 'Carlos Servicos', professionalEmail, passwordHash, UserRole.PROFESSIONAL),
    });
    const client = await prisma.client.create({ data: { tenantId: tenantA.id, userId: clientUser.id, isActive: true } });
    const professional = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: professionalUser.id, displayName: 'Carlos', isActive: true },
    });
    clientId = client.id;
    professionalId = professional.id;
    void admin;

    await prisma.service.create({
      data: { tenantId: tenantA.id, name: `AAA ${suffix}`, price: '10.00', durationMinutes: 30, points: 1, isActive: true },
    });
    await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: corte,
        description: 'Descricao fora da busca',
        price: '45.00',
        durationMinutes: 45,
        points: 10,
        redemptionPoints: 80,
        isActive: true,
      },
    });
    await prisma.service.create({
      data: { tenantId: tenantA.id, name: twinName, price: '12.00', durationMinutes: 60, points: 2, isActive: true },
    });
    await prisma.service.create({
      data: { tenantId: tenantA.id, name: twinName, price: '13.00', durationMinutes: 90, points: 3, isActive: true },
    });
    await prisma.service.createMany({
      data: Array.from({ length: 21 }, (_, index) => ({
        tenantId: tenantA.id,
        name: `Paginado ${suffix} ${String(index).padStart(2, '0')}`,
        price: '20.00',
        durationMinutes: 20,
        points: 1,
        isActive: true,
      })),
    });
    const inactive = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: inactiveName,
        price: '15.00',
        durationMinutes: 15,
        points: 0,
        isActive: false,
      },
    });
    const foreign = await prisma.service.create({
      data: {
        tenantId: tenantB.id,
        name: foreignName,
        price: '20.00',
        durationMinutes: 20,
        points: 2,
        isActive: true,
      },
    });
    await prisma.service.create({
      data: { tenantId: tenantA.id, name: `ZZZ ${suffix}`, price: '99.00', durationMinutes: 30, points: 4, isActive: true },
    });
    inactiveId = inactive.id;
    foreignId = foreign.id;

    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
    adminToken = await login(app, tenantA.slug, adminEmail);
    clientToken = await login(app, tenantA.slug, clientEmail);
    professionalToken = await login(app, tenantA.slug, professionalEmail);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professional.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.client.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.service.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.userSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('lets an admin list the tenant and keeps the operational catalog for the other roles', async () => {
    const admin = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ pageSize: 100 })
      .set(auth(adminToken))
      .expect(200);
    const names = admin.body.data.map((item: { name: string }) => item.name);
    expect(names).toContain(corte);
    expect(names).toContain(inactiveName);
    expect(names).not.toContain(foreignName);
    expect(admin.body.data.every((item: { tenantId: string }) => item.tenantId === tenantA.id)).toBe(true);
    expect(admin.body.meta).toMatchObject({ page: 1, pageSize: 100 });

    for (const token of [clientToken, professionalToken]) {
      const list = await request(app.getHttpServer())
        .get('/api/v1/services')
        .query({ isActive: false, search: inactiveName, pageSize: 100 })
        .set(auth(token))
        .expect(200);
      expect(list.body.data.every((item: { isActive: boolean }) => item.isActive)).toBe(true);
      expect(list.body.data.map((item: { name: string }) => item.name)).not.toContain(inactiveName);
      expect(list.body.data.map((item: { name: string }) => item.name)).not.toContain(foreignName);
      expect(list.body.data.length).toBeGreaterThan(1);
      await request(app.getHttpServer()).post('/api/v1/services').set(auth(token)).send(validBody('Barba')).expect(403);
      await request(app.getHttpServer())
        .patch(`/api/v1/services/${inactiveId}`)
        .set(auth(token))
        .send({ name: 'Invadido' })
        .expect(403);
      await request(app.getHttpServer()).delete(`/api/v1/services/${inactiveId}`).set(auth(token)).expect(403);
    }

    await request(app.getHttpServer()).get('/api/v1/services').expect(401);
    await request(app.getHttpServer()).post('/api/v1/services').send(validBody('Anonimo')).expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ tenantId: tenantB.id })
      .set(auth(adminToken))
      .expect(400);
  });

  it('searches by a partial name and ignores a blank search', async () => {
    const partial = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ search: 'mascul' })
      .set(auth(adminToken))
      .expect(200);
    expect(partial.body.data.map((item: { name: string }) => item.name)).toEqual([corte]);

    const folded = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ search: `  corte masculino ${suffix}  ` })
      .set(auth(adminToken))
      .expect(200);
    expect(folded.body.data).toHaveLength(1);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ search: `zzz-sem-resultado-${suffix}` })
      .set(auth(adminToken))
      .expect(200);
    expect(empty.body.data).toEqual([]);
    expect(empty.body.meta).toMatchObject({ total: 0, pageCount: 0 });

    const foreign = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ search: foreignName })
      .set(auth(adminToken))
      .expect(200);
    expect(foreign.body.data).toEqual([]);

    const blank = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ search: '   ' })
      .set(auth(adminToken))
      .expect(200);
    expect(blank.body.meta.total).toBeGreaterThan(1);
  });

  it('filters active and inactive services', async () => {
    const active = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ isActive: true, pageSize: 100 })
      .set(auth(adminToken))
      .expect(200);
    expect(active.body.data.every((item: { isActive: boolean }) => item.isActive)).toBe(true);
    expect(active.body.data.map((item: { name: string }) => item.name)).not.toContain(inactiveName);

    const inactive = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ isActive: false, pageSize: 100 })
      .set(auth(adminToken))
      .expect(200);
    expect(inactive.body.data.every((item: { isActive: boolean }) => !item.isActive)).toBe(true);
    expect(inactive.body.data.map((item: { name: string }) => item.name)).toContain(inactiveName);
  });

  it('paginates with a default page size and a stable name order', async () => {
    const defaults = await request(app.getHttpServer()).get('/api/v1/services').set(auth(adminToken)).expect(200);
    expect(defaults.body.meta).toMatchObject({ page: 1, pageSize: 20 });
    expect(defaults.body.data).toHaveLength(20);
    expect(defaults.body.meta.pageCount).toBeGreaterThan(1);

    const first = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ search: `Paginado ${suffix}`, pageSize: 20 })
      .set(auth(adminToken))
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ search: `Paginado ${suffix}`, page: 2, pageSize: 20 })
      .set(auth(adminToken))
      .expect(200);
    expect(first.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 21, pageCount: 2 });
    expect(second.body.data).toHaveLength(1);
    expect(second.body.data[0].name).toBe(`Paginado ${suffix} 20`);

    const wide = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ pageSize: 100 })
      .set(auth(adminToken))
      .expect(200);
    const ordered = wide.body.data.map((item: { name: string; id: string }) => `${item.name}:${item.id}`);
    const sorted = [...ordered].sort((left, right) => left.localeCompare(right));
    expect(ordered).toEqual(sorted);
    expect(wide.body.data[0].name).toBe(`AAA ${suffix}`);

    const twins = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ search: twinName })
      .set(auth(adminToken))
      .expect(200);
    expect(twins.body.data).toHaveLength(2);
    expect(twins.body.data[0].id < twins.body.data[1].id).toBe(true);

    await request(app.getHttpServer()).get('/api/v1/services').query({ page: 0 }).set(auth(adminToken)).expect(400);
    await request(app.getHttpServer()).get('/api/v1/services').query({ pageSize: 101 }).set(auth(adminToken)).expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ search: 'a'.repeat(81) })
      .set(auth(adminToken))
      .expect(400);
  });

  it('keeps the operational catalog newest first and does not apply the admin page size', async () => {
    const catalog = await request(app.getHttpServer())
      .get('/api/v1/services')
      .query({ pageSize: 100, isActive: true })
      .set(auth(clientToken))
      .expect(200);
    expect(catalog.body.data[0].name).toBe(`ZZZ ${suffix}`);
    expect(catalog.body.data.at(-1).name).toBe(`AAA ${suffix}`);
    expect(catalog.body.meta.pageSize).toBe(100);
    expect(catalog.body.data.every((item: { isActive: boolean }) => item.isActive)).toBe(true);
  });

  it('creates, edits, deactivates and reactivates without a physical delete', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ ...validBody(`Combo ${suffix}`), price: 10.5, redemptionPoints: 40 })
      .expect(201);
    expect(created.body).toMatchObject({
      name: `Combo ${suffix}`,
      price: '10.50',
      durationMinutes: 30,
      points: 5,
      redemptionPoints: 40,
      isActive: true,
      tenantId: tenantA.id,
    });

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/services/${created.body.id}`)
      .set(auth(adminToken))
      .send({ name: `Combo editado ${suffix}`, price: 11, points: 6, redemptionPoints: null })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: `Combo editado ${suffix}`,
      price: '11.00',
      points: 6,
      redemptionPoints: null,
    });

    const deactivated = await request(app.getHttpServer())
      .delete(`/api/v1/services/${created.body.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(deactivated.body.isActive).toBe(false);
    const stored = await prisma.service.findUnique({ where: { id: created.body.id as string } });
    expect(stored?.isActive).toBe(false);

    const visible = await request(app.getHttpServer())
      .get(`/api/v1/services/${created.body.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(visible.body.isActive).toBe(false);
    await request(app.getHttpServer()).get(`/api/v1/services/${created.body.id}`).set(auth(clientToken)).expect(404);

    const reactivated = await request(app.getHttpServer())
      .patch(`/api/v1/services/${created.body.id}`)
      .set(auth(adminToken))
      .send({ isActive: true })
      .expect(200);
    expect(reactivated.body.isActive).toBe(true);

    await request(app.getHttpServer()).get(`/api/v1/services/${foreignId}`).set(auth(adminToken)).expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/services/${foreignId}`)
      .set(auth(adminToken))
      .send({ name: 'Invadido' })
      .expect(404);
    await request(app.getHttpServer()).delete(`/api/v1/services/${foreignId}`).set(auth(adminToken)).expect(404);
    expect((await prisma.service.findUnique({ where: { id: foreignId } }))?.name).toBe(foreignName);
  });

  it('rejects numbers outside the current limits and accepts zero when it is already valid', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ ...validBody('Negativo'), price: -1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ ...validBody('Casas'), price: 10.555 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ ...validBody('Duracao'), durationMinutes: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ ...validBody('Duracao longa'), durationMinutes: 1441 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ ...validBody('Pontos'), points: -1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ ...validBody('Pontos altos'), points: 100001 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ ...validBody('Resgate'), redemptionPoints: 0 })
      .expect(400);

    const courtesy = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: `Cortesia ${suffix}`, price: 0, durationMinutes: 1, points: 0 })
      .expect(201);
    expect(courtesy.body).toMatchObject({ price: '0.00', points: 0, redemptionPoints: null });
  });

  it('keeps appointment snapshots when the service is edited', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ ...validBody(`Historico ${suffix}`), price: 45, durationMinutes: 30, points: 10, redemptionPoints: 50 })
      .expect(201);
    const startAt = new Date('2026-11-02T13:00:00.000Z');
    const appointment = await prisma.appointment.create({
      data: {
        tenantId: tenantA.id,
        clientId,
        professionalId,
        serviceId: created.body.id as string,
        startAt,
        endAt: new Date(startAt.getTime() + 30 * 60_000),
        serviceNameSnapshot: `Historico ${suffix}`,
        servicePriceSnapshot: '45.00',
        serviceDurationMinutesSnapshot: 30,
        pointsSnapshot: 10,
        redemptionPointsSnapshot: 50,
        bookingMode: 'POINTS',
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/services/${created.body.id}`)
      .set(auth(adminToken))
      .send({
        name: `Historico novo ${suffix}`,
        price: 70,
        durationMinutes: 90,
        points: 1,
        redemptionPoints: null,
      })
      .expect(200);

    const after = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(after.serviceNameSnapshot).toBe(`Historico ${suffix}`);
    expect(after.servicePriceSnapshot.toFixed(2)).toBe('45.00');
    expect(after.serviceDurationMinutesSnapshot).toBe(30);
    expect(after.pointsSnapshot).toBe(10);
    expect(after.redemptionPointsSnapshot).toBe(50);
    expect(after.updatedAt.toISOString()).toBe(appointment.updatedAt.toISOString());
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: appointment.id } })).toBe(0);

    const service = await prisma.service.findUniqueOrThrow({ where: { id: created.body.id as string } });
    expect(service.name).toBe(`Historico novo ${suffix}`);
    expect(service.price.toFixed(2)).toBe('70.00');
    expect(service.durationMinutes).toBe(90);
    expect(service.points).toBe(1);
    expect(service.redemptionPoints).toBeNull();
  });
});

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function login(app: INestApplication, slug: string, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Tenant-Slug', slug)
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

function user(tenantId: string, name: string, email: string, passwordHash: string, role: UserRole) {
  return { tenantId, name, email, passwordHash, role, isActive: true };
}

function validBody(name: string) {
  return { name, price: 30, durationMinutes: 30, points: 5 };
}
