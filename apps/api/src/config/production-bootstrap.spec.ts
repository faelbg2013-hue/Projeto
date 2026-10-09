import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PasswordService } from '../common/auth/password.service';
import {
  BootstrapConflict,
  bootstrapFirstAdmin,
  type BootstrapInput,
} from './production-bootstrap';

const execFileAsync = promisify(execFile);
const ISOLATED_DATABASE = 'ravion_bootstrap_test';
const LOCAL_SOURCE_DATABASES = new Set(['ravion_barber', 'ravion_homolog']);
const CI_SOURCE_DATABASE = 'ravion_barber_ci';
const CI_SOURCE_USER = 'ravion_ci';
const PROTECTED_DATABASES = ['ravion_barber', 'ravion_homolog', 'ravion_barber_ci'];

type BootstrapAdminMode = 'local' | 'ci' | 'e2e';

interface BootstrapTestTarget {
  url: string;
  mode: BootstrapAdminMode;
}

function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//, ''));
}

function resolveBootstrapTestTarget(databaseUrl: string): BootstrapTestTarget {
  if (ISOLATED_DATABASE !== 'ravion_bootstrap_test') {
    throw new Error('O banco temporário do bootstrap precisa se chamar ravion_bootstrap_test.');
  }
  const url = new URL(databaseUrl);
  const source = databaseName(url);
  if (source === ISOLATED_DATABASE) {
    return { url: url.toString(), mode: 'local' };
  }
  const ciSource =
    source === CI_SOURCE_DATABASE &&
    decodeURIComponent(url.username) === CI_SOURCE_USER &&
    url.hostname === '127.0.0.1' &&
    (url.port === '' || url.port === '3306');
  const integrationOnE2e =
    source === 'ravion_integration_test' &&
    decodeURIComponent(url.username) === 'ravion_integration' &&
    url.hostname === '127.0.0.1' &&
    url.port === '33116';
  const integrationOnCi =
    source === 'ravion_integration_test' &&
    decodeURIComponent(url.username) === CI_SOURCE_USER &&
    url.hostname === '127.0.0.1' &&
    (url.port === '' || url.port === '3306') &&
    process.env.GITHUB_ACTIONS === 'true';
  if (integrationOnE2e || integrationOnCi) {
    url.pathname = `/${ISOLATED_DATABASE}`;
    return { url: url.toString(), mode: integrationOnCi ? 'ci' : 'e2e' };
  }
  if (!LOCAL_SOURCE_DATABASES.has(source) && !ciSource) {
    if (source === CI_SOURCE_DATABASE) {
      throw new Error(
        'O banco ravion_barber_ci só pode originar o teste no MySQL local do CI, com o usuário ravion_ci em 127.0.0.1.',
      );
    }
    throw new Error(
      'O teste de bootstrap recusou um banco que não é o de desenvolvimento, o de homologação nem o MySQL isolado do CI.',
    );
  }
  url.pathname = `/${ISOLATED_DATABASE}`;
  if (databaseName(url) !== ISOLATED_DATABASE) {
    throw new Error('O teste de bootstrap não conseguiu apontar para o banco temporário.');
  }
  return { url: url.toString(), mode: ciSource ? 'ci' : 'local' };
}

function assertBootstrapAdminStatement(statement: string): void {
  if (!/^[a-z0-9_]+$/.test(ISOLATED_DATABASE) || ISOLATED_DATABASE !== 'ravion_bootstrap_test') {
    throw new Error('O banco temporário do bootstrap precisa se chamar ravion_bootstrap_test.');
  }
  for (const name of PROTECTED_DATABASES) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(statement)) {
      throw new Error('O teste de bootstrap recusou uma operação sobre um banco protegido.');
    }
  }
  const parts = statement
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0 || !statement.includes(ISOLATED_DATABASE)) {
    throw new Error('O teste de bootstrap só administra o banco ravion_bootstrap_test.');
  }
  for (const part of parts) {
    const allowed =
      part.startsWith(`CREATE DATABASE IF NOT EXISTS ${ISOLATED_DATABASE} `) ||
      part.startsWith(`GRANT ALL PRIVILEGES ON ${ISOLATED_DATABASE}.* TO '`) ||
      part === 'FLUSH PRIVILEGES' ||
      part === `DROP DATABASE IF EXISTS ${ISOLATED_DATABASE}`;
    if (!allowed) {
      throw new Error('O teste de bootstrap recusou um comando administrativo fora do banco temporário.');
    }
  }
}

async function mysqlInContainer(container: string, statement: string): Promise<void> {
  if (container !== 'ravion-barber-mysql' && container !== 'ravion-e2e-mysql') {
    throw new Error('O teste de bootstrap só administra os MySQL locais já previstos.');
  }
  await execFileAsync(
    'docker',
    [
      'exec',
      container,
      'sh',
      '-c',
      'umask 077; printf "[client]\\nuser=root\\npassword=%s\\n" "$MYSQL_ROOT_PASSWORD" > /tmp/ravion-bootstrap.cnf; mysql --defaults-extra-file=/tmp/ravion-bootstrap.cnf --protocol=socket --connect-timeout=5 --batch -e "$1"; status=$?; rm -f /tmp/ravion-bootstrap.cnf; exit $status',
      'sh',
      statement,
    ],
    { timeout: 60_000 },
  );
}

async function mysqlAsLocalRoot(statement: string): Promise<void> {
  await mysqlInContainer('ravion-barber-mysql', statement);
}

async function mysqlAsE2eRoot(statement: string): Promise<void> {
  await mysqlInContainer('ravion-e2e-mysql', statement);
}

async function mysqlAsCiRoot(statement: string): Promise<void> {
  const password = process.env.MYSQL_ROOT_PASSWORD;
  if (!password || password.includes('\n') || password.includes('\r') || password.includes('"')) {
    throw new Error(
      'O teste de bootstrap no CI precisa da senha de root do MySQL de serviço, sem caracteres de controle.',
    );
  }
  const directory = await mkdtemp(join(tmpdir(), 'ravion-bootstrap-'));
  const defaultsFile = join(directory, 'client.cnf');
  await writeFile(
    defaultsFile,
    `[client]\nuser=root\npassword="${password}"\nhost=127.0.0.1\nport=3306\nprotocol=tcp\n`,
    { mode: 0o600 },
  );
  try {
    await execFileAsync(
      'mysql',
      [`--defaults-extra-file=${defaultsFile}`, '--connect-timeout=10', '--batch', '-e', statement],
      { timeout: 60_000 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replaceAll(password, 'redacted'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function runBootstrapAdmin(statement: string, mode: BootstrapAdminMode): Promise<void> {
  assertBootstrapAdminStatement(statement);
  if (mode === 'ci') {
    await mysqlAsCiRoot(statement);
    return;
  }
  if (mode === 'e2e') {
    await mysqlAsE2eRoot(statement);
    return;
  }
  await mysqlAsLocalRoot(statement);
}

async function prepareIsolatedDatabase(appUser: string, mode: BootstrapAdminMode): Promise<void> {
  if (!/^[A-Za-z0-9_]+$/.test(appUser)) {
    throw new Error('O usuário do banco temporário tem um nome que o teste não aceita.');
  }
  await runBootstrapAdmin(
    [
      `CREATE DATABASE IF NOT EXISTS ${ISOLATED_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `GRANT ALL PRIVILEGES ON ${ISOLATED_DATABASE}.* TO '${appUser}'@'%'`,
      'FLUSH PRIVILEGES',
    ].join('; '),
    mode,
  );
  const repoRoot = resolve(process.cwd(), '../..');
  const databaseUrl = new URL(resolveBootstrapTestTarget(process.env.DATABASE_URL ?? '').url);
  databaseUrl.searchParams.set('connect_timeout', '10');
  try {
    await execFileAsync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
        timeout: 180_000,
      },
    );
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr?: unknown }).stderr ?? '')
        : '';
    const message = error instanceof Error ? error.message : String(error);
    const redacted = `${message}\n${stderr}`
      .replace(/mysql:\/\/[^@\s]+@/g, 'mysql://redacted@')
      .slice(-1500);
    throw new Error(redacted);
  }
}

function input(suffix: string, overrides: Partial<BootstrapInput> = {}): BootstrapInput {
  return {
    tenantName: `Barbearia ${suffix}`,
    tenantSlug: `boot-${suffix}`,
    adminName: `Admin ${suffix}`,
    adminEmail: `admin.${suffix}@example.com`,
    password: 'senha-segura-123',
    ...overrides,
  };
}

describe('bootstrap test database guard', () => {
  it('rewrites the development database to the temporary database', () => {
    const target = resolveBootstrapTestTarget('mysql://ravion:secret@127.0.0.1:3306/ravion_barber');
    expect(new URL(target.url).pathname).toBe('/ravion_bootstrap_test');
    expect(target.mode).toBe('local');
    expect(target.url).not.toContain('/ravion_barber');
  });

  it('rewrites the homologation database to the temporary database', () => {
    const target = resolveBootstrapTestTarget('mysql://ravion:secret@127.0.0.1:3306/ravion_homolog');
    expect(new URL(target.url).pathname).toBe('/ravion_bootstrap_test');
    expect(target.mode).toBe('local');
  });

  it('accepts the CI database only for the CI user on loopback', () => {
    const target = resolveBootstrapTestTarget(
      'mysql://ravion_ci:secret@127.0.0.1:3306/ravion_barber_ci',
    );
    expect(target.mode).toBe('ci');
    expect(new URL(target.url).pathname).toBe('/ravion_bootstrap_test');
    expect(new URL(target.url).username).toBe('ravion_ci');
  });

  it('rejects the CI database name on another host or user', () => {
    expect(() =>
      resolveBootstrapTestTarget('mysql://ravion_ci:secret@db.example.com:3306/ravion_barber_ci'),
    ).toThrow('127.0.0.1');
    expect(() =>
      resolveBootstrapTestTarget('mysql://root:secret@127.0.0.1:3306/ravion_barber_ci'),
    ).toThrow('ravion_ci');
  });

  it('rewrites the local integration database onto the E2E MySQL', () => {
    const target = resolveBootstrapTestTarget(
      'mysql://ravion_integration:secret@127.0.0.1:33116/ravion_integration_test',
    );
    expect(target.mode).toBe('e2e');
    expect(new URL(target.url).pathname).toBe('/ravion_bootstrap_test');
    expect(new URL(target.url).port).toBe('33116');
  });

  it('rewrites the CI integration database only when GitHub Actions is set', () => {
    const previous = process.env.GITHUB_ACTIONS;
    process.env.GITHUB_ACTIONS = 'true';
    try {
      const target = resolveBootstrapTestTarget(
        'mysql://ravion_ci:secret@127.0.0.1:3306/ravion_integration_test',
      );
      expect(target.mode).toBe('ci');
      expect(new URL(target.url).pathname).toBe('/ravion_bootstrap_test');
    } finally {
      if (previous === undefined) {
        delete process.env.GITHUB_ACTIONS;
      } else {
        process.env.GITHUB_ACTIONS = previous;
      }
    }
  });

  it('rejects the integration database on the development port without GitHub Actions', () => {
    expect(() =>
      resolveBootstrapTestTarget(
        'mysql://ravion_ci:secret@127.0.0.1:3306/ravion_integration_test',
      ),
    ).toThrow('recusou');
  });

  it('rejects an unknown database even when CI is set', () => {
    const previous = process.env.CI;
    process.env.CI = 'true';
    try {
      expect(() =>
        resolveBootstrapTestTarget('mysql://app:secret@db.internal:3306/ravion_production'),
      ).toThrow('recusou');
    } finally {
      if (previous === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = previous;
      }
    }
  });

  it('rejects admin statements aimed at protected databases', () => {
    expect(() => assertBootstrapAdminStatement('DROP DATABASE IF EXISTS ravion_barber')).toThrow(
      'banco protegido',
    );
    expect(() => assertBootstrapAdminStatement('DROP DATABASE IF EXISTS ravion_homolog')).toThrow(
      'banco protegido',
    );
    expect(() => assertBootstrapAdminStatement('DROP DATABASE IF EXISTS ravion_barber_ci')).toThrow(
      'banco protegido',
    );
    expect(() =>
      assertBootstrapAdminStatement('DROP DATABASE IF EXISTS ravion_bootstrap_test'),
    ).not.toThrow();
  });
});

describe('production bootstrap', () => {
  let prisma: PrismaClient;
  let adminMode: BootstrapAdminMode | undefined;

  beforeAll(async () => {
    const current = process.env.DATABASE_URL;
    if (!current) {
      throw new Error('DATABASE_URL ausente. O teste isolado não altera o arquivo de ambiente.');
    }
    const target = resolveBootstrapTestTarget(current);
    adminMode = target.mode;
    const user = decodeURIComponent(new URL(target.url).username);
    await prepareIsolatedDatabase(user, target.mode);
    prisma = new PrismaClient({ datasources: { db: { url: target.url } } });
  }, 240_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (adminMode) {
      await runBootstrapAdmin(`DROP DATABASE IF EXISTS ${ISOLATED_DATABASE}`, adminMode);
    }
  });

  it('creates the tenant and an ADMIN with an argon2id hash', async () => {
    const data = input('valido');
    const result = await bootstrapFirstAdmin(prisma, new PasswordService(), data);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: result.tenantId } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: result.adminId } });

    expect(tenant.slug).toBe(data.tenantSlug);
    expect(tenant.name).toBe(data.tenantName);
    expect(admin.role).toBe('ADMIN');
    expect(admin.tenantId).toBe(tenant.id);
    expect(admin.email).toBe(data.adminEmail);
    expect(admin.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(admin.passwordHash).not.toContain(data.password);
    expect(await new PasswordService().verify(admin.passwordHash, data.password)).toBe(true);
  });

  it('rejects a short password before writing', async () => {
    const slug = 'boot-curta';
    await expect(
      bootstrapFirstAdmin(prisma, new PasswordService(), input('curta', { password: 'curta' })),
    ).rejects.toThrow('entre 8 e 72 caracteres');
    expect(await prisma.tenant.findUnique({ where: { slug } })).toBeNull();
  });

  it('fails a second run without changing the stored password', async () => {
    const data = input('repetido');
    await bootstrapFirstAdmin(prisma, new PasswordService(), data);
    const before = await prisma.user.findFirstOrThrow({
      where: { email: data.adminEmail, role: 'ADMIN' },
    });

    await expect(bootstrapFirstAdmin(prisma, new PasswordService(), data)).rejects.toBeInstanceOf(
      BootstrapConflict,
    );

    const after = await prisma.user.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.role).toBe('ADMIN');
    expect(await prisma.tenant.count({ where: { slug: data.tenantSlug } })).toBe(1);
  });

  it('does not turn an existing client into an admin or replace the password', async () => {
    const data = input('cliente');
    const tenant = await prisma.tenant.create({
      data: { name: data.tenantName, slug: data.tenantSlug, isActive: true },
    });
    const originalHash = await new PasswordService().hash('outra-senha-123');
    const client = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: 'Cliente Existente',
        email: data.adminEmail,
        passwordHash: originalHash,
        role: 'CLIENT',
        isActive: true,
      },
    });

    await expect(bootstrapFirstAdmin(prisma, new PasswordService(), data)).rejects.toBeInstanceOf(
      BootstrapConflict,
    );

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: client.id } });
    expect(stored.role).toBe('CLIENT');
    expect(stored.passwordHash).toBe(originalHash);
  });

  it('rejects a duplicate slug even when the email is new', async () => {
    const data = input('slug');
    await bootstrapFirstAdmin(prisma, new PasswordService(), data);

    await expect(
      bootstrapFirstAdmin(
        prisma,
        new PasswordService(),
        input('slug-outro', {
          tenantSlug: data.tenantSlug,
          adminEmail: 'outro.admin@example.com',
        }),
      ),
    ).rejects.toBeInstanceOf(BootstrapConflict);

    expect(await prisma.user.count({ where: { email: 'outro.admin@example.com' } })).toBe(0);
  });

  it('rolls back the tenant when the administrator cannot be stored', async () => {
    const data = input('rollback');
    const hasher = { hash: async () => 'x'.repeat(300) };

    await expect(bootstrapFirstAdmin(prisma, hasher, data)).rejects.toThrow();
    expect(await prisma.tenant.findUnique({ where: { slug: data.tenantSlug } })).toBeNull();
  });

  it('does not call the development seed', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(resolve(process.cwd(), '../../prisma/bootstrap.ts'), 'utf8'),
    );
    expect(source).not.toContain('development-seed');
    expect(source).not.toContain('db:seed');
  });
});
