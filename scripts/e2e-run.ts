import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { assertE2eStack } from '../apps/api/src/config/e2e-stack';
import { e2eApiOrigin, e2eDatabaseUrl, e2eWebOrigin } from '../apps/web/e2e/target';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const databaseUrl = e2eDatabaseUrl();
const children: ChildProcess[] = [];

function childEnv(extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...process.env, ...extra };
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

function start(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const child = spawn(command, args, {
    cwd: root,
    env,
    shell: true,
    stdio: 'inherit',
  });
  children.push(child);
}

async function stopOwnedProcesses(): Promise<void> {
  await Promise.all(
    children.map(
      (child) =>
        new Promise<void>((resolveStop) => {
          if (!child.pid || child.exitCode !== null) {
            resolveStop();
            return;
          }
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            shell: true,
            stdio: 'ignore',
          });
          killer.on('exit', () => resolveStop());
        }),
    ),
  );
}

async function stopE2eContainer(): Promise<void> {
  await run(
    'docker',
    ['compose', '-p', 'ravion-e2e', '-f', 'docker-compose.e2e.yml', 'stop'],
    process.env,
  ).catch(() => undefined);
}

async function waitForStack(): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const api = await fetch(`${e2eApiOrigin}/api/v1/health`);
      const web = await fetch(e2eWebOrigin);
      if (api.ok && api.headers.get('x-ravion-stack') === 'ravion_e2e' && web.ok) {
        return;
      }
    } catch {
      // The servers are still booting.
    }
    await delay(1000);
  }
  throw new Error('A stack E2E não se identificou a tempo. Nenhum teste foi executado.');
}

async function main(): Promise<void> {
  const identity = {
    E2E_STACK: 'ravion_e2e',
    NODE_ENV: 'development',
    PORT: '43121',
    DATABASE_URL: databaseUrl,
  };
  assertE2eStack(identity);
  console.log('E2E isolado: MySQL 127.0.0.1:33116/ravion_e2e, API 43121, PWA 43120.');

  await run(
    'docker',
    ['compose', '-p', 'ravion-e2e', '-f', 'docker-compose.e2e.yml', 'up', '-d', '--wait'],
    process.env,
  );
  await run('npx', ['prisma', 'migrate', 'deploy'], childEnv({ DATABASE_URL: databaseUrl }));
  await run('pnpm', ['--filter', '@ravion/api', 'exec', 'tsx', '../../scripts/e2e-fixture.ts'], process.env);

  start('pnpm', ['--filter', '@ravion/api', 'exec', 'tsx', 'src/main.ts'], childEnv({
    ...identity,
    JWT_SECRET: 'e2e-only-access-secret-not-for-production-use',
    JWT_REFRESH_SECRET: 'e2e-only-refresh-secret-not-for-production-use',
    DEFAULT_PUBLIC_TENANT_ID: '11111111-1111-4111-8111-111111111111',
    CORS_ORIGINS: e2eWebOrigin,
    SWAGGER_ENABLED: 'false',
    AUTH_LOGIN_LIMIT: '500',
    AUTH_REGISTER_LIMIT: '500',
    THROTTLE_LIMIT: '2000',
    TRUST_PROXY: 'false',
  }));
  start(
    'pnpm',
    ['--filter', '@ravion/web', 'exec', 'vite', '--host', '127.0.0.1', '--port', '43120', '--strictPort'],
    childEnv({
      RAVION_DEV_API_PROXY: e2eApiOrigin,
      VITE_API_URL: '',
      VITE_TENANT_SLUG: 'e2e',
    }),
  );

  await waitForStack();
  const browsersPath = resolve(process.env.LOCALAPPDATA ?? root, 'ms-playwright');
  const playwrightEnv = childEnv({ PLAYWRIGHT_BROWSERS_PATH: browsersPath });
  await run(
    'pnpm',
    ['--filter', '@ravion/web', 'exec', 'playwright', 'install', '--only-shell', 'chromium'],
    playwrightEnv,
  );
  const playwrightArgs = ['--filter', '@ravion/web', 'exec', 'playwright', 'test'];
  if (process.env.E2E_PLAYWRIGHT_SPEC) {
    playwrightArgs.push(process.env.E2E_PLAYWRIGHT_SPEC);
  }
  if (process.env.E2E_PLAYWRIGHT_PROJECT) {
    playwrightArgs.push('--project', process.env.E2E_PLAYWRIGHT_PROJECT);
  }
  if (process.env.E2E_PLAYWRIGHT_GREP) {
    playwrightArgs.push('--grep', process.env.E2E_PLAYWRIGHT_GREP);
  }
  await run('pnpm', playwrightArgs, playwrightEnv);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Falha na stack E2E');
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopOwnedProcesses();
    await stopE2eContainer();
  });
