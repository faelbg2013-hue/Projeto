import type { ApiErrorBody } from '@ravion/types';

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly error: string;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiClientError';
    this.statusCode = body.statusCode;
    this.error = body.error;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.message === 'string' &&
    typeof candidate.error === 'string'
  );
}

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiClient {
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly baseUrl: string,
    fetchFn?: typeof fetch,
  ) {
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
  }

  get<TResponse>(path: string, headers?: Record<string, string>): Promise<TResponse> {
    return this.request<TResponse>(path, { method: 'GET', headers });
  }

  post<TResponse>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { method: 'POST', body, headers });
  }

  patch<TResponse>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { method: 'PATCH', body, headers });
  }

  delete<TResponse>(path: string, headers?: Record<string, string>): Promise<TResponse> {
    return this.request<TResponse>(path, { method: 'DELETE', headers });
  }

  private async request<TResponse>(path: string, init: ApiRequest): Promise<TResponse> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    if (response.status === 204) {
      return undefined as TResponse;
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      if (isApiErrorBody(payload)) {
        throw new ApiClientError(payload);
      }

      throw new ApiClientError({
        statusCode: response.status,
        message: response.statusText || 'Erro ao consumir a API',
        error: 'Error',
      });
    }

    return payload as TResponse;
  }
}
