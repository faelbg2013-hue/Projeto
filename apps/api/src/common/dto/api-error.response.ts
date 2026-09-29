import { ApiProperty } from '@nestjs/swagger';
import type { ApiErrorBody } from '@ravion/types';

export class ApiErrorResponseDto implements ApiErrorBody {
  @ApiProperty({ type: Number, example: 400 })
  statusCode!: number;

  @ApiProperty({ type: String, example: 'Mensagem do erro' })
  message!: string;

  @ApiProperty({ type: String, example: 'Bad Request' })
  error!: string;
}
