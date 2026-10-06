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
const clock = { current: new Date('2026-10-06T08:00:00-03:00') };
const inside = '2026-10-07';
const limit = '2026-11-05';
const beyond = '2026-11-06';
const closedDay: BusinessHoursDay = { enabled: false, open: null, close: null };

function openDay(open: string, close: string): BusinessHoursDay {
  return { enabled: true, open, close };
}

describe('booking max advance days', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Horizon A', slug: `fase116-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Horizon B', slug: `fase116-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
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
    await prisma.user.create({
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

    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp({ now: () => clock.current });
    adminToken = await login(tenantA.slug, `admin.${suffix}@example.com`);
    clientToken = await login(tenantA.slug, `cliente.${suffix}@example.com`);
    clientTokenB = await login(tenantB.slug, `cliente.b.${suffix}@example.com`);
  });

  beforeEach(async () => {
    clock.current = new Date('2026-10-06T08:00:00-03:00');
    await prisma.pointsTransaction.deleteMany({
      where: { tenantId: { in: tenantIds }, reversalOfTransactionId: { not: null } },
    });
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalScheduleException.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalTimeBlock.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalSchedule.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantSetting.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalSchedule.createMany({
      data: [1, 2, 3, 4, 5, 6, 7].flatMap((dayOfWeek) => [
        {
          tenantId: tenantA.id,
          professionalId: professionalAId,
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
        },
        {
          tenantId: tenantB.id,
          professionalId: professionalBId,
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
        },
      ]),
    });
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

  async function saveHorizon(days: number, extra: Record<string, number> = {}): Promise<void> {
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set(auth(adminToken))
      .send({ settings: { booking_max_advance_days: days, ...extra } })
      .expect(200);
  }

  async function slots(token: string, professionalId: string, serviceId: string, date: string): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalId}/availability`)
      .query({ date, serviceId })
      .set(auth(token))
      .expect(200);
    return response.body.slots as string[];
  }

  function book(token: string, date: string, time: string, serviceId = serviceAId, mode?: 'POINTS') {
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

  it('keeps a far date open when the horizon is absent', async () => {
    const available = await slots(clientToken, professionalAId, serviceAId, '2026-12-01');
    expect(available).toContain('10:00');
    expect(available).not.toContain('10:10');
    expect(available.filter((slot) => !/^\d{2}:(00|15|30|45)$/.test(slot))).toEqual([]);

    const past = await slots(clientToken, professionalAId, serviceAId, '2026-10-05');
    expect(past).toEqual([]);

    const created = await book(clientToken, '2026-12-01', '10:00');
    expect(created.status).toBe(201);
    expect(created.body.endAt).toBe('2026-12-01T10:30:00-03:00');
    expect(created.body.durationMinutes).toBe(30);
  });

  it('allows the limit date and rejects the following day on availability and on create', async () => {
    await saveHorizon(30);

    expect(await slots(clientToken, professionalAId, serviceAId, inside)).toContain('10:00');
    expect(await slots(clientToken, professionalAId, serviceAId, limit)).toContain('10:00');
    expect(await slots(clientToken, professionalAId, serviceAId, beyond)).toEqual([]);

    const allowed = await book(clientToken, limit, '10:00');
    expect(allowed.status).toBe(201);
    expect(allowed.body.startAt).toBe(`${limit}T10:00:00-03:00`);
    expect(allowed.body.endAt).toBe(`${limit}T10:30:00-03:00`);

    const rejected = await book(clientToken, beyond, '10:00');
    expect(rejected.status).toBe(409);
    expect(rejected.body.message).toBe('Este horário não está mais disponível.');
    expect(await prisma.appointment.count({ where: { professionalId: professionalAId, startAt: { gte: new Date(`${beyond}T00:00:00-03:00`) } } })).toBe(0);
  });

  it('keeps another tenant on its own horizon', async () => {
    await saveHorizon(7);
    await prisma.tenantSetting.create({
      data: { tenantId: tenantB.id, key: 'booking_max_advance_days', value: '30' },
    });

    expect(await slots(clientToken, professionalAId, serviceAId, '2026-10-13')).toContain('10:00');
    expect(await slots(clientToken, professionalAId, serviceAId, '2026-10-14')).toEqual([]);
    expect(await slots(clientTokenB, professionalBId, serviceBId, '2026-10-14')).toContain('10:00');
  });

  it('counts calendar days in America/Sao_Paulo, including an afternoon on the limit day', async () => {
    await saveHorizon(1);
    clock.current = new Date('2026-10-06T01:00:00-03:00');

    expect(await slots(clientToken, professionalAId, serviceAId, '2026-10-07')).toContain('17:30');
    expect(await slots(clientToken, professionalAId, serviceAId, '2026-10-08')).toEqual([]);

    clock.current = new Date('2026-10-07T02:00:00.000Z');
    expect(await slots(clientToken, professionalAId, serviceAId, '2026-10-07')).toContain('08:00');
    expect(await slots(clientToken, professionalAId, serviceAId, '2026-10-08')).toEqual([]);
  });

  it('keeps minimum advance, business hours, buffer, blocks and exceptions beside the horizon', async () => {
    await saveHorizon(30, { booking_min_advance_minutes: 60, cancellation_min_advance_minutes: 120, appointment_buffer_minutes: 15 });
    clock.current = new Date('2026-10-06T10:07:00-03:00');
    const today = await slots(clientToken, professionalAId, serviceAId, '2026-10-06');
    expect(today).not.toContain('11:00');
    expect(today).toContain('11:15');
    expect(await slots(clientToken, professionalAId, serviceAId, beyond)).toEqual([]);

    await prisma.tenantSetting.create({
      data: {
        tenantId: tenantA.id,
        key: 'business_hours',
        value: JSON.stringify(
          toStoredBusinessHours({
            monday: closedDay,
            tuesday: openDay('08:00', '18:00'),
            wednesday: openDay('08:00', '12:00'),
            thursday: closedDay,
            friday: closedDay,
            saturday: closedDay,
            sunday: closedDay,
          }),
        ),
      },
    });
    const byHours = await slots(clientToken, professionalAId, serviceAId, inside);
    expect(byHours).toContain('11:30');
    expect(byHours).not.toContain('11:45');

    expect((await book(clientToken, inside, '10:00')).status).toBe(201);
    const buffered = await slots(clientToken, professionalAId, serviceAId, inside);
    expect(buffered).not.toContain('10:30');
    expect(buffered).toContain('10:45');

    await prisma.appointment.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalTimeBlock.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        startAt: new Date(`${inside}T12:00:00-03:00`),
        endAt: new Date(`${inside}T13:00:00-03:00`),
      },
    });
    const blocked = await slots(clientToken, professionalAId, serviceAId, inside);
    expect(blocked).toContain('11:30');
    expect(blocked).not.toContain('11:45');

    await prisma.professionalScheduleException.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        date: inside,
        startTime: null,
        endTime: null,
        type: 'BLOCK',
      },
    });
    expect(await slots(clientToken, professionalAId, serviceAId, inside)).toEqual([]);

    await prisma.professionalScheduleException.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalSchedule.deleteMany({ where: { professionalId: professionalAId, dayOfWeek: 3 } });
    await prisma.professionalScheduleException.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        date: inside,
        startTime: '08:00',
        endTime: '12:00',
        type: 'OPEN',
      },
    });
    expect((await slots(clientToken, professionalAId, serviceAId, inside))[0]).toBe('08:00');
  });

  it('still rejects a late client cancellation and a double booking inside the horizon', async () => {
    await saveHorizon(30, { cancellation_min_advance_minutes: 120 });
    const created = await book(clientToken, inside, '15:00');
    expect(created.status).toBe(201);
    clock.current = new Date('2026-10-07T14:00:00-03:00');
    const late = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id as string}/cancel`)
      .set(auth(clientToken));
    expect(late.status).toBe(409);
    expect(late.body.message).toBe('O cancelamento pelo cliente exige mais antecedência.');

    clock.current = new Date('2026-10-06T08:00:00-03:00');
    await prisma.appointment.deleteMany({ where: { professionalId: professionalAId } });
    const [first, second] = await Promise.all([book(clientToken, inside, '11:00'), book(clientToken, inside, '11:00')]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await prisma.appointment.count({ where: { professionalId: professionalAId, status: 'CONFIRMED' } })).toBe(1);
  });

  it('redeems points inside the horizon and writes nothing beyond it', async () => {
    await saveHorizon(30);
    await prisma.pointsTransaction.create({
      data: {
        tenantId: tenantA.id,
        clientId: clientAId,
        type: 'ADJUSTMENT_CREDIT',
        points: 100,
        reason: 'Saldo para a janela',
      },
    });

    const created = await book(clientToken, inside, '14:00', pointsServiceId, 'POINTS');
    expect(created.status).toBe(201);
    expect(created.body.bookingMode).toBe('POINTS');
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: created.body.id as string, type: 'REDEEM' } })).toBe(1);

    const rejected = await book(clientToken, beyond, '14:00', pointsServiceId, 'POINTS');
    expect(rejected.status).toBe(409);
    expect(await prisma.appointment.count({ where: { professionalId: professionalAId } })).toBe(1);
    expect(await prisma.pointsTransaction.count({ where: { clientId: clientAId, type: 'REDEEM' } })).toBe(1);
  });
});
