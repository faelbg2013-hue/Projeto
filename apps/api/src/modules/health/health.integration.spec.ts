import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';

const healthyPayload = {
  status: 'ok',
  service: 'ravion-barber-api',
};

describe('health against MySQL', () => {
  let app: INestApplication | undefined;

  beforeAll(async () => {
    const { createTestApp } = await import('../../test/create-test-app');
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves liveness and the legacy alias without credentials', async () => {
    const server = app!.getHttpServer();

    await request(server).get('/api/v1/health/live').expect(200).expect(healthyPayload);
    await request(server).get('/api/v1/health').expect(200).expect(healthyPayload);
  });

  it('reports readiness when MySQL answers SELECT 1', async () => {
    await request(app!.getHttpServer()).get('/api/v1/health/ready').expect(200).expect(healthyPayload);
  });
});
