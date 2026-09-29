import { describe, expect, it, vi } from 'vitest';
import type { HealthResponse } from '@ravion/types';
import { ApiClient, ApiClientError } from './api';
import { createHealthService } from './health.service';

describe('ApiClient', () => {
  it('returns the JSON payload from a successful response', async () => {
    const payload: HealthResponse = { status: 'ok', service: 'ravion-barber-api' };
    const fetchFn: typeof fetch = vi.fn(async () => {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const client = new ApiClient('http://127.0.0.1:43111', fetchFn);

    await expect(client.get<HealthResponse>('/api/v1/health')).resolves.toEqual(payload);
    expect(fetchFn).toHaveBeenCalledWith('http://127.0.0.1:43111/api/v1/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  });

  it('throws the shared API error contract', async () => {
    const fetchFn: typeof fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          statusCode: 400,
          message: 'Mensagem do erro',
          error: 'Bad Request',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const client = new ApiClient('http://127.0.0.1:43111', fetchFn);

    await expect(client.get('/api/v1/health')).rejects.toMatchObject({
      name: 'ApiClientError',
      statusCode: 400,
      message: 'Mensagem do erro',
      error: 'Bad Request',
    } satisfies Partial<ApiClientError>);
  });
});

describe('createHealthService', () => {
  it('requests the versioned health endpoint', async () => {
    const fetchFn: typeof fetch = async (input) => {
      expect(String(input)).toBe('http://api.test/api/v1/health');
      return new Response(JSON.stringify({ status: 'ok', service: 'ravion-barber-api' }), {
        status: 200,
      });
    };
    const service = createHealthService(new ApiClient('http://api.test', fetchFn));

    await expect(service.getHealth()).resolves.toEqual({
      status: 'ok',
      service: 'ravion-barber-api',
    });
  });
});
