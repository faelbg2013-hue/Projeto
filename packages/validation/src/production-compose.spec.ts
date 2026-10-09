import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function readRepo(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('production compose configuration', () => {
  const compose = readRepo('docker-compose.production.yml');
  const tls = readRepo('deploy/nginx/proxy-tls.conf');
  const http = readRepo('deploy/nginx/proxy.conf');
  const example = readRepo('deploy/env.production.example');

  it('requires the public origin and the production secrets', () => {
    expect(compose).toContain('CORS_ORIGINS: ${PUBLIC_ORIGIN:?Set PUBLIC_ORIGIN}');
    expect(compose).not.toContain('PUBLIC_ORIGIN:-');
    expect(compose).toContain('MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?Set MYSQL_ROOT_PASSWORD}');
    expect(compose).toContain('MYSQL_PASSWORD: ${MYSQL_PASSWORD:?Set MYSQL_PASSWORD}');
    expect(compose).toContain('JWT_SECRET: ${JWT_SECRET:?Set JWT_SECRET}');
    expect(compose).toContain('JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET}');
    expect(compose).toContain(
      'DEFAULT_PUBLIC_TENANT_ID: ${DEFAULT_PUBLIC_TENANT_ID:?Set DEFAULT_PUBLIC_TENANT_ID}',
    );
    expect(compose).toContain("SWAGGER_ENABLED: 'false'");
    expect(compose).toContain('TRUST_PROXY: ${TRUST_PROXY:-1}');
  });

  it('keeps migrate deploy and does not seed on boot', () => {
    expect(compose).toContain("'migrate', 'deploy'");
    expect(compose).not.toContain('migrate reset');
    expect(compose).not.toContain('db push');
    expect(compose).not.toContain('db seed');
  });

  it('sends HSTS only on the TLS listener', () => {
    expect(tls).toContain('Strict-Transport-Security');
    expect(tls).toContain('listen 443 ssl;');
    expect(tls).not.toContain('listen 80');
    expect(http).not.toContain('Strict-Transport-Security');
  });

  it('ships an example without usable secrets', () => {
    expect(example).toContain('PUBLIC_ORIGIN=');
    expect(example).toContain('JWT_SECRET=');
    expect(example).toContain('JWT_REFRESH_SECRET=');
    expect(example).toContain('MYSQL_PASSWORD=');
    expect(example).not.toMatch(/JWT_SECRET=.+/);
    expect(example).not.toMatch(/MYSQL_PASSWORD=.+/);
    expect(example).not.toContain('dev-only-change-me');
  });
});
