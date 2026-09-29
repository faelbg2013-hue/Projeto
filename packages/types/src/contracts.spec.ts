import { describe, expect, it } from 'vitest';
import type { ApiErrorBody, HealthResponse, Paginated } from './index';

describe('shared TypeScript contracts', () => {
  it('describes the health payload consumed by the PWA', () => {
    const health: HealthResponse = {
      status: 'ok',
      service: 'ravion-barber-api',
    };

    expect(health).toEqual({
      status: 'ok',
      service: 'ravion-barber-api',
    });
  });

  it('describes the error and pagination envelopes', () => {
    const error: ApiErrorBody = {
      statusCode: 400,
      message: 'Mensagem do erro',
      error: 'Bad Request',
    };
    const page: Paginated<{ id: string }> = {
      data: [{ id: 'item' }],
      meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 },
    };

    expect(error.statusCode).toBe(400);
    expect(page.meta.pageCount).toBe(1);
  });
});
