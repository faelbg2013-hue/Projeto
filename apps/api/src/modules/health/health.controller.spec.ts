import { VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { HealthModule } from './health.module';

const healthyPayload = {
  status: 'ok',
  service: 'ravion-barber-api',
};

describe('health endpoints', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createApp(queryRaw: ReturnType<typeof vi.fn>): Promise<void> {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new GlobalExceptionFilter(true));
    await app.init();
  }

  it('keeps GET /api/v1/health as the liveness alias', async () => {
    await createApp(vi.fn());

    const response = await request(app!.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toEqual(healthyPayload);
  });

  it('returns process liveness without querying the database', async () => {
    const queryRaw = vi.fn();
    await createApp(queryRaw);

    const response = await request(app!.getHttpServer()).get('/api/v1/health/live').expect(200);

    expect(response.body).toEqual(healthyPayload);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns readiness when the database answers', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ ok: 1 }]);
    await createApp(queryRaw);

    const response = await request(app!.getHttpServer()).get('/api/v1/health/ready').expect(200);

    expect(response.body).toEqual(healthyPayload);
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it('returns 503 without the database error when readiness fails', async () => {
    const driverError = new Error(
      'connect ECONNREFUSED mysql://user:super-secret@db.internal:3306/ravion_barber DATABASE_URL',
    );
    await createApp(vi.fn().mockRejectedValue(driverError));

    const response = await request(app!.getHttpServer()).get('/api/v1/health/ready').expect(503);
    const serialized = JSON.stringify(response.body);

    expect(response.body).toEqual({
      statusCode: 503,
      message: 'Serviço indisponível',
      error: 'Service Unavailable',
    });
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('db.internal');
    expect(serialized).not.toContain('mysql://');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('ECONNREFUSED');
  });
});
