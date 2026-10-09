import { execFile, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  assertIntegrationDatabase,
  integrationDatabaseUrl,
} from '../apps/api/src/config/integration-database';

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const databaseUrl = assertIntegrationDatabase(integrationDatabaseUrl());

const prepareStatement = [
  'CREATE DATABASE IF NOT EXISTS ravion_integration_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  "CREATE USER IF NOT EXISTS 'ravion_integration'@'%' IDENTIFIED BY 'ravion_integration_local_only'",
  "ALTER USER 'ravion_integration'@'%' IDENTIFIED BY 'ravion_integration_local_only'",
  "GRANT ALL PRIVILEGES ON ravion_integration_test.* TO 'ravion_integration'@'%'",
  'FLUSH PRIVILEGES',
].join('; ');

function assertPrepareStatement(statement: string): void {
  const forbidden = ['ravion_barber', 'ravion_homolog', 'ravion_barber_ci', 'ravion_e2e', 'ravion_bootstrap_test'];
  if (forbidden.some((name) => statement.includes(name)) || !statement.includes('ravion_integration_test')) {
    throw new Error('A preparação da integração recusou um banco que não é o de teste.');
  }
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      shell: true,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      reject(new Error(`${command} encerrou com ${code ?? 'sinal'}`));
    });
  });
}

async function prepareDatabase(): Promise<void> {
  assertPrepareStatement(prepareStatement);
  await execFileAsync(
    'docker',
    [
      'exec',
      'ravion-e2e-mysql',
      'sh',
      '-c',
      'umask 077; printf "[client]\\nuser=root\\npassword=%s\\n" "$MYSQL_ROOT_PASSWORD" > /tmp/ravion-integration.cnf; mysql --defaults-extra-file=/tmp/ravion-integration.cnf --protocol=socket --connect-timeout=5 --batch -e "$1"; status=$?; rm -f /tmp/ravion-integration.cnf; exit $status',
      'sh',
      prepareStatement,
    ],
    { timeout: 60_000 },
  );
}

async function stopE2eMysql(): Promise<void> {
  await execFileAsync(
    'docker',
    ['compose', '-p', 'ravion-e2e', '-f', 'docker-compose.e2e.yml', 'stop'],
    { cwd: root },
  ).catch(() => undefined);
}

async function main(): Promise<void> {
  console.log('Integração isolada: MySQL 127.0.0.1:33116/ravion_integration_test.');
  await run('docker', ['compose', '-p', 'ravion-e2e', '-f', 'docker-compose.e2e.yml', 'up', '-d', '--wait'], process.env);
  await prepareDatabase();
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  await run('npx', ['prisma', 'migrate', 'deploy'], env);
  await run('pnpm', ['--filter', '@ravion/api', 'exec', 'vitest', 'run', '--no-file-parallelism'], env);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Falha na integração isolada';
    console.error(message.replace(/mysql:\/\/[^@\s]+@/g, 'mysql://redacted@'));
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopE2eMysql();
  });
