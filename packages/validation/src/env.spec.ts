import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isSwaggerEnabled, validateEnv } from './index';

const here = dirname(fileURLToPath(import.meta.url));

const validEnv = {
  NODE_ENV: 'development',
  PORT: '43111',
  DATABASE_URL: 'mysql://ravion:ravion_dev_password@127.0.0.1:3306/ravion_barber',
  JWT_SECRET: 'dev-only-change-me-ravion-access-secret',
  JWT_REFRESH_SECRET: 'dev-only-change-me-ravion-refresh-secret',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  DEFAULT_PUBLIC_TENANT_ID: '3f1c2a7e-6b4d-4e8a-9c21-0a1b2c3d4e5f',
  CORS_ORIGINS: 'http://127.0.0.1:43110',
};

describe('validateEnv', () => {
  it('parses a complete development environment', () => {
    const env = validateEnv(validEnv);

    expect(env.PORT).toBe(43111);
    expect(env.NODE_ENV).toBe('development');
    expect(env.THROTTLE_LIMIT).toBe(120);
  });

  it('rejects missing or short secrets without echoing their values', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: undefined })).toThrow(
      /Invalid environment configuration/,
    );

    try {
      validateEnv({ ...validEnv, JWT_SECRET: 'short-but-sensitive' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).not.toContain('short-but-sensitive');
    }
  });

  it('accepts the documented example file', () => {
    const raw = readFileSync(resolve(here, '../../../.env.example'), 'utf8');
    const parsed: Record<string, string> = {};

    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separator = trimmed.indexOf('=');
      parsed[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
    }

    expect(validateEnv(parsed).DATABASE_URL).toContain('ravion_barber');
  });
});

describe('isSwaggerEnabled', () => {
  it('keeps OpenAPI available in development and hidden in production by default', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'development', SWAGGER_ENABLED: undefined })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: undefined })).toBe(false);
    expect(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'development', SWAGGER_ENABLED: 'false' })).toBe(false);
  });
});
