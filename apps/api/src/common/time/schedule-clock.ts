export const SCHEDULE_TIMEZONE = 'America/Sao_Paulo';
export const SCHEDULE_UTC_OFFSET = '-03:00';
export const SLOT_STEP_MINUTES = 15;

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function parseWallTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error('Horário inválido.');
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatWallTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function assertIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Data inválida.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== (month ?? 1) - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error('Data inválida.');
  }
  return value;
}

export function todayInScheduleZone(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = assertIsoDate(isoDate).split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  const nextYear = utc.getUTCFullYear();
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(utc.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function dayOfWeek(isoDate: string): number {
  const instant = new Date(`${assertIsoDate(isoDate)}T12:00:00${SCHEDULE_UTC_OFFSET}`);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULE_TIMEZONE,
    weekday: 'short',
  }).format(instant);
  const day = WEEKDAY_INDEX[label];
  if (!day) {
    throw new Error('Data inválida.');
  }
  return day;
}

export function nextOrSameDate(isoDate: string, weekday: number): string {
  const current = dayOfWeek(isoDate);
  const delta = (weekday - current + 7) % 7;
  return addDays(isoDate, delta);
}

export function parseScheduleInstant(value: string): Date {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/i.exec(
      value.trim(),
    );
  if (!match) {
    throw new Error('Data e horário inválidos.');
  }
  const date = match[1] ?? '';
  const hours = match[2] ?? '';
  const seconds = match[3] ?? '00';
  const zone = match[4] ?? SCHEDULE_UTC_OFFSET;
  assertIsoDate(date);
  const parsed = new Date(`${date}T${hours}:${seconds}${zone.toUpperCase() === 'Z' ? 'Z' : zone}`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data e horário inválidos.');
  }
  return parsed;
}

export function formatScheduleInstant(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}${SCHEDULE_UTC_OFFSET}`;
}

export function dayBounds(isoDate: string): { startAt: Date; endAt: Date } {
  const date = assertIsoDate(isoDate);
  return {
    startAt: new Date(`${date}T00:00:00${SCHEDULE_UTC_OFFSET}`),
    endAt: new Date(`${addDays(date, 1)}T00:00:00${SCHEDULE_UTC_OFFSET}`),
  };
}
