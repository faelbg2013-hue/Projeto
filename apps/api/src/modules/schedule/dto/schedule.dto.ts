import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ScheduleIntervalDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 7, example: 1, description: '1 = segunda … 7 = domingo.' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ type: String, example: '08:00' })
  @Matches(WALL_TIME)
  startTime!: string;

  @ApiProperty({ type: String, example: '12:00' })
  @Matches(WALL_TIME)
  endTime!: string;
}

export class ReplaceScheduleDto {
  @ApiProperty({ type: () => ScheduleIntervalDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalDto)
  intervals!: ScheduleIntervalDto[];
}

export class CreateTimeBlockDto {
  @ApiProperty({
    type: String,
    example: '2026-10-05T12:00:00-03:00',
    description:
      'Instante inicial. Sem fuso, o valor é interpretado em America/Sao_Paulo. O fuso do navegador não é usado.',
  })
  @IsString()
  startAt!: string;

  @ApiProperty({ type: String, example: '2026-10-05T13:30:00-03:00' })
  @IsString()
  endAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 240, example: 'Almoço' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string | null;
}

export class CreateScheduleExceptionDto {
  @ApiProperty({ type: String, example: '2026-10-10', description: 'Data civil YYYY-MM-DD.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ type: String, enum: ['BLOCK', 'OPEN'], example: 'OPEN' })
  @IsIn(['BLOCK', 'OPEN'])
  type!: 'BLOCK' | 'OPEN';

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '08:00',
    description: 'Nulo junto com endTime representa o dia inteiro.',
  })
  @ValidateIf((_, value: unknown) => value !== null && value !== undefined)
  @Matches(WALL_TIME)
  startTime?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '14:00' })
  @ValidateIf((_, value: unknown) => value !== null && value !== undefined)
  @Matches(WALL_TIME)
  endTime?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string | null;
}

export class UpdateScheduleExceptionDto {
  @ApiPropertyOptional({ type: String, example: '2026-10-10' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ type: String, enum: ['BLOCK', 'OPEN'] })
  @IsOptional()
  @IsIn(['BLOCK', 'OPEN'])
  type?: 'BLOCK' | 'OPEN';

  @ApiPropertyOptional({ type: String, nullable: true, example: '08:00' })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null && value !== undefined)
  @Matches(WALL_TIME)
  startTime?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '14:00' })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null && value !== undefined)
  @Matches(WALL_TIME)
  endTime?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string | null;
}

export class AvailabilityQueryDto {
  @ApiProperty({ type: String, example: '2026-10-05' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  serviceId!: string;
}
