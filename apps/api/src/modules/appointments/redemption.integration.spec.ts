import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createIntegrationPrisma } from '../../config/integration-database';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';
import { addDays, nextOrSameDate, parseScheduleInstant, todayInScheduleZone } from '../../common/time/schedule-clock';

const password = 'senha-segura-123';

function futureSlot(weekday: number, time: string): { date: string; time: string } {
  let date = nextOrSameDate(todayInScheduleZone(), weekday);
  if (parseScheduleInstant(`${date}T${time}:00`).getTime() <= Date.now()) {
    date = addDays(date, 7);
  }
  return { date, time };
}

describe('points redemption on appointments', () => {
  const prisma = createIntegrationPrisma();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Resgate A', slug: `fase7-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Resgate B', slug: `fase7-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let clientTwoToken = '';
  let professionalToken = '';
  let adminTokenB = '';
  let clientAId = '';
  let professionalAId = '';
  let professionalSecondId = '';
  let professionalBId = '';
  let serviceId = '';
  let plainServiceId = '';
  let serviceBId = '';

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
          name: 'Admin A',
          email: `admin.${suffix}@example.com`,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      }),
      client: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Ana Costa',
          email: `cliente.${suffix}@example.com`,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
      }),
      clientTwo: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Bruno',
          email: `cliente2.${suffix}@example.com`,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
      }),
      professional: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Carlos',
          email: `pro.${suffix}@example.com`,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
      professionalSecond: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Eduardo',
          email: `pro2.${suffix}@example.com`,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
      adminB: await prisma.user.create({
        data: {
          tenantId: tenantB.id,
          name: 'Admin B',
          email: `admin.b.${suffix}@example.com`,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      }),
      professionalB: await prisma.user.create({
        data: {
          tenantId: tenantB.id,
          name: 'Diego',
          email: `pro.b.${suffix}@example.com`,
          passwordHash,
          role: UserRole.PROFESSIONAL,
          isActive: true,
        },
      }),
    };
    const clientA = await prisma.client.create({
      data: { tenantId: tenantA.id, userId: users.client.id, isActive: true },
    });
    await prisma.client.create({
      data: { tenantId: tenantA.id, userId: users.clientTwo.id, isActive: true },
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
    const plain = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Barba',
        price: '30.00',
        durationMinutes: 30,
        points: 5,
        redemptionPoints: null,
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
        redemptionPoints: 50,
        isActive: true,
      },
    });
    clientAId = clientA.id;
    professionalAId = professionalA.id;
    professionalSecondId = professionalSecond.id;
    professionalBId = professionalB.id;
    serviceId = service.id;
    plainServiceId = plain.id;
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
    clientTwoToken = await login(tenantA.slug, users.clientTwo.email);
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
      data: { points: 10, redemptionPoints: 50, isActive: true },
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

  async function credit(points: number): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points, reason: 'Saldo de teste' })
      .expect(201);
  }

  async function balance(): Promise<number> {
    const response = await request(app.getHttpServer()).get('/api/v1/points/me').set(auth(clientToken)).expect(200);
    return response.body.balance as number;
  }

  async function redeemCount(): Promise<number> {
    return prisma.pointsTransaction.count({ where: { clientId: clientAId, type: 'REDEEM' } });
  }

  it('keeps the balance when the booking is normal', async () => {
    await credit(40);
    const slot = futureSlot(1, '10:00');
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalAId, serviceId, ...slot, bookingMode: 'NORMAL' })
      .expect(201);
    expect(created.body).toMatchObject({
      bookingMode: 'NORMAL',
      redemptionPointsSnapshot: null,
      pointsSnapshot: 10,
      price: '45.00',
      status: 'CONFIRMED',
    });
    expect(await balance()).toBe(40);
    expect(await redeemCount()).toBe(0);
  });

  it('redeems the service cost from the ledger when booking with points', async () => {
    await credit(100);
    const slot = futureSlot(1, '11:00');
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalAId, serviceId, ...slot, bookingMode: 'POINTS' })
      .expect(201);
    expect(created.body).toMatchObject({
      bookingMode: 'POINTS',
      redemptionPointsSnapshot: 50,
      pointsSnapshot: 10,
      price: '45.00',
      serviceName: 'Corte',
    });
    expect(await balance()).toBe(50);
    expect(await redeemCount()).toBe(1);
    const row = await prisma.pointsTransaction.findFirstOrThrow({
      where: { appointmentId: created.body.id as string, type: 'REDEEM' },
    });
    expect(row.points).toBe(50);
    expect(row.redeemAppointmentId).toBe(created.body.id);
    expect(row.reason).toBe('Resgate de pontos no agendamento do serviço Corte');
  });

  it('rejects a points booking when the balance is short and writes nothing', async () => {
    await credit(30);
    const slot = futureSlot(2, '10:00');
    const rejected = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalAId, serviceId, ...slot, bookingMode: 'POINTS' })
      .expect(409);
    expect(rejected.body.message).toBe('Saldo de pontos insuficiente.');
    expect(await balance()).toBe(30);
    expect(await redeemCount()).toBe(0);
    expect(await prisma.appointment.count({ where: { clientId: clientAId } })).toBe(0);
  });

  it('does not redeem when the slot is already taken', async () => {
    await credit(80);
    const slot = futureSlot(2, '11:00');
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientTwoToken))
      .send({ professionalId: professionalAId, serviceId, ...slot })
      .expect(201);
    const rejected = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalAId, serviceId, ...slot, bookingMode: 'POINTS' })
      .expect(409);
    expect(rejected.body.message).toBe('Este horário não está mais disponível.');
    expect(await balance()).toBe(80);
    expect(await redeemCount()).toBe(0);
  });

  it('lets only one of two simultaneous points bookings take the same slot', async () => {
    await credit(50);
    const slot = futureSlot(3, '10:00');
    const payload = { professionalId: professionalAId, serviceId, ...slot, bookingMode: 'POINTS' };
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/appointments').set(auth(clientToken)).send(payload),
      request(app.getHttpServer()).post('/api/v1/appointments').set(auth(clientToken)).send(payload),
    ]);
    expect([first.status, second.status].sort((left, right) => left - right)).toEqual([201, 409]);
    expect(await prisma.appointment.count({ where: { clientId: clientAId } })).toBe(1);
    expect(await redeemCount()).toBe(1);
    expect(await balance()).toBe(0);
  });

  it('lets only one of two simultaneous points bookings at different times spend the balance', async () => {
    await credit(50);
    const firstSlot = futureSlot(3, '14:00');
    const secondSlot = futureSlot(3, '15:00');
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set(auth(clientToken))
        .send({ professionalId: professionalAId, serviceId, ...firstSlot, bookingMode: 'POINTS' }),
      request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set(auth(clientToken))
        .send({ professionalId: professionalAId, serviceId, ...secondSlot, bookingMode: 'POINTS' }),
    ]);
    const statuses = [first.status, second.status].sort((left, right) => left - right);
    expect(statuses).toEqual([201, 409]);
    const failure = first.status === 409 ? first : second;
    expect(failure.body.message).toBe('Saldo de pontos insuficiente.');
    expect(await prisma.appointment.count({ where: { clientId: clientAId } })).toBe(1);
    expect(await redeemCount()).toBe(1);
    expect(await balance()).toBe(0);
  });

  it('locks the client when two professionals are booked with the same points', async () => {
    await credit(50);
    const slot = futureSlot(4, '10:00');
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set(auth(clientToken))
        .send({ professionalId: professionalAId, serviceId, ...slot, bookingMode: 'POINTS' }),
      request(app.getHttpServer()).post('/api/v1/appointments').set(auth(clientToken)).send({
        professionalId: professionalSecondId,
        serviceId,
        ...futureSlot(4, '11:00'),
        bookingMode: 'POINTS',
      }),
    ]);
    expect([first.status, second.status].sort((left, right) => left - right)).toEqual([201, 409]);
    expect(await prisma.appointment.count({ where: { clientId: clientAId } })).toBe(1);
    expect(await redeemCount()).toBe(1);
    expect(await balance()).toBe(0);
  });

  it('returns the redeemed points once when the appointment is cancelled', async () => {
    await credit(100);
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalAId, serviceId, ...futureSlot(4, '15:00'), bookingMode: 'POINTS' })
      .expect(201);
    expect(await balance()).toBe(50);
    await prisma.service.update({
      where: { id: serviceId },
      data: { redemptionPoints: 80, isActive: false },
    });
    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(await balance()).toBe(100);
    const reversal = await prisma.pointsTransaction.findFirstOrThrow({
      where: { appointmentId: created.body.id as string, type: 'REDEEM_REVERSAL' },
    });
    expect(reversal.points).toBe(50);
    expect(reversal.reversalOfTransactionId).toBeTruthy();
    expect(await prisma.pointsTransaction.count({ where: { type: 'EARN', appointmentId: created.body.id as string } })).toBe(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(409);
    expect(
      await prisma.pointsTransaction.count({ where: { appointmentId: created.body.id as string, type: 'REDEEM_REVERSAL' } }),
    ).toBe(1);
    expect(await balance()).toBe(100);
  });

  it('creates a single reversal when two cancellations run together', async () => {
    await credit(80);
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalAId, serviceId, ...futureSlot(5, '10:00'), bookingMode: 'POINTS' })
      .expect(201);
    const id = created.body.id as string;
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).patch(`/api/v1/appointments/${id}/cancel`).set(auth(clientToken)),
      request(app.getHttpServer()).patch(`/api/v1/appointments/${id}/cancel`).set(auth(adminToken)),
    ]);
    expect([first.status, second.status].sort((left, right) => left - right)).toEqual([200, 409]);
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: id, type: 'REDEEM_REVERSAL' } })).toBe(1);
    expect(await balance()).toBe(80);
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe('CANCELLED');
  });

  it('keeps the redeemed points on no-show and does not earn', async () => {
    await credit(70);
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalAId, serviceId, ...futureSlot(5, '11:00'), bookingMode: 'POINTS' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id as string}/no-show`)
      .set(auth(professionalToken))
      .expect(200);
    expect(await balance()).toBe(20);
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: created.body.id as string, type: 'REDEEM_REVERSAL' } })).toBe(0);
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: created.body.id as string, type: 'EARN' } })).toBe(0);
  });

  it('earns the snapshot after a points booking and refuses a later cancellation', async () => {
    await credit(100);
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalAId, serviceId, ...futureSlot(5, '14:00'), bookingMode: 'POINTS' })
      .expect(201);
    const completed = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id as string}/complete`)
      .set(auth(professionalToken))
      .expect(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(await balance()).toBe(60);
    const rows = await prisma.pointsTransaction.findMany({
      where: { appointmentId: created.body.id as string },
      orderBy: { type: 'asc' },
    });
    expect(rows.map((row) => `${row.type}:${row.points}`).sort()).toEqual(['EARN:10', 'REDEEM:50']);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id as string}/cancel`)
      .set(auth(adminToken))
      .expect(409);
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: created.body.id as string, type: 'REDEEM_REVERSAL' } })).toBe(0);
    expect(await balance()).toBe(60);
  });

  it('does not create a second redeem for the same idempotency key', async () => {
    await credit(90);
    const key = `resgate-${suffix}-01`;
    const payload = { professionalId: professionalAId, serviceId, ...futureSlot(6, '10:00'), bookingMode: 'POINTS' };
    const first = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
    expect(await redeemCount()).toBe(1);
    expect(await balance()).toBe(40);
  });

  it('refuses points mode when the service has no redemption cost', async () => {
    await credit(80);
    const rejected = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({
        professionalId: professionalAId,
        serviceId: plainServiceId,
        ...futureSlot(6, '11:00'),
        bookingMode: 'POINTS',
      })
      .expect(400);
    expect(rejected.body.message).toBe('Este serviço não aceita resgate de pontos.');
    expect(await prisma.appointment.count({ where: { clientId: clientAId } })).toBe(0);
    expect(await balance()).toBe(80);
  });

  it('ignores a client-supplied redemption amount and blocks other tenants', async () => {
    await credit(50);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({
        professionalId: professionalAId,
        serviceId,
        ...futureSlot(6, '12:00'),
        bookingMode: 'POINTS',
        redemptionPointsSnapshot: 1,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(professionalToken))
      .send({ professionalId: professionalAId, serviceId, ...futureSlot(6, '12:00'), bookingMode: 'POINTS' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalBId, serviceId: serviceBId, ...futureSlot(6, '12:00'), bookingMode: 'POINTS' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'REDEEM', points: 10, reason: 'Simular resgate' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'REDEEM_REVERSAL', points: 10, reason: 'Simular devolução' })
      .expect(400);
    await request(app.getHttpServer()).get(`/api/v1/clients/${clientAId}/points`).set(auth(adminTokenB)).expect(404);
    expect(await redeemCount()).toBe(0);
    expect(await balance()).toBe(50);

    const created = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Quebrado', price: 10, durationMinutes: 30, points: 1, redemptionPoints: 1.5 })
      .expect(400);
    expect(created.body.message).toBeDefined();
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Zero', price: 10, durationMinutes: 30, points: 1, redemptionPoints: 0 })
      .expect(400);
  });
});
