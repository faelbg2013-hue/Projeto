import { VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import { afterEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { HealthModule } from '../modules/health/health.module';
import {
  API_DESCRIPTION,
  applyOpenApiConventions,
  buildSwaggerConfig,
  swaggerModels,
} from './swagger';

describe('OpenAPI', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('publishes a client-neutral contract for the PWA and the future Flutter app', async () => {
    expect(API_DESCRIPTION).toContain('Flutter');
    expect(API_DESCRIPTION).toContain('Dart');

    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    const document = applyOpenApiConventions(
      SwaggerModule.createDocument(app, buildSwaggerConfig(43111), {
        extraModels: swaggerModels,
        operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
      }),
    );

    const healthOperation = document.paths['/api/v1/health']?.get;
    expect(healthOperation?.operationId).toBe('getHealth');
    expect(healthOperation?.responses?.['200']).toBeDefined();
    expect(document.components?.securitySchemes?.bearer).toBeDefined();
    expect(document.components?.schemas?.ApiErrorResponseDto).toBeDefined();
    expect(document.components?.schemas?.PaginationQueryDto).toBeDefined();
    expect(document.components?.schemas?.PaginationMetaDto).toBeDefined();
    expect(document.components?.parameters?.Page).toMatchObject({ name: 'page', in: 'query' });
    expect(document.components?.parameters?.PageSize).toMatchObject({
      name: 'pageSize',
      in: 'query',
    });
    expect(document.components?.responses?.Unauthorized).toBeDefined();
    expect(document.components?.responses?.BadRequest).toBeDefined();
    expect(document.components?.responses?.TooManyRequests).toBeDefined();
  });
});
