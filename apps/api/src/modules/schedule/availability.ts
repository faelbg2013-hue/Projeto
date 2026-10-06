import { dayBounds, formatWallTime } from '../../common/time/schedule-clock';

export interface MinuteWindow {
  start: number;
  end: number;
}

export interface AvailabilityException {
  type: 'BLOCK' | 'OPEN';
  start: number | null;
  end: number | null;
}

export interface InstantRange {
  startAt: Date;
  endAt: Date;
}

const DAY_MINUTES = 24 * 60;

export function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function hasOverlap(ranges: MinuteWindow[]): boolean {
  const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (!previous || !current) {
      continue;
    }
    if (rangesOverlap(previous.start, previous.end, current.start, current.end)) {
      return true;
    }
  }
  return false;
}

export function mergeWindows(windows: MinuteWindow[]): MinuteWindow[] {
  const sorted = [...windows]
    .filter((window) => window.end > window.start)
    .sort((left, right) => left.start - right.start);
  const merged: MinuteWindow[] = [];
  for (const window of sorted) {
    const last = merged.at(-1);
    if (!last || window.start > last.end) {
      merged.push({ ...window });
    } else {
      last.end = Math.max(last.end, window.end);
    }
  }
  return merged;
}

export function subtractWindow(windows: MinuteWindow[], cut: MinuteWindow): MinuteWindow[] {
  const next: MinuteWindow[] = [];
  for (const window of windows) {
    if (cut.end <= window.start || cut.start >= window.end) {
      next.push(window);
      continue;
    }
    if (cut.start > window.start) {
      next.push({ start: window.start, end: cut.start });
    }
    if (cut.end < window.end) {
      next.push({ start: cut.end, end: window.end });
    }
  }
  return next.filter((window) => window.end > window.start);
}

export function intersectWindows(left: MinuteWindow[], right: MinuteWindow[]): MinuteWindow[] {
  const overlap: MinuteWindow[] = [];
  for (const first of left) {
    for (const second of right) {
      const start = Math.max(first.start, second.start);
      const end = Math.min(first.end, second.end);
      if (end > start) {
        overlap.push({ start, end });
      }
    }
  }
  return mergeWindows(overlap);
}

function exceptionWindow(item: AvailabilityException): MinuteWindow {
  if (item.start === null || item.end === null) {
    return { start: 0, end: DAY_MINUTES };
  }
  return { start: item.start, end: item.end };
}

export function instantWindowOnDate(date: string, startAt: Date, endAt: Date): MinuteWindow | null {
  const bounds = dayBounds(date);
  const start = Math.max(startAt.getTime(), bounds.startAt.getTime());
  const end = Math.min(endAt.getTime(), bounds.endAt.getTime());
  if (end <= start) {
    return null;
  }
  return {
    start: Math.floor((start - bounds.startAt.getTime()) / 60_000),
    end: Math.ceil((end - bounds.startAt.getTime()) / 60_000),
  };
}

export function buildSlots(windows: MinuteWindow[], durationMinutes: number, stepMinutes: number): string[] {
  const slots: string[] = [];
  for (const window of windows) {
    for (let start = window.start; start + durationMinutes <= window.end; start += stepMinutes) {
      slots.push(formatWallTime(start));
    }
  }
  return slots;
}

/**
 * Ordem: agenda semanal, exceções OPEN, exceções BLOCK, bloqueios, ocupações.
 * `establishment` null ou omitido: o tenant ainda não salvou business_hours e a agenda do profissional segue sozinha.
 * `establishment` vazio: o estabelecimento está fechado nesse dia e nenhum slot sai.
 * Quando há janela, o slot precisa caber na interseção, inclusive o fim do serviço.
 */
export function calculateAvailability(input: {
  date: string;
  durationMinutes: number;
  stepMinutes: number;
  weekly: MinuteWindow[];
  exceptions: AvailabilityException[];
  blocks: InstantRange[];
  occupied?: InstantRange[];
  establishment?: MinuteWindow[] | null;
}): string[] {
  const opens = input.exceptions.filter((item) => item.type === 'OPEN').map(exceptionWindow);
  let windows = mergeWindows([...input.weekly, ...opens]);
  for (const exception of input.exceptions.filter((item) => item.type === 'BLOCK')) {
    windows = subtractWindow(windows, exceptionWindow(exception));
  }
  for (const block of [...input.blocks, ...(input.occupied ?? [])]) {
    const cut = instantWindowOnDate(input.date, block.startAt, block.endAt);
    if (cut) {
      windows = subtractWindow(windows, cut);
    }
  }
  if (input.establishment != null) {
    windows = intersectWindows(windows, input.establishment);
  }
  return buildSlots(windows, input.durationMinutes, input.stepMinutes);
}
