import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.query';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

export class CreateAppointmentDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  professionalId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ type: String, example: '2026-10-05' })
  @Matches(DATE)
  date!: string;

  @ApiProperty({ type: String, example: '10:30', description: 'Horário de parede HH:mm em America/Sao_Paulo.' })
  @Matches(TIME)
  time!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class AppointmentMeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: String,
    enum: ['upcoming', 'history'],
    description: 'upcoming lista CONFIRMED. history lista COMPLETED, CANCELLED e NO_SHOW.',
  })
  @IsOptional()
  @IsIn(['upcoming', 'history'])
  view?: 'upcoming' | 'history';
}

export class ProfessionalAppointmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: String, example: '2026-10-05' })
  @IsOptional()
  @Matches(DATE)
  date?: string;

  @ApiPropertyOptional({ type: String, enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}

export class AdminAppointmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ type: String, example: '2026-10-05' })
  @IsOptional()
  @Matches(DATE)
  date?: string;

  @ApiPropertyOptional({ type: String, example: '2026-10-01' })
  @IsOptional()
  @Matches(DATE)
  startDate?: string;

  @ApiPropertyOptional({ type: String, example: '2026-10-31' })
  @IsOptional()
  @Matches(DATE)
  endDate?: string;

  @ApiPropertyOptional({ type: String, enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
