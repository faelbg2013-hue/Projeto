import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { BusinessHoursDay } from '@ravion/types';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';
import { toStoredBusinessHours } from '../settings/business-hours';

const password = 'senha-segura-123';
const date = '2026-10-05';
const clock = { current: new Date('2026-10-05T10:07:00-03:00') };

const closedDay: BusinessHoursDay = { enabled: false, open: null, close: null };

function openDay(open: string, close: string): BusinessHoursDay {
  return { enabled: true, open, close };
}

describe('advance policies', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Antecedência A', slug: `fase114-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Antecedência B', slug: `fase114-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let clientTokenB = '';
  let clientAId = '';
  let professionalAId = '';
  let professionalBId = '';
  let serviceAId = '';
  let pointsServiceId = '';
  let serviceBId = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
      ],
    });
    const clientUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Cliente A',
        email: `cliente.${suffix}@example.com`,
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const adminUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Admin A',
        email: `admin.${suffix}@example.com`,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    const professionalUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Carlos',
        email: `pro.${suffix}@example.com`,
        passwordHash,
        role: UserRole.PROFESSIONAL,
        isActive: true,
      },
    });
    const clientUserB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        name: 'Cliente B',
        email: `cliente.b.${suffix}@example.com`,
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const professionalUserB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        name: 'Bruno',
        email: `pro.b.${suffix}@example.com`,
        passwordHash,
        role: UserRole.PROFESSIONAL,
        isActive: true,
      },
    });
    const clientA = await prisma.client.create({
      data: { tenantId: tenantA.id, userId: clientUser.id, isActive: true },
    });
    await prisma.client.create({ data: { tenantId: tenantB.id, userId: clientUserB.id, isActive: true } });
    const professionalA = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: professionalUser.id, displayName: 'Carlos', isActive: true },
    });
    const professionalB = await prisma.professional.create({
      data: { tenantId: tenantB.id, userId: professionalUserB.id, displayName: 'Bruno', isActive: true },
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
    const pointsService = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Corte pontos',
        price: '45.00',
        durationMinutes: 30,
        points: 10,
        redemptionPoints: 20,
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
    professionalBId = professionalB.id;
    serviceAId = serviceA.id;
    pointsServiceId = pointsService.id;
    serviceBId = serviceB.id;
    await prisma.professionalSchedule.createMany({
      data: [professionalA.id, professionalB.id].map((professionalId) => ({
        tenantId: professionalId === professionalA.id ? tenantA.id : tenantB.id,
        professionalId,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '18:00',
      })),
    });
    void adminUser;

    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp({ now: () => clock.current });
    adminToken = await login(tenantA.slug, `admin.${suffix}@example.com`);
    clientToken = await login(tenantA.slug, `cliente.${suffix}@example.com`);
    professionalToken = await login(tenantA.slug, `pro.${suffix}@example.com`);
    clientTokenB = await login(tenantB.slug, `cliente.b.${suffix}@example.com`);
  });

  beforeEach(async () => {
    clock.current = new Date('2026-10-05T10:07:00-03:00');
    await prisma.pointsTransaction.deleteMany({
      where: { tenantId: { in: tenantIds }, reversalOfTransactionId: { not: null } },
    });
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalScheduleException.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalTimeBlock.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantSetting.deleteMany({ where: { tenantId: { in: tenantIds } } });
  });

  afterAll(async () => {
    await app?.close();
    await prisma.pointsTransaction.deleteMany({
      where: { tenantId: { in: tenantIds }, reversalOfTransactionId: { not: null } },
    });
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalScheduleException.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalTimeBlock.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalSchedule.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantSetting.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

  async function saveAdvance(booking: number, cancellation = 0): Promise<void> {
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set(auth(adminToken))
      .send({
        settings: {
          booking_min_advance_minutes: booking,
          cancellation_min_advance_minutes: cancellation,
        },
      })
      .expect(200);
  }

  async function slots(token: string, professionalId: string, serviceId: string): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalId}/availability`)
      .query({ date, serviceId })
      .set(auth(token))
      .expect(200);
    return response.body.slots as string[];
  }

  async function book(token: string, time: string, serviceId = serviceAId, mode?: 'POINTS'): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(token))
      .send({
        professionalId: professionalAId,
        serviceId,
        date,
        time,
        ...(mode ? { bookingMode: mode } : {}),
      });
  }

  it('keeps the current grid and a future booking when the advance is absent', async () => {
    const available = await slots(clientToken, professionalAId, serviceAId);
    expect(available).toContain('08:00');
    expect(available).toContain('11:00');

    const past = await book(clientToken, '08:00');
    expect(past.status).toBe(400);
    expect(past.body.message).toBe('O horário já passou.');

    const created = await book(clientToken, '11:00');
    expect(created.status).toBe(201);
    expect(created.body.startAt).toContain('T11:00:00-03:00');
  });

  it('hides and rejects a start inside the advance, and allows the boundary', async () => {
    await saveAdvance(60);
    const early = await slots(clientToken, professionalAId, serviceAId);
    expect(early).not.toContain('11:00');
    expect(early).toContain('11:15');
    expect(early[0]).toBe('11:15');

    const rejected = await book(clientToken, '11:00');
    expect(rejected.status).toBe(409);
    expect(rejected.body.message).toBe('Este horário não está mais disponível.');

    const created = await book(clientToken, '11:15');
    expect(created.status).toBe(201);
    expect(created.body.startAt).toBe(`${date}T11:15:00-03:00`);

    clock.current = new Date('2026-10-05T10:00:00-03:00');
    await saveAdvance(120);
    const boundary = await slots(clientToken, professionalAId, serviceAId);
    expect(boundary).not.toContain('11:45');
    expect(boundary).toContain('12:00');

    const tooSoon = await book(clientToken, '11:45');
    expect(tooSoon.status).toBe(409);
    const exact = await book(clientToken, '12:00');
    expect(exact.status).toBe(201);
    expect(exact.body.startAt).toBe(`${date}T12:00:00-03:00`);
  });

  it('does not apply another tenant advance', async () => {
    await saveAdvance(60);
    await prisma.tenantSetting.create({
      data: { tenantId: tenantB.id, key: 'booking_min_advance_minutes', value: '600' },
    });

    const own = await slots(clientToken, professionalAId, serviceAId);
    const other = await slots(clientTokenB, professionalBId, serviceBId);

    expect(own).toContain('11:15');
    expect(own).not.toContain('11:00');
    expect(other).toEqual([]);
  });

  it('still clips business hours, blocks, exceptions and past dates', async () => {
    await saveAdvance(60);
    await prisma.tenantSetting.create({
      data: {
        tenantId: tenantA.id,
        key: 'business_hours',
        value: JSON.stringify(
          toStoredBusinessHours({
            monday: openDay('12:00', '16:00'),
            tuesday: closedDay,
            wednesday: closedDay,
            thursday: closedDay,
            friday: closedDay,
            saturday: closedDay,
            sunday: closedDay,
          }),
        ),
      },
    });
    const opened = await slots(clientToken, professionalAId, serviceAId);
    expect(opened[0]).toBe('12:00');
    expect(opened).not.toContain('11:15');
    expect(opened.at(-1)).toBe('15:30');

    await prisma.tenantSetting.deleteMany({ where: { tenantId: tenantA.id, key: 'business_hours' } });
    await prisma.professionalTimeBlock.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        startAt: new Date(`${date}T12:00:00-03:00`),
        endAt: new Date(`${date}T13:00:00-03:00`),
      },
    });
    const blocked = await slots(clientToken, professionalAId, serviceAId);
    expect(blocked).toContain('11:15');
    expect(blocked).not.toContain('12:00');
    expect(blocked).toContain('13:00');

    await prisma.professionalTimeBlock.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalScheduleException.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        date,
        startTime: null,
        endTime: null,
        type: 'BLOCK',
      },
    });
    expect(await slots(clientToken, professionalAId, serviceAId)).toEqual([]);

    const past = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: '2026-10-04', serviceId: serviceAId })
      .set(auth(clientToken))
      .expect(200);
    expect(past.body.slots).toEqual([]);
  });

  it('lets the client cancel before and exactly at the limit', async () => {
    clock.current = new Date('2026-10-05T11:00:00-03:00');
    await saveAdvance(0, 120);
    const early = await book(clientToken, '14:00');
    expect(early.status).toBe(201);
    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${early.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const again = await book(clientToken, '14:00');
    expect(again.status).toBe(201);
    clock.current = new Date('2026-10-05T12:00:00-03:00');
    const exact = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${again.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(200);
    expect(exact.body.status).toBe('CANCELLED');
  });

  it('refuses a late client cancel and still allows admin and professional', async () => {
    clock.current = new Date('2026-10-05T11:00:00-03:00');
    await saveAdvance(0, 120);
    const first = await book(clientToken, '13:30');
    const second = await book(clientToken, '14:00');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    clock.current = new Date('2026-10-05T12:30:00-03:00');

    const denied = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${first.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(409);
    expect(denied.body.message).toBe('O cancelamento pelo cliente exige mais antecedência.');
    const stillThere = await request(app.getHttpServer())
      .get(`/api/v1/appointments/${first.body.id as string}`)
      .set(auth(clientToken))
      .expect(200);
    expect(stillThere.body.status).toBe('CONFIRMED');

    const byAdmin = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${first.body.id as string}/cancel`)
      .set(auth(adminToken))
      .expect(200);
    expect(byAdmin.body.status).toBe('CANCELLED');

    const clientDenied = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${second.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(409);
    expect(clientDenied.body.message).toBe('O cancelamento pelo cliente exige mais antecedência.');
    const byProfessional = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${second.body.id as string}/cancel`)
      .set(auth(professionalToken))
      .expect(200);
    expect(byProfessional.body.status).toBe('CANCELLED');
  });

  it('reverses points once when the client cancels in time and skips the ledger when late', async () => {
    clock.current = new Date('2026-10-05T11:00:00-03:00');
    await saveAdvance(0, 120);
    await prisma.pointsTransaction.create({
      data: {
        tenantId: tenantA.id,
        clientId: clientAId,
        type: 'ADJUSTMENT_CREDIT',
        points: 100,
        reason: 'Saldo para a antecedência',
      },
    });

    const allowed = await book(clientToken, '14:00', pointsServiceId, 'POINTS');
    expect(allowed.status).toBe(201);
    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${allowed.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: allowed.body.id as string, type: 'REDEEM' } })).toBe(1);
    expect(
      await prisma.pointsTransaction.count({ where: { appointmentId: allowed.body.id as string, type: 'REDEEM_REVERSAL' } }),
    ).toBe(1);

    const repeated = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${allowed.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(409);
    expect(repeated.body.message).toBe('A transição de status não é permitida.');
    expect(
      await prisma.pointsTransaction.count({ where: { appointmentId: allowed.body.id as string, type: 'REDEEM_REVERSAL' } }),
    ).toBe(1);

    const late = await book(clientToken, '13:30', pointsServiceId, 'POINTS');
    expect(late.status).toBe(201);
    clock.current = new Date('2026-10-05T12:30:00-03:00');
    const denied = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${late.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(409);
    expect(denied.body.message).toBe('O cancelamento pelo cliente exige mais antecedência.');
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: late.body.id as string, type: 'REDEEM' } })).toBe(1);
    expect(
      await prisma.pointsTransaction.count({ where: { appointmentId: late.body.id as string, type: 'REDEEM_REVERSAL' } }),
    ).toBe(0);
    const unchanged = await prisma.appointment.findUnique({ where: { id: late.body.id as string } });
    expect(unchanged?.status).toBe('CONFIRMED');
  });
});
