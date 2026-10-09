import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createIntegrationPrisma } from '../../config/integration-database';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';
import { parseScheduleInstant } from '../../common/time/schedule-clock';

const password = 'senha-segura-123';
const now = () => parseScheduleInstant('2026-10-06T15:00:00-03:00');

describe('admin professional management', () => {
  const prisma = createIntegrationPrisma();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Profissionais A', slug: `fase124-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Profissionais B', slug: `fase124-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];
  const loteSearch = `Lote ${suffix}`;
  const twinName = `Igual Ordem ${suffix}`;

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let visaoId = '';
  let inactiveId = '';
  let foreignProfessionalId = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
      ],
    });
    const admin = await prisma.user.create({
      data: user(tenantA.id, 'Admin Profissionais', `admin.pro.${suffix}@example.com`, passwordHash, UserRole.ADMIN),
    });
    const clientUser = await prisma.user.create({
      data: user(tenantA.id, 'Ana Cliente', `ana.cliente.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const visaoUser = await prisma.user.create({
      data: user(tenantA.id, `Rafael Prof ${suffix}`, `rafael.pro.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const otherProUser = await prisma.user.create({
      data: user(tenantA.id, 'Outro Pro', `outro.pro.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const inactiveUser = await prisma.user.create({
      data: user(tenantA.id, 'Inativo Conta', `inativo.pro.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const twinA = await prisma.user.create({
      data: user(tenantA.id, 'Gemeo A', `gemeo.a.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const twinB = await prisma.user.create({
      data: user(tenantA.id, 'Gemeo B', `gemeo.b.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const foreignProUser = await prisma.user.create({
      data: user(tenantB.id, `Rafael Externo ${suffix}`, `rafael.externo.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const foreignClientUser = await prisma.user.create({
      data: user(tenantB.id, 'Cliente Externo', `cliente.externo.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });

    const client = await prisma.client.create({ data: { tenantId: tenantA.id, userId: clientUser.id } });
    const foreignClient = await prisma.client.create({ data: { tenantId: tenantB.id, userId: foreignClientUser.id } });
    const visao = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: visaoUser.id, displayName: `Nando ${suffix}`, isActive: true },
    });
    const other = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: otherProUser.id, displayName: `Outro ${suffix}`, isActive: true },
    });
    const inactive = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: inactiveUser.id, displayName: `Inativo Filtro ${suffix}`, isActive: false },
    });
    await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: twinA.id, displayName: twinName, isActive: true },
    });
    await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: twinB.id, displayName: twinName, isActive: true },
    });
    const foreignProfessional = await prisma.professional.create({
      data: { tenantId: tenantB.id, userId: foreignProUser.id, displayName: `Nando Externo ${suffix}`, isActive: true },
    });
    visaoId = visao.id;
    inactiveId = inactive.id;
    foreignProfessionalId = foreignProfessional.id;

    const service = await prisma.service.create({
      data: { tenantId: tenantA.id, name: 'Corte', price: '45.00', durationMinutes: 30, points: 10, isActive: true },
    });
    await prisma.service.create({
      data: { tenantId: tenantA.id, name: 'Barba', price: '30.00', durationMinutes: 20, points: 0, isActive: false },
    });
    const foreignService = await prisma.service.create({
      data: { tenantId: tenantB.id, name: 'Corte Externo', price: '45.00', durationMinutes: 30, points: 10, isActive: true },
    });

    for (let index = 1; index <= 21; index += 1) {
      const label = String(index).padStart(2, '0');
      const loteUser = await prisma.user.create({
        data: user(
          tenantA.id,
          `Conta ${label}`,
          `lote.${label}.${suffix}@example.com`,
          passwordHash,
          UserRole.PROFESSIONAL,
        ),
      });
      await prisma.professional.create({
        data: { tenantId: tenantA.id, userId: loteUser.id, displayName: `${loteSearch} ${label}`, isActive: true },
      });
    }

    await prisma.professionalSchedule.createMany({
      data: [
        interval(tenantA.id, visao.id, 1, '09:00', '18:00', true),
        interval(tenantA.id, visao.id, 2, '13:00', '18:00', true),
        interval(tenantA.id, visao.id, 2, '09:00', '12:00', true),
        interval(tenantA.id, visao.id, 3, '09:00', '18:00', false),
        interval(tenantB.id, foreignProfessional.id, 1, '08:15', '12:00', true),
      ],
    });

    const visits: Array<{ start: string; status: Prisma.AppointmentUncheckedCreateInput['status'] }> = [
      { start: '2099-01-01T09:00:00-03:00', status: 'PENDING' },
      { start: '2099-01-02T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-03T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-04T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-05T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-06T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-07T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-08-01T09:00:00-03:00', status: 'NO_SHOW' },
      { start: '2099-02-01T09:00:00-03:00', status: 'CANCELLED' },
      { start: '2026-10-06T23:30:00-03:00', status: 'COMPLETED' },
      { start: '2026-10-05T23:30:00-03:00', status: 'COMPLETED' },
      { start: '2026-10-06T10:00:00-03:00', status: 'CONFIRMED' },
      { start: '2025-06-01T09:00:00-03:00', status: 'COMPLETED' },
      { start: '2024-06-01T09:00:00-03:00', status: 'COMPLETED' },
      { start: '2020-05-01T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2020-03-01T09:00:00-03:00', status: 'CANCELLED' },
      { start: '2020-01-01T09:00:00-03:00', status: 'COMPLETED' },
    ];
    await Promise.all(
      visits.map((visit) =>
        prisma.appointment.create({
          data: row(tenantA.id, client.id, visao.id, service.id, visit.start, visit.status),
        }),
      ),
    );
    await prisma.appointment.create({
      data: row(tenantA.id, client.id, other.id, service.id, '2099-03-01T09:00:00-03:00', 'CONFIRMED'),
    });
    await prisma.appointment.create({
      data: row(tenantA.id, client.id, inactive.id, service.id, '2024-01-01T09:00:00-03:00', 'COMPLETED'),
    });
    await prisma.appointment.create({
      data: row(
        tenantB.id,
        foreignClient.id,
        foreignProfessional.id,
        foreignService.id,
        '2099-03-02T09:00:00-03:00',
        'CONFIRMED',
      ),
    });
    await prisma.service.update({ where: { id: service.id }, data: { name: 'Corte Novo' } });

    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp({ now });
    adminToken = await login(app, tenantA.slug, admin.email);
    clientToken = await login(app, tenantA.slug, clientUser.email);
    professionalToken = await login(app, tenantA.slug, visaoUser.email);
  });

  afterAll(async () => {
    await app?.close();
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

  it('lists only the session tenant and rejects the other roles', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ pageSize: 100 })
      .set(auth(adminToken))
      .expect(200);
    const emails = response.body.data.map((item: { user: { email: string } }) => item.user.email);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 100 });
    expect(emails).toContain(`rafael.pro.${suffix}@example.com`);
    expect(emails).not.toContain(`rafael.externo.${suffix}@example.com`);
    expect(response.body.data.every((item: { tenantId: string }) => item.tenantId === tenantA.id)).toBe(true);

    await request(app.getHttpServer()).get('/api/v1/professionals').set(auth(clientToken)).expect(403);
    await request(app.getHttpServer()).get('/api/v1/professionals').set(auth(professionalToken)).expect(403);
    await request(app.getHttpServer()).get('/api/v1/professionals').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ tenantId: tenantB.id })
      .set(auth(adminToken))
      .expect(400);
  });

  it('searches by display name, account name and email inside the tenant', async () => {
    const byDisplayName = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: `Nando ${suffix}` })
      .set(auth(adminToken))
      .expect(200);
    expect(byDisplayName.body.data.map((item: { user: { email: string } }) => item.user.email)).toEqual([
      `rafael.pro.${suffix}@example.com`,
    ]);

    const byName = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: `Rafael Prof ${suffix}` })
      .set(auth(adminToken))
      .expect(200);
    expect(byName.body.data.map((item: { displayName: string }) => item.displayName)).toEqual([`Nando ${suffix}`]);

    const byEmail = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: `rafael.pro.${suffix}@` })
      .set(auth(adminToken))
      .expect(200);
    expect(byEmail.body.data).toHaveLength(1);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: `nenhum-${suffix}` })
      .set(auth(adminToken))
      .expect(200);
    expect(empty.body.data).toEqual([]);
    expect(empty.body.meta).toMatchObject({ total: 0, pageCount: 0 });

    const foreign = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: `Nando Externo ${suffix}` })
      .set(auth(adminToken))
      .expect(200);
    expect(foreign.body.data).toEqual([]);
  });

  it('filters active and inactive professionals', async () => {
    const active = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: `Filtro ${suffix}`, isActive: true })
      .set(auth(adminToken))
      .expect(200);
    expect(active.body.data).toEqual([]);

    const inactive = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: `Filtro ${suffix}`, isActive: false })
      .set(auth(adminToken))
      .expect(200);
    expect(inactive.body.data.map((item: { displayName: string; isActive: boolean }) => item.isActive)).toEqual([false]);
    expect(inactive.body.data[0].displayName).toBe(`Inativo Filtro ${suffix}`);
  });

  it('paginates in the database and keeps a stable order', async () => {
    const defaults = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: loteSearch })
      .set(auth(adminToken))
      .expect(200);
    expect(defaults.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 21, pageCount: 2 });
    expect(defaults.body.data).toHaveLength(20);
    expect(defaults.body.data[0].displayName).toBe(`${loteSearch} 01`);
    expect(defaults.body.data[19].displayName).toBe(`${loteSearch} 20`);

    const second = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: loteSearch, page: 2 })
      .set(auth(adminToken))
      .expect(200);
    expect(second.body.data.map((item: { displayName: string }) => item.displayName)).toEqual([`${loteSearch} 21`]);

    const wide = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: loteSearch, pageSize: 100 })
      .set(auth(adminToken))
      .expect(200);
    expect(wide.body.data).toHaveLength(21);
    expect(wide.body.meta.pageSize).toBe(100);

    const beyond = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: loteSearch, page: 4 })
      .set(auth(adminToken))
      .expect(200);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.meta).toMatchObject({ page: 4, total: 21, pageCount: 2 });

    await request(app.getHttpServer()).get('/api/v1/professionals').query({ pageSize: 101 }).set(auth(adminToken)).expect(400);
    await request(app.getHttpServer()).get('/api/v1/professionals').query({ page: 0 }).set(auth(adminToken)).expect(400);

    const twins = await request(app.getHttpServer())
      .get('/api/v1/professionals')
      .query({ search: twinName })
      .set(auth(adminToken))
      .expect(200);
    const ids = twins.body.data.map((item: { id: string }) => item.id);
    expect(twins.body.data.map((item: { displayName: string }) => item.displayName)).toEqual([twinName, twinName]);
    expect(ids).toEqual([...ids].sort((left: string, right: string) => (left < right ? -1 : 1)));
  });

  it('returns the operational detail and hides other tenants', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${visaoId}/overview`)
      .set(auth(adminToken))
      .expect(200);
    expect(response.body).toMatchObject({
      displayName: `Nando ${suffix}`,
      name: `Rafael Prof ${suffix}`,
      email: `rafael.pro.${suffix}@example.com`,
      isActive: true,
    });
    expect(response.body.tenantId).toBeUndefined();
    expect(response.body.id).toBeUndefined();
    expect(response.body.services).toEqual([
      { name: 'Barba', durationMinutes: 20, isActive: false, price: '30.00' },
      { name: 'Corte Novo', durationMinutes: 30, isActive: true, price: '45.00' },
    ]);
    expect(response.body.week).toEqual([
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 2, startTime: '13:00', endTime: '18:00' },
    ]);
    expect(JSON.stringify(response.body)).not.toContain('Corte Externo');
    expect(JSON.stringify(response.body)).not.toContain('08:15');

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${foreignProfessionalId}/overview`)
      .set(auth(adminToken))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${foreignProfessionalId}/schedule`)
      .set(auth(adminToken))
      .expect(404);
    await request(app.getHttpServer()).get(`/api/v1/professionals/${randomUUID()}/overview`).set(auth(adminToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/professionals/${visaoId}/overview`).set(auth(clientToken)).expect(403);
    await request(app.getHttpServer()).get(`/api/v1/professionals/${visaoId}/overview`).set(auth(professionalToken)).expect(403);
    await request(app.getHttpServer()).get(`/api/v1/professionals/${visaoId}/overview`).expect(401);

    const inactive = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${inactiveId}/overview`)
      .set(auth(adminToken))
      .expect(200);
    expect(inactive.body.isActive).toBe(false);
    expect(inactive.body.appointments.summary.completed).toBe(1);
    expect(inactive.body.appointments.history).toEqual([
      expect.objectContaining({ date: '2024-01-01', status: 'COMPLETED', serviceName: 'Corte' }),
    ]);
  });

  it('summarizes appointments in America/Sao_Paulo and limits the previews', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${visaoId}/overview`)
      .set(auth(adminToken))
      .expect(200);
    expect(response.body.appointments.summary).toEqual({
      total: 17,
      today: 2,
      upcoming: 7,
      pending: 1,
      confirmed: 8,
      completed: 5,
      cancelled: 2,
      noShow: 1,
    });
    expect(response.body.appointments.upcoming.map((item: { date: string; status: string }) => `${item.date} ${item.status}`)).toEqual([
      '2099-01-01 PENDING',
      '2099-01-02 CONFIRMED',
      '2099-01-03 CONFIRMED',
      '2099-01-04 CONFIRMED',
      '2099-01-05 CONFIRMED',
    ]);
    expect(response.body.appointments.upcoming.map((item: { status: string }) => item.status)).not.toContain('CANCELLED');
    expect(response.body.appointments.upcoming.map((item: { status: string }) => item.status)).not.toContain('COMPLETED');
    expect(response.body.appointments.upcoming.map((item: { status: string }) => item.status)).not.toContain('NO_SHOW');
    expect(response.body.appointments.history.map((item: { date: string; status: string }) => `${item.date} ${item.status}`)).toEqual([
      '2099-08-01 NO_SHOW',
      '2099-02-01 CANCELLED',
      '2026-10-06 COMPLETED',
      '2026-10-05 COMPLETED',
      '2025-06-01 COMPLETED',
    ]);
    expect(response.body.appointments.history.map((item: { status: string }) => item.status)).not.toContain('PENDING');
    expect(response.body.appointments.history.map((item: { status: string }) => item.status)).not.toContain('CONFIRMED');
    expect(response.body.appointments.upcoming[0]).toMatchObject({
      clientName: 'Ana Cliente',
      serviceName: 'Corte',
      time: '09:00',
    });
    expect(JSON.stringify(response.body.appointments)).not.toContain('2099-03-01');
    expect(JSON.stringify(response.body.appointments)).not.toContain('2099-03-02');
  });
});

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function login(app: INestApplication, slug: string, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Tenant-Slug', slug)
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

function user(tenantId: string, name: string, email: string, passwordHash: string, role: UserRole) {
  return { tenantId, name, email, passwordHash, role, isActive: true };
}

function interval(
  tenantId: string,
  professionalId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  isActive: boolean,
) {
  return { tenantId, professionalId, dayOfWeek, startTime, endTime, isActive };
}

function row(
  tenantId: string,
  clientId: string,
  professionalId: string,
  serviceId: string,
  start: string,
  status: Prisma.AppointmentUncheckedCreateInput['status'],
): Prisma.AppointmentUncheckedCreateInput {
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
    bookingMode: 'NORMAL',
  };
}
