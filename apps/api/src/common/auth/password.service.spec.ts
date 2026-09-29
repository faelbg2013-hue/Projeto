import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('stores an argon2id hash and checks the original password', async () => {
    const hash = await service.hash('senha-segura');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('senha-segura');
    await expect(service.verify(hash, 'senha-segura')).resolves.toBe(true);
    await expect(service.verify(hash, 'senha-errada')).resolves.toBe(false);
  });

  it('rejects a hash that is not a password hash', async () => {
    await expect(service.verify('not-a-hash', 'senha-segura')).resolves.toBe(false);
  });
});
