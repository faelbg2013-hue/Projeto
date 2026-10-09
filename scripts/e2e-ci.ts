import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { assertE2ePlaywrightProject, assertGithubActionsE2e } from '../apps/api/src/config/e2e-stack';
import { sanitizeEvidenceText } from '../apps/api/src/config/e2e-evidence';
import { e2eApiOrigin, e2eDatabaseUrl, e2eWebOrigin } from '../apps/web/e2e/target';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const logDir = resolve(root, 'e2e-logs');
const children: ChildProcess[] = [];
const streams: WriteStream[] = [];

function childEnv(extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...process.env, ...extra };
}

function attach(child: ChildProcess, logName: string): void {
  const stream = createWriteStream(resolve(logDir, logName), { flags: 'a' });
  streams.push(stream);
  const write = (chunk: Buffer) => {
    const text = sanitizeEvidenceText(chunk.toString());
    process.stdout.write(text);
    stream.write(text);
  };
  child.stdout?.on('data', write);
  child.stderr?.on('data', write);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    attach(child, 'commands.log');
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      reject(new Error(`${command} encerrou com ${code ?? 'sinal'}`));
    });
  });
}

function start(command: string, args: string[], env: NodeJS.ProcessEnv, logName: string): void {
  const child = spawn(command, args, {
    cwd: root,
    env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  attach(child, logName);
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
          const timer = setTimeout(() => {
            if (process.platform !== 'win32') {
              try {
                process.kill(-child.pid!, 'SIGKILL');
              } catch {
                child.kill('SIGKILL');
              }
            }
            resolveStop();
          }, 5_000);
          child.once('exit', () => {
            clearTimeout(timer);
            resolveStop();
          });
          if (process.platform === 'win32') {
            spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
              shell: true,
              stdio: 'ignore',
            });
            return;
          }
          try {
            process.kill(-child.pid, 'SIGTERM');
          } catch {
            child.kill('SIGTERM');
          }
        }),
    ),
  );
  await Promise.all(
    streams.map((stream) => new Promise<void>((resolveClose) => stream.end(resolveClose))),
  );
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
  const project = process.env.E2E_PLAYWRIGHT_PROJECT;
  process.env.E2E_STACK = 'ravion_e2e';
  process.env.NODE_ENV = 'development';
  process.env.PORT = '43121';
  process.env.DATABASE_URL = e2eDatabaseUrl();
  if (project) {
    process.env.E2E_PLAYWRIGHT_PROJECT = project;
  } else {
    delete process.env.E2E_PLAYWRIGHT_PROJECT;
  }
  assertGithubActionsE2e(process.env);
  assertE2ePlaywrightProject(project);
  mkdirSync(logDir, { recursive: true });
  console.log(
    `E2E GitHub Actions: ${project}. MySQL 127.0.0.1:33116/ravion_e2e, API 43121, PWA 43120.`,
  );

  const identity = {
    E2E_STACK: 'ravion_e2e',
    NODE_ENV: 'development',
    PORT: '43121',
    DATABASE_URL: e2eDatabaseUrl(),
    E2E_PLAYWRIGHT_PROJECT: project,
    GITHUB_ACTIONS: 'true',
  };

  await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], childEnv(identity));
  await run(
    'pnpm',
    ['--filter', '@ravion/api', 'exec', 'tsx', '../../scripts/e2e-fixture.ts'],
    childEnv(identity),
  );
  start(
    'pnpm',
    ['--filter', '@ravion/api', 'exec', 'tsx', 'src/main.ts'],
    childEnv({
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
    }),
    'api.log',
  );
  start(
    'pnpm',
    ['--filter', '@ravion/web', 'exec', 'vite', '--host', '127.0.0.1', '--port', '43120', '--strictPort'],
    childEnv({
      ...identity,
      RAVION_DEV_API_PROXY: e2eApiOrigin,
      VITE_API_URL: '',
      VITE_TENANT_SLUG: 'e2e',
    }),
    'web.log',
  );

  await waitForStack();
  await run(
    'pnpm',
    ['--filter', '@ravion/web', 'exec', 'playwright', 'test', '--project', project, '--workers=1'],
    childEnv(identity),
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Falha na stack E2E';
    console.error(sanitizeEvidenceText(message));
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopOwnedProcesses();
  });
