import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createIntegrationPrisma } from '../../config/integration-database';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';
import { addDays, nextOrSameDate, todayInScheduleZone } from '../../common/time/schedule-clock';

const password = 'senha-segura-123';
const today = todayInScheduleZone();
const monday = nextOrSameDate(today, 1);
const saturday = nextOrSameDate(today, 6);
const yesterday = addDays(today, -1);

describe('professional schedule and availability', () => {
  const prisma = createIntegrationPrisma();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Agenda A', slug: `fase4-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Agenda B', slug: `fase4-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let adminTokenB = '';
  let professionalAId = '';
  let professionalBId = '';
  let inactiveProfessionalId = '';
  let serviceAId = '';
  let serviceHourId = '';
  let serviceBId = '';
  let inactiveServiceId = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
      ],
    });

    const adminA = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Admin A',
        email: `admin.${suffix}@example.com`,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
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
    const professionalUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Carlos Lima',
        email: `pro.${suffix}@example.com`,
        passwordHash,
        role: UserRole.PROFESSIONAL,
        isActive: true,
      },
    });
    const inactiveUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Inativo',
        email: `inativo.${suffix}@example.com`,
        passwordHash,
        role: UserRole.PROFESSIONAL,
        isActive: true,
      },
    });
    const adminB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        name: 'Admin B',
        email: `admin.b.${suffix}@example.com`,
        passwordHash,
        role: UserRole.ADMIN,
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

    await prisma.client.create({
      data: { tenantId: tenantA.id, userId: clientUser.id, isActive: true },
    });
    const professionalA = await prisma.professional.create({
      data: {
        tenantId: tenantA.id,
        userId: professionalUser.id,
        displayName: 'Carlos',
        isActive: true,
      },
    });
    const inactiveProfessional = await prisma.professional.create({
      data: {
        tenantId: tenantA.id,
        userId: inactiveUser.id,
        displayName: 'Fora',
        isActive: false,
      },
    });
    const professionalB = await prisma.professional.create({
      data: {
        tenantId: tenantB.id,
        userId: professionalUserB.id,
        displayName: 'Bruno',
        isActive: true,
      },
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
    const serviceHour = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Corte longo',
        price: '80.00',
        durationMinutes: 60,
        points: 10,
        isActive: true,
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
    const serviceB = await prisma.service.create({
      data: {
        tenantId: tenantB.id,
        name: 'Serviço B',
        price: '20.00',
        durationMinutes: 30,
        points: 1,
        isActive: true,
      },
    });

    professionalAId = professionalA.id;
    professionalBId = professionalB.id;
    inactiveProfessionalId = inactiveProfessional.id;
    serviceAId = serviceA.id;
    serviceHourId = serviceHour.id;
    inactiveServiceId = inactiveService.id;
    serviceBId = serviceB.id;
    void adminA;
    void adminB;

    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
    adminToken = await login(tenantA.slug, `admin.${suffix}@example.com`);
    clientToken = await login(tenantA.slug, `cliente.${suffix}@example.com`);
    professionalToken = await login(tenantA.slug, `pro.${suffix}@example.com`);
    adminTokenB = await login(tenantB.slug, `admin.b.${suffix}@example.com`);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.userSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.pointsTransaction.deleteMany({
      where: { tenantId: { in: tenantIds }, reversalOfTransactionId: { not: null } },
    });
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalScheduleException.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalTimeBlock.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.professionalSchedule.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function clearCalendar(): Promise<void> {
    await prisma.professionalScheduleException.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalTimeBlock.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalSchedule.deleteMany({ where: { professionalId: professionalAId } });
  }

  it('replaces the week, keeps several intervals and leaves a day closed', async () => {
    const saved = await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({
        intervals: [
          { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
          { dayOfWeek: 1, startTime: '13:30', endTime: '18:00' },
          { dayOfWeek: 2, startTime: '08:00', endTime: '12:00' },
        ],
      })
      .expect(200);

    expect(saved.body.professionalId).toBe(professionalAId);
    expect(saved.body.intervals).toHaveLength(3);
    expect(saved.body.intervals.map((item: { dayOfWeek: number }) => item.dayOfWeek)).toEqual([1, 1, 2]);
    expect(JSON.stringify(saved.body)).not.toContain('passwordHash');

    const read = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .expect(200);
    expect(read.body.intervals.some((item: { dayOfWeek: number }) => item.dayOfWeek === 3)).toBe(false);

    const touching = await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({
        intervals: [
          { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
          { dayOfWeek: 1, startTime: '12:00', endTime: '18:00' },
        ],
      })
      .expect(200);
    expect(touching.body.intervals).toHaveLength(2);
  });

  it('rejects an invalid or overlapping interval without wiping the week', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({ intervals: [{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }] })
      .expect(200);

    const reversed = await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({ intervals: [{ dayOfWeek: 1, startTime: '12:00', endTime: '08:00' }] })
      .expect(400);
    expect(reversed.body.message).toBe('O horário inicial precisa ser anterior ao horário final.');

    const equal = await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({ intervals: [{ dayOfWeek: 1, startTime: '08:00', endTime: '08:00' }] })
      .expect(400);
    expect(equal.body.message).toBe('O horário inicial precisa ser anterior ao horário final.');

    const overlap = await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({
        intervals: [
          { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
          { dayOfWeek: 1, startTime: '11:00', endTime: '14:00' },
        ],
      })
      .expect(400);
    expect(overlap.body.message).toBe('Os intervalos se sobrepõem.');

    const kept = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .expect(200);
    expect(kept.body.intervals).toEqual([
      expect.objectContaining({ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }),
    ]);
  });

  it('lets an admin edit a professional schedule and hides other tenants', async () => {
    const saved = await request(app.getHttpServer())
      .put(`/api/v1/professionals/${professionalAId}/schedule`)
      .set(auth(adminToken))
      .send({ intervals: [{ dayOfWeek: 4, startTime: '09:00', endTime: '13:00' }] })
      .expect(200);
    expect(saved.body.intervals[0]).toMatchObject({ dayOfWeek: 4, startTime: '09:00', endTime: '13:00' });

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/schedule`)
      .set(auth(adminToken))
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/professionals/${professionalAId}/schedule`)
      .set(auth(professionalToken))
      .send({ intervals: [] })
      .expect(403);

    await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(clientToken))
      .send({ intervals: [] })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/schedule`)
      .set(auth(adminTokenB))
      .expect(404);

    await request(app.getHttpServer())
      .put(`/api/v1/professionals/${professionalBId}/schedule`)
      .set(auth(adminToken))
      .send({ intervals: [] })
      .expect(404);

    const rejected = await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({ tenantId: tenantB.id, intervals: [] })
      .expect(400);
    expect(rejected.body.message).toContain('tenantId');
  });

  it('creates, lists and deletes time blocks and rejects overlap across tenants', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/time-blocks')
      .set(auth(professionalToken))
      .send({
        startAt: `${monday}T12:00:00-03:00`,
        endAt: `${monday}T13:30:00-03:00`,
        reason: 'Almoço',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      professionalId: professionalAId,
      tenantId: tenantA.id,
      reason: 'Almoço',
      startAt: `${monday}T12:00:00-03:00`,
      endAt: `${monday}T13:30:00-03:00`,
    });

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/time-blocks')
      .set(auth(professionalToken))
      .send({
        startAt: `${monday}T15:00:00-03:00`,
        endAt: `${monday}T14:00:00-03:00`,
      })
      .expect(400);
    expect(invalid.body.message).toBe('O horário inicial precisa ser anterior ao horário final.');

    const overlap = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/time-blocks')
      .set(auth(professionalToken))
      .send({
        startAt: `${monday}T13:00:00-03:00`,
        endAt: `${monday}T14:00:00-03:00`,
      })
      .expect(400);
    expect(overlap.body.message).toBe('Os bloqueios se sobrepõem.');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/time-blocks')
      .set(auth(professionalToken))
      .expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.meta.total).toBe(1);

    await request(app.getHttpServer())
      .post('/api/v1/professionals/me/time-blocks')
      .set(auth(clientToken))
      .send({
        startAt: `${monday}T15:00:00-03:00`,
        endAt: `${monday}T16:00:00-03:00`,
      })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/professionals/${professionalAId}/time-blocks/${created.body.id as string}`)
      .set(auth(adminTokenB))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalBId}/time-blocks`)
      .set(auth(adminToken))
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/professionals/me/time-blocks/${created.body.id as string}`)
      .set(auth(professionalToken))
      .expect(204);
  });

  it('creates, updates and deletes schedule exceptions inside the tenant', async () => {
    const opened = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/exceptions')
      .set(auth(professionalToken))
      .send({
        date: saturday,
        type: 'OPEN',
        startTime: '08:00',
        endTime: '14:00',
        reason: 'Plantão',
      })
      .expect(201);

    const blocked = await request(app.getHttpServer())
      .post(`/api/v1/professionals/${professionalAId}/exceptions`)
      .set(auth(adminToken))
      .send({
        date: monday,
        type: 'BLOCK',
        startTime: null,
        endTime: null,
        reason: 'Folga',
      })
      .expect(201);
    expect(blocked.body).toMatchObject({ type: 'BLOCK', startTime: null, endTime: null, date: monday });

    const overlap = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/exceptions')
      .set(auth(professionalToken))
      .send({ date: saturday, type: 'BLOCK', startTime: '10:00', endTime: '12:00' })
      .expect(400);
    expect(overlap.body.message).toBe('As exceções se sobrepõem.');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/professionals/me/exceptions/${opened.body.id as string}`)
      .set(auth(professionalToken))
      .send({ endTime: '13:00' })
      .expect(200);
    expect(updated.body.endTime).toBe('13:00');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/exceptions')
      .set(auth(professionalToken))
      .expect(200);
    expect(listed.body.meta.total).toBe(2);

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/exceptions`)
      .set(auth(adminTokenB))
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/professionals/${professionalBId}/exceptions/${opened.body.id as string}`)
      .set(auth(adminTokenB))
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/professionals/me/exceptions/${opened.body.id as string}`)
      .set(auth(professionalToken))
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/api/v1/professionals/${professionalAId}/exceptions/${blocked.body.id as string}`)
      .set(auth(adminToken))
      .expect(204);
  });

  it('offers 15 minute slots that finish inside the shift', async () => {
    await clearCalendar();
    await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({ intervals: [{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }] })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: monday, serviceId: serviceAId })
      .set(auth(clientToken))
      .expect(200);

    expect(response.body).toMatchObject({
      date: monday,
      professionalId: professionalAId,
      serviceId: serviceAId,
      durationMinutes: 30,
    });
    expect(response.body.slots[0]).toBe('08:00');
    expect(response.body.slots.at(-1)).toBe('11:30');
    expect(response.body.slots).not.toContain('11:45');
    expect(response.body.slots).not.toContain('12:00');
    expect(response.body.slotStepMinutes).toBeUndefined();
  });

  it('removes slots that would cross a time block', async () => {
    await clearCalendar();
    await request(app.getHttpServer())
      .put(`/api/v1/professionals/${professionalAId}/schedule`)
      .set(auth(adminToken))
      .send({ intervals: [{ dayOfWeek: 1, startTime: '08:00', endTime: '18:00' }] })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/professionals/${professionalAId}/time-blocks`)
      .set(auth(adminToken))
      .send({
        startAt: `${monday}T12:00:00-03:00`,
        endAt: `${monday}T13:30:00-03:00`,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: monday, serviceId: serviceHourId })
      .set(auth(professionalToken))
      .expect(200);

    expect(response.body.slots).toContain('11:00');
    expect(response.body.slots).toContain('13:30');
    expect(response.body.slots).not.toContain('11:15');
    expect(response.body.slots).not.toContain('11:30');
    expect(response.body.slots).not.toContain('12:00');
    expect(response.body.slots.at(-1)).toBe('17:00');
  });

  it('opens a closed saturday and blocks a working saturday', async () => {
    await clearCalendar();
    await request(app.getHttpServer())
      .post('/api/v1/professionals/me/exceptions')
      .set(auth(professionalToken))
      .send({ date: saturday, type: 'OPEN', startTime: '08:00', endTime: '14:00' })
      .expect(201);

    const opened = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: saturday, serviceId: serviceAId })
      .set(auth(adminToken))
      .expect(200);
    expect(opened.body.slots[0]).toBe('08:00');
    expect(opened.body.slots.at(-1)).toBe('13:30');

    await clearCalendar();
    await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({ intervals: [{ dayOfWeek: 6, startTime: '08:00', endTime: '14:00' }] })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/professionals/me/exceptions')
      .set(auth(professionalToken))
      .send({ date: saturday, type: 'BLOCK', startTime: '08:00', endTime: '14:00' })
      .expect(201);

    const blocked = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: saturday, serviceId: serviceAId })
      .set(auth(clientToken))
      .expect(200);
    expect(blocked.body.slots).toEqual([]);
  });

  it('isolates availability by tenant and rejects inactive or past dates', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalBId}/availability`)
      .query({ date: monday, serviceId: serviceAId })
      .set(auth(clientToken))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: monday, serviceId: serviceBId })
      .set(auth(adminToken))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${inactiveProfessionalId}/availability`)
      .query({ date: monday, serviceId: serviceAId })
      .set(auth(adminToken))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: monday, serviceId: inactiveServiceId })
      .set(auth(clientToken))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: monday, serviceId: inactiveServiceId })
      .set(auth(professionalToken))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: monday, serviceId: inactiveServiceId })
      .set(auth(adminToken))
      .expect(404);

    const past = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: yesterday, serviceId: serviceAId })
      .set(auth(clientToken))
      .expect(200);
    expect(past.body.slots).toEqual([]);

    const invalid = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: '2026-02-31', serviceId: serviceAId })
      .set(auth(clientToken))
      .expect(400);
    expect(invalid.body.message).toBe('Data inválida.');

    await request(app.getHttpServer())
      .put(`/api/v1/professionals/${inactiveProfessionalId}/schedule`)
      .set(auth(adminToken))
      .send({ intervals: [{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }] })
      .expect(200);
  });
});
