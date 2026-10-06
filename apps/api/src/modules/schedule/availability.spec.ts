import { describe, expect, it } from 'vitest';
import { dayOfWeek, parseWallTime, SLOT_STEP_MINUTES } from '../../common/time/schedule-clock';
import { applyBookingAdvance, calculateAvailability } from './availability';

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

  it('keeps the professional window when establishment hours are absent', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('07:00', '20:00')],
      exceptions: [],
      blocks: [],
      establishment: null,
    });

    expect(slots[0]).toBe('07:00');
    expect(slots.at(-1)).toBe('19:30');
  });

  it('intersects an earlier professional start with the establishment opening', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('07:00', '18:00')],
      exceptions: [],
      blocks: [],
      establishment: [window('08:00', '18:00')],
    });

    expect(slots[0]).toBe('08:00');
    expect(slots).not.toContain('07:00');
    expect(slots).not.toContain('07:45');
    expect(slots.at(-1)).toBe('17:30');
  });

  it('intersects a later professional end with the establishment closing', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('08:00', '20:00')],
      exceptions: [],
      blocks: [],
      establishment: [window('08:00', '18:00')],
    });

    expect(slots[0]).toBe('08:00');
    expect(slots.at(-1)).toBe('17:30');
    expect(slots).not.toContain('17:45');
    expect(slots).not.toContain('18:00');
    expect(slots).not.toContain('19:30');
  });

  it('returns the partial overlap of professional and establishment windows', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('08:00', '12:00')],
      exceptions: [],
      blocks: [],
      establishment: [window('10:00', '16:00')],
    });

    expect(slots[0]).toBe('10:00');
    expect(slots.at(-1)).toBe('11:30');
    expect(slots).not.toContain('09:45');
    expect(slots).not.toContain('12:00');
  });

  it('returns no slots when the establishment is closed', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('07:00', '20:00')],
      exceptions: [],
      blocks: [],
      establishment: [],
    });

    expect(slots).toEqual([]);
  });

  it('keeps a professional block inside the intersection', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('07:00', '20:00')],
      exceptions: [],
      blocks: [
        {
          startAt: new Date('2026-10-05T12:00:00-03:00'),
          endAt: new Date('2026-10-05T13:00:00-03:00'),
        },
      ],
      establishment: [window('08:00', '18:00')],
    });

    expect(slots).toContain('08:00');
    expect(slots).toContain('11:30');
    expect(slots).not.toContain('12:00');
    expect(slots).not.toContain('12:30');
    expect(slots).toContain('13:00');
    expect(slots).not.toContain('07:45');
    expect(slots.at(-1)).toBe('17:30');
  });

  it('clips an OPEN exception to the establishment and still honors BLOCK', () => {
    const openOnly = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [],
      exceptions: [{ type: 'OPEN', start: parseWallTime('07:00'), end: parseWallTime('20:00') }],
      blocks: [],
      establishment: [window('08:00', '18:00')],
    });
    expect(openOnly[0]).toBe('08:00');
    expect(openOnly.at(-1)).toBe('17:30');
    expect(openOnly).not.toContain('07:00');

    const blocked = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 30,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('07:00', '20:00')],
      exceptions: [{ type: 'BLOCK', start: null, end: null }],
      blocks: [],
      establishment: [window('08:00', '18:00')],
    });
    expect(blocked).toEqual([]);
  });

  it('does not offer a slot that starts at opening but would begin before it', () => {
    const slots = calculateAvailability({
      date: '2026-10-05',
      durationMinutes: 45,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: [window('07:00', '20:00')],
      exceptions: [],
      blocks: [],
      establishment: [window('08:00', '18:00')],
    });

    expect(slots[0]).toBe('08:00');
    expect(slots.at(-1)).toBe('17:15');
    expect(slots).not.toContain('17:30');
  });

  it('keeps the current grid when the booking advance is zero', () => {
    const slots = ['08:00', '11:00', '11:15'];
    const now = new Date('2026-10-05T10:07:00-03:00');

    expect(applyBookingAdvance('2026-10-05', slots, now, 0)).toEqual(slots);
  });

  it('drops a start inside the advance and keeps the next 15 minute step', () => {
    const slots = ['11:00', '11:15', '12:00'];
    const now = new Date('2026-10-05T10:07:00-03:00');

    expect(applyBookingAdvance('2026-10-05', slots, now, 60)).toEqual(['11:15', '12:00']);
  });

  it('allows a start exactly at now plus the advance in America/Sao_Paulo', () => {
    const slots = ['11:45', '12:00'];
    const now = new Date('2026-10-05T10:00:00-03:00');

    expect(applyBookingAdvance('2026-10-05', slots, now, 120)).toEqual(['12:00']);
  });
});
