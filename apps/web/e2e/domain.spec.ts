import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { e2eAdminEmail, e2eAdminPassword, e2eApiOrigin, e2eTenantSlug } from './target';

const apiOrigin = e2eApiOrigin;

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
    headers: { 'X-Tenant-Slug': e2eTenantSlug },
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
  await login(page, e2eAdminEmail, e2eAdminPassword);
  await page.goto('/admin/services');
  await expect(page.getByRole('heading', { name: 'Serviços' })).toBeVisible();

  await page.getByRole('button', { name: 'Criar serviço' }).click();
  await expect(page.getByRole('alert')).toHaveText('Informe o nome do serviço.');

  await page.getByLabel('Nome').fill(serviceName);
  await page.getByLabel('Descrição').fill('Corte de verificação');
  await page.getByLabel('Valor do serviço').fill('55');
  await page.getByLabel('Duração em minutos').fill('40');
  await page.getByLabel('Pontos ao concluir').fill('7');
  await page.getByRole('button', { name: 'Criar serviço' }).click();

  await page.getByLabel('Busca').fill(serviceName);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const card = page.getByRole('article').filter({ hasText: serviceName });
  await expect(card).toBeVisible();
  await expect(card.getByText('Ativo')).toBeVisible();
  await expect(card.getByText('Duração 40 min')).toBeVisible();
  await expect(card.getByText('Valor do serviço R$ 55,00')).toBeVisible();
  await expect(card.getByText('Pontos ao concluir 7')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await card.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Nome').fill(`${serviceName} editado`);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByLabel('Busca').fill(`${serviceName} editado`);
  await page.getByRole('button', { name: 'Buscar' }).click();
  const edited = page.getByRole('article').filter({ hasText: `${serviceName} editado` });
  await expect(edited).toBeVisible();

  await edited.getByRole('button', { name: 'Desativar' }).click();
  await expect(edited.getByText('Inativo')).toBeVisible();
});

test('admin creates, edits and deactivates a professional', async ({ page }, testInfo) => {
  const email = `e2e-pro-${testInfo.project.name}-${Date.now()}@example.com`;
  const displayName = `Barbeiro ${testInfo.project.name} ${Date.now()}`;
  await login(page, e2eAdminEmail, e2eAdminPassword);
  await page.goto('/admin/professionals');
  await expect(page.getByRole('heading', { name: 'Profissionais' })).toBeVisible();

  await page.getByLabel('Nome completo').fill('Carlos Lima');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByLabel('Nome de exibição').fill(displayName);
  const created = page.waitForResponse(
    (response) => response.url().includes('/api/v1/professionals') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Criar profissional' }).click();
  expect((await created).ok()).toBeTruthy();
  await page.getByLabel('Busca').fill(email);
  await page.getByRole('button', { name: 'Buscar' }).click();

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

  await login(page, e2eAdminEmail, e2eAdminPassword);
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
  const token = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
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
