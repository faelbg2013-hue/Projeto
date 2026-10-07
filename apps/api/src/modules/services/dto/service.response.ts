import { ApiProperty } from '@nestjs/swagger';
import type { ServiceItem } from '@ravion/types';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.response';

export class ServiceResponseDto implements ServiceItem {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ type: String, example: 'Corte' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Corte masculino' })
  description!: string | null;

  @ApiProperty({
    type: String,
    example: '45.00',
    description:
      'Valor comercial do serviço, com duas casas decimais. Não representa pagamento, cobrança ou receita.',
  })
  price!: string;

  @ApiProperty({ type: Number, example: 30, minimum: 1 })
  durationMinutes!: number;

  @ApiProperty({
    type: Number,
    example: 10,
    minimum: 0,
    description: 'Pontos que o cliente ganha quando o atendimento é concluído. Não é o custo do resgate.',
  })
  points!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 50,
    description: 'Pontos necessários para agendar no modo POINTS. Null significa que o serviço não aceita resgate.',
  })
  redemptionPoints!: number | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PaginatedServicesDto {
  @ApiProperty({ type: () => ServiceResponseDto, isArray: true })
  data!: ServiceResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
