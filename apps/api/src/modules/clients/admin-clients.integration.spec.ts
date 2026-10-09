import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Prisma, type PointsTransactionType } from '@prisma/client';
import { createIntegrationPrisma } from '../../config/integration-database';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';
import { parseScheduleInstant } from '../../common/time/schedule-clock';

const password = 'senha-segura-123';

describe('admin client management', () => {
  const prisma = createIntegrationPrisma();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Clientes A', slug: `fase123-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Clientes B', slug: `fase123-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];
  const loteSearch = `Lote ${suffix}`;
  const twinName = `Igual Ordem ${suffix}`;

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let visaoId = '';
  let foreignClientId = '';

  beforeAll(async () => {
    const passwordHash = await new PasswordService().hash(password);
    await prisma.tenant.createMany({
      data: [
        { ...tenantA, isActive: true },
        { ...tenantB, isActive: true },
      ],
    });
    const admin = await prisma.user.create({
      data: user(tenantA.id, 'Admin Clientes', `admin.clientes.${suffix}@example.com`, passwordHash, UserRole.ADMIN),
    });
    const clientUser = await prisma.user.create({
      data: user(tenantA.id, 'Ana Alfa', `ana.alfa.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const professionalUser = await prisma.user.create({
      data: user(tenantA.id, 'Carlos Pro', `carlos.pro.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });
    const rafael = await prisma.user.create({
      data: user(tenantA.id, 'Rafael Busca', `rafael.busca.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const visaoUser = await prisma.user.create({
      data: user(tenantA.id, 'Visao Cliente', `visao.cliente.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const otherUser = await prisma.user.create({
      data: user(tenantA.id, 'Outro Cliente', `outro.cliente.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const twinA = await prisma.user.create({
      data: user(tenantA.id, twinName, `igual.a.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const twinB = await prisma.user.create({
      data: user(tenantA.id, twinName, `igual.b.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const foreignUser = await prisma.user.create({
      data: user(tenantB.id, `Rafael Externo ${suffix}`, `rafael.externo.${suffix}@example.com`, passwordHash, UserRole.CLIENT),
    });
    const foreignProfessionalUser = await prisma.user.create({
      data: user(tenantB.id, 'Pro Externo', `pro.externo.${suffix}@example.com`, passwordHash, UserRole.PROFESSIONAL),
    });

    await prisma.client.create({ data: { tenantId: tenantA.id, userId: clientUser.id } });
    await prisma.client.create({ data: { tenantId: tenantA.id, userId: rafael.id } });
    const visao = await prisma.client.create({ data: { tenantId: tenantA.id, userId: visaoUser.id } });
    const other = await prisma.client.create({ data: { tenantId: tenantA.id, userId: otherUser.id } });
    await prisma.client.create({ data: { tenantId: tenantA.id, userId: twinA.id } });
    await prisma.client.create({ data: { tenantId: tenantA.id, userId: twinB.id } });
    const foreignClient = await prisma.client.create({ data: { tenantId: tenantB.id, userId: foreignUser.id } });
    const professional = await prisma.professional.create({
      data: { tenantId: tenantA.id, userId: professionalUser.id, displayName: 'Nando', isActive: true },
    });
    const foreignProfessional = await prisma.professional.create({
      data: { tenantId: tenantB.id, userId: foreignProfessionalUser.id, displayName: 'Externo', isActive: true },
    });
    const service = await prisma.service.create({
      data: { tenantId: tenantA.id, name: 'Corte', price: '45.00', durationMinutes: 30, points: 10, isActive: true },
    });
    const foreignService = await prisma.service.create({
      data: { tenantId: tenantB.id, name: 'Corte B', price: '45.00', durationMinutes: 30, points: 10, isActive: true },
    });
    visaoId = visao.id;
    foreignClientId = foreignClient.id;

    for (let index = 1; index <= 21; index += 1) {
      const label = String(index).padStart(2, '0');
      const loteUser = await prisma.user.create({
        data: user(
          tenantA.id,
          `${loteSearch} ${label}`,
          `lote.${label}.${suffix}@example.com`,
          passwordHash,
          UserRole.CLIENT,
        ),
      });
      await prisma.client.create({ data: { tenantId: tenantA.id, userId: loteUser.id } });
    }

    const visits: Array<{ start: string; status: Prisma.AppointmentUncheckedCreateInput['status'] }> = [
      { start: '2099-01-01T09:00:00-03:00', status: 'PENDING' },
      { start: '2099-01-02T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-03T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-04T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-05T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-06T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-01-07T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2099-02-01T09:00:00-03:00', status: 'CANCELLED' },
      { start: '2025-06-01T09:00:00-03:00', status: 'COMPLETED' },
      { start: '2024-06-01T09:00:00-03:00', status: 'COMPLETED' },
      { start: '2020-05-01T09:00:00-03:00', status: 'CONFIRMED' },
      { start: '2020-03-01T09:00:00-03:00', status: 'CANCELLED' },
      { start: '2020-02-01T09:00:00-03:00', status: 'NO_SHOW' },
      { start: '2020-01-01T09:00:00-03:00', status: 'COMPLETED' },
    ];
    await Promise.all(
      visits.map((visit) =>
        prisma.appointment.create({
          data: row(tenantA.id, visao.id, professional.id, service.id, visit.start, visit.status),
        }),
      ),
    );
    await prisma.appointment.create({
      data: row(tenantA.id, other.id, professional.id, service.id, '2099-03-01T09:00:00-03:00', 'CONFIRMED'),
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

    await prisma.pointsTransaction.create({
      data: movement(tenantA.id, visao.id, 'EARN', 10, 'Atendimento antigo', 1),
    });
    const redeem = await prisma.pointsTransaction.create({
      data: movement(tenantA.id, visao.id, 'REDEEM', 4, 'Resgate do corte', 2),
    });
    await prisma.pointsTransaction.create({
      data: {
        ...movement(tenantA.id, visao.id, 'REDEEM_REVERSAL', 4, 'Devolução de pontos por cancelamento do agendamento', 3),
        reversalOfTransactionId: redeem.id,
      },
    });
    await prisma.pointsTransaction.create({
      data: movement(tenantA.id, visao.id, 'ADJUSTMENT_CREDIT', 3, 'Boas-vindas', 4),
    });
    await prisma.pointsTransaction.create({
      data: movement(tenantA.id, visao.id, 'ADJUSTMENT_DEBIT', 2, 'Correção', 5),
    });
    await prisma.pointsTransaction.create({
      data: movement(tenantA.id, visao.id, 'EARN', 1, 'Atendimento recente', 6),
    });
    await prisma.pointsTransaction.create({
      data: movement(tenantA.id, other.id, 'EARN', 50, 'Outro cliente', 1),
    });
    await prisma.pointsTransaction.create({
      data: movement(tenantB.id, foreignClient.id, 'EARN', 100, 'Outro tenant', 1),
    });
    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
    adminToken = await login(app, tenantA.slug, admin.email);
    clientToken = await login(app, tenantA.slug, clientUser.email);
    professionalToken = await login(app, tenantA.slug, professionalUser.email);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.pointsTransaction.deleteMany({
      where: { tenantId: { in: tenantIds }, type: 'REDEEM_REVERSAL' },
    });
    await prisma.pointsTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: tenantIds } } });
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
      .get('/api/v1/clients')
      .query({ pageSize: 100 })
      .set(auth(adminToken))
      .expect(200);
    const emails = response.body.data.map((item: { user: { email: string } }) => item.user.email);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 100 });
    expect(emails).toContain(`rafael.busca.${suffix}@example.com`);
    expect(emails).not.toContain(`rafael.externo.${suffix}@example.com`);
    expect(response.body.data.every((item: { tenantId: string }) => item.tenantId === tenantA.id)).toBe(true);

    await request(app.getHttpServer()).get('/api/v1/clients').set(auth(clientToken)).expect(403);
    await request(app.getHttpServer()).get('/api/v1/clients').set(auth(professionalToken)).expect(403);
    await request(app.getHttpServer()).get('/api/v1/clients').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ tenantId: tenantB.id })
      .set(auth(adminToken))
      .expect(400);
  });

  it('searches by name and email inside the tenant', async () => {
    const byName = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: 'Rafael' })
      .set(auth(adminToken))
      .expect(200);
    expect(byName.body.data.map((item: { user: { email: string } }) => item.user.email)).toEqual([
      `rafael.busca.${suffix}@example.com`,
    ]);

    const byEmail = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: `rafael.busca.${suffix}` })
      .set(auth(adminToken))
      .expect(200);
    expect(byEmail.body.data).toHaveLength(1);
    expect(byEmail.body.data[0].user.name).toBe('Rafael Busca');

    const empty = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: `nao-existe-${suffix}` })
      .set(auth(adminToken))
      .expect(200);
    expect(empty.body.data).toEqual([]);
    expect(empty.body.meta).toMatchObject({ total: 0, pageCount: 0 });

    const foreign = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: `Externo ${suffix}` })
      .set(auth(adminToken))
      .expect(200);
    expect(foreign.body.data).toEqual([]);
  });

  it('paginates in the database with a stable name order', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: loteSearch })
      .set(auth(adminToken))
      .expect(200);
    expect(first.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 21, pageCount: 2 });
    expect(first.body.data).toHaveLength(20);
    expect(first.body.data[0].user.name).toBe(`${loteSearch} 01`);
    expect(first.body.data[19].user.name).toBe(`${loteSearch} 20`);

    const second = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: loteSearch, page: 2 })
      .set(auth(adminToken))
      .expect(200);
    expect(second.body.data.map((item: { user: { name: string } }) => item.user.name)).toEqual([`${loteSearch} 21`]);
    expect(second.body.meta).toMatchObject({ page: 2, pageSize: 20, total: 21, pageCount: 2 });

    const wide = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: loteSearch, pageSize: 100 })
      .set(auth(adminToken))
      .expect(200);
    expect(wide.body.data).toHaveLength(21);
    expect(wide.body.meta.pageSize).toBe(100);

    const beyond = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: loteSearch, page: 4 })
      .set(auth(adminToken))
      .expect(200);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.meta).toMatchObject({ page: 4, total: 21, pageCount: 2 });

    await request(app.getHttpServer()).get('/api/v1/clients').query({ pageSize: 101 }).set(auth(adminToken)).expect(400);
    await request(app.getHttpServer()).get('/api/v1/clients').query({ page: 0 }).set(auth(adminToken)).expect(400);

    const twins = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ search: twinName, pageSize: 20 })
      .set(auth(adminToken))
      .expect(200);
    const ids = twins.body.data.map((item: { id: string }) => item.id);
    expect(twins.body.data.map((item: { user: { name: string } }) => item.user.name)).toEqual([twinName, twinName]);
    expect(ids).toEqual([...ids].sort((left: string, right: string) => (left < right ? -1 : 1)));
  });

  it('returns the operational detail and hides other tenants', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/clients/${visaoId}/overview`)
      .set(auth(adminToken))
      .expect(200);
    expect(response.body).toMatchObject({
      name: 'Visao Cliente',
      email: `visao.cliente.${suffix}@example.com`,
      isActive: true,
    });
    expect(response.body.tenantId).toBeUndefined();
    expect(response.body.points.balance).toBe(12);
    expect(response.body.appointments.summary).toEqual({
      total: 14,
      upcoming: 7,
      pending: 1,
      confirmed: 7,
      completed: 3,
      cancelled: 2,
      noShow: 1,
    });

    await request(app.getHttpServer()).get(`/api/v1/clients/${foreignClientId}/overview`).set(auth(adminToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/clients/${randomUUID()}/overview`).set(auth(adminToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/clients/${visaoId}/overview`).set(auth(clientToken)).expect(403);
    await request(app.getHttpServer()).get(`/api/v1/clients/${visaoId}/overview`).set(auth(professionalToken)).expect(403);
    await request(app.getHttpServer()).get(`/api/v1/clients/${visaoId}/overview`).expect(401);
  });

  it('derives the balance from the ledger and limits the recent movements', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/clients/${visaoId}/overview`)
      .set(auth(adminToken))
      .expect(200);
    expect(response.body.points.recent).toEqual([
      expect.objectContaining({ type: 'EARN', points: 1, reason: 'Atendimento recente' }),
      expect.objectContaining({ type: 'ADJUSTMENT_DEBIT', points: 2, reason: 'Correção' }),
      expect.objectContaining({ type: 'ADJUSTMENT_CREDIT', points: 3, reason: 'Boas-vindas' }),
      expect.objectContaining({
        type: 'REDEEM_REVERSAL',
        points: 4,
        reason: 'Devolução de pontos por cancelamento do agendamento',
      }),
      expect.objectContaining({ type: 'REDEEM', points: 4, reason: 'Resgate do corte' }),
    ]);
    expect(response.body.points.recent).toHaveLength(5);
    expect(response.body.points.recent.map((item: { reason: string }) => item.reason)).not.toContain('Atendimento antigo');
    expect(response.body.points.recent.map((item: { reason: string }) => item.reason)).not.toContain('Outro cliente');
    expect(response.body.points.recent.map((item: { reason: string }) => item.reason)).not.toContain('Outro tenant');
    expect(response.body.points.balance).toBe(12);
  });

  it('limits upcoming and history without mixing clients', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/clients/${visaoId}/overview`)
      .set(auth(adminToken))
      .expect(200);
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
      '2099-02-01 CANCELLED',
      '2025-06-01 COMPLETED',
      '2024-06-01 COMPLETED',
      '2020-03-01 CANCELLED',
      '2020-02-01 NO_SHOW',
    ]);
    expect(response.body.appointments.history.map((item: { status: string }) => item.status)).not.toContain('PENDING');
    expect(response.body.appointments.history.map((item: { status: string }) => item.status)).not.toContain('CONFIRMED');
    expect(response.body.appointments.upcoming[0]).toMatchObject({
      professionalName: 'Nando',
      serviceName: 'Corte',
      time: '09:00',
    });
    expect(JSON.stringify(response.body)).not.toContain('2099-03-01');
    expect(JSON.stringify(response.body)).not.toContain('2099-03-02');
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

function movement(
  tenantId: string,
  clientId: string,
  type: PointsTransactionType,
  points: number,
  reason: string,
  minute: number,
): Prisma.PointsTransactionUncheckedCreateInput {
  return {
    tenantId,
    clientId,
    type,
    points,
    reason,
    createdAt: new Date(Date.UTC(2026, 0, 1, 12, minute, 0)),
    earnAppointmentId: type === 'EARN' ? randomUUID() : null,
    redeemAppointmentId: type === 'REDEEM' ? randomUUID() : null,
  };
}
