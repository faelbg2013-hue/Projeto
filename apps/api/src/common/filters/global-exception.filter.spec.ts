import { BadRequestException, Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ApiErrorBody } from '@ravion/types';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

@Controller('probe')
class ProbeController {
  @Get('bad')
  bad(): void {
    throw new BadRequestException(['campo obrigatório', 'formato inválido']);
  }

  @Get('missing')
  missing(): void {
    throw new HttpException('Cannot GET /probe/missing', HttpStatus.NOT_FOUND);
  }

  @Get('limited')
  limited(): void {
    throw new HttpException('ThrottlerException: Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  @Get('boom')
  boom(): void {
    throw new Error('connect mysql://ravion:super-secret@127.0.0.1:3306/ravion_barber failed');
  }
}

describe('GlobalExceptionFilter', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  async function createApp(isProduction: boolean): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter(isProduction));
    await app.init();
    return app;
  }

  it('joins validation messages into the shared error contract', async () => {
    await createApp(false);

    const response = await request(app.getHttpServer()).get('/probe/bad').expect(400);
    const body = response.body as ApiErrorBody;

    expect(body).toEqual({
      statusCode: 400,
      message: 'campo obrigatório; formato inválido',
      error: 'Bad Request',
    });
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('normalizes not found and rate limit responses', async () => {
    await createApp(false);

    const missing = await request(app.getHttpServer()).get('/probe/missing').expect(404);
    const limited = await request(app.getHttpServer()).get('/probe/limited').expect(429);

    expect(missing.body).toEqual({
      statusCode: 404,
      message: 'Rota não encontrada',
      error: 'Not Found',
    });
    expect(limited.body).toMatchObject({
      statusCode: 429,
      message: 'Muitas requisições. Tente novamente em instantes.',
    });
  });

  it('hides internal details and credentials from unexpected failures', async () => {
    await createApp(true);

    const response = await request(app.getHttpServer()).get('/probe/boom').expect(500);
    const serialized = JSON.stringify(response.body);

    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Erro interno do servidor',
      error: 'Internal Server Error',
    });
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('at ');
  });
});
