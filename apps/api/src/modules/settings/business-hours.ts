import type { BusinessHours, BusinessHoursDay } from '@ravion/types';

export const BUSINESS_HOUR_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const satisfies ReadonlyArray<keyof BusinessHours>;

const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isWallTime(value: unknown): value is string {
  return typeof value === 'string' && WALL_TIME.test(value);
}

export function businessDayError(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return 'Informe o horário de todos os dias.';
  }

  const day = value as Partial<BusinessHoursDay>;
  if (typeof day.enabled !== 'boolean') {
    return 'Informe se o dia está aberto.';
  }

  if (day.enabled) {
    if (!isWallTime(day.open) || !isWallTime(day.close)) {
      return 'Dia aberto exige horário inicial e final no formato HH:mm.';
    }
    if (day.open >= day.close) {
      return 'O horário inicial precisa ser anterior ao horário final.';
    }
    return null;
  }

  if (day.open === null && day.close === null) {
    return null;
  }

  return 'Dia fechado não informa horário.';
}

export function businessHoursError(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'Informe o horário de funcionamento.';
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(BUSINESS_HOUR_DAYS as readonly string[]).includes(key)) {
      return 'Dia desconhecido no horário de funcionamento.';
    }
  }

  for (const day of BUSINESS_HOUR_DAYS) {
    const error = businessDayError(record[day]);
    if (error) {
      return error;
    }
  }

  return null;
}

export function toStoredBusinessHours(value: BusinessHours): BusinessHours {
  return {
    monday: toStoredDay(value.monday),
    tuesday: toStoredDay(value.tuesday),
    wednesday: toStoredDay(value.wednesday),
    thursday: toStoredDay(value.thursday),
    friday: toStoredDay(value.friday),
    saturday: toStoredDay(value.saturday),
    sunday: toStoredDay(value.sunday),
  };
}

function toStoredDay(day: BusinessHoursDay): BusinessHoursDay {
  if (day.enabled) {
    return { enabled: true, open: day.open, close: day.close };
  }
  return { enabled: false, open: null, close: null };
}
