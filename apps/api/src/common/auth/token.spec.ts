import { describe, expect, it } from 'vitest';
import { createRefreshToken, hashRefreshToken, parseDurationToSeconds } from './token';

describe('token helpers', () => {
  it('parses configured durations into seconds', () => {
    expect(parseDurationToSeconds('15m')).toBe(900);
    expect(parseDurationToSeconds('7d')).toBe(604_800);
  });

  it('hashes refresh tokens without keeping the raw value', () => {
    const first = createRefreshToken();
    const second = createRefreshToken();

    expect(first).not.toBe(second);
    expect(hashRefreshToken(first)).toHaveLength(64);
    expect(hashRefreshToken(first)).not.toBe(first);
    expect(hashRefreshToken(first)).not.toBe(hashRefreshToken(second));
  });
});
