import { ApiProperty } from '@nestjs/swagger';
import type {
  AppointmentStatus,
  BookingMode,
  ProfessionalDay,
  ProfessionalDayAppointment,
  ProfessionalDaySummary,
} from '@ravion/types';

const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
const MODES = ['NORMAL', 'POINTS'] as const;

export class ProfessionalDaySummaryDto implements ProfessionalDaySummary {
  @ApiProperty({ type: Number, example: 8, description: 'Quantidade de agendamentos do profissional no dia.' })
  total!: number;

  @ApiProperty({ type: Number, example: 3 })
  confirmed!: number;

  @ApiProperty({ type: Number, example: 3 })
  completed!: number;

  @ApiProperty({ type: Number, example: 1 })
  noShow!: number;

  @ApiProperty({ type: Number, example: 1 })
  cancelled!: number;
}

export class ProfessionalDayAppointmentDto implements ProfessionalDayAppointment {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    example: '2026-09-29T15:00:00-03:00',
    description: 'Início em America/Sao_Paulo, ISO 8601 com offset.',
  })
  startAt!: string;

  @ApiProperty({
    type: String,
    example: '2026-09-29T15:30:00-03:00',
    description: 'Fim em America/Sao_Paulo, ISO 8601 com offset.',
  })
  endAt!: string;

  @ApiProperty({ type: String, example: '15:00' })
  time!: string;

  @ApiProperty({ type: String, example: '15:30' })
  endTime!: string;

  @ApiProperty({ type: String, example: 'Ana Costa' })
  clientName!: string;

  @ApiProperty({ type: String, example: 'Corte', description: 'Nome gravado no agendamento.' })
  serviceName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Corte clássico',
    description: 'Descrição atual do serviço, quando existir. Não é um snapshot.',
  })
  serviceDescription!: string | null;

  @ApiProperty({ type: Number, example: 30, description: 'Duração gravada no agendamento, em minutos.' })
  durationMinutes!: number;

  @ApiProperty({
    type: String,
    example: '45.00',
    description: 'priceSnapshot. É o valor registrado do serviço, não um pagamento.',
  })
  price!: string;

  @ApiProperty({ type: String, enum: STATUSES })
  status!: AppointmentStatus;

  @ApiProperty({ type: String, enum: MODES })
  bookingMode!: BookingMode;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 50,
    description: 'Pontos debitados quando bookingMode é POINTS. Null em NORMAL.',
  })
  redemptionPointsSnapshot!: number | null;

  @ApiProperty({
    type: Number,
    example: 10,
    description: 'Pontos que a conclusão pode creditar. O frontend não movimenta o ledger.',
  })
  pointsSnapshot!: number;
}

export class ProfessionalDayDto implements ProfessionalDay {
  @ApiProperty({ type: String, example: '2026-09-29' })
  date!: string;

  @ApiProperty({ type: ProfessionalDaySummaryDto })
  summary!: ProfessionalDaySummaryDto;

  @ApiProperty({ type: ProfessionalDayAppointmentDto, nullable: true })
  nextAppointment!: ProfessionalDayAppointmentDto | null;

  @ApiProperty({
    type: ProfessionalDayAppointmentDto,
    nullable: true,
    description: 'CONFIRMED cujo intervalo contém o instante atual. O relógio do cliente não muda o status.',
  })
  currentAppointment!: ProfessionalDayAppointmentDto | null;

  @ApiProperty({ type: ProfessionalDayAppointmentDto, isArray: true })
  appointments!: ProfessionalDayAppointmentDto[];
}
