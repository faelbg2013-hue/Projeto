import { ApiProperty } from '@nestjs/swagger';
import type { HealthResponse } from '@ravion/types';

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ type: String, example: 'ok', enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ type: String, example: 'ravion-barber-api', enum: ['ravion-barber-api'] })
  service!: 'ravion-barber-api';
}
