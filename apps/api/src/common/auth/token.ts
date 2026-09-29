import { createHash, randomBytes } from 'node:crypto';

const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3_600,
  d: 86_400,
};

export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  const amount = match?.[1];
  const unit = match?.[2];
  const multiplier = unit ? UNIT_SECONDS[unit] : undefined;
  if (!amount || multiplier === undefined) {
    throw new Error('Invalid duration');
  }
  return Number(amount) * multiplier;
}

export function createRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
