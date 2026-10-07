import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertDevelopmentSeedAllowed } from './development-seed';

const seedSource = readFileSync(resolve(process.cwd(), '../../prisma/seed.ts'), 'utf8');

describe('development seed guard', () => {
  it('blocks production before the seed opens a database client', () => {
    const guardAt = seedSource.indexOf('assertDevelopmentSeedAllowed');
    const clientAt = seedSource.indexOf('new PrismaClient');

    expect(guardAt).toBeGreaterThan(-1);
    expect(clientAt).toBeGreaterThan(guardAt);
    expect(() => assertDevelopmentSeedAllowed('production')).toThrow(
      'Development seed cannot run with NODE_ENV=production.',
    );
  });

  it('allows development and test', () => {
    expect(() => assertDevelopmentSeedAllowed('development')).not.toThrow();
    expect(() => assertDevelopmentSeedAllowed('test')).not.toThrow();
    expect(() => assertDevelopmentSeedAllowed(undefined)).not.toThrow();
  });

  it('does not include a connection string in the production error', () => {
    expect(() => assertDevelopmentSeedAllowed('production')).toThrow(/NODE_ENV=production/);
    try {
      assertDevelopmentSeedAllowed('production');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).not.toMatch(/mysql:|DATABASE_URL|password/i);
    }
  });
});
