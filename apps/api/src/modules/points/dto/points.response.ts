import { ApiProperty } from '@nestjs/swagger';
import type {
  ClientPointsSummary,
  PointsAdjustmentResult,
  PointsBalance,
  PointsTransactionItem,
} from '@ravion/types';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.response';

const TYPES = ['EARN', 'REDEEM', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT'] as const;

export class PointsBalanceDto implements PointsBalance {
  @ApiProperty({ type: Number, example: 120 })
  balance!: number;
}

export class PointsTransactionResponseDto implements PointsTransactionItem {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: TYPES })
  type!: PointsTransactionItem['type'];

  @ApiProperty({ type: Number, example: 10, description: 'Quantidade positiva. O tipo define crédito ou débito.' })
  points!: number;

  @ApiProperty({ type: String, example: 'Atendimento concluído: Corte' })
  reason!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  appointmentId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Corte' })
  serviceName!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class PaginatedPointsTransactionsDto {
  @ApiProperty({ type: () => PointsTransactionResponseDto, isArray: true })
  data!: PointsTransactionResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class ClientPointsSummaryDto implements ClientPointsSummary {
  @ApiProperty({ type: String, format: 'uuid' })
  clientId!: string;

  @ApiProperty({ type: Number, example: 15 })
  balance!: number;

  @ApiProperty({ type: Number, example: 30 })
  credits!: number;

  @ApiProperty({ type: Number, example: 15 })
  debits!: number;

  @ApiProperty({ type: () => PointsTransactionResponseDto, nullable: true })
  lastTransaction!: PointsTransactionResponseDto | null;
}

export class PointsAdjustmentResultDto implements PointsAdjustmentResult {
  @ApiProperty({ type: Number, example: 80 })
  balance!: number;

  @ApiProperty({ type: () => PointsTransactionResponseDto })
  transaction!: PointsTransactionResponseDto;
}
