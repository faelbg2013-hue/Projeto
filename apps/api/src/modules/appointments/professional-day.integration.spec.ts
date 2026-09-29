import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';
import {
  addDays,
  dayBounds,
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

describe('professional day', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Dia A', slug: `fase9-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Dia B', slug: `fase9-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let professionalSecondToken = '';
  let professionalBToken = '';
  let clientAId = '';
  let professionalAId = '';
  let professionalSecondId = '';
  let serviceId = '';
  let serviceBId = '';
  let clientBId = '';
  let professionalBId = '';

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
          name: 'Admin Dia',
          email: `admin.dia.${suffix}@example.com`,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      }),
      client: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Ana Dia',
          email: `cliente.dia.${suffix}@example.com`,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
      }),
      professional: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Carlos Dia',
          email: `pro.dia.${suffix}@example.com`,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
      professionalSecond: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Eduardo Dia',
          email: `pro2.dia.${suffix}@example.com`,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
      clientB: await prisma.user.create({
        data: {
          tenantId: tenantB.id,
          name: 'Bia Outro',
          email: `cliente.b.dia.${suffix}@example.com`,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
      }),
      professionalB: await prisma.user.create({
        data: {
          tenantId: tenantB.id,
          name: 'Diego Dia',
          email: `pro.b.dia.${suffix}@example.com`,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
    };
    const clientA = await prisma.client.create({
      data: { tenantId: tenantA.id, userId: users.client.id, isActive: true },
    });
    const clientB = await prisma.client.create({
      data: { tenantId: tenantB.id, userId: users.clientB.id, isActive: true },
    });
    const professionalA = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: users.professional.id, displayName: 'Carlos', isActive: true },
    });
    const professionalSecond = await prisma.professional.create({
      data: {
        tenantId: tenantA.id,
        userId: users.professionalSecond.id,
        displayName: 'Eduardo',
        isActive: true,
      },
    });
    const professionalB = await prisma.professional.create({
      data: { tenantId: tenantB.id, userId: users.professionalB.id, displayName: 'Diego', isActive: true },
    });
    const service = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Corte',
        description: 'Corte clássico',
        price: '45.00',
        durationMinutes: 30,
        points: 10,
        redemptionPoints: 50,
        isActive: true,
      },
    });
    const serviceB = await prisma.service.create({
      data: {
        tenantId: tenantB.id,
        name: 'Barba',
        price: '30.00',
        durationMinutes: 30,
        points: 5,
        isActive: true,
      },
    });
    clientAId = clientA.id;
    clientBId = clientB.id;
    professionalAId = professionalA.id;
    professionalSecondId = professionalSecond.id;
    professionalBId = professionalB.id;
    serviceId = service.id;
    serviceBId = serviceB.id;
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
    professionalSecondToken = await login(tenantA.slug, users.professionalSecond.email);
    professionalBToken = await login(tenantB.slug, users.professionalB.email);
  });

  beforeEach(async () => {
    await prisma.pointsTransaction.deleteMany({
      where: { tenantId: { in: tenantIds }, reversalOfTransactionId: { not: null } },
    });
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

  async function credit(points: number): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points, reason: 'Saldo de teste' })
      .expect(201);
  }

  async function book(
    professionalId: string,
    slot: { date: string; time: string },
    mode: 'NORMAL' | 'POINTS',
    key: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .set('Idempotency-Key', key)
      .send({ professionalId, serviceId, date: slot.date, time: slot.time, bookingMode: mode })
      .expect(201);
    return response.body.id as string;
  }

  it('lets the professional read the own day and rejects client and admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .set(auth(professionalToken))
      .expect(200);
    expect(response.body.date).toBe(todayInScheduleZone());
    expect(response.body.summary).toEqual({
      total: 0,
      confirmed: 0,
      completed: 0,
      noShow: 0,
      cancelled: 0,
    });
    expect(response.body.nextAppointment).toBeNull();
    expect(response.body.currentAppointment).toBeNull();
    expect(response.body.appointments).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .set(auth(clientToken))
      .expect(403)
      .expect((res) => {
        expect(res.body.message).toBe('Acesso negado');
      });
    await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .set(auth(adminToken))
      .expect(403)
      .expect((res) => {
        expect(res.body.message).toBe('Acesso negado');
      });
  });

  it('rejects an invalid date and a professionalId sent by the client', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .query({ date: '2026-02-31' })
      .set(auth(professionalToken))
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe('Data inválida.');
      });
    await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .query({ date: 'ontem' })
      .set(auth(professionalToken))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .query({ professionalId: professionalSecondId })
      .set(auth(professionalToken))
      .expect(400);
  });

  it('counts a past day and keeps other tenants and professionals out', async () => {
    const slot = futureSlot(1, '10:00');
    const id = await book(professionalAId, slot, 'NORMAL', `passado-${suffix}`);
    const yesterday = addDays(todayInScheduleZone(), -1);
    const start = parseScheduleInstant(`${yesterday}T10:00:00`);
    await prisma.appointment.update({
      where: { id },
      data: { startAt: start, endAt: new Date(start.getTime() + 30 * 60_000) },
    });
    const otherStart = parseScheduleInstant(`${yesterday}T11:00:00`);
    await prisma.appointment.create({
      data: {
        tenantId: tenantB.id,
        clientId: clientBId,
        professionalId: professionalBId,
        serviceId: serviceBId,
        startAt: otherStart,
        endAt: new Date(otherStart.getTime() + 30 * 60_000),
        status: 'CONFIRMED',
        serviceNameSnapshot: 'Barba',
        servicePriceSnapshot: '30.00',
        serviceDurationMinutesSnapshot: 30,
        pointsSnapshot: 5,
        bookingMode: 'NORMAL',
      },
    });

    const mine = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .query({ date: yesterday })
      .set(auth(professionalToken))
      .expect(200);
    expect(mine.body.summary).toEqual({
      total: 1,
      confirmed: 1,
      completed: 0,
      noShow: 0,
      cancelled: 0,
    });
    expect(mine.body.appointments[0].clientName).toBe('Ana Dia');
    expect(JSON.stringify(mine.body)).not.toContain('Bia Outro');
    expect(mine.body.nextAppointment).toBeNull();

    const other = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .query({ date: yesterday })
      .set(auth(professionalBToken))
      .expect(200);
    expect(other.body.summary.total).toBe(1);
    expect(other.body.appointments[0].clientName).toBe('Bia Outro');
    expect(JSON.stringify(other.body)).not.toContain('Ana Dia');
  });

  it('identifies the next confirmed appointment and ignores completed, cancelled and no-show', async () => {
    const date = futureSlot(3, '10:00').date;
    const confirmed = await book(professionalAId, { date, time: '10:00' }, 'NORMAL', `prox-${suffix}-c`);
    const completed = await book(professionalAId, { date, time: '11:00' }, 'NORMAL', `prox-${suffix}-d`);
    const cancelled = await book(professionalAId, { date, time: '12:00' }, 'NORMAL', `prox-${suffix}-x`);
    const missed = await book(professionalAId, { date, time: '13:00' }, 'NORMAL', `prox-${suffix}-n`);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${completed}/complete`)
      .set(auth(professionalToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${cancelled}/cancel`)
      .set(auth(professionalToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${missed}/no-show`)
      .set(auth(professionalToken))
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .query({ date })
      .set(auth(professionalToken))
      .expect(200);
    expect(response.body.summary).toEqual({
      total: 4,
      confirmed: 1,
      completed: 1,
      noShow: 1,
      cancelled: 1,
    });
    expect(response.body.nextAppointment.id).toBe(confirmed);
    expect(response.body.nextAppointment.status).toBe('CONFIRMED');
    expect(response.body.nextAppointment.time).toBe('10:00');
    expect(response.body.appointments.map((item: { status: string }) => item.status)).toEqual([
      'CONFIRMED',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ]);
  });

  it('returns redemption snapshot only for POINTS bookings', async () => {
    await credit(50);
    const date = futureSlot(4, '10:00').date;
    await book(professionalAId, { date, time: '10:00' }, 'NORMAL', `modo-${suffix}-n`);
    await book(professionalAId, { date, time: '11:00' }, 'POINTS', `modo-${suffix}-p`);
    const response = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .query({ date })
      .set(auth(professionalToken))
      .expect(200);
    const normal = response.body.appointments[0];
    const points = response.body.appointments[1];
    expect(normal.bookingMode).toBe('NORMAL');
    expect(normal.redemptionPointsSnapshot).toBeNull();
    expect(normal.pointsSnapshot).toBe(10);
    expect(normal.price).toBe('45.00');
    expect(normal.serviceDescription).toBe('Corte clássico');
    expect(points.bookingMode).toBe('POINTS');
    expect(points.redemptionPointsSnapshot).toBe(50);
    expect(points.pointsSnapshot).toBe(10);
  });

  it('marks the confirmed appointment that contains the current instant', async () => {
    const slot = futureSlot(2, '10:00');
    const id = await book(professionalAId, slot, 'NORMAL', `agora-${suffix}`);
    const now = new Date();
    const date = todayInScheduleZone(now);
    const bounds = dayBounds(date);
    const start = new Date(now.getTime() - 2 * 60_000);
    const end = new Date(now.getTime() + 20 * 60_000);
    await prisma.appointment.update({
      where: { id },
      data: { startAt: start < bounds.startAt ? bounds.startAt : start, endAt: end },
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .query({ date })
      .set(auth(professionalToken))
      .expect(200);
    expect(response.body.currentAppointment.id).toBe(id);
    expect(response.body.currentAppointment.status).toBe('CONFIRMED');
    expect(response.body.nextAppointment).toBeNull();
  });

  it('earns points on complete, skips earn on no-show, and keeps the existing reversals', async () => {
    await credit(50);
    const date = futureSlot(5, '10:00').date;
    const earned = await book(professionalAId, { date, time: '10:00' }, 'NORMAL', `earn-${suffix}`);
    const missed = await book(professionalAId, { date, time: '11:00' }, 'POINTS', `miss-${suffix}`);
    const returned = await book(professionalAId, { date, time: '14:00' }, 'NORMAL', `back-${suffix}-wait`);
    await credit(50);
    const pointsCancel = await book(professionalAId, { date, time: '15:00' }, 'POINTS', `back-${suffix}-pts`);
    const plainCancel = await book(professionalAId, { date, time: '16:00' }, 'NORMAL', `back-${suffix}-nrm`);

    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${earned}/complete`)
      .set(auth(professionalToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${missed}/no-show`)
      .set(auth(professionalToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${pointsCancel}/cancel`)
      .set(auth(professionalToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${plainCancel}/cancel`)
      .set(auth(professionalToken))
      .expect(200);

    const earnRows = await prisma.pointsTransaction.findMany({
      where: { earnAppointmentId: earned, type: 'EARN' },
    });
    expect(earnRows).toHaveLength(1);
    expect(earnRows[0]?.points).toBe(10);
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: missed, type: 'EARN' } })).toBe(0);
    expect(
      await prisma.pointsTransaction.count({ where: { appointmentId: missed, type: 'REDEEM_REVERSAL' } }),
    ).toBe(0);
    expect(
      await prisma.pointsTransaction.count({ where: { appointmentId: pointsCancel, type: 'REDEEM_REVERSAL' } }),
    ).toBe(1);
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: plainCancel } })).toBe(0);
    expect(returned).toBeTruthy();
  });

  it('rejects a second complete and a concurrent second action', async () => {
    const slot = futureSlot(1, '15:00');
    const id = await book(professionalAId, slot, 'NORMAL', `twice-${suffix}`);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${id}/complete`)
      .set(auth(professionalToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${id}/complete`)
      .set(auth(professionalToken))
      .expect(409)
      .expect((res) => {
        expect(res.body.message).toBe('A transição de status não é permitida.');
      });

    const other = await book(professionalAId, { date: slot.date, time: '16:00' }, 'NORMAL', `race-${suffix}`);
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).patch(`/api/v1/appointments/${other}/no-show`).set(auth(professionalToken)),
      request(app.getHttpServer()).patch(`/api/v1/appointments/${other}/cancel`).set(auth(professionalToken)),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect([first, second].find((item) => item.status === 409)?.body.message).toBe(
      'A transição de status não é permitida.',
    );
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: other, type: 'EARN' } })).toBe(0);
  });

  it('hides another professional appointment behind not found', async () => {
    const slot = futureSlot(6, '10:00');
    const id = await book(professionalSecondId, slot, 'NORMAL', `outro-${suffix}`);
    const day = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/dashboard')
      .query({ date: slot.date })
      .set(auth(professionalToken))
      .expect(200);
    expect(day.body.summary.total).toBe(0);

    for (const path of ['complete', 'cancel', 'no-show']) {
      await request(app.getHttpServer())
        .patch(`/api/v1/appointments/${id}/${path}`)
        .set(auth(professionalToken))
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Recurso não encontrado');
        });
    }
    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${id}`)
      .set(auth(professionalToken))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${id}/complete`)
      .set(auth(professionalSecondToken))
      .expect(200);
  });
});
