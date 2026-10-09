import { describe, expect, it } from 'vitest';
import { assertIntegrationDatabase, integrationDatabaseUrl } from './integration-database';

const localUrl = integrationDatabaseUrl();

describe('integration database guard', () => {
  it('accepts the local integration database on the E2E MySQL port', () => {
    expect(new URL(assertIntegrationDatabase(localUrl)).pathname).toBe('/ravion_integration_test');
    expect(new URL(assertIntegrationDatabase(localUrl)).port).toBe('33116');
  });

  it('accepts the CI MySQL only for the CI user when GitHub Actions is set', () => {
    const url = 'mysql://ravion_ci:secret@127.0.0.1:3306/ravion_integration_test';
    expect(new URL(assertIntegrationDatabase(url, { GITHUB_ACTIONS: 'true' })).username).toBe(
      'ravion_ci',
    );
  });

  it.each([
    ['mysql://ravion:secret@127.0.0.1:3306/ravion_barber', {}],
    ['mysql://ravion:secret@127.0.0.1:3306/ravion_homolog', {}],
    ['mysql://ravion_ci:secret@127.0.0.1:3306/ravion_barber_ci', { GITHUB_ACTIONS: 'true', CI: 'true' }],
    ['mysql://ravion_e2e:secret@127.0.0.1:33116/ravion_e2e', {}],
    ['mysql://ravion:secret@127.0.0.1:33116/ravion_bootstrap_test', {}],
    ['mysql://ravion_integration:secret@127.0.0.1:3306/ravion_integration_test', { CI: 'true', NODE_ENV: 'test' }],
    ['mysql://ravion_ci:secret@127.0.0.1:3306/ravion_integration_test', { CI: 'true', NODE_ENV: 'test' }],
    ['mysql://root:secret@127.0.0.1:33116/ravion_integration_test', {}],
    ['mysql://ravion_integration:secret@10.0.0.5:33116/ravion_integration_test', {}],
    ['mysql://ravion_ci:secret@db.example.com:3306/ravion_integration_test', { GITHUB_ACTIONS: 'true' }],
    [undefined, { GITHUB_ACTIONS: 'true', CI: 'true', NODE_ENV: 'test' }],
  ])('rejects %s', (url, env) => {
    expect(() => assertIntegrationDatabase(url, env)).toThrow('Teste de integração recusado');
  });
});
