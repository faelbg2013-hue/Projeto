import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  e2eAdminEmail,
  e2eAdminPassword,
  e2eApiOrigin,
  e2eOtherAdminEmail,
  e2eOtherAdminPassword,
  e2eOtherTenantSlug,
  e2eTenantSlug,
} from './target';

const apiOrigin = e2eApiOrigin;
const cancellationField = 'Antecedência mínima para cancelamento pelo cliente';

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

async function apiToken(request: APIRequestContext, slug: string, email: string, password: string): Promise<string> {
  const response = await request.post(`${apiOrigin}/api/v1/auth/login`, {
    headers: { 'X-Tenant-Slug': slug },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

test('admin saves settings, they persist, and the other tenant stays unchanged', async ({ page, request }) => {
  let admin = '';
  try {
    admin = await apiToken(request, e2eTenantSlug, e2eAdminEmail, e2eAdminPassword);
    await login(page, e2eAdminEmail, e2eAdminPassword);
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
    const input = page.getByLabel(cancellationField);
    await expect(input).toBeVisible();
    await input.fill('45');
    await page.getByRole('button', { name: 'Salvar políticas' }).click();
    await expect(page.getByText('Políticas de antecedência salvas.')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.reload();
    await expect(page.getByLabel(cancellationField)).toHaveValue('45');

    const other = await apiToken(request, e2eOtherTenantSlug, e2eOtherAdminEmail, e2eOtherAdminPassword);
    const otherSettings = await request.get(`${apiOrigin}/api/v1/settings`, {
      headers: { authorization: `Bearer ${other}` },
    });
    expect(otherSettings.status()).toBe(200);
    const otherBody = (await otherSettings.json()) as {
      settings: { cancellation_min_advance_minutes?: number };
    };
    expect(otherBody.settings.cancellation_min_advance_minutes ?? 0).toBe(0);
  } finally {
    if (admin) {
      const restored = await request.patch(`${apiOrigin}/api/v1/settings`, {
        headers: { authorization: `Bearer ${admin}` },
        data: { settings: { cancellation_min_advance_minutes: 0 } },
      });
      expect(restored.status()).toBe(200);
    }
  }
});

test('client and professional cannot open administrative settings', async ({ page, request }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const admin = await apiToken(request, e2eTenantSlug, e2eAdminEmail, e2eAdminPassword);
  const professionalEmail = `e2e-settings-pro-${stamp}@example.com`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { authorization: `Bearer ${admin}` },
    data: {
      name: 'Profissional Configuracao',
      email: professionalEmail,
      password: 'senha-segura',
      displayName: `Config ${stamp}`,
    },
  });
  expect(created.status()).toBe(201);

  const clientEmail = `e2e-settings-cliente-${stamp}@example.com`;
  const registered = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    headers: { 'X-Tenant-Slug': e2eTenantSlug },
    data: { name: 'Cliente Configuracao', email: clientEmail, password: 'senha-segura' },
  });
  expect(registered.status()).toBe(201);
  const clientToken = ((await registered.json()) as { accessToken: string }).accessToken;
  const clientDenied = await request.get(`${apiOrigin}/api/v1/settings`, {
    headers: { authorization: `Bearer ${clientToken}` },
  });
  expect(clientDenied.status()).toBe(403);

  const professionalToken = await apiToken(request, e2eTenantSlug, professionalEmail, 'senha-segura');
  const professionalDenied = await request.get(`${apiOrigin}/api/v1/settings`, {
    headers: { authorization: `Bearer ${professionalToken}` },
  });
  expect(professionalDenied.status()).toBe(403);

  await login(page, clientEmail, 'senha-segura');
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole('heading', { name: 'Configurações' })).toHaveCount(0);

  await page.goto('/conta');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, professionalEmail, 'senha-segura');
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole('heading', { name: 'Configurações' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
