import { ApiProperty } from '@nestjs/swagger';
import type {
  AdminProfessionalAppointment,
  AdminProfessionalAppointmentSummary,
  AdminProfessionalDetail,
  AdminProfessionalInterval,
  AdminProfessionalService,
  AppointmentStatus,
  BookingMode,
} from '@ravion/types';

const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
const MODES = ['NORMAL', 'POINTS'] as const;

export class AdminProfessionalServiceDto implements AdminProfessionalService {
  @ApiProperty({ type: String, example: 'Corte' })
  name!: string;

  @ApiProperty({ type: Number, example: 30 })
  durationMinutes!: number;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;

  @ApiProperty({
    type: String,
    example: '45.00',
    description: 'Valor comercial cadastrado do serviço. Não é receita nem faturamento.',
  })
  price!: string;
}

export class AdminProfessionalIntervalDto implements AdminProfessionalInterval {
  @ApiProperty({ type: Number, example: 1, description: '1 é segunda e 7 é domingo.' })
  dayOfWeek!: number;

  @ApiProperty({ type: String, example: '09:00' })
  startTime!: string;

  @ApiProperty({ type: String, example: '18:00' })
  endTime!: string;
}

export class AdminProfessionalAppointmentDto implements AdminProfessionalAppointment {
  @ApiProperty({ type: String, example: '2026-10-07', description: 'Dia civil do início, em America/Sao_Paulo.' })
  date!: string;

  @ApiProperty({ type: String, example: '10:00' })
  time!: string;

  @ApiProperty({ type: String, example: 'Rafael' })
  clientName!: string;

  @ApiProperty({ type: String, example: 'Corte', description: 'Nome gravado no agendamento. Não acompanha renomeação posterior.' })
  serviceName!: string;

  @ApiProperty({ enum: STATUSES, example: 'CONFIRMED' })
  status!: AppointmentStatus;

  @ApiProperty({ enum: MODES, example: 'NORMAL' })
  bookingMode!: BookingMode;
}

export class AdminProfessionalAppointmentSummaryDto implements AdminProfessionalAppointmentSummary {
  @ApiProperty({ type: Number, example: 4, description: 'Total histórico do profissional no tenant. Não é métrica financeira.' })
  total!: number;

  @ApiProperty({
    type: Number,
    example: 1,
    description: 'Agendamentos cujo início cai no dia civil de hoje em America/Sao_Paulo, em qualquer status.',
  })
  today!: number;

  @ApiProperty({
    type: Number,
    example: 1,
    description: 'PENDING ou CONFIRMED com início futuro. Pode ser maior que a lista de próximos.',
  })
  upcoming!: number;

  @ApiProperty({ type: Number, example: 0, description: 'Total histórico.' })
  pending!: number;

  @ApiProperty({ type: Number, example: 1, description: 'Total histórico.' })
  confirmed!: number;

  @ApiProperty({ type: Number, example: 1, description: 'Total histórico.' })
  completed!: number;

  @ApiProperty({ type: Number, example: 1, description: 'Total histórico.' })
  cancelled!: number;

  @ApiProperty({ type: Number, example: 0, description: 'Total histórico.' })
  noShow!: number;
}

export class AdminProfessionalAppointmentsDto {
  @ApiProperty({ type: () => AdminProfessionalAppointmentSummaryDto })
  summary!: AdminProfessionalAppointmentSummaryDto;

  @ApiProperty({ type: () => AdminProfessionalAppointmentDto, isArray: true })
  upcoming!: AdminProfessionalAppointmentDto[];

  @ApiProperty({ type: () => AdminProfessionalAppointmentDto, isArray: true })
  history!: AdminProfessionalAppointmentDto[];
}

export class AdminProfessionalDetailDto implements AdminProfessionalDetail {
  @ApiProperty({ type: String, example: 'Carlos' })
  displayName!: string;

  @ApiProperty({ type: String, example: 'Carlos Lima' })
  name!: string;

  @ApiProperty({ type: String, example: 'carlos@example.com' })
  email!: string;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    type: () => AdminProfessionalServiceDto,
    isArray: true,
    description: 'Catálogo de serviços do tenant. Não existe vínculo individual com o profissional.',
  })
  services!: AdminProfessionalServiceDto[];

  @ApiProperty({
    type: () => AdminProfessionalIntervalDto,
    isArray: true,
    description: 'Intervalos ativos da agenda semanal. A edição continua na rota de agenda.',
  })
  week!: AdminProfessionalIntervalDto[];

  @ApiProperty({ type: () => AdminProfessionalAppointmentsDto })
  appointments!: AdminProfessionalAppointmentsDto;
}
