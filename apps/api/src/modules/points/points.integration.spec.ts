import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
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

describe('points ledger', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Pontos A', slug: `fase6-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Pontos B', slug: `fase6-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let clientTwoToken = '';
  let professionalToken = '';
  let adminTokenB = '';
  let clientAId = '';
  let clientBId = '';
  let professionalAId = '';
  let serviceAId = '';
  let serviceZeroId = '';

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
          name: 'Bruno Cliente',
          email: `cliente2.${suffix}@example.com`,
          passwordHash,
          role: UserRole.CLIENT,
          isActive: true,
        },
      }),
      professional: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Carlos Lima',
          email: `pro.${suffix}@example.com`,
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
      clientB: await prisma.user.create({
        data: {
          tenantId: tenantB.id,
          name: 'Cliente B',
          email: `cliente.b.${suffix}@example.com`,
          passwordHash,
          role: UserRole.CLIENT,
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
    const clientB = await prisma.client.create({
      data: { tenantId: tenantB.id, userId: users.clientB.id, isActive: true },
    });
    const professional = await prisma.professional.create({
      data: {
        tenantId: tenantA.id,
        userId: users.professional.id,
        displayName: 'Carlos',
        isActive: true,
      },
    });
    const service = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Corte',
        price: '40.00',
        durationMinutes: 30,
        points: 10,
        isActive: true,
      },
    });
    const courtesy = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Cortesia',
        price: '0.00',
        durationMinutes: 30,
        points: 0,
        isActive: true,
      },
    });
    clientAId = clientA.id;
    clientBId = clientB.id;
    professionalAId = professional.id;
    serviceAId = service.id;
    serviceZeroId = courtesy.id;

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
    await prisma.professionalSchedule.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalSchedule.createMany({
      data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        tenantId: tenantA.id,
        professionalId: professionalAId,
        dayOfWeek,
        startTime: '08:00',
        endTime: '18:00',
        isActive: true,
      })),
    });
    await prisma.service.update({ where: { id: serviceAId }, data: { points: 10, isActive: true } });
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

  async function book(slot: { date: string; time: string }, serviceId = serviceAId): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ professionalId: professionalAId, serviceId, date: slot.date, time: slot.time })
      .expect(201);
    return created.body.id as string;
  }

  async function balance(): Promise<number> {
    const response = await request(app.getHttpServer())
      .get('/api/v1/points/me')
      .set(auth(clientToken))
      .expect(200);
    return response.body.balance as number;
  }

  it('earns the appointment snapshot once and ignores cancel, no-show and zero points', async () => {
    const earned = await book(futureSlot(1, '10:00'));
    const cancelled = await book(futureSlot(1, '11:00'));
    const missed = await book(futureSlot(1, '12:00'));
    const courtesy = await book(futureSlot(1, '13:00'), serviceZeroId);
    expect(
      (
        await request(app.getHttpServer()).get(`/api/v1/appointments/${earned}`).set(auth(clientToken))
      ).body.pointsSnapshot,
    ).toBe(10);

    await prisma.service.update({ where: { id: serviceAId }, data: { points: 20, isActive: false } });
    const completed = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${earned}/complete`)
      .set(auth(professionalToken))
      .expect(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(await balance()).toBe(10);

    const again = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${earned}/complete`)
      .set(auth(professionalToken))
      .expect(409);
    expect(again.body.message).toBe('A transição de status não é permitida.');
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: earned, type: 'EARN' } })).toBe(1);

    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${cancelled}/cancel`)
      .set(auth(clientToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${missed}/no-show`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${courtesy}/complete`)
      .set(auth(professionalToken))
      .expect(200);

    expect(await balance()).toBe(10);
    const statement = await request(app.getHttpServer())
      .get('/api/v1/points/me/transactions')
      .set(auth(clientToken))
      .expect(200);
    expect(statement.body.data).toEqual([
      expect.objectContaining({
        type: 'EARN',
        points: 10,
        appointmentId: earned,
        serviceName: 'Corte',
        reason: 'Atendimento concluído: Corte',
      }),
    ]);
    expect(statement.body.meta.total).toBe(1);
    expect(
      await prisma.pointsTransaction.count({ where: { clientId: clientAId } }),
    ).toBe(1);
  });

  it('keeps a single earn when two completions run together', async () => {
    const appointmentId = await book(futureSlot(2, '15:00'));
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).patch(`/api/v1/appointments/${appointmentId}/complete`).set(auth(professionalToken)),
      request(app.getHttpServer()).patch(`/api/v1/appointments/${appointmentId}/complete`).set(auth(adminToken)),
    ]);
    const statuses = [first.status, second.status].sort((left, right) => left - right);
    expect(statuses).toEqual([200, 409]);
    expect((first.status === 409 ? first : second).body.message).toBe(
      'A transição de status não é permitida.',
    );
    expect(await prisma.pointsTransaction.count({ where: { type: 'EARN', appointmentId } })).toBe(1);
    expect(await balance()).toBe(10);
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(stored.status).toBe('COMPLETED');
  });

  it('adjusts credits and debits without going negative or accepting a forged earn', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 10, reason: 'Boas-vindas' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 20, reason: 'Bonificação' })
      .expect(201);
    const debit = await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_DEBIT', points: 15, reason: 'Correção' })
      .expect(201);
    expect(debit.body.balance).toBe(15);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 5, reason: 'Ajuste' })
      .expect(201);

    expect(await balance()).toBe(20);
    const statement = await request(app.getHttpServer())
      .get('/api/v1/points/me/transactions')
      .set(auth(clientToken))
      .expect(200);
    expect(statement.body.data).toHaveLength(4);
    expect(statement.body.meta).toMatchObject({ total: 4, page: 1 });
    const stamps = statement.body.data.map((row: { createdAt: string }) => row.createdAt);
    expect([...stamps].sort().reverse()).toEqual(stamps);
    expect(statement.body.data.map((row: { type: string; points: number }) => `${row.type}:${row.points}`).sort()).toEqual(
      [
        'ADJUSTMENT_CREDIT:10',
        'ADJUSTMENT_CREDIT:20',
        'ADJUSTMENT_CREDIT:5',
        'ADJUSTMENT_DEBIT:15',
      ].sort(),
    );

    const summary = await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientAId}/points`)
      .set(auth(adminToken))
      .expect(200);
    expect(summary.body).toMatchObject({ clientId: clientAId, balance: 20, credits: 35, debits: 15 });
    expect(summary.body.lastTransaction.points).toBe(5);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_DEBIT', points: 100, reason: 'Demais' })
      .expect(409);
    expect(rejected.body.message).toBe('Saldo de pontos insuficiente.');
    expect(await balance()).toBe(20);
    expect(await prisma.pointsTransaction.count({ where: { clientId: clientAId } })).toBe(4);

    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'EARN', points: 10, reason: 'Manual' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 1.5, reason: 'Quebrado' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 10, reason: '   ', newBalance: 999 })
      .expect(400);
  });

  it('accepts only one of two simultaneous debits against the same balance', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 100, reason: 'Saldo inicial' })
      .expect(201);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/clients/${clientAId}/points/adjustments`)
        .set(auth(adminToken))
        .send({ type: 'ADJUSTMENT_DEBIT', points: 80, reason: 'Resgate A' }),
      request(app.getHttpServer())
        .post(`/api/v1/clients/${clientAId}/points/adjustments`)
        .set(auth(adminToken))
        .send({ type: 'ADJUSTMENT_DEBIT', points: 80, reason: 'Resgate B' }),
    ]);
    const statuses = [first.status, second.status].sort((left, right) => left - right);
    expect(statuses).toEqual([201, 409]);
    expect((first.status === 409 ? first : second).body.message).toBe('Saldo de pontos insuficiente.');
    const summary = await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientAId}/points`)
      .set(auth(adminToken))
      .expect(200);
    expect(summary.body.balance).toBe(20);
    expect(
      await prisma.pointsTransaction.count({
        where: { clientId: clientAId, type: 'ADJUSTMENT_DEBIT' },
      }),
    ).toBe(1);
  });

  it('isolates tenants and keeps professional and client away from adjustments', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 8, reason: 'Somente A' })
      .expect(201);
    const transactionId = created.body.transaction.id as string;

    await request(app.getHttpServer()).get(`/api/v1/clients/${clientAId}/points`).set(auth(adminTokenB)).expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientAId}/points/transactions`)
      .set(auth(adminTokenB))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(adminTokenB))
      .send({ type: 'ADJUSTMENT_DEBIT', points: 1, reason: 'Outro tenant' })
      .expect(404);
    await request(app.getHttpServer()).get(`/api/v1/clients/${clientBId}/points`).set(auth(adminToken)).expect(404);

    await request(app.getHttpServer()).get('/api/v1/points/me').set(auth(clientTwoToken)).expect(200);
    expect(
      (await request(app.getHttpServer()).get('/api/v1/points/me').set(auth(clientTwoToken))).body.balance,
    ).toBe(0);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(clientToken))
      .send({ type: 'ADJUSTMENT_CREDIT', points: 10, reason: 'Eu mesmo' })
      .expect(403);
    await request(app.getHttpServer()).get(`/api/v1/clients/${clientAId}/points`).set(auth(clientToken)).expect(403);
    await request(app.getHttpServer()).get('/api/v1/points/me').set(auth(professionalToken)).expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientAId}/points/transactions`)
      .set(auth(professionalToken))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/clients/${clientAId}/points/adjustments`)
      .set(auth(professionalToken))
      .send({ type: 'ADJUSTMENT_DEBIT', points: 1, reason: 'Profissional' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/points/transactions/${transactionId}`)
      .set(auth(adminToken))
      .send({ points: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/points/transactions/${transactionId}`)
      .set(auth(adminToken))
      .expect(404);
    expect(await prisma.pointsTransaction.count({ where: { id: transactionId, points: 8 } })).toBe(1);
  });
});
