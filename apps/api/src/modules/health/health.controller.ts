import { Controller, Get, Inject } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth/public.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { HealthResponseDto } from './dto/health.response';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get('live')
  @Public()
  @SkipThrottle()
  @ApiOperation({
    operationId: 'getHealthLive',
    summary: 'Verifica se o processo da API está no ar',
    description: 'Não consulta o banco e não revela configuração interna.',
  })
  @ApiOkResponse({ description: 'O processo está no ar.', type: HealthResponseDto })
  live(): HealthResponseDto {
    return this.healthService.check();
  }

  @Get('ready')
  @Public()
  @SkipThrottle()
  @ApiOperation({
    operationId: 'getHealthReady',
    summary: 'Verifica se a API consegue consultar o banco',
    description: 'Executa uma consulta mínima. Banco indisponível responde 503, sem detalhes da conexão.',
  })
  @ApiOkResponse({ description: 'O banco respondeu.', type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ description: 'O banco não está disponível.', type: ApiErrorResponseDto })
  ready(): Promise<HealthResponseDto> {
    return this.healthService.ready();
  }

  @Get()
  @Public()
  @SkipThrottle()
  @ApiOperation({
    operationId: 'getHealth',
    summary: 'Alias de liveness da API',
    description: 'O mesmo resultado de GET /api/v1/health/live. A prontidão do banco fica em /api/v1/health/ready.',
  })
  @ApiOkResponse({ description: 'A API está disponível.', type: HealthResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Falha inesperada.', type: ApiErrorResponseDto })
  getHealth(): HealthResponseDto {
    return this.healthService.check();
  }
}
