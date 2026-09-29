import { ApiProperty } from '@nestjs/swagger';
import type { AppointmentItem, BookingMode } from '@ravion/types';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.response';

export class AppointmentResponseDto implements AppointmentItem {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  clientId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  professionalId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  serviceId!: string;

  @ApiProperty({ type: String, example: 'Ana Costa' })
  clientName!: string;

  @ApiProperty({ type: String, example: 'Carlos' })
  professionalName!: string;

  @ApiProperty({ type: String, example: 'Corte', description: 'Nome do serviço no momento da criação.' })
  serviceName!: string;

  @ApiProperty({ type: String, example: '40.00', description: 'Preço decimal no momento da criação.' })
  price!: string;

  @ApiProperty({ type: Number, example: 30, description: 'Duração em minutos no momento da criação.' })
  durationMinutes!: number;

  @ApiProperty({
    type: Number,
    example: 10,
    description: 'Pontos que o atendimento concluído gera. É o points do serviço no momento da criação.',
  })
  pointsSnapshot!: number;

  @ApiProperty({
    type: String,
    enum: ['NORMAL', 'POINTS'],
    example: 'NORMAL',
    description: 'NORMAL não debita pontos. POINTS registra o resgate feito na criação. Não é forma de pagamento.',
  })
  bookingMode!: BookingMode;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 50,
    description: 'Pontos debitados na criação quando bookingMode é POINTS. Null quando o modo é NORMAL.',
  })
  redemptionPointsSnapshot!: number | null;

  @ApiProperty({ type: String, example: '2026-10-05' })
  date!: string;

  @ApiProperty({ type: String, example: '10:30' })
  time!: string;

  @ApiProperty({ type: String, example: '2026-10-05T10:30:00-03:00' })
  startAt!: string;

  @ApiProperty({ type: String, example: '2026-10-05T11:00:00-03:00' })
  endAt!: string;

  @ApiProperty({ type: String, enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] })
  status!: AppointmentItem['status'];

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: string | null;
}

export class PaginatedAppointmentsDto {
  @ApiProperty({ type: () => AppointmentResponseDto, isArray: true })
  data!: AppointmentResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
