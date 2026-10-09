import { describe, expect, it } from 'vitest';
import { assertE2eStack, assertGithubActionsE2e, e2eStackName } from './e2e-stack';

const valid = {
  E2E_STACK: e2eStackName,
  NODE_ENV: 'development',
  PORT: '43121',
  DATABASE_URL: 'mysql://ravion_e2e:local-only@127.0.0.1:33116/ravion_e2e',
};

describe('e2e stack identity', () => {
  it('accepts only the reserved loopback database', () => {
    expect(() => assertE2eStack(valid)).not.toThrow();
  });

  it.each([
    [{ ...valid, E2E_STACK: undefined }, 'identidade'],
    [{ ...valid, E2E_STACK: 'true' }, 'identidade'],
    [{ ...valid, NODE_ENV: 'test', E2E_STACK: undefined }, 'identidade'],
    [{ ...valid, NODE_ENV: 'production' }, 'produção'],
    [{ ...valid, PORT: '43111' }, 'porta'],
    [{ ...valid, DATABASE_URL: 'mysql://ravion_e2e:local-only@127.0.0.1:3306/ravion_e2e' }, 'MySQL'],
    [{ ...valid, DATABASE_URL: 'mysql://ravion:local-only@127.0.0.1:33116/ravion_e2e' }, 'MySQL'],
    [{ ...valid, DATABASE_URL: 'mysql://ravion_e2e:local-only@127.0.0.1:33116/ravion_barber' }, 'MySQL'],
    [{ ...valid, DATABASE_URL: 'mysql://ravion_e2e:local-only@127.0.0.1:33116/ravion_homolog' }, 'MySQL'],
    [{ ...valid, DATABASE_URL: 'mysql://ravion_e2e:local-only@127.0.0.1:33116/ravion_barber_ci' }, 'MySQL'],
    [{ ...valid, DATABASE_URL: 'mysql://ravion_ci:local-only@127.0.0.1:3306/ravion_barber_ci' }, 'MySQL'],
  ])('rejects an unsafe target', (env, fragment) => {
    expect(() => assertE2eStack(env)).toThrow(new RegExp(fragment));
  });
});

describe('GitHub Actions e2e gate', () => {
  const actions = {
    ...valid,
    GITHUB_ACTIONS: 'true',
    E2E_PLAYWRIGHT_PROJECT: 'width-360',
  };

  it('accepts one authorized resolution on the runner', () => {
    expect(() => assertGithubActionsE2e(actions)).not.toThrow();
  });

  it.each([
    [{ ...actions, GITHUB_ACTIONS: undefined }, 'runner'],
    [{ ...actions, GITHUB_ACTIONS: 'true', CI: 'true', E2E_STACK: undefined }, 'identidade'],
    [{ ...valid, CI: 'true', NODE_ENV: 'test' }, 'runner'],
    [{ ...actions, DATABASE_URL: 'mysql://ravion_e2e:local-only@127.0.0.1:3306/ravion_e2e' }, 'MySQL'],
    [{ ...actions, DATABASE_URL: 'mysql://ravion_ci:local-only@127.0.0.1:3306/ravion_barber_ci' }, 'MySQL'],
    [{ ...actions, E2E_PLAYWRIGHT_PROJECT: undefined }, 'resolução'],
    [{ ...actions, E2E_PLAYWRIGHT_PROJECT: 'width-360 width-390' }, 'resolução'],
  ])('rejects an unauthorized Actions run', (env, fragment) => {
    expect(() => assertGithubActionsE2e(env)).toThrow(new RegExp(fragment));
  });
});
