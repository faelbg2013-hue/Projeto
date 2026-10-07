import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:43111';

function envValue(name: string): string {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) {
    return fromProcess;
  }
  const text = readFileSync(fileURLToPath(new URL('../../../.env', import.meta.url)), 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    const key = trimmed.slice(0, separator);
    if (key === name) {
      return trimmed.slice(separator + 1).trim();
    }
  }
  throw new Error(`Variável ausente: ${name}`);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/conta$/);
}

async function apiToken(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post(`${apiOrigin}/api/v1/auth/login`, {
    headers: { 'X-Tenant-Slug': envValue('TENANT_SLUG') },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

test('client account lists services and blocks operational administration', async ({
  page,
}, testInfo) => {
  const email = `e2e-cliente-${testInfo.project.name}-${Date.now()}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Nome').fill('Ana Costa');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByRole('heading', { name: 'Ana Costa' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Serviços disponíveis' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto('/admin/services');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByText('Sessão')).toBeVisible();
  await page.goto('/profissional');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole('heading', { name: 'Serviços', exact: true })).toHaveCount(0);
});

test('admin creates, edits and deactivates a service', async ({ page }, testInfo) => {
  const serviceName = `E2E ${testInfo.project.name} ${Date.now()}`;
  await login(page, envValue('ADMIN_EMAIL'), envValue('ADMIN_PASSWORD'));
  await page.goto('/admin/services');
  await expect(page.getByRole('heading', { name: 'Serviços' })).toBeVisible();

  await page.getByRole('button', { name: 'Criar serviço' }).click();
  await expect(page.getByRole('alert')).toHaveText('Informe o nome do serviço.');

  await page.getByLabel('Nome').fill(serviceName);
  await page.getByLabel('Descrição').fill('Corte de verificação');
  await page.getByLabel('Preço').fill('55');
  await page.getByLabel('Duração em minutos').fill('40');
  await page.getByLabel('Pontuação').fill('7');
  await page.getByRole('button', { name: 'Criar serviço' }).click();

  const card = page.getByRole('article').filter({ hasText: serviceName });
  await expect(card).toBeVisible();
  await expect(card.getByText('Ativo')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await card.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Nome').fill(`${serviceName} editado`);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const edited = page.getByRole('article').filter({ hasText: `${serviceName} editado` });
  await expect(edited).toBeVisible();

  await edited.getByRole('button', { name: 'Desativar' }).click();
  await expect(edited.getByText('Inativo')).toBeVisible();
});

test('admin creates, edits and deactivates a professional', async ({ page }, testInfo) => {
  const email = `e2e-pro-${testInfo.project.name}-${Date.now()}@example.com`;
  const displayName = `Barbeiro ${testInfo.project.name} ${Date.now()}`;
  await login(page, envValue('ADMIN_EMAIL'), envValue('ADMIN_PASSWORD'));
  await page.goto('/admin/professionals');
  await expect(page.getByRole('heading', { name: 'Profissionais' })).toBeVisible();

  await page.getByLabel('Nome completo').fill('Carlos Lima');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByLabel('Nome de exibição').fill(displayName);
  await page.getByRole('button', { name: 'Criar profissional' }).click();

  const card = page.getByRole('article').filter({ hasText: displayName });
  await expect(card).toBeVisible();
  await expect(card.getByText(email)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await card.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Nome de exibição').fill(`${displayName} editado`);
  await page.getByRole('button', { name: 'Salvar' }).click();
  const edited = page.getByRole('article').filter({ hasText: `${displayName} editado` });
  await expect(edited).toBeVisible();
  await edited.getByRole('button', { name: 'Desativar' }).click();
  await expect(edited.getByText('Inativo')).toBeVisible();
});

test('admin deactivates a client from the same tenant', async ({ page, request }, testInfo) => {
  const email = `e2e-admin-cliente-${testInfo.project.name}-${Date.now()}@example.com`;
  const registered = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: { name: 'Cliente E2E', email, password: 'senha-segura' },
  });
  expect(registered.status()).toBe(201);

  await login(page, envValue('ADMIN_EMAIL'), envValue('ADMIN_PASSWORD'));
  await page.goto('/admin/clients');
  await page.getByLabel('Busca').fill(email);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const card = page.getByRole('article').filter({ hasText: email });
  await expect(card).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await card.getByRole('button', { name: 'Desativar' }).click();
  await expect(card.getByText('Inativo')).toBeVisible();
});

test('professional sees their own profile and cannot open administration', async ({
  page,
  request,
}, testInfo) => {
  const email = `e2e-area-${testInfo.project.name}-${Date.now()}@example.com`;
  const displayName = `Área ${testInfo.project.name}`;
  const token = await apiToken(request, envValue('ADMIN_EMAIL'), envValue('ADMIN_PASSWORD'));
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'Profissional E2E',
      email,
      password: 'senha-segura',
      displayName,
    },
  });
  expect(created.status()).toBe(201);

  await login(page, email, 'senha-segura');
  await page.goto('/profissional');
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible();
  await expect(page.getByText('Ativo')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Serviços disponíveis' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto('/admin/services');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByText('Sessão')).toBeVisible();
});
