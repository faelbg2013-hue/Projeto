import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('authentication rate limits', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = '2';
    process.env.THROTTLE_TTL_MS = '60000';
    process.env.AUTH_THROTTLE_TTL_MS = '60000';
    process.env.AUTH_LOGIN_LIMIT = '2';
    process.env.AUTH_REGISTER_LIMIT = '2';
    process.env.AUTH_REFRESH_LIMIT = '2';
    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps the global limit and answers 429 with Retry-After', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    const blocked = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(429);

    expect(blocked.body.statusCode).toBe(429);
    expect(blocked.body.error).toBe('Too Many Requests');
    expect(blocked.headers['retry-after']).toMatch(/^[1-9]\d*$/);
  });

  it('limits login without changing the credential error', async () => {
    const credentials = { email: 'ninguem@example.com', password: 'senha-segura' };
    const first = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(401);
    const second = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(401);
    const blocked = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(429);

    expect(first.body.message).toBe('Credenciais inválidas');
    expect(second.body.message).toBe('Credenciais inválidas');
    expect(blocked.body.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toMatch(/^[1-9]\d*$/);
  });

  it('limits registration separately from login', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({}).expect(400);
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({}).expect(400);
    const blocked = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({})
      .expect(429);

    expect(blocked.body.statusCode).toBe(429);
  });

  it('limits refresh separately and still accepts a request before the limit', async () => {
    const first = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({}).expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({}).expect(401);
    const blocked = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({}).expect(429);

    expect(first.body.message).toBe('Sessão inválida');
    expect(blocked.body.statusCode).toBe(429);
    expect(blocked.body.error).not.toBe('Unauthorized');
  });
});
