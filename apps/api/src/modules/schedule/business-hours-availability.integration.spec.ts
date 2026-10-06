import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UserRole, type BusinessHours, type BusinessHoursDay } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';
import { addDays, dayOfWeek, nextOrSameDate, todayInScheduleZone } from '../../common/time/schedule-clock';
import { toStoredBusinessHours } from '../settings/business-hours';

const password = 'senha-segura-123';
const today = todayInScheduleZone();
const sameOrNextMonday = nextOrSameDate(today, 1);
const monday = sameOrNextMonday === today ? addDays(today, 7) : sameOrNextMonday;
const yesterday = addDays(today, -1);

const closedDay: BusinessHoursDay = { enabled: false, open: null, close: null };

function week(mondayHours: BusinessHoursDay, other: BusinessHoursDay = closedDay): BusinessHours {
  return toStoredBusinessHours({
    monday: mondayHours,
    tuesday: other,
    wednesday: other,
    thursday: other,
    friday: other,
    saturday: other,
    sunday: other,
  });
}

function openDay(open: string, close: string): BusinessHoursDay {
  return { enabled: true, open, close };
}

describe('business hours inside availability', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Horas A', slug: `fase113-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Horas B', slug: `fase113-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];

  let app: INestApplication;
  let clientToken = '';
  let clientTokenB = '';
  let professionalAId = '';
  let professionalBId = '';
  let serviceAId = '';
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

    await prisma.client.create({ data: { tenantId: tenantA.id, userId: clientUser.id, isActive: true } });
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

    professionalAId = professionalA.id;
    professionalBId = professionalB.id;
    serviceAId = serviceA.id;
    serviceBId = serviceB.id;

    await prisma.professionalSchedule.create({
      data: {
        tenantId: tenantB.id,
        professionalId: professionalB.id,
        dayOfWeek: 1,
        startTime: '07:00',
        endTime: '20:00',
      },
    });
    await saveHours(tenantB.id, week(closedDay));

    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
    clientToken = await login(tenantA.slug, `cliente.${suffix}@example.com`);
    clientTokenB = await login(tenantB.slug, `cliente.b.${suffix}@example.com`);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.userSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalScheduleException.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalTimeBlock.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalSchedule.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenantSetting.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professional.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.client.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.service.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

  async function saveHours(tenantId: string, hours: BusinessHours): Promise<void> {
    await prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'business_hours' } },
      create: { tenantId, key: 'business_hours', value: JSON.stringify(hours) },
      update: { value: JSON.stringify(hours) },
    });
  }

  async function resetProfessionalA(startTime = '07:00', endTime = '20:00'): Promise<void> {
    await prisma.appointment.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalScheduleException.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalTimeBlock.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalSchedule.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.tenantSetting.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.professionalSchedule.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        dayOfWeek: 1,
        startTime,
        endTime,
      },
    });
  }

  async function slots(token: string, professionalId: string, serviceId: string, date: string): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalId}/availability`)
      .query({ date, serviceId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body.slots as string[];
  }

  it('keeps the professional shift when business_hours is absent', async () => {
    await resetProfessionalA();

    const available = await slots(clientToken, professionalAId, serviceAId, monday);

    expect(dayOfWeek(monday)).toBe(1);
    expect(available[0]).toBe('07:00');
    expect(available.at(-1)).toBe('19:30');
    expect(available).not.toContain('19:45');
  });

  it('hides starts before opening and after the last slot that finishes at closing', async () => {
    await resetProfessionalA();
    await saveHours(tenantA.id, week(openDay('08:00', '18:00'), openDay('08:00', '18:00')));

    const available = await slots(clientToken, professionalAId, serviceAId, monday);

    expect(available[0]).toBe('08:00');
    expect(available).not.toContain('07:00');
    expect(available).not.toContain('07:45');
    expect(available.at(-1)).toBe('17:30');
    expect(available).not.toContain('17:45');
    expect(available).not.toContain('18:00');
    expect(available).not.toContain('19:30');
  });

  it('returns only the overlap when the professional covers part of the establishment', async () => {
    await resetProfessionalA('08:00', '12:00');
    await saveHours(tenantA.id, week(openDay('10:00', '16:00')));

    const available = await slots(clientToken, professionalAId, serviceAId, monday);

    expect(available[0]).toBe('10:00');
    expect(available.at(-1)).toBe('11:30');
    expect(available).not.toContain('09:45');
    expect(available).not.toContain('12:00');
  });

  it('returns no slots when the establishment is closed that day', async () => {
    await resetProfessionalA();
    await saveHours(tenantA.id, week(closedDay, openDay('08:00', '18:00')));

    expect(await slots(clientToken, professionalAId, serviceAId, monday)).toEqual([]);
  });

  it('still removes a professional time block inside the intersection', async () => {
    await resetProfessionalA();
    await saveHours(tenantA.id, week(openDay('08:00', '18:00')));
    await prisma.professionalTimeBlock.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        startAt: new Date(`${monday}T12:00:00-03:00`),
        endAt: new Date(`${monday}T13:00:00-03:00`),
      },
    });

    const available = await slots(clientToken, professionalAId, serviceAId, monday);

    expect(available).toContain('11:30');
    expect(available).not.toContain('12:00');
    expect(available).not.toContain('12:30');
    expect(available).toContain('13:00');
    expect(available).not.toContain('07:45');
  });

  it('clips an OPEN exception to the establishment and keeps a full-day BLOCK', async () => {
    await resetProfessionalA();
    await prisma.professionalSchedule.deleteMany({ where: { professionalId: professionalAId } });
    await saveHours(tenantA.id, week(openDay('08:00', '18:00')));
    await prisma.professionalScheduleException.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        date: monday,
        startTime: '07:00',
        endTime: '20:00',
        type: 'OPEN',
      },
    });

    const opened = await slots(clientToken, professionalAId, serviceAId, monday);
    expect(opened[0]).toBe('08:00');
    expect(opened.at(-1)).toBe('17:30');
    expect(opened).not.toContain('07:00');

    await prisma.professionalScheduleException.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalSchedule.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        dayOfWeek: 1,
        startTime: '07:00',
        endTime: '20:00',
      },
    });
    await prisma.professionalScheduleException.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        date: monday,
        startTime: null,
        endTime: null,
        type: 'BLOCK',
      },
    });

    expect(await slots(clientToken, professionalAId, serviceAId, monday)).toEqual([]);
  });

  it('keeps a past date empty even when the establishment is open', async () => {
    await resetProfessionalA();
    await prisma.professionalSchedule.create({
      data: {
        tenantId: tenantA.id,
        professionalId: professionalAId,
        dayOfWeek: dayOfWeek(yesterday),
        startTime: '08:00',
        endTime: '18:00',
      },
    });
    await saveHours(tenantA.id, week(openDay('08:00', '18:00'), openDay('08:00', '18:00')));

    expect(await slots(clientToken, professionalAId, serviceAId, yesterday)).toEqual([]);
  });

  it('never applies business_hours from another tenant', async () => {
    await resetProfessionalA();
    await saveHours(tenantA.id, week(openDay('08:00', '18:00')));

    const own = await slots(clientToken, professionalAId, serviceAId, monday);
    const other = await slots(clientTokenB, professionalBId, serviceBId, monday);

    expect(own[0]).toBe('08:00');
    expect(other).toEqual([]);
  });

  it('restores the professional shift after business_hours is removed', async () => {
    await resetProfessionalA();
    await saveHours(tenantA.id, week(openDay('10:00', '16:00')));
    expect((await slots(clientToken, professionalAId, serviceAId, monday))[0]).toBe('10:00');

    await prisma.tenantSetting.deleteMany({ where: { tenantId: tenantA.id } });

    const available = await slots(clientToken, professionalAId, serviceAId, monday);
    expect(available[0]).toBe('07:00');
    expect(available.at(-1)).toBe('19:30');
  });

  it('rejects a stored business_hours document that is no longer valid', async () => {
    await resetProfessionalA();
    await prisma.tenantSetting.create({
      data: { tenantId: tenantA.id, key: 'business_hours', value: '{' },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: monday, serviceId: serviceAId })
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(400);

    expect(response.body.message).toBe('Horário de funcionamento armazenado é inválido.');
  });

  it('refuses a booking outside the establishment and accepts one on the opening boundary', async () => {
    await resetProfessionalA();
    await saveHours(tenantA.id, week(openDay('08:00', '18:00')));

    const tooEarly = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ professionalId: professionalAId, serviceId: serviceAId, date: monday, time: '07:00' })
      .expect(409);
    expect(tooEarly.body.message).toBe('Este horário não está mais disponível.');

    const pastClose = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ professionalId: professionalAId, serviceId: serviceAId, date: monday, time: '17:45' })
      .expect(409);
    expect(pastClose.body.message).toBe('Este horário não está mais disponível.');

    const booked = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ professionalId: professionalAId, serviceId: serviceAId, date: monday, time: '08:00' })
      .expect(201);
    expect(booked.body.startAt).toContain('T08:00:00');
  });
});
