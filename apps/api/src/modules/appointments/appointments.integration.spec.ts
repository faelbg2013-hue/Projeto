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

describe('appointments', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Agenda A', slug: `fase5-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Agenda B', slug: `fase5-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];
  const monday = () => futureSlot(1, '10:00');

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let clientTwoToken = '';
  let inactiveClientToken = '';
  let professionalToken = '';
  let adminTokenB = '';
  let clientAId = '';
  let clientTwoId = '';
  let professionalAId = '';
  let professionalBId = '';
  let inactiveProfessionalId = '';
  let serviceAId = '';
  let serviceHourId = '';
  let serviceLongId = '';
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
      inactiveClient: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Inativo',
          email: `inativo.cliente.${suffix}@example.com`,
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
      inactiveProfessional: await prisma.user.create({
        data: {
          tenantId: tenantA.id,
          name: 'Fora',
          email: `pro.inativo.${suffix}@example.com`,
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
    const clientTwo = await prisma.client.create({
      data: { tenantId: tenantA.id, userId: users.clientTwo.id, isActive: true },
    });
    await prisma.client.create({
      data: { tenantId: tenantA.id, userId: users.inactiveClient.id, isActive: false },
    });
    const professionalA = await prisma.professional.create({
      data: {
        tenantId: tenantA.id,
        userId: users.professional.id,
        displayName: 'Carlos',
        isActive: true,
      },
    });
    const inactiveProfessional = await prisma.professional.create({
      data: {
        tenantId: tenantA.id,
        userId: users.inactiveProfessional.id,
        displayName: 'Fora',
        isActive: false,
      },
    });
    const professionalB = await prisma.professional.create({
      data: {
        tenantId: tenantB.id,
        userId: users.professionalB.id,
        displayName: 'Diego',
        isActive: true,
      },
    });
    const serviceA = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Corte',
        price: '40.00',
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
    const serviceLong = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Ritual',
        price: '120.00',
        durationMinutes: 90,
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

    clientAId = clientA.id;
    clientTwoId = clientTwo.id;
    professionalAId = professionalA.id;
    professionalBId = professionalB.id;
    inactiveProfessionalId = inactiveProfessional.id;
    serviceAId = serviceA.id;
    serviceHourId = serviceHour.id;
    serviceLongId = serviceLong.id;
    inactiveServiceId = inactiveService.id;
    serviceBId = serviceB.id;

    const intervals = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      tenantId: tenantA.id,
      professionalId: professionalA.id,
      dayOfWeek,
      startTime: '08:00',
      endTime: '18:00',
      isActive: true,
    }));
    await prisma.professionalSchedule.createMany({ data: intervals });

    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
    adminToken = await login(tenantA.slug, users.adminA.email);
    clientToken = await login(tenantA.slug, users.client.email);
    clientTwoToken = await login(tenantA.slug, users.clientTwo.email);
    inactiveClientToken = await login(tenantA.slug, users.inactiveClient.email);
    professionalToken = await login(tenantA.slug, users.professional.email);
    adminTokenB = await login(tenantB.slug, users.adminB.email);
  });

  beforeEach(async () => {
    await prisma.appointment.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalTimeBlock.deleteMany({ where: { professionalId: professionalAId } });
    await prisma.professionalScheduleException.deleteMany({ where: { professionalId: professionalAId } });
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
  });

  afterAll(async () => {
    await app?.close();
    await prisma.userSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

  function body(slot: { date: string; time: string }, serviceId = serviceAId) {
    return {
      professionalId: professionalAId,
      serviceId,
      date: slot.date,
      time: slot.time,
      notes: 'Sem pressa',
    };
  }

  async function restoreWeek(): Promise<void> {
    await request(app.getHttpServer())
      .put(`/api/v1/professionals/${professionalAId}/schedule`)
      .set(auth(adminToken))
      .send({
        intervals: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
        })),
      })
      .expect(200);
  }

  it('creates a confirmed appointment for the authenticated client and keeps the service snapshot', async () => {
    const slot = monday();
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body(slot))
      .expect(201);

    expect(created.body).toMatchObject({
      tenantId: tenantA.id,
      clientId: clientAId,
      clientName: 'Ana Costa',
      professionalId: professionalAId,
      professionalName: 'Carlos',
      serviceId: serviceAId,
      serviceName: 'Corte',
      price: '40.00',
      durationMinutes: 30,
      date: slot.date,
      time: slot.time,
      status: 'CONFIRMED',
      notes: 'Sem pressa',
      startAt: `${slot.date}T${slot.time}:00-03:00`,
      endAt: `${slot.date}T10:30:00-03:00`,
    });
    expect(JSON.stringify(created.body)).not.toContain('passwordHash');

    await prisma.service.update({
      where: { id: serviceAId },
      data: { price: '50.00', durationMinutes: 45, name: 'Corte novo' },
    });
    const stored = await request(app.getHttpServer())
      .get(`/api/v1/appointments/${created.body.id as string}`)
      .set(auth(clientToken))
      .expect(200);
    expect(stored.body).toMatchObject({
      serviceName: 'Corte',
      price: '40.00',
      durationMinutes: 30,
    });
    await prisma.service.update({
      where: { id: serviceAId },
      data: { price: '40.00', durationMinutes: 30, name: 'Corte', isActive: false },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${created.body.id as string}`)
      .set(auth(clientToken))
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body(futureSlot(1, '11:00')))
      .expect(404);
    await prisma.service.update({
      where: { id: serviceAId },
      data: { isActive: true },
    });

    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ ...body(futureSlot(1, '11:00')), clientId: clientTwoId })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ ...body(futureSlot(1, '11:00')), tenantId: tenantB.id, endAt: 'x', status: 'PENDING' })
      .expect(400);
    await request(app.getHttpServer()).post('/api/v1/appointments').set(auth(professionalToken)).send(body(slot)).expect(403);
  });

  it('rejects an overlapping booking and allows a slot that only touches the previous one', async () => {
    const slot = monday();
    await request(app.getHttpServer()).post('/api/v1/appointments').set(auth(clientToken)).send(body(slot)).expect(201);
    const exact = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientTwoToken))
      .send(body(slot))
      .expect(409);
    expect(exact.body.message).toBe('Este horário não está mais disponível.');

    const partial = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientTwoToken))
      .send(body({ date: slot.date, time: '10:15' }, serviceHourId))
      .expect(409);
    expect(partial.body.message).toBe('Este horário não está mais disponível.');

    const hour = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientTwoToken))
      .send(body({ date: slot.date, time: '11:00' }, serviceHourId))
      .expect(201);
    expect(hour.body.endAt).toBe(`${slot.date}T12:00:00-03:00`);

    await prisma.appointment.deleteMany({ where: { professionalId: professionalAId } });
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body({ date: slot.date, time: '10:00' }, serviceHourId))
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientTwoToken))
      .send(body({ date: slot.date, time: '10:30' }))
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientTwoToken))
      .send(body({ date: slot.date, time: '11:00' }))
      .expect(201);
  });

  it('confirms only one of two simultaneous bookings for the same slot', async () => {
    const slot = futureSlot(2, '15:00');
    const payload = body(slot);
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/appointments').set(auth(clientToken)).send(payload),
      request(app.getHttpServer()).post('/api/v1/appointments').set(auth(clientTwoToken)).send(payload),
    ]);
    const statuses = [first.status, second.status].sort((left, right) => left - right);
    expect(statuses).toEqual([201, 409]);
    const conflict = first.status === 409 ? first : second;
    expect(conflict.body.message).toBe('Este horário não está mais disponível.');
    const rows = await prisma.appointment.count({
      where: { professionalId: professionalAId, status: 'CONFIRMED' },
    });
    expect(rows).toBe(1);
  });

  it('reuses the same idempotency key and rejects a different payload', async () => {
    const slot = futureSlot(3, '09:00');
    const key = `chave-${suffix}-0900`;
    const first = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .set('Idempotency-Key', key)
      .send(body(slot))
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .set('Idempotency-Key', key)
      .send(body(slot))
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
    const count = await prisma.appointment.count({ where: { clientId: clientAId, idempotencyKey: key } });
    expect(count).toBe(1);
    const changed = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .set('Idempotency-Key', key)
      .send(body({ date: slot.date, time: '09:30' }))
      .expect(409);
    expect(changed.body.message).toBe('A chave de idempotência já foi utilizada.');
  });

  it('rejects blocked times, closed days and a service that would pass the shift end', async () => {
    const slot = futureSlot(4, '12:30');
    await request(app.getHttpServer())
      .post('/api/v1/professionals/me/time-blocks')
      .set(auth(professionalToken))
      .send({
        startAt: `${slot.date}T12:00:00-03:00`,
        endAt: `${slot.date}T13:30:00-03:00`,
        reason: 'Almoço',
      })
      .expect(201);
    await request(app.getHttpServer()).post('/api/v1/appointments').set(auth(clientToken)).send(body(slot)).expect(409);

    const saturday = futureSlot(6, '10:00');
    await request(app.getHttpServer())
      .put('/api/v1/professionals/me/schedule')
      .set(auth(professionalToken))
      .send({
        intervals: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
        })),
      })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body(saturday))
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/v1/professionals/me/exceptions')
      .set(auth(professionalToken))
      .send({ date: saturday.date, type: 'OPEN', startTime: '08:00', endTime: '14:00' })
      .expect(201);
    await request(app.getHttpServer()).post('/api/v1/appointments').set(auth(clientToken)).send(body(saturday)).expect(201);

    await request(app.getHttpServer())
      .put(`/api/v1/professionals/${professionalAId}/schedule`)
      .set(auth(adminToken))
      .send({ intervals: [{ dayOfWeek: 1, startTime: '08:00', endTime: '10:00' }] })
      .expect(200);
    const morning = futureSlot(1, '09:00');
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body(morning, serviceLongId))
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body({ date: morning.date, time: '08:00' }, serviceLongId))
      .expect(201);
    await restoreWeek();
  });

  it('frees a cancelled slot and keeps completed or no-show history', async () => {
    const slot = futureSlot(5, '16:00');
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body(slot))
      .expect(201);
    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: slot.date, serviceId: serviceAId })
      .set(auth(clientToken))
      .expect(200);
    expect(hidden.body.slots).not.toContain(slot.time);

    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id as string}/cancel`)
      .set(auth(clientToken))
      .expect(200);
    const visible = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: slot.date, serviceId: serviceAId })
      .set(auth(clientTwoToken))
      .expect(200);
    expect(visible.body.slots).toContain(slot.time);

    const again = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientTwoToken))
      .send(body(slot))
      .expect(201);
    const completed = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${again.body.id as string}/complete`)
      .set(auth(professionalToken))
      .expect(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.completedAt).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${again.body.id as string}/cancel`)
      .set(auth(adminToken))
      .expect(409);
    const stillHidden = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}/availability`)
      .query({ date: slot.date, serviceId: serviceAId })
      .set(auth(clientToken))
      .expect(200);
    expect(stillHidden.body.slots).not.toContain(slot.time);

    const third = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body({ date: slot.date, time: '17:00' }))
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${third.body.id as string}/complete`)
      .set(auth(clientToken))
      .expect(403);
    const missed = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${third.body.id as string}/no-show`)
      .set(auth(adminToken))
      .expect(200);
    expect(missed.body.status).toBe('NO_SHOW');
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${third.body.id as string}/cancel`)
      .set(auth(professionalToken))
      .expect(409);

    const history = await request(app.getHttpServer())
      .get('/api/v1/appointments/me')
      .query({ view: 'history' })
      .set(auth(clientToken))
      .expect(200);
    expect(history.body.data.map((item: { status: string }) => item.status).sort()).toEqual([
      'CANCELLED',
      'NO_SHOW',
    ]);
  });

  it('isolates tenants and roles and rejects inactive or past choices', async () => {
    const slot = futureSlot(1, '14:00');
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body(slot))
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${created.body.id as string}`)
      .set(auth(adminTokenB))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id as string}/cancel`)
      .set(auth(adminTokenB))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/appointments/${created.body.id as string}`)
      .set(auth(clientTwoToken))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${created.body.id as string}/cancel`)
      .set(auth(clientTwoToken))
      .expect(404);

    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ ...body(futureSlot(2, '14:00')), professionalId: professionalBId })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ ...body(futureSlot(2, '14:00')), serviceId: serviceBId })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ ...body(futureSlot(2, '14:15')), professionalId: inactiveProfessionalId })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send({ ...body(futureSlot(2, '14:15')), serviceId: inactiveServiceId })
      .expect(404);
    const inactive = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(inactiveClientToken))
      .send(body(futureSlot(2, '14:15')))
      .expect(403);
    expect(inactive.body.message).toBe('O cliente está inativo.');

    const pastDate = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body({ date: addDays(todayInScheduleZone(), -1), time: '10:00' }))
      .expect(400);
    expect(pastDate.body.message).toBe('Não é possível agendar em uma data passada.');
    const pastTime = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set(auth(clientToken))
      .send(body({ date: todayInScheduleZone(), time: '00:00' }))
      .expect(400);
    expect(pastTime.body.message).toBe('O horário já passou.');

    const mine = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/appointments')
      .query({ date: slot.date, status: 'CONFIRMED' })
      .set(auth(professionalToken))
      .expect(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].clientName).toBe('Ana Costa');

    const adminList = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ professionalId: professionalAId, clientId: clientAId, serviceId: serviceAId, status: 'CONFIRMED' })
      .set(auth(adminToken))
      .expect(200);
    expect(adminList.body.data).toHaveLength(1);
    await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ professionalId: professionalBId })
      .set(auth(adminToken))
      .expect(404);
    await request(app.getHttpServer()).get('/api/v1/appointments').set(auth(clientToken)).expect(403);

    const bookable = await request(app.getHttpServer())
      .get('/api/v1/professionals/bookable')
      .set(auth(clientToken))
      .expect(200);
    expect(bookable.body.data).toEqual([expect.objectContaining({ id: professionalAId, displayName: 'Carlos' })]);
    expect(JSON.stringify(bookable.body)).not.toContain('passwordHash');
    expect(JSON.stringify(bookable.body)).not.toContain('@');
  });
});
