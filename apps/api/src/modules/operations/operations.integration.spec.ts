import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UserRole } from '@ravion/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../../common/auth/password.service';

const password = 'senha-segura-123';

describe('clients, professionals and services', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const tenantA = { id: randomUUID(), name: 'Contexto A', slug: `fase3-a-${suffix}` };
  const tenantB = { id: randomUUID(), name: 'Contexto B', slug: `fase3-b-${suffix}` };
  const tenantIds = [tenantA.id, tenantB.id];
  const adminEmail = `admin.${suffix}@example.com`;
  const clientEmail = `cliente.${suffix}@example.com`;
  const professionalEmail = `pro.${suffix}@example.com`;
  const adminEmailB = `admin.b.${suffix}@example.com`;

  let app: INestApplication;
  let adminToken = '';
  let clientToken = '';
  let professionalToken = '';
  let adminTokenB = '';
  let clientAId = '';
  let professionalAId = '';
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
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    const clientUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Ana Costa',
        email: clientEmail,
        passwordHash,
        role: UserRole.CLIENT,
        isActive: true,
      },
    });
    const professionalUser = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        name: 'Carlos Lima',
        email: professionalEmail,
        passwordHash,
        role: UserRole.PROFESSIONAL,
        isActive: true,
      },
    });
    const adminB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        name: 'Admin B',
        email: adminEmailB,
        passwordHash,
        role: UserRole.ADMIN,
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
        name: 'Profissional B',
        email: `pro.b.${suffix}@example.com`,
        passwordHash,
        role: UserRole.PROFESSIONAL,
        isActive: true,
      },
    });

    const clientA = await prisma.client.create({
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
    await prisma.client.create({
      data: { tenantId: tenantB.id, userId: clientUserB.id, isActive: true },
    });
    await prisma.professional.create({
      data: {
        tenantId: tenantB.id,
        userId: professionalUserB.id,
        displayName: 'Bruno',
        isActive: true,
      },
    });
    const serviceB = await prisma.service.create({
      data: {
        tenantId: tenantB.id,
        name: 'Serviço B',
        price: '20.00',
        durationMinutes: 20,
        points: 2,
        isActive: true,
      },
    });
    const inactive = await prisma.service.create({
      data: {
        tenantId: tenantA.id,
        name: 'Serviço inativo',
        price: '15.00',
        durationMinutes: 15,
        points: 1,
        isActive: false,
      },
    });

    clientAId = clientA.id;
    professionalAId = professionalA.id;
    serviceBId = serviceB.id;
    inactiveServiceId = inactive.id;
    void adminA;
    void adminB;

    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
    adminToken = await login(tenantA.slug, adminEmail);
    clientToken = await login(tenantA.slug, clientEmail);
    professionalToken = await login(tenantA.slug, professionalEmail);
    adminTokenB = await login(tenantB.slug, adminEmailB);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.userSession.deleteMany({ where: { tenantId: { in: tenantIds } } });
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

  it('lets a client read only their own operational profile', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/v1/clients/me')
      .set(auth(clientToken))
      .expect(200);

    expect(mine.body).toMatchObject({
      id: clientAId,
      tenantId: tenantA.id,
      isActive: true,
      user: { email: clientEmail, role: UserRole.CLIENT },
    });
    expect(JSON.stringify(mine.body)).not.toContain('passwordHash');

    await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientAId}`)
      .set(auth(clientToken))
      .expect(403);
  });

  it('lets a professional read only their own operational profile', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/v1/professionals/me')
      .set(auth(professionalToken))
      .expect(200);

    expect(mine.body).toMatchObject({
      id: professionalAId,
      tenantId: tenantA.id,
      displayName: 'Carlos',
      user: { email: professionalEmail, role: UserRole.PROFESSIONAL },
    });
    expect(JSON.stringify(mine.body)).not.toContain('passwordHash');

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalAId}`)
      .set(auth(professionalToken))
      .expect(403);
  });

  it('returns only active services of the current tenant to client and professional', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({
        name: 'Corte',
        description: 'Corte masculino',
        price: 45,
        durationMinutes: 30,
        points: 10,
      })
      .expect(201);

    expect(created.body.price).toBe('45.00');
    expect(created.body.tenantId).toBe(tenantA.id);

    for (const token of [clientToken, professionalToken]) {
      const list = await request(app.getHttpServer())
        .get('/api/v1/services')
        .query({ isActive: false })
        .set(auth(token))
        .expect(200);

      const names = (list.body.data as Array<{ name: string }>).map((item) => item.name);
      expect(names).toContain('Corte');
      expect(names).not.toContain('Serviço inativo');
      expect(names).not.toContain('Serviço B');
      expect(list.body.meta).toMatchObject({ page: 1, pageSize: 20 });

      await request(app.getHttpServer())
        .get(`/api/v1/services/${inactiveServiceId}`)
        .set(auth(token))
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/v1/services/${serviceBId}`)
        .set(auth(token))
        .expect(404);
    }
  });

  it('forbids client and professional from creating services or professionals', async () => {
    for (const token of [clientToken, professionalToken]) {
      await request(app.getHttpServer())
        .post('/api/v1/services')
        .set(auth(token))
        .send({ name: 'Barba', price: 30, durationMinutes: 20, points: 5 })
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/v1/professionals')
        .set(auth(token))
        .send({
          name: 'Outro',
          email: `outro.${suffix}@example.com`,
          password,
          displayName: 'Outro',
        })
        .expect(403);
    }
  });

  it('lets an admin create, edit and deactivate a service', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Barba', price: 30, durationMinutes: 20, points: 5 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/services/${created.body.id}`)
      .set(auth(adminToken))
      .send({ name: 'Barba completa', price: 35, points: 6 })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Barba completa', price: '35.00', points: 6 });

    const deactivated = await request(app.getHttpServer())
      .delete(`/api/v1/services/${created.body.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(deactivated.body.isActive).toBe(false);

    const stored = await prisma.service.findUnique({ where: { id: created.body.id as string } });
    expect(stored?.isActive).toBe(false);
    expect(stored?.tenantId).toBe(tenantA.id);
  });

  it('lets an admin create and edit a professional and list clients', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/professionals')
      .set(auth(adminToken))
      .send({
        name: 'Diego Alves',
        email: `diego.${suffix}@example.com`,
        password,
        displayName: 'Diego',
        role: UserRole.CLIENT,
        tenantId: tenantB.id,
      });
    expect(created.status).toBe(400);

    const professional = await request(app.getHttpServer())
      .post('/api/v1/professionals')
      .set(auth(adminToken))
      .send({
        name: 'Diego Alves',
        email: `diego.${suffix}@example.com`,
        password,
        displayName: 'Diego',
      })
      .expect(201);

    expect(professional.body.user.role).toBe(UserRole.PROFESSIONAL);
    expect(professional.body.tenantId).toBe(tenantA.id);
    expect(JSON.stringify(professional.body)).not.toContain('passwordHash');

    const storedUser = await prisma.user.findUnique({
      where: { id: professional.body.user.id as string },
    });
    expect(storedUser?.role).toBe(UserRole.PROFESSIONAL);

    const edited = await request(app.getHttpServer())
      .patch(`/api/v1/professionals/${professional.body.id}`)
      .set(auth(adminToken))
      .send({ displayName: 'Diego A.' })
      .expect(200);
    expect(edited.body.displayName).toBe('Diego A.');

    const clients = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set(auth(adminToken))
      .expect(200);
    const emails = (clients.body.data as Array<{ user: { email: string } }>).map(
      (item) => item.user.email,
    );
    expect(emails).toContain(clientEmail);
    expect(emails).not.toContain(`cliente.b.${suffix}@example.com`);
    expect(clients.body.meta.page).toBe(1);
  });

  it('hides records from another tenant on get, patch and delete', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/services/${serviceBId}`)
      .set(auth(adminToken))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/services/${serviceBId}`)
      .set(auth(adminToken))
      .send({ name: 'Invadido' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/services/${serviceBId}`)
      .set(auth(adminToken))
      .expect(404);

    const professionalB = await prisma.professional.findFirst({ where: { tenantId: tenantB.id } });
    const clientB = await prisma.client.findFirst({ where: { tenantId: tenantB.id } });

    await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalB?.id}`)
      .set(auth(adminToken))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/professionals/${professionalB?.id}`)
      .set(auth(adminToken))
      .send({ displayName: 'Invadido' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/professionals/${professionalB?.id}`)
      .set(auth(adminToken))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/clients/${clientB?.id}`)
      .set(auth(adminToken))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/clients/${clientB?.id}`)
      .set(auth(adminToken))
      .send({ isActive: false })
      .expect(404);

    const untouched = await prisma.service.findUnique({ where: { id: serviceBId } });
    expect(untouched?.name).toBe('Serviço B');
    expect(untouched?.isActive).toBe(true);

    const own = await request(app.getHttpServer())
      .get(`/api/v1/services/${serviceBId}`)
      .set(auth(adminTokenB))
      .expect(200);
    expect(own.body.tenantId).toBe(tenantB.id);
  });

  it('rejects a tenant change and invalid service numbers', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Sobrancelha', price: 25, durationMinutes: 15, points: 3 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/services/${created.body.id}`)
      .set(auth(adminToken))
      .send({ tenantId: tenantB.id })
      .expect(400);

    const stored = await prisma.service.findUnique({ where: { id: created.body.id as string } });
    expect(stored?.tenantId).toBe(tenantA.id);

    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: ' ', price: 10, durationMinutes: 10, points: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Negativo', price: -1, durationMinutes: 10, points: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Zero', price: 10, durationMinutes: 0, points: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Pontos', price: 10, durationMinutes: 10, points: -1 })
      .expect(400);

    const zero = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Cortesia', price: 0, durationMinutes: 1, points: 0 })
      .expect(201);
    expect(zero.body.price).toBe('0.00');
  });

  it('keeps one operational profile per user and allows repeated service names', async () => {
    const clientUser = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenantA.id, email: clientEmail } },
    });
    await expect(
      prisma.client.create({
        data: { tenantId: tenantA.id, userId: clientUser?.id ?? '', isActive: true },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const first = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Corte', price: 40, durationMinutes: 25, points: 4 })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth(adminToken))
      .send({ name: 'Corte', price: 50, durationMinutes: 35, points: 8 })
      .expect(201);
    expect(first.body.id).not.toBe(second.body.id);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/professionals')
      .set(auth(adminToken))
      .send({
        name: 'Carlos Lima',
        email: professionalEmail,
        password,
        displayName: 'Carlos de novo',
      })
      .expect(409);
    expect(duplicate.body.message).toBe('Não foi possível criar o profissional.');
  });
});
