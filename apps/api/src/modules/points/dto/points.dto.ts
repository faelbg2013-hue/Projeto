import { ApiProperty } from '@nestjs/swagger';
import { PointsTransactionType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const ADJUSTMENT_TYPES = [
  PointsTransactionType.ADJUSTMENT_CREDIT,
  PointsTransactionType.ADJUSTMENT_DEBIT,
] as const;

export class AdjustPointsDto {
  @ApiProperty({ enum: ADJUSTMENT_TYPES, example: 'ADJUSTMENT_CREDIT' })
  @IsIn(ADJUSTMENT_TYPES)
  type!: (typeof ADJUSTMENT_TYPES)[number];

  @ApiProperty({ type: Number, minimum: 1, maximum: 100000, example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  points!: number;

  @ApiProperty({ type: String, minLength: 1, maxLength: 240, example: 'Bonificação' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  reason!: string;
}
