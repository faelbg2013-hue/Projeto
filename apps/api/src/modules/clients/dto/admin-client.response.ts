import { ApiProperty } from '@nestjs/swagger';
import type {
  AdminClientAppointment,
  AdminClientAppointmentSummary,
  AdminClientDetail,
  AdminClientMovement,
  AppointmentStatus,
  BookingMode,
  PointsTransactionType,
} from '@ravion/types';

const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
const MODES = ['NORMAL', 'POINTS'] as const;
const MOVEMENTS = ['EARN', 'REDEEM', 'REDEEM_REVERSAL', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT'] as const;

export class AdminClientMovementDto implements AdminClientMovement {
  @ApiProperty({ enum: MOVEMENTS, example: 'EARN' })
  type!: PointsTransactionType;

  @ApiProperty({ type: Number, example: 10, description: 'Quantidade positiva. O tipo define crédito ou débito.' })
  points!: number;

  @ApiProperty({ type: String, example: 'Atendimento concluído: Corte' })
  reason!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class AdminClientPointsDto {
  @ApiProperty({
    type: Number,
    example: 12,
    description: 'Saldo derivado do ledger: créditos menos débitos. Não é uma coluna do cliente.',
  })
  balance!: number;

  @ApiProperty({ type: () => AdminClientMovementDto, isArray: true })
  recent!: AdminClientMovementDto[];
}

export class AdminClientAppointmentDto implements AdminClientAppointment {
  @ApiProperty({ type: String, example: '2026-10-07', description: 'Dia civil do início, em America/Sao_Paulo.' })
  date!: string;

  @ApiProperty({ type: String, example: '10:00' })
  time!: string;

  @ApiProperty({ type: String, example: 'Carlos' })
  professionalName!: string;

  @ApiProperty({ type: String, example: 'Corte' })
  serviceName!: string;

  @ApiProperty({ enum: STATUSES, example: 'CONFIRMED' })
  status!: AppointmentStatus;

  @ApiProperty({ enum: MODES, example: 'NORMAL' })
  bookingMode!: BookingMode;
}

export class AdminClientAppointmentSummaryDto implements AdminClientAppointmentSummary {
  @ApiProperty({ type: Number, example: 4 })
  total!: number;

  @ApiProperty({
    type: Number,
    example: 1,
    description: 'PENDING ou CONFIRMED com início futuro. Não é métrica financeira.',
  })
  upcoming!: number;

  @ApiProperty({ type: Number, example: 0 })
  pending!: number;

  @ApiProperty({ type: Number, example: 1 })
  confirmed!: number;

  @ApiProperty({ type: Number, example: 1 })
  completed!: number;

  @ApiProperty({ type: Number, example: 1 })
  cancelled!: number;

  @ApiProperty({ type: Number, example: 1 })
  noShow!: number;
}

export class AdminClientAppointmentsDto {
  @ApiProperty({ type: () => AdminClientAppointmentSummaryDto })
  summary!: AdminClientAppointmentSummaryDto;

  @ApiProperty({ type: () => AdminClientAppointmentDto, isArray: true })
  upcoming!: AdminClientAppointmentDto[];

  @ApiProperty({ type: () => AdminClientAppointmentDto, isArray: true })
  history!: AdminClientAppointmentDto[];
}

export class AdminClientDetailDto implements AdminClientDetail {
  @ApiProperty({ type: String, example: 'Rafael Busca' })
  name!: string;

  @ApiProperty({ type: String, example: 'rafael@example.com' })
  email!: string;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: () => AdminClientPointsDto })
  points!: AdminClientPointsDto;

  @ApiProperty({ type: () => AdminClientAppointmentsDto })
  appointments!: AdminClientAppointmentsDto;
}
