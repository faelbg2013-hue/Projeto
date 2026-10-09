const FORBIDDEN_DATABASES = [
  'ravion_barber',
  'ravion_homolog',
  'ravion_barber_ci',
  'ravion_bootstrap_test',
] as const;

export const e2eStackName = 'ravion_e2e';
export const e2eApiOrigin = 'http://127.0.0.1:43121';
export const e2eWebOrigin = 'http://127.0.0.1:43120';
export const e2eApiPort = '43121';
export const e2eMysqlHost = '127.0.0.1';
export const e2eMysqlPort = '33116';
export const e2eMysqlUser = 'ravion_e2e';
export const e2eDatabaseName = 'ravion_e2e';
export const e2ePlaywrightProjects = [
  'width-360',
  'width-390',
  'width-768',
  'width-1024',
  'width-1440',
] as const;

export type E2ePlaywrightProject = (typeof e2ePlaywrightProjects)[number];

export function e2eStackRequested(env: NodeJS.ProcessEnv): boolean {
  return env.E2E_STACK !== undefined && env.E2E_STACK !== '';
}

export function assertE2eStack(env: NodeJS.ProcessEnv): void {
  if (env.E2E_STACK !== e2eStackName) {
    throw new Error('Stack E2E recusada: identidade ausente.');
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('Stack E2E recusada em produção.');
  }
  if (env.PORT !== e2eApiPort) {
    throw new Error('Stack E2E recusada: a API não está na porta exclusiva.');
  }

  const raw = env.DATABASE_URL;
  if (!raw) {
    throw new Error('Stack E2E recusada: banco ausente.');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Stack E2E recusada: URL de banco inválida.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (
    url.protocol !== 'mysql:' ||
    url.hostname !== e2eMysqlHost ||
    url.port !== e2eMysqlPort ||
    decodeURIComponent(url.username) !== e2eMysqlUser ||
    database !== e2eDatabaseName ||
    FORBIDDEN_DATABASES.some((name) => raw.includes(`/${name}`))
  ) {
    throw new Error('Stack E2E recusada: o destino não é o MySQL exclusivo.');
  }
}

export function assertE2ePlaywrightProject(
  project: string | undefined,
): asserts project is E2ePlaywrightProject {
  if (!project || !(e2ePlaywrightProjects as readonly string[]).includes(project)) {
    throw new Error('Stack E2E recusada: resolução não autorizada.');
  }
}

export function assertGithubActionsE2e(env: NodeJS.ProcessEnv): void {
  if (env.GITHUB_ACTIONS !== 'true') {
    throw new Error('Stack E2E do GitHub Actions recusada fora do runner.');
  }
  assertE2eStack(env);
  assertE2ePlaywrightProject(env.E2E_PLAYWRIGHT_PROJECT);
}
