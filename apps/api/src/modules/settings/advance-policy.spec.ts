import { describe, expect, it } from 'vitest';
import { isBookingDateOpen } from './advance-policy';

describe('booking horizon', () => {
  const morning = new Date('2026-10-06T08:00:00-03:00');

  it('leaves every future date open when the horizon is zero', () => {
    expect(isBookingDateOpen('2026-12-01', morning, 0)).toBe(true);
  });

  it('allows the civil date exactly thirty days ahead and rejects the next day', () => {
    expect(isBookingDateOpen('2026-11-05', morning, 30)).toBe(true);
    expect(isBookingDateOpen('2026-11-06', morning, 30)).toBe(false);
  });

  it('uses the America/Sao_Paulo civil date after UTC has already changed day', () => {
    const late = new Date('2026-10-07T02:00:00.000Z');

    expect(isBookingDateOpen('2026-10-07', late, 1)).toBe(true);
    expect(isBookingDateOpen('2026-10-08', late, 1)).toBe(false);
  });

  it('keeps the whole limit day open when the clock is early the day before', () => {
    const early = new Date('2026-10-06T01:00:00-03:00');

    expect(isBookingDateOpen('2026-10-07', early, 1)).toBe(true);
    expect(isBookingDateOpen('2026-10-08', early, 1)).toBe(false);
  });
});
