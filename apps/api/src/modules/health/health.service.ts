import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@ravion/types';

export const API_SERVICE_NAME = 'ravion-barber-api' as const;

@Injectable()
export class HealthService {
  check(): HealthResponse {
    return {
      status: 'ok',
      service: API_SERVICE_NAME,
    };
  }
}
