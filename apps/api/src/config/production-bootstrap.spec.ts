import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
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

function isolatedDatabaseUrl(): string {
  const current = process.env.DATABASE_URL;
  if (!current) {
    throw new Error('DATABASE_URL ausente. O teste isolado não altera o arquivo de ambiente.');
  }
  const url = new URL(current);
  if (url.pathname === `/${ISOLATED_DATABASE}`) {
    return url.toString();
  }
  if (url.pathname !== '/ravion_barber' && url.pathname !== '/ravion_homolog') {
    throw new Error('O teste de bootstrap recusou um banco que não é o de desenvolvimento nem o de homologação.');
  }
  url.pathname = `/${ISOLATED_DATABASE}`;
  return url.toString();
}

async function mysqlAsRoot(statement: string): Promise<void> {
  await execFileAsync(
    'docker',
    [
      'exec',
      'ravion-barber-mysql',
      'sh',
      '-c',
      'umask 077; printf "[client]\\nuser=root\\npassword=%s\\n" "$MYSQL_ROOT_PASSWORD" > /tmp/ravion-bootstrap.cnf; mysql --defaults-extra-file=/tmp/ravion-bootstrap.cnf --protocol=socket --connect-timeout=5 --batch -e "$1"; status=$?; rm -f /tmp/ravion-bootstrap.cnf; exit $status',
      'sh',
      statement,
    ],
    { timeout: 60_000 },
  );
}

async function prepareIsolatedDatabase(appUser: string): Promise<void> {
  const user = appUser.replaceAll("'", '');
  await mysqlAsRoot(
    [
      `CREATE DATABASE IF NOT EXISTS ${ISOLATED_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `GRANT ALL PRIVILEGES ON ${ISOLATED_DATABASE}.* TO '${user}'@'%'`,
      'FLUSH PRIVILEGES',
    ].join('; '),
  );
  const repoRoot = resolve(process.cwd(), '../..');
  const databaseUrl = new URL(isolatedDatabaseUrl());
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

describe('production bootstrap', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const url = isolatedDatabaseUrl();
    const user = new URL(url).username;
    await prepareIsolatedDatabase(user);
    prisma = new PrismaClient({ datasources: { db: { url } } });
  }, 240_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await mysqlAsRoot(`DROP DATABASE IF EXISTS ${ISOLATED_DATABASE}`);
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
