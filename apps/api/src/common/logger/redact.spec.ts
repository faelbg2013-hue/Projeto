import { describe, expect, it } from 'vitest';
import { redactSensitiveText, redactValue } from './redact';

describe('redactSensitiveText', () => {
  it('removes credentials from connection strings and bearer tokens', () => {
    const raw =
      'connect mysql://ravion:ravion_dev_password@127.0.0.1:3306/ravion_barber Authorization: Bearer abc.def.ghi';

    const redacted = redactSensitiveText(raw);

    expect(redacted).toContain('mysql://[REDACTED]@127.0.0.1:3306/ravion_barber');
    expect(redacted).toContain('Authorization: [REDACTED]');
    expect(redacted).not.toContain('ravion_dev_password');
    expect(redacted).not.toContain('abc.def.ghi');
  });

  it('redacts assignment-style secrets and leaves ordinary text intact', () => {
    expect(redactSensitiveText('password=hunter2 status=ok')).toBe('password=[REDACTED] status=ok');
    expect(redactSensitiveText('Ravion Barber API listening')).toBe('Ravion Barber API listening');
  });
});

describe('redactValue', () => {
  it('redacts sensitive object keys recursively', () => {
    expect(
      redactValue({
        name: 'ravion',
        JWT_SECRET: 'dev-only-change-me-ravion-access-secret',
        nested: { refreshToken: 'another-secret-value' },
      }),
    ).toEqual({
      name: 'ravion',
      JWT_SECRET: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]' },
    });
  });
});
