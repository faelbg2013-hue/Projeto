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
    description: 'Preço decimal com duas casas. Não é um número de ponto flutuante.',
  })
  price!: string;

  @ApiProperty({ type: Number, example: 30, minimum: 1 })
  durationMinutes!: number;

  @ApiProperty({
    type: Number,
    example: 10,
    minimum: 0,
    description: 'Pontuação configurada do serviço. Não é saldo nem extrato de fidelidade.',
  })
  points!: number;

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
