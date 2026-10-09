import { PrismaClient } from '@prisma/client';

const integrationDatabaseName = 'ravion_integration_test';
const localUser = 'ravion_integration';
const localPort = '33116';
const ciUser = 'ravion_ci';
const ciPort = '3306';

const forbiddenDatabases = [
  'ravion_barber',
  'ravion_homolog',
  'ravion_barber_ci',
  'ravion_e2e',
  'ravion_bootstrap_test',
] as const;

export function integrationDatabaseUrl(): string {
  return `mysql://${localUser}:ravion_integration_local_only@127.0.0.1:${localPort}/${integrationDatabaseName}`;
}

export function assertIntegrationDatabase(
  raw: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!raw) {
    throw new Error('Teste de integração recusado: banco ausente.');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Teste de integração recusado: URL de banco inválida.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const user = decodeURIComponent(url.username);
  const port = url.port === '' ? '3306' : url.port;
  const forbidden = forbiddenDatabases.some(
    (name) => database === name || raw.includes(`/${name}`),
  );

  if (url.protocol !== 'mysql:' || url.hostname !== '127.0.0.1' || forbidden || database !== integrationDatabaseName) {
    throw new Error('Teste de integração recusado: o banco não é o de integração isolado.');
  }

  const localTarget = port === localPort && user === localUser;
  const ciTarget = env.GITHUB_ACTIONS === 'true' && port === ciPort && user === ciUser;
  if (!localTarget && !ciTarget) {
    throw new Error('Teste de integração recusado: credencial ou porta não autorizada.');
  }

  return url.toString();
}

export function createIntegrationPrisma(env: NodeJS.ProcessEnv = process.env): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: assertIntegrationDatabase(env.DATABASE_URL, env) } },
  });
}
