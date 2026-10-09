import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createIntegrationPrisma } from '../../config/integration-database';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';
import {
  addDays,
  nextOrSameDate,
  parseScheduleInstant,
  todayInScheduleZone,
} from '../../common/time/schedule-clock';

const password = 'senha-segura-123';

function futureSlot(weekday: number, time: string): { date: string; time: string } {
  let date = nextOrSameDate(todayInScheduleZone(), weekday);
  if (parseScheduleInstant(`${date}T${time}:00`).getTime() <= Date.now()) {
    date = addDays(date, 7);
  }
  return { date, time };
}

describe('admin dashboard', () => {
  const prisma = createIntegrationPrisma();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Painel A', slug: `fase8-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Painel B', slug: `fase8-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let adminTokenB = '';
  let clientAId = '';
  let professionalAId = '';
  let professionalSecondId = '';
  let professionalBId = '';
  let serviceId = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
      ],
    });
    const users = {
      adminA: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Admin Painel',
          email: `admin.painel.${suffix}@example.com`,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      }),
      client: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Ana Painel',
          email: `cliente.painel.${suffix}@example.com`,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
      }),
      professional: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Carlos Painel',
          email: `pro.painel.${suffix}@example.com`,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
      professionalSecond: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Eduardo Painel',
          email: `pro2.painel.${suffix}@example.com`,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
      adminB: await prisma.user.create({
        data: {
          tenantId: tenantB.id,
          name: 'Admin B',
          email: `admin.b.painel.${suffix}@example.com`,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      }),
      professionalB: await prisma.user.create({
        data: {
          tenantId: tenantB.id,
          name: 'Diego',
          email: `pro.b.painel.${suffix}@example.com`,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
    };
    const clientA = await prisma.client.create({
      data: { tenantId: tenantA.id, userId: users.client.id, isActive: true },
    });
    const professionalA = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: users.professional.id, displayName: 'Carlos', isActive: true },
    });
    const professionalSecond = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: users.professionalSecond.id, displayName: 'Eduardo', isActive: true },
    });
    const professionalB = await prisma.professional.create({
      data: { tenantId: tenantB.id, userId: users.professionalB.id, displayName: 'Diego', isActive: true },
    });
    const service = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Corte',
        price: '45.00',
        durationMinutes: 30,
        points: 10,
        redemptionPoints: 50,
        isActive: true,
      },
    });
    clientAId = clientA.id;
    professionalAId = professionalA.id;
    professionalSecondId = professionalSecond.id;
    professionalBId = professionalB.id;
    serviceId = service.id;
    await prisma.professionalSchedule.createMany({
      data: [professionalA.id, professionalSecond.id].flatMap((professionalId) =>
        [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          tenantId: tenantA.id,
          professionalId,
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
          isActive: true,
        })),
      ),
    });
    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
    adminToken = await login(tenantA.slug, users.adminA.email);
    clientToken = await login(tenantA.slug, users.client.email);
    professionalToken = await login(tenantA.slug, users.professional.email);
    adminTokenB = await login(tenantB.slug, users.adminB.email);
  });

  beforeEach(async () => {
    await prisma.pointsTransaction.deleteMany({
      where: { tenantId: { in: tenantIds }, reversalOfTransactionId: { not: null } },
    });
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.service.update({
      where: { id: serviceId },
      data: { name: 'Corte', price: '45.00', points: 10, redemptionPoints: 50, isActive: true },
    });
  });

  afterAll(async () => {
    await app?.close();
    await prisma.pointsTransaction.deleteMany({
      where: { tenantId: { in: tenantIds }, reversalOfTransactionId: { not: null } },
    });
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalSchedule.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professional.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.client.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.service.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.userSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  async function login(slug: string, email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', slug)
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function book(
    professionalId: string,
    date: string,
    time: string,
    bookingMode: 'NORMAL' | 'POINTS',
  ): Promise<{ id: string; time: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .set('Idempotency-Key', randomUUID())
      .send({ professionalId, serviceId, date, time, bookingMode })
      .expect(201);
    return { id: response.body.id as string, time: response.body.time as string };
  }

  it('rejects client and professional and a foreign tenant professional', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/dashboard').set(auth(clientToken)).expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(professionalToken))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminToken))
      .query({ professionalId: professionalBId })
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminToken))
      .query({ date: '2026-02-31' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminToken))
      .query({ tenantId: tenantB.id })
      .expect(400);
    await request(app.getHttpServer()).get('/api/v1/admin/dashboard').expect(401);
  });

  it('accepts a past civil date and defaults an omitted date to today in America/Sao_Paulo', async () => {
    const past = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminToken))
      .query({ date: '2020-01-01' })
      .expect(200);
    expect(past.body.date).toBe('2020-01-01');
    expect(past.body.summary).toMatchObject({
      totalAppointments: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      servicesValue: '0.00',
    });
    expect(past.body.totals).toEqual({ clients: 1, activeProfessionals: 2, activeServices: 1 });
    expect(past.body.upcoming).toEqual([]);
    expect(past.body.appointments).toEqual([]);

    const today = await request(app.getHttpServer()).get('/api/v1/admin/dashboard').set(auth(adminToken)).expect(200);
    expect(today.body.date).toBe(todayInScheduleZone());
  });

  it('summarizes the day from snapshots and the ledger', async () => {
    const slot = futureSlot(3, '10:00');
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 200, reason: 'Saldo do painel' })
      .expect(201);

    const pointsBooking = await book(professionalAId, slot.date, '10:00', 'POINTS');
    const completed = await book(professionalAId, slot.date, '11:00', 'NORMAL');
    const missed = await book(professionalAId, slot.date, '12:00', 'NORMAL');
    const cancelled = await book(professionalAId, slot.date, '13:00', 'POINTS');
    const other = await book(professionalSecondId, slot.date, '14:00', 'NORMAL');

    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${completed.id}/complete`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${missed.id}/no-show`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${cancelled.id}/cancel`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/services/${serviceId}`)
      .set(auth(adminToken))
      .send({ name: 'Corte alterado', price: 99, redemptionPoints: 80 })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminToken))
      .query({ date: slot.date })
      .expect(200);

    expect(response.body.summary).toEqual({
      totalAppointments: 5,
      pending: 0,
      confirmed: 2,
      completed: 1,
      cancelled: 1,
      noShow: 1,
      servicesValue: '225.00',
      pointsRedeemed: 100,
      pointsReversed: 50,
      pointsEarned: 10,
    });
    expect(response.body.upcoming.map((item: { id: string }) => item.id)).toEqual([pointsBooking.id, other.id]);
    expect(response.body.upcoming.map((item: { status: string }) => item.status)).toEqual(['CONFIRMED', 'CONFIRMED']);
    const redeemed = response.body.appointments.find((item: { id: string }) => item.id === pointsBooking.id);
    const plain = response.body.appointments.find((item: { id: string }) => item.id === completed.id);
    expect(redeemed).toMatchObject({
      bookingMode: 'POINTS',
      redemptionPointsSnapshot: 50,
      price: '45.00',
      serviceName: 'Corte',
      clientName: 'Ana Painel',
      professionalName: 'Carlos',
      time: '10:00',
    });
    expect(plain).toMatchObject({
      bookingMode: 'NORMAL',
      redemptionPointsSnapshot: null,
      price: '45.00',
      serviceName: 'Corte',
      status: 'COMPLETED',
    });
    expect(response.body.professionals).toEqual([
      {
        professionalId: professionalAId,
        name: 'Carlos',
        appointments: 4,
        completed: 1,
        cancelled: 1,
        noShow: 1,
        servicesValue: '180.00',
      },
      {
        professionalId: professionalSecondId,
        name: 'Eduardo',
        appointments: 1,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        servicesValue: '45.00',
      },
    ]);

    const byProfessional = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminToken))
      .query({ date: slot.date, professionalId: professionalSecondId })
      .expect(200);
    expect(byProfessional.body.summary.totalAppointments).toBe(1);
    expect(byProfessional.body.summary.servicesValue).toBe('45.00');
    expect(byProfessional.body.appointments).toHaveLength(1);
    expect(byProfessional.body.appointments[0].id).toBe(other.id);
    expect(byProfessional.body.professionals).toHaveLength(1);

    const cancelledOnly = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminToken))
      .query({ date: slot.date, status: 'CANCELLED' })
      .expect(200);
    expect(cancelledOnly.body.summary.totalAppointments).toBe(5);
    expect(cancelledOnly.body.appointments).toHaveLength(1);
    expect(cancelledOnly.body.appointments[0].id).toBe(cancelled.id);
    expect(cancelledOnly.body.upcoming.map((item: { status: string }) => item.status)).not.toContain('CANCELLED');
    expect(cancelledOnly.body.upcoming.map((item: { status: string }) => item.status)).not.toContain('NO_SHOW');
    expect(cancelledOnly.body.upcoming.map((item: { status: string }) => item.status)).not.toContain('COMPLETED');

    const foreign = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminTokenB))
      .query({ date: slot.date })
      .expect(200);
    expect(foreign.body.summary.totalAppointments).toBe(0);
    expect(foreign.body.appointments).toEqual([]);
    expect(foreign.body.upcoming).toEqual([]);
    expect(foreign.body.totals).toEqual({ clients: 0, activeProfessionals: 1, activeServices: 0 });
  });

  it('counts the establishment and limits the next operational appointments', async () => {
    const slot = futureSlot(4, '08:00');
    const later = addDays(slot.date, 1);
    const inactiveUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Inativo',
        email: `inativo.${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: await new PasswordService().hash(password),
        role: UserRole.CLIENT,
        isActive: false,
      },
    });
    const inactiveClient = await prisma.client.create({
      data: { tenantId: tenantA.id, userId: inactiveUser.id, isActive: false },
    });
    const inactiveProfessionalUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Pro inativo',
        email: `pro.inativo.${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: inactiveUser.passwordHash,
        role: UserRole.PROFESSIONAL,
        isActive: false,
      },
    });
    const inactiveProfessional = await prisma.professional.create({
      data: {
        tenantId: tenantA.id,
        userId: inactiveProfessionalUser.id,
        displayName: 'Inativo',
        isActive: false,
      },
    });
    const inactiveService = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Inativo',
        price: '10.00',
        durationMinutes: 30,
        points: 0,
        isActive: false,
      },
    });

    const cancelled = await book(professionalAId, slot.date, '08:00', 'NORMAL');
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${cancelled.id}/cancel`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 100, reason: 'Saldo dos próximos' })
      .expect(201);
    for (const time of ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00']) {
      await book(professionalAId, slot.date, time, time === '09:00' ? 'POINTS' : 'NORMAL');
    }
    const nextDay = await book(professionalAId, later, '10:00', 'NORMAL');
    await prisma.appointment.create({
      data: {
        tenantId: tenantA.id,
        clientId: clientAId,
        professionalId: professionalAId,
        serviceId,
        startAt: parseScheduleInstant(`${slot.date}T15:00:00`),
        endAt: parseScheduleInstant(`${slot.date}T15:30:00`),
        status: 'PENDING',
        serviceNameSnapshot: 'Corte',
        servicePriceSnapshot: '45.00',
        serviceDurationMinutesSnapshot: 30,
        pointsSnapshot: 10,
        bookingMode: 'NORMAL',
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminToken))
      .query({ date: slot.date })
      .expect(200);

    expect(response.body.totals).toEqual({ clients: 2, activeProfessionals: 2, activeServices: 1 });
    expect(response.body.summary.pending).toBe(1);
    expect(response.body.summary.totalAppointments).toBe(8);
    expect(response.body.appointments.map((item: { id: string }) => item.id)).not.toContain(nextDay.id);
    expect(response.body.upcoming).toHaveLength(5);
    expect(response.body.upcoming.map((item: { time: string }) => item.time)).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
    ]);
    expect(response.body.upcoming.map((item: { status: string }) => item.status)).not.toContain('CANCELLED');
    expect(response.body.upcoming[0]).toMatchObject({ bookingMode: 'POINTS', date: slot.date });
    expect(response.body.upcoming[1]).toMatchObject({ bookingMode: 'NORMAL' });
    expect(JSON.stringify(response.body.upcoming)).not.toContain(tenantA.id);

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set(auth(adminToken))
      .query({ date: slot.date, professionalId: professionalSecondId })
      .expect(200);
    expect(filtered.body.upcoming).toEqual([]);
    expect(filtered.body.totals.clients).toBe(2);

    await prisma.service.delete({ where: { id: inactiveService.id } });
    await prisma.professional.delete({ where: { id: inactiveProfessional.id } });
    await prisma.user.delete({ where: { id: inactiveProfessionalUser.id } });
    await prisma.client.delete({ where: { id: inactiveClient.id } });
    await prisma.user.delete({ where: { id: inactiveUser.id } });
  });
});

describe('admin dashboard civil day', () => {
  const prisma = createIntegrationPrisma();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Fuso A', slug: `fase121-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Fuso B', slug: `fase121-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];
  const clock = { current: new Date('2026-10-06T22:00:00-03:00') };

  let app: INestApplication;
  let adminToken = '';
  let clientAId = '';
  let professionalAId = '';
  let serviceAId = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
      ],
    });
    const admin = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Admin Fuso',
        email: `admin.fuso.${suffix}@example.com`,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    const clientUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Cliente Fuso',
        email: `cliente.fuso.${suffix}@example.com`,
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const professionalUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Carlos Fuso',
        email: `pro.fuso.${suffix}@example.com`,
        passwordHash,
        role: UserRole.PROFESSIONAL,
        isActive: true,
      },
    });
    const clientBUser = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        name: 'Cliente B',
        email: `cliente.b.fuso.${suffix}@example.com`,
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const professionalBUser = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        name: 'Diego Fuso',
        email: `pro.b.fuso.${suffix}@example.com`,
        passwordHash,
        role: UserRole.PROFESSIONAL,
        isActive: true,
      },
    });
    const clientA = await prisma.client.create({
      data: { tenantId: tenantA.id, userId: clientUser.id, isActive: true },
    });
    const clientB = await prisma.client.create({
      data: { tenantId: tenantB.id, userId: clientBUser.id, isActive: true },
    });
    const professionalA = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: professionalUser.id, displayName: 'Carlos', isActive: true },
    });
    const professionalB = await prisma.professional.create({
      data: { tenantId: tenantB.id, userId: professionalBUser.id, displayName: 'Diego', isActive: true },
    });
    const serviceA = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Corte',
        price: '45.00',
        durationMinutes: 30,
        points: 10,
        isActive: true,
      },
    });
    const serviceB = await prisma.service.create({
      data: {
        tenantId: tenantB.id,
        name: 'Corte B',
        price: '45.00',
        durationMinutes: 30,
        points: 10,
        isActive: true,
      },
    });
    clientAId = clientA.id;
    professionalAId = professionalA.id;
    serviceAId = serviceA.id;
    await prisma.appointment.createMany({
      data: [
        appointment(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-06T21:00:00-03:00', 'CONFIRMED'),
        appointment(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-06T23:00:00-03:00', 'CONFIRMED'),
        appointment(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-06T23:30:00-03:00', 'CANCELLED'),
        appointment(tenantA.id, clientA.id, professionalA.id, serviceA.id, '2026-10-07T09:00:00-03:00', 'CONFIRMED'),
        appointment(tenantB.id, clientB.id, professionalB.id, serviceB.id, '2026-10-06T23:00:00-03:00', 'CONFIRMED'),
      ],
    });
    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp({ now: () => clock.current });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Tenant-Slug', tenantA.slug)
      .send({ email: admin.email, password })
      .expect(200);
    adminToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await app?.close();
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professional.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.client.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.service.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.userSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('keeps today and the next appointments on the America/Sao_Paulo civil day', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.date).toBe('2026-10-06');
    expect(todayInScheduleZone(clock.current)).toBe('2026-10-06');
    expect(response.body.summary).toMatchObject({
      totalAppointments: 3,
      pending: 0,
      confirmed: 2,
      completed: 0,
      cancelled: 1,
      noShow: 0,
    });
    expect(response.body.upcoming.map((item: { time: string; date: string }) => `${item.date} ${item.time}`)).toEqual([
      '2026-10-06 23:00',
      '2026-10-07 09:00',
    ]);
    expect(response.body.totals).toEqual({ clients: 1, activeProfessionals: 1, activeServices: 1 });
    expect(clientAId).toBeTruthy();
    expect(professionalAId).toBeTruthy();
    expect(serviceAId).toBeTruthy();
  });
});

function appointment(
  tenantId: string,
  clientId: string,
  professionalId: string,
  serviceId: string,
  start: string,
  status: 'CONFIRMED' | 'CANCELLED',
) {
  const startAt = parseScheduleInstant(start);
  return {
    tenantId,
    clientId,
    professionalId,
    serviceId,
    startAt,
    endAt: new Date(startAt.getTime() + 30 * 60_000),
    status,
    serviceNameSnapshot: 'Corte',
    servicePriceSnapshot: '45.00',
    serviceDurationMinutesSnapshot: 30,
    pointsSnapshot: 10,
    bookingMode: 'NORMAL' as const,
  };
}
