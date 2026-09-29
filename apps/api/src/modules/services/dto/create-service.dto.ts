import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function trimToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class CreateServiceDto {
  @ApiProperty({ type: String, example: 'Corte', minLength: 1, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 1000,
    example: 'Corte masculino',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiProperty({ type: Number, example: 45, minimum: 0, maximum: 99999999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  price!: number;

  @ApiProperty({ type: Number, example: 30, minimum: 1, maximum: 1440 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @ApiProperty({
    type: Number,
    example: 10,
    minimum: 0,
    maximum: 100000,
    description: 'Pontos que o cliente ganha quando o atendimento é concluído.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  points!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 50,
    minimum: 1,
    maximum: 100000,
    description: 'Pontos necessários para agendar no modo POINTS. Null significa que o resgate não está disponível.',
  })
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  redemptionPoints?: number | null;
}
