import { Controller, Get, Inject } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
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

  @Get()
  @Public()
  @SkipThrottle()
  @ApiOperation({
    operationId: 'getHealth',
    summary: 'Verifica se a API está disponível',
  })
  @ApiOkResponse({ description: 'A API está disponível.', type: HealthResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Falha inesperada.', type: ApiErrorResponseDto })
  getHealth(): HealthResponseDto {
    return this.healthService.check();
  }
}
