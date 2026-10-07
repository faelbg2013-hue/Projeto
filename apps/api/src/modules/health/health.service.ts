import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@ravion/types';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const API_SERVICE_NAME = 'ravion-barber-api' as const;

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  check(): HealthResponse {
    return {
      status: 'ok',
      service: API_SERVICE_NAME,
    };
  }

  async ready(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Serviço indisponível');
    }

    return this.check();
  }
}
