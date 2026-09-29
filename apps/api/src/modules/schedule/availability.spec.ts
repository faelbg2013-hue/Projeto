import { describe, expect, it } from 'vitest';
import { dayOfWeek, parseWallTime, SLOT_STEP_MINUTES } from '../../common/time/schedule-clock';
import { calculateAvailability } from './availability';

function window(start: string, end: string) {
  return { start: parseWallTime(start), end: parseWallTime(end) };
}

describe('availability engine', () => {
  it('uses Monday as day 1 in America/Sao_Paulo', () => {
    expect(dayOfWeek('2026-10-05')).toBe(1);
    expect(dayOfWeek('2026-10-10')).toBe(6);
    expect(dayOfWeek('2026-10-11')).toBe(7);
  });

  it('offers 15 minute starts that finish inside the shift', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('08:00', '12:00')],
      exceptions: [],
      blocks: [],
    });

    expect(slots[0]).toBe('08:00');
    expect(slots.at(-1)).toBe('11:30');
    expect(slots).not.toContain('11:45');
    expect(slots).not.toContain('12:00');
  });

  it('keeps a 45 minute service on the 15 minute grid without passing the shift end', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 45,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('08:00', '10:00')],
      exceptions: [],
      blocks: [],
    });

    expect(slots).toEqual(['08:00', '08:15', '08:30', '08:45', '09:00', '09:15']);
  });

  it('drops a 50 minute service that would end after the shift', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 50,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('08:00', '10:00')],
      exceptions: [],
      blocks: [],
    });

    expect(slots).toEqual(['08:00', '08:15', '08:30', '08:45', '09:00']);
    expect(slots).not.toContain('09:15');
  });

  it('removes slots that would cross a time block', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 60,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('08:00', '18:00')],
      exceptions: [],
      blocks: [
        {
          startAt: new Date('2026-10-05T12:00:00-03:00'),
          endAt: new Date('2026-10-05T13:30:00-03:00'),
        },
      ],
    });

    expect(slots).toContain('11:00');
    expect(slots).not.toContain('11:15');
    expect(slots).not.toContain('11:30');
    expect(slots).not.toContain('12:00');
    expect(slots).toContain('13:30');
    expect(slots.at(-1)).toBe('17:00');
  });

  it('opens a closed weekday through an OPEN exception', () => {
    const slots = calculateAvailability({
      date: '2026-10-10',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [],
      exceptions: [{ type: 'OPEN', start: parseWallTime('08:00'), end: parseWallTime('14:00') }],
      blocks: [],
    });

    expect(slots[0]).toBe('08:00');
    expect(slots.at(-1)).toBe('13:30');
  });

  it('clears the weekly shift when a BLOCK exception covers it', () => {
    const slots = calculateAvailability({
      date: '2026-10-10',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('08:00', '14:00')],
      exceptions: [{ type: 'BLOCK', start: parseWallTime('08:00'), end: parseWallTime('14:00') }],
      blocks: [],
    });

    expect(slots).toEqual([]);
  });

  it('reserves room for future appointments without changing the public contract', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('08:00', '10:00')],
      exceptions: [],
      blocks: [],
      occupied: [
        {
          startAt: new Date('2026-10-05T08:00:00-03:00'),
          endAt: new Date('2026-10-05T08:30:00-03:00'),
        },
      ],
    });

    expect(slots[0]).toBe('08:30');
    expect(slots).not.toContain('08:00');
  });
});
