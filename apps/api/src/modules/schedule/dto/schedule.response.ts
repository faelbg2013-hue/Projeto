import { ApiProperty } from '@nestjs/swagger';
import type {
  Availability,
  ProfessionalSchedule,
  ScheduleException,
  ScheduleInterval,
  TimeBlock,
} from '@ravion/types';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.response';

export class ScheduleIntervalResponseDto implements ScheduleInterval {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  professionalId!: string;

  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 7,
    example: 1,
    description: '1 = segunda, 2 = terça, 3 = quarta, 4 = quinta, 5 = sexta, 6 = sábado, 7 = domingo.',
  })
  dayOfWeek!: number;

  @ApiProperty({ type: String, example: '08:00', description: 'Horário de parede HH:mm, sem data.' })
  startTime!: string;

  @ApiProperty({ type: String, example: '12:00' })
  endTime!: string;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class ProfessionalScheduleResponseDto implements ProfessionalSchedule {
  @ApiProperty({ type: String, format: 'uuid' })
  professionalId!: string;

  @ApiProperty({ type: () => ScheduleIntervalResponseDto, isArray: true })
  intervals!: ScheduleIntervalResponseDto[];
}

export class TimeBlockResponseDto implements TimeBlock {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  professionalId!: string;

  @ApiProperty({
    type: String,
    example: '2026-10-05T12:00:00-03:00',
    description: 'Instante formatado em America/Sao_Paulo, com offset explícito.',
  })
  startAt!: string;

  @ApiProperty({ type: String, example: '2026-10-05T13:30:00-03:00' })
  endAt!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Almoço' })
  reason!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PaginatedTimeBlocksDto {
  @ApiProperty({ type: () => TimeBlockResponseDto, isArray: true })
  data!: TimeBlockResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class ScheduleExceptionResponseDto implements ScheduleException {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  professionalId!: string;

  @ApiProperty({ type: String, example: '2026-10-10', description: 'Data civil YYYY-MM-DD.' })
  date!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '08:00',
    description: 'Nulo, junto com endTime, significa o dia inteiro.',
  })
  startTime!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '14:00' })
  endTime!: string | null;

  @ApiProperty({ type: String, enum: ['BLOCK', 'OPEN'], example: 'OPEN' })
  type!: 'BLOCK' | 'OPEN';

  @ApiProperty({ type: String, nullable: true, example: 'Plantão' })
  reason!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PaginatedScheduleExceptionsDto {
  @ApiProperty({ type: () => ScheduleExceptionResponseDto, isArray: true })
  data!: ScheduleExceptionResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class AvailabilityResponseDto implements Availability {
  @ApiProperty({ type: String, example: '2026-10-05' })
  date!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  professionalId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  serviceId!: string;

  @ApiProperty({ type: Number, example: 30 })
  durationMinutes!: number;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['08:00', '08:15', '08:30'],
    description: 'Horários de início HH:mm. O passo interno desta fase é 15 minutos.',
  })
  slots!: string[];
}
