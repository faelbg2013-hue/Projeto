import { describe, expect, it } from 'vitest';
import { sanitizeEvidenceText } from './e2e-evidence';

describe('e2e evidence sanitizer', () => {
  it('removes credentials, bearer tokens and raw JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signaturevalue';
    const sanitized = sanitizeEvidenceText(
      `mysql://ravion_e2e:ravion_e2e_local_only@127.0.0.1:33116/ravion_e2e password=segredo Bearer ${jwt} ${jwt}`,
    );

    expect(sanitized).not.toContain('ravion_e2e_local_only');
    expect(sanitized).not.toContain('segredo');
    expect(sanitized).not.toContain(jwt);
    expect(sanitized).toContain('127.0.0.1:33116/ravion_e2e');
    expect(sanitized).toContain('mysql://[REDACTED]@');
  });
});
