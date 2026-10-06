import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { addDays, todayInScheduleZone } from '../../common/time/schedule-clock';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** 30 dias. Acima disso a política deixa de ser uma antecedência e passa a fechar a agenda. */
export const ADVANCE_MAX_MINUTES = 43_200;

/** 4 horas. Acima disso o intervalo deixa de ser uma folga entre atendimentos. */
export const APPOINTMENT_BUFFER_MAX_MINUTES = 240;

/** Um ano civil. Acima disso a janela deixa de ser uma política de abertura da agenda. */
export const BOOKING_MAX_ADVANCE_DAYS = 365;

export const BOOKING_MIN_ADVANCE_KEY = 'booking_min_advance_minutes';
export const CANCELLATION_MIN_ADVANCE_KEY = 'cancellation_min_advance_minutes';
export const APPOINTMENT_BUFFER_KEY = 'appointment_buffer_minutes';
export const BOOKING_MAX_ADVANCE_KEY = 'booking_max_advance_days';

const STORED_MINUTES = /^(0|[1-9]\d*)$/;

type SettingReader = Prisma.TransactionClient | PrismaService;

export function parseStoredMinutes(raw: string, max: number): number | null {
  if (!STORED_MINUTES.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > max) {
    return null;
  }
  return value;
}

export function parseStoredAdvanceMinutes(raw: string): number | null {
  return parseStoredMinutes(raw, ADVANCE_MAX_MINUTES);
}

/**
 * Sem linha, a política efetiva é 0 e nada é gravado.
 * 0 não acrescenta restrição. Um texto fora do contrato falha em vez de ser ignorado.
 */
export async function readAdvanceMinutes(
  db: SettingReader,
  tenantId: string,
  key: typeof BOOKING_MIN_ADVANCE_KEY | typeof CANCELLATION_MIN_ADVANCE_KEY,
): Promise<number> {
  const row = await db.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key } },
  });
  if (!row) {
    return 0;
  }
  const minutes = parseStoredAdvanceMinutes(row.value);
  if (minutes === null) {
    throw new BadRequestException('Antecedência armazenada é inválida.');
  }
  return minutes;
}

/**
 * 0 deixa qualquer data futura aberta.
 * Com dias positivos, a data local em America/Sao_Paulo pode ser hoje + N, inclusive.
 * O dia seguinte fica fechado. A conta é de calendário, não de 24 horas.
 */
export function isBookingDateOpen(date: string, now: Date, maxDays: number): boolean {
  if (maxDays <= 0) {
    return true;
  }
  return date <= addDays(todayInScheduleZone(now), maxDays);
}

/** Sem linha, a janela efetiva é 0 e qualquer data futura continua aberta. */
export async function readBookingMaxAdvanceDays(db: SettingReader, tenantId: string): Promise<number> {
  const row = await db.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key: BOOKING_MAX_ADVANCE_KEY } },
  });
  if (!row) {
    return 0;
  }
  const days = parseStoredMinutes(row.value, BOOKING_MAX_ADVANCE_DAYS);
  if (days === null) {
    throw new BadRequestException('Antecedência máxima de agendamento armazenada é inválida.');
  }
  return days;
}

/** Sem linha, o intervalo efetivo é 0. O texto fora de 0–240 falha em vez de ser ignorado. */
export async function readAppointmentBufferMinutes(db: SettingReader, tenantId: string): Promise<number> {
  const row = await db.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key: APPOINTMENT_BUFFER_KEY } },
  });
  if (!row) {
    return 0;
  }
  const minutes = parseStoredMinutes(row.value, APPOINTMENT_BUFFER_MAX_MINUTES);
  if (minutes === null) {
    throw new BadRequestException('Intervalo entre atendimentos armazenado é inválido.');
  }
  return minutes;
}
