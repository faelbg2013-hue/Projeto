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
const clock = { current: new Date('2026-10-05T08:00:00-03:00') };
const closedDay: BusinessHoursDay = { enabled: false, open: null, close: null };

function openDay(open: string, close: string): BusinessHoursDay {
  return { enabled: true, open, close };
}

describe('appointment buffer', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Buffer A', slug: `fase115-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Buffer B', slug: `fase115-b-${suffix}` };
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
    clock.current = new Date('2026-10-05T08:00:00-03:00');
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
      data: [
        {
          tenantId: tenantA.id,
          professionalId: professionalAId,
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '20:00',
        },
        {
          tenantId: tenantB.id,
          professionalId: professionalBId,
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '20:00',
        },
      ],
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

  async function saveBuffer(minutes: number): Promise<void> {
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set(auth(adminToken))
      .send({ settings: { appointment_buffer_minutes: minutes } })
      .expect(200);
  }

  async function slots(token: string, professionalId: string, serviceId: string, day = date): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalId}/availability`)
      .query({ date: day, serviceId })
      .set(auth(token))
      .expect(200);
    return response.body.slots as string[];
  }

  async function book(
    token: string,
    time: string,
    serviceId = serviceAId,
    mode?: 'POINTS',
  ): Promise<request.Response> {
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

  it('keeps a touching start when the buffer is absent', async () => {
    const created = await book(clientToken, '10:00');
    expect(created.status).toBe(201);
    expect(created.body.endAt).toBe(`${date}T10:30:00-03:00`);
    expect(created.body.durationMinutes).toBe(30);

    const available = await slots(clientToken, professionalAId, serviceAId);
    expect(available).toContain('10:30');
    expect(available).not.toContain('10:10');
    expect(available.filter((slot) => slot > '10:00' && slot < '10:30')).toEqual([]);
  });

  it('blocks the buffer and allows the first grid start after it', async () => {
    await saveBuffer(15);
    expect((await book(clientToken, '10:00')).status).toBe(201);

    const available = await slots(clientToken, professionalAId, serviceAId);
    expect(available).not.toContain('10:30');
    expect(available).toContain('10:45');

    const inside = await book(clientToken, '10:30');
    expect(inside.status).toBe(409);
    expect(inside.body.message).toBe('Este horário não está mais disponível.');

    const exact = await book(clientToken, '10:45');
    expect(exact.status).toBe(201);
    expect(exact.body.startAt).toBe(`${date}T10:45:00-03:00`);
    expect(exact.body.endAt).toBe(`${date}T11:15:00-03:00`);
  });

  it('does not round a 10 minute buffer onto the 15 minute grid', async () => {
    await saveBuffer(10);
    expect((await book(clientToken, '10:00')).status).toBe(201);

    const available = await slots(clientToken, professionalAId, serviceAId);
    expect(available).not.toContain('10:30');
    expect(available).not.toContain('10:40');
    expect(available).toContain('10:45');
  });

  it('rejects a new appointment whose own buffer reaches the next one', async () => {
    await saveBuffer(30);
    expect((await book(clientToken, '11:00')).status).toBe(201);

    const available = await slots(clientToken, professionalAId, serviceAId);
    expect(available).not.toContain('10:15');
    expect(available).toContain('10:00');

    const invading = await book(clientToken, '10:15');
    expect(invading.status).toBe(409);
    const allowed = await book(clientToken, '10:00');
    expect(allowed.status).toBe(201);
    expect(allowed.body.endAt).toBe(`${date}T10:30:00-03:00`);
  });

  it('ignores a cancelled appointment and keeps another tenant without buffer', async () => {
    await saveBuffer(15);
    const cancelled = await book(clientToken, '12:00');
    expect(cancelled.status).toBe(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${cancelled.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(200);

    expect(await slots(clientToken, professionalAId, serviceAId)).toContain('12:00');
    expect((await book(clientToken, '10:00')).status).toBe(201);
    expect(await slots(clientToken, professionalAId, serviceAId)).not.toContain('10:30');

    await prisma.tenantSetting.create({
      data: { tenantId: tenantB.id, key: 'appointment_buffer_minutes', value: '0' },
    });
    const other = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientTokenB))
      .send({ professionalId: professionalBId, serviceId: serviceBId, date, time: '10:00' })
      .expect(201);
    expect(other.body.endAt).toBe(`${date}T10:30:00-03:00`);
    expect(await slots(clientTokenB, professionalBId, serviceBId)).toContain('10:30');
  });

  it('lets the last service end at closing and at the shift end while the buffer runs past them', async () => {
    await saveBuffer(15);
    await prisma.tenantSetting.create({
      data: {
        tenantId: tenantA.id,
        key: 'business_hours',
        value: JSON.stringify(
          toStoredBusinessHours({
            monday: openDay('08:00', '18:00'),
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

    const byHours = await slots(clientToken, professionalAId, serviceAId);
    expect(byHours).toContain('17:30');
    expect(byHours).not.toContain('17:45');
    expect(byHours).not.toContain('18:00');
    const closing = await book(clientToken, '17:30');
    expect(closing.status).toBe(201);
    expect(closing.body.endAt).toBe(`${date}T18:00:00-03:00`);

    await prisma.appointment.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.tenantSetting.deleteMany({ where: { tenantId: tenantA.id, key: 'business_hours' } });
    await prisma.professionalSchedule.updateMany({
      where: { professionalId: professionalAId },
      data: { endTime: '18:00' },
    });
    const byShift = await slots(clientToken, professionalAId, serviceAId);
    expect(byShift).toContain('17:30');
    expect(byShift).not.toContain('17:45');
    const shiftEnd = await book(clientToken, '17:30');
    expect(shiftEnd.status).toBe(201);
    expect(shiftEnd.body.endAt).toBe(`${date}T18:00:00-03:00`);
  });

  it('keeps blocks, exceptions, advance and past dates in force', async () => {
    await saveBuffer(15);
    await prisma.professionalTimeBlock.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        startAt: new Date(`${date}T12:00:00-03:00`),
        endAt: new Date(`${date}T13:00:00-03:00`),
      },
    });
    const blocked = await slots(clientToken, professionalAId, serviceAId);
    expect(blocked).toContain('11:30');
    expect(blocked).not.toContain('11:45');
    expect(blocked).not.toContain('12:00');
    expect(blocked).toContain('13:00');

    await prisma.professionalTimeBlock.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalSchedule.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalScheduleException.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        date,
        startTime: '08:00',
        endTime: '12:00',
        type: 'OPEN',
      },
    });
    expect((await slots(clientToken, professionalAId, serviceAId))[0]).toBe('08:00');

    await prisma.professionalScheduleException.deleteMany({ where: { professionalId: professionalAId } });
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
    await prisma.professionalSchedule.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '20:00',
      },
    });
    expect(await slots(clientToken, professionalAId, serviceAId)).toEqual([]);

    await prisma.professionalScheduleException.deleteMany({ where: { professionalId: professionalAId } });
    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set(auth(adminToken))
      .send({ settings: { booking_min_advance_minutes: 60, cancellation_min_advance_minutes: 120 } })
      .expect(200);
    clock.current = new Date('2026-10-05T10:07:00-03:00');
    expect((await book(clientToken, '11:30')).status).toBe(201);
    const advanced = await slots(clientToken, professionalAId, serviceAId);
    expect(advanced).not.toContain('11:00');
    expect(advanced).not.toContain('11:15');
    expect(advanced).not.toContain('12:00');
    expect(advanced).toContain('12:15');

    clock.current = new Date('2026-10-05T13:00:00-03:00');
    const late = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${(await prisma.appointment.findFirstOrThrow({ where: { professionalId: professionalAId } })).id}/cancel`)
      .set(auth(clientToken));
    expect(late.status).toBe(409);
    expect(late.body.message).toBe('O cancelamento pelo cliente exige mais antecedência.');

    const past = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: '2026-10-04', serviceId: serviceAId })
      .set(auth(clientToken))
      .expect(200);
    expect(past.body.slots).toEqual([]);
  });

  it('protects two simultaneous bookings that only collide because of the buffer', async () => {
    await saveBuffer(15);
    const [first, second] = await Promise.all([book(clientToken, '10:00'), book(clientToken, '10:30')]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await prisma.appointment.count({ where: { professionalId: professionalAId, status: 'CONFIRMED' } })).toBe(1);
  });

  it('books with points on a free slot and does not redeem when the buffer rejects the next one', async () => {
    await saveBuffer(15);
    await prisma.pointsTransaction.create({
      data: {
        tenantId: tenantA.id,
        clientId: clientAId,
        type: 'ADJUSTMENT_CREDIT',
        points: 100,
        reason: 'Saldo para o intervalo',
      },
    });

    const created = await book(clientToken, '14:00', pointsServiceId, 'POINTS');
    expect(created.status).toBe(201);
    expect(created.body.bookingMode).toBe('POINTS');
    expect(await prisma.pointsTransaction.count({ where: { appointmentId: created.body.id as string, type: 'REDEEM' } })).toBe(1);

    const rejected = await book(clientToken, '14:30', pointsServiceId, 'POINTS');
    expect(rejected.status).toBe(409);
    expect(await prisma.appointment.count({ where: { professionalId: professionalAId } })).toBe(1);
    expect(await prisma.pointsTransaction.count({ where: { clientId: clientAId, type: 'REDEEM' } })).toBe(1);
  });
});
