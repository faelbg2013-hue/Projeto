import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';
import { addDays, parseScheduleInstant } from '../../common/time/schedule-clock';

const password = 'senha-segura-123';

describe('admin appointment query', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Consulta A', slug: `fase122-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Consulta B', slug: `fase122-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let clientSecondId = '';
  let professionalSecondId = '';
  let inactiveServiceId = '';
  let clientBId = '';
  let professionalBId = '';
  let serviceBId = '';
  let pointsId = '';
  let pendingId = '';
  let snapshotId = '';
  let foreignId = '';
  let actionId = '';
  let noShowId = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
      ],
    });
    const admin = await prisma.user.create({
      data: user(tenantA.id, 'Admin Consulta', `admin.consulta.${suffix}@example.com`, passwordHash, UserRole.ADMIN),
    });
    const clientUser = await prisma.user.create({
      data: user(tenantA.id, 'Ana Lista', `ana.lista.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const clientSecondUser = await prisma.user.create({
      data: user(tenantA.id, 'Bruno Lista', `bruno.lista.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const professionalUser = await prisma.user.create({
      data: user(tenantA.id, 'Carlos Lista', `carlos.lista.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const professionalSecondUser = await prisma.user.create({
      data: user(tenantA.id, 'Eduardo Lista', `eduardo.lista.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const clientBUser = await prisma.user.create({
      data: user(tenantB.id, 'Diego Lista', `diego.lista.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const professionalBUser = await prisma.user.create({
      data: user(tenantB.id, 'Diego Pro', `diego.pro.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const clientA = await prisma.client.create({ data: { tenantId: tenantA.id, userId: clientUser.id, isActive: true } });
    const clientSecond = await prisma.client.create({
      data: { tenantId: tenantA.id, userId: clientSecondUser.id, isActive: false },
    });
    const professionalA = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: professionalUser.id, displayName: 'Carlos', isActive: true },
    });
    const professionalSecond = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: professionalSecondUser.id, displayName: 'Eduardo', isActive: false },
    });
    const clientB = await prisma.client.create({ data: { tenantId: tenantB.id, userId: clientBUser.id, isActive: true } });
    const professionalB = await prisma.professional.create({
      data: { tenantId: tenantB.id, userId: professionalBUser.id, displayName: 'Diego', isActive: true },
    });
    const serviceA = await prisma.service.create({
      data: { tenantId: tenantA.id, name: 'Corte', price: '45.00', durationMinutes: 30, points: 10, isActive: true },
    });
    const inactiveService = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Nome atual',
        price: '45.00',
        durationMinutes: 30,
        points: 10,
        isActive: false,
      },
    });
    const serviceB = await prisma.service.create({
      data: { tenantId: tenantB.id, name: 'Corte B', price: '45.00', durationMinutes: 30, points: 10, isActive: true },
    });
    clientSecondId = clientSecond.id;
    professionalSecondId = professionalSecond.id;
    inactiveServiceId = inactiveService.id;
    clientBId = clientB.id;
    professionalBId = professionalB.id;
    serviceBId = serviceB.id;

    const rows = await Promise.all([
      createAppointment(prisma, row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-04T10:00:00-03:00')),
      createAppointment(prisma, row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-05T09:00:00-03:00')),
      createAppointment(prisma, row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-06T23:30:00-03:00')),
      createAppointment(prisma, {
        ...row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-07T00:30:00-03:00'),
        bookingMode: 'POINTS',
        redemptionPointsSnapshot: 20,
      }),
      createAppointment(prisma, row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-08T11:00:00-03:00')),
      createAppointment(prisma, {
        ...row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-06T15:00:00-03:00'),
        status: 'PENDING',
      }),
      createAppointment(prisma, {
        ...row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-06T16:00:00-03:00'),
        status: 'COMPLETED',
      }),
      createAppointment(prisma, {
        ...row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-06T17:00:00-03:00'),
        status: 'CANCELLED',
      }),
      createAppointment(prisma, {
        ...row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-06T18:00:00-03:00'),
        status: 'NO_SHOW',
      }),
      createAppointment(prisma, row(tenantA.id, clientA.id, professionalSecond.id, serviceA.id, '2026-10-06T19:00:00-03:00')),
      createAppointment(prisma, row(tenantA.id, clientSecond.id, professionalA.id, serviceA.id, '2026-10-06T19:30:00-03:00')),
      createAppointment(prisma, {
        ...row(tenantA.id, clientA.id, professionalA.id, inactiveService.id, '2026-10-06T20:00:00-03:00'),
        serviceNameSnapshot: 'Nome antigo',
      }),
      createAppointment(prisma, row(tenantB.id, clientB.id, professionalB.id, serviceB.id, '2026-10-06T23:00:00-03:00')),
      createAppointment(prisma, row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-11-02T10:00:00-03:00')),
      createAppointment(prisma, {
        ...row(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-11-02T11:00:00-03:00'),
        bookingMode: 'POINTS',
        redemptionPointsSnapshot: 20,
      }),
    ]);
    pointsId = rows[3].id;
    pendingId = rows[5].id;
    snapshotId = rows[11].id;
    foreignId = rows[12].id;
    actionId = rows[13].id;
    noShowId = rows[14].id;
    await prisma.appointment.createMany({
      data: Array.from({ length: 21 }, (_, index) => {
        const minutes = 8 * 60 + index * 30;
        const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
        const minute = String(minutes % 60).padStart(2, '0');
        return row(
          tenantA.id,
          clientA.id,
          professionalA.id,
          serviceA.id,
          `2026-09-01T${hour}:${minute}:00-03:00`,
        );
      }),
    });

    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
    adminToken = await login(app, tenantA.slug, admin.email);
    clientToken = await login(app, tenantA.slug, clientUser.email);
    professionalToken = await login(app, tenantA.slug, professionalUser.email);
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

  it('lets an admin read the tenant and rejects the other roles', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-05', endDate: '2026-10-07', pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 50 });
    expect(response.body.data.every((item: { tenantId: string }) => item.tenantId === tenantA.id)).toBe(true);
    expect(response.body.data.map((item: { id: string }) => item.id)).not.toContain(foreignId);

    await request(app.getHttpServer()).get('/api/v1/appointments').set(auth(clientToken)).expect(403);
    await request(app.getHttpServer()).get('/api/v1/appointments').set(auth(professionalToken)).expect(403);
    await request(app.getHttpServer()).get('/api/v1/appointments').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ tenantId: tenantB.id })
      .set(auth(adminToken))
      .expect(400);
  });

  it('filters the civil period on startAt in America/Sao_Paulo', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-05', endDate: '2026-10-07', pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);
    const dates = response.body.data.map((item: { date: string }) => item.date);
    expect(dates).toContain('2026-10-05');
    expect(dates).toContain('2026-10-06');
    expect(dates).toContain('2026-10-07');
    expect(dates).not.toContain('2026-10-04');
    expect(dates).not.toContain('2026-10-08');
    expect(response.body.data.map((item: { time: string; date: string }) => `${item.date} ${item.time}`)).toContain(
      '2026-10-06 23:30',
    );
    expect(response.body.data.map((item: { time: string; date: string }) => `${item.date} ${item.time}`)).toContain(
      '2026-10-07 00:30',
    );

    const sixth = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ date: '2026-10-06', pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);
    const sixthTimes = sixth.body.data.map((item: { time: string }) => item.time);
    expect(sixthTimes).toContain('23:30');
    expect(sixthTimes).not.toContain('00:30');

    const early = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-04', endDate: '2026-10-04' })
      .set(auth(adminToken))
      .expect(200);
    expect(early.body.data.map((item: { date: string }) => item.date)).toEqual(['2026-10-04']);

    const late = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-08', endDate: '2026-10-08' })
      .set(auth(adminToken))
      .expect(200);
    expect(late.body.data.map((item: { date: string }) => item.date)).toEqual(['2026-10-08']);
  });

  it('rejects an invalid, reversed or oversized period', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-02-31', endDate: '2026-03-01' })
      .set(auth(adminToken))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-01', endDate: '2026-13-01' })
      .set(auth(adminToken))
      .expect(400);
    const reversed = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-07', endDate: '2026-10-01' })
      .set(auth(adminToken))
      .expect(400);
    expect(reversed.body.message).toBe('A data inicial não pode ser posterior à data final.');
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-01' })
      .set(auth(adminToken))
      .expect(400);
    const limit = addDays('2026-10-01', 90);
    const oversized = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-01', endDate: limit })
      .set(auth(adminToken))
      .expect(400);
    expect(oversized.body.message).toBe('O intervalo máximo da consulta é de 90 dias.');
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-01', endDate: addDays('2026-10-01', 89) })
      .set(auth(adminToken))
      .expect(200);
  });

  it('filters status, people, service and booking mode inside the tenant', async () => {
    const pending = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-05', endDate: '2026-10-07', status: 'PENDING', pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);
    expect(pending.body.data.map((item: { id: string }) => item.id)).toEqual([pendingId]);

    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ status: 'ARCHIVED' })
      .set(auth(adminToken))
      .expect(400);

    const byProfessional = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-06', endDate: '2026-10-06', professionalId: professionalSecondId, pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);
    expect(byProfessional.body.data).toHaveLength(1);
    expect(byProfessional.body.data[0].professionalName).toBe('Eduardo');
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ professionalId: professionalBId })
      .set(auth(adminToken))
      .expect(404);

    const byClient = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-06', endDate: '2026-10-06', clientId: clientSecondId, pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);
    expect(byClient.body.data).toHaveLength(1);
    expect(byClient.body.data[0].clientName).toBe('Bruno Lista');
    const byName = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-06', endDate: '2026-10-06', clientName: 'Bruno', pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);
    expect(byName.body.data.every((item: { clientName: string }) => item.clientName.includes('Bruno'))).toBe(true);
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ clientId: clientBId })
      .set(auth(adminToken))
      .expect(404);

    const byService = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ serviceId: inactiveServiceId, pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);
    expect(byService.body.data.map((item: { id: string }) => item.id)).toContain(snapshotId);
    expect(byService.body.data.find((item: { id: string }) => item.id === snapshotId).serviceName).toBe('Nome antigo');
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ serviceId: serviceBId })
      .set(auth(adminToken))
      .expect(404);

    const points = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-05', endDate: '2026-10-07', bookingMode: 'POINTS', pageSize: 50 })
      .set(auth(adminToken))
      .expect(200);
    expect(points.body.data.map((item: { id: string }) => item.id)).toEqual([pointsId]);
    expect(points.body.data[0]).toMatchObject({ bookingMode: 'POINTS', redemptionPointsSnapshot: 20 });
    const normal = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-10-07', endDate: '2026-10-07', bookingMode: 'NORMAL' })
      .set(auth(adminToken))
      .expect(200);
    expect(normal.body.data).toEqual([]);
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ bookingMode: 'CASH' })
      .set(auth(adminToken))
      .expect(400);
  });

  it('paginates and orders the newest start first', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-09-01', endDate: '2026-09-02' })
      .set(auth(adminToken))
      .expect(200);
    expect(first.body.data).toHaveLength(20);
    expect(first.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 21, pageCount: 2 });
    const times = first.body.data.map((item: { startAt: string }) => item.startAt);
    expect([...times].sort((left, right) => (left < right ? 1 : -1))).toEqual(times);

    const second = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-09-01', endDate: '2026-09-02', page: 2 })
      .set(auth(adminToken))
      .expect(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.meta.page).toBe(2);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ startDate: '2026-01-01', endDate: '2026-01-02', page: 4 })
      .set(auth(adminToken))
      .expect(200);
    expect(empty.body.data).toEqual([]);
    expect(empty.body.meta).toMatchObject({ page: 4, total: 0, pageCount: 0 });

    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ pageSize: 101 })
      .set(auth(adminToken))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ pageSize: 0 })
      .set(auth(adminToken))
      .expect(400);
  });

  it('keeps status transitions and blocks the other tenant', async () => {
    await request(app.getHttpServer()).patch(`/api/v1/appointments/${foreignId}/complete`).set(auth(adminToken)).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/appointments/${foreignId}/cancel`).set(auth(adminToken)).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/appointments/${foreignId}/no-show`).set(auth(adminToken)).expect(404);
    const untouched = await prisma.appointment.findUnique({ where: { id: foreignId } });
    expect(untouched?.status).toBe('CONFIRMED');

    const completed = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${actionId}/complete`)
      .set(auth(adminToken))
      .expect(200);
    expect(completed.body.status).toBe('COMPLETED');
    await request(app.getHttpServer()).patch(`/api/v1/appointments/${actionId}/complete`).set(auth(adminToken)).expect(409);
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: actionId, type: 'EARN' } })).toBe(1);

    const missed = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${noShowId}/no-show`)
      .set(auth(adminToken))
      .expect(200);
    expect(missed.body.status).toBe('NO_SHOW');
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: noShowId } })).toBe(0);
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

function row(
  tenantId: string,
  clientId: string,
  professionalId: string,
  serviceId: string,
  start: string,
): Prisma.AppointmentUncheckedCreateInput {
  const startAt = parseScheduleInstant(start);
  return {
    tenantId,
    clientId,
    professionalId,
    serviceId,
    startAt,
    endAt: new Date(startAt.getTime() + 30 * 60_000),
    serviceNameSnapshot: 'Corte',
    servicePriceSnapshot: '45.00',
    serviceDurationMinutesSnapshot: 30,
    pointsSnapshot: 10,
    bookingMode: 'NORMAL',
  };
}

function createAppointment(prisma: PrismaClient, data: Prisma.AppointmentUncheckedCreateInput) {
  return prisma.appointment.create({ data });
}
