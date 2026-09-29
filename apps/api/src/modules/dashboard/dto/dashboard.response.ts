import { ApiProperty } from '@nestjs/swagger';
import type {
  AppointmentStatus,
  BookingMode,
  DashboardAppointment,
  DashboardProfessional,
  DashboardSummary,
  OperationalDashboard,
} from '@ravion/types';

const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
const MODES = ['NORMAL', 'POINTS'] as const;

export class DashboardSummaryDto implements DashboardSummary {
  @ApiProperty({ type: Number, example: 10 })
  totalAppointments!: number;

  @ApiProperty({ type: Number, example: 4 })
  confirmed!: number;

  @ApiProperty({ type: Number, example: 3 })
  completed!: number;

  @ApiProperty({ type: Number, example: 2 })
  cancelled!: number;

  @ApiProperty({ type: Number, example: 1 })
  noShow!: number;

  @ApiProperty({
    type: String,
    example: '450.00',
    description: 'Soma de priceSnapshot do dia. É o valor registrado do serviço, não um pagamento.',
  })
  servicesValue!: string;

  @ApiProperty({ type: Number, example: 50, description: 'Soma dos REDEEM ligados aos agendamentos do dia.' })
  pointsRedeemed!: number;

  @ApiProperty({
    type: Number,
    example: 50,
    description: 'Soma dos REDEEM_REVERSAL ligados aos agendamentos do dia.',
  })
  pointsReversed!: number;

  @ApiProperty({ type: Number, example: 30, description: 'Soma dos EARN ligados aos agendamentos do dia.' })
  pointsEarned!: number;
}

export class DashboardAppointmentDto implements DashboardAppointment {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: '15:00', description: 'Horário de parede em America/Sao_Paulo.' })
  time!: string;

  @ApiProperty({ type: String, example: 'Ana Costa' })
  clientName!: string;

  @ApiProperty({ type: String, example: 'Carlos' })
  professionalName!: string;

  @ApiProperty({ type: String, example: 'Corte', description: 'Nome gravado no agendamento.' })
  serviceName!: string;

  @ApiProperty({ type: Number, example: 30 })
  durationMinutes!: number;

  @ApiProperty({ type: String, example: '45.00', description: 'priceSnapshot. Não é pagamento.' })
  price!: string;

  @ApiProperty({ type: String, enum: STATUSES })
  status!: AppointmentStatus;

  @ApiProperty({ type: String, enum: MODES })
  bookingMode!: BookingMode;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 50,
    description: 'Pontos utilizados no agendamento. Null quando o modo é NORMAL.',
  })
  redemptionPointsSnapshot!: number | null;
}

export class DashboardProfessionalDto implements DashboardProfessional {
  @ApiProperty({ type: String, format: 'uuid' })
  professionalId!: string;

  @ApiProperty({ type: String, example: 'Carlos' })
  name!: string;

  @ApiProperty({ type: Number, example: 4 })
  appointments!: number;

  @ApiProperty({ type: Number, example: 2 })
  completed!: number;

  @ApiProperty({ type: Number, example: 1 })
  cancelled!: number;

  @ApiProperty({ type: Number, example: 0 })
  noShow!: number;

  @ApiProperty({ type: String, example: '180.00', description: 'Soma de priceSnapshot. Não é comissão nem pagamento.' })
  servicesValue!: string;
}

export class DashboardResponseDto implements OperationalDashboard {
  @ApiProperty({ type: String, example: '2026-09-29' })
  date!: string;

  @ApiProperty({ type: () => DashboardSummaryDto })
  summary!: DashboardSummaryDto;

  @ApiProperty({ type: () => DashboardAppointmentDto, isArray: true })
  upcoming!: DashboardAppointmentDto[];

  @ApiProperty({ type: () => DashboardAppointmentDto, isArray: true })
  appointments!: DashboardAppointmentDto[];

  @ApiProperty({ type: () => DashboardProfessionalDto, isArray: true })
  professionals!: DashboardProfessionalDto[];
}
