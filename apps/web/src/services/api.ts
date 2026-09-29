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

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async get<TResponse>(path: string): Promise<TResponse> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      if (isApiErrorBody(payload)) {
        throw new ApiClientError(payload);
      }

      throw new ApiClientError({
        statusCode: response.status,
        message: response.statusText || 'Erro ao consumir a API',
        error: 'Error',
      });
    }

    return (await response.json()) as TResponse;
  }
}
