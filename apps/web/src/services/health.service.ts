import type { HealthResponse } from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';

export function createHealthService(client: ApiClient): {
  getHealth: () => Promise<HealthResponse>;
} {
  return {
    getHealth() {
      return client.get<HealthResponse>('/api/v1/health');
    },
  };
}

export const healthService = createHealthService(new ApiClient(env.apiUrl));
