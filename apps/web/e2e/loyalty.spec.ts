import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { e2eAdminEmail, e2eAdminPassword, e2eApiOrigin, e2eTenantSlug } from './target';

const apiOrigin = e2eApiOrigin;

function nextWeekday(weekday: number): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(new Date(`${today}T12:00:00-03:00`));
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const delta = (weekday - (map[label] ?? 1) + 7) % 7;
  const [year, month, day] = today.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, (day ?? 1) + (delta === 0 ? 7 : delta)));
  return utc.toISOString().slice(0, 10);
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

async function apiToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(`${apiOrigin}/api/v1/auth/login`, {
    headers: { 'X-Tenant-Slug': e2eTenantSlug },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

async function openWeek(request: APIRequestContext, token: string, professionalId: string): Promise<void> {
  const saved = await request.put(`${apiOrigin}/api/v1/professionals/${professionalId}/schedule`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      intervals: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        startTime: '08:00',
        endTime: '18:00',
      })),
    },
  });
  expect(saved.status(), await saved.text()).toBe(200);
}

test('client sees the earned balance and statement and cannot open admin points', async ({
  page,
  request,
}, testInfo) => {
  const adminToken = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const serviceName = `Corte pontos ${stamp}`;
  const clientEmail = `e2e-pontos-cliente-${stamp}@example.com`;
  const professionalEmail = `e2e-pontos-pro-${stamp}@example.com`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Barbeiro Pontos',
      email: professionalEmail,
      password: 'senha-segura',
      displayName: `00 Pontos ${stamp}`,
    },
  });
  expect(created.status()).toBe(201);
  const professional = (await created.json()) as { id: string };
  await openWeek(request, adminToken, professional.id);
  const service = await request.post(`${apiOrigin}/api/v1/services`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: serviceName, price: 45, durationMinutes: 30, points: 10 },
  });
  expect(service.status()).toBe(201);
  const serviceBody = (await service.json()) as { id: string };
  const registered = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: { name: 'Cliente Pontos', email: clientEmail, password: 'senha-segura' },
  });
  expect(registered.status()).toBe(201);
  const clientToken = ((await registered.json()) as { accessToken: string }).accessToken;
  const profile = await request.get(`${apiOrigin}/api/v1/clients/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  expect(profile.status()).toBe(200);
  const client = (await profile.json()) as { id: string };
  const booked = await request.post(`${apiOrigin}/api/v1/appointments`, {
    headers: { Authorization: `Bearer ${clientToken}` },
    data: {
      professionalId: professional.id,
      serviceId: serviceBody.id,
      date: nextWeekday(2),
      time: '10:00',
    },
  });
  expect(booked.status(), await booked.text()).toBe(201);
  const appointment = (await booked.json()) as { id: string };
  const professionalToken = await apiToken(request, professionalEmail, 'senha-segura');
  const completed = await request.patch(`${apiOrigin}/api/v1/appointments/${appointment.id}/complete`, {
    headers: { Authorization: `Bearer ${professionalToken}` },
  });
  expect(completed.status(), await completed.text()).toBe(200);

  await login(page, clientEmail, 'senha-segura');
  const card = page.getByText('Pontos disponíveis', { exact: true }).locator('..');
  await expect(card).toContainText('10');
  await expectNoHorizontalOverflow(page);
  await card.getByRole('link', { name: 'Ver extrato' }).click();
  await expect(page).toHaveURL(/\/pontos$/);
  await expect(page.getByRole('heading', { name: 'Pontos', exact: true })).toBeVisible();
  await expect(page.locator('p').filter({ hasText: 'Saldo atual' })).toContainText('10');
  const earn = page.getByRole('article').filter({ hasText: `Atendimento concluído: ${serviceName}` });
  await expect(earn.getByText('+10', { exact: true })).toBeVisible();
  await expect(earn.getByRole('heading', { name: 'Pontos ganhos' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(`/admin/clients/${client.id}/points`);
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByText('Sessão')).toBeVisible();
});

test('admin credits and debits with a debit preview', async ({ page, request }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const clientEmail = `e2e-ajuste-${stamp}@example.com`;
  const registered = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: { name: 'Cliente Ajuste', email: clientEmail, password: 'senha-segura' },
  });
  expect(registered.status()).toBe(201);
  const clientToken = ((await registered.json()) as { accessToken: string }).accessToken;
  const profile = await request.get(`${apiOrigin}/api/v1/clients/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  expect(profile.status()).toBe(200);
  const client = (await profile.json()) as { id: string };

  await login(page, e2eAdminEmail, e2eAdminPassword);
  await page.goto(`/admin/clients/${client.id}/points`);
  await expect(page.getByRole('heading', { name: 'Pontos' })).toBeVisible();
  await expect(page.locator('p').filter({ hasText: 'Saldo atual' })).toContainText('0');
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'Ajustar pontos' }).click();
  await page.getByLabel('Tipo').selectOption({ label: 'Crédito' });
  await page.getByLabel('Quantidade').fill('20');
  await page.getByLabel('Motivo').fill('Bonificação');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.locator('p').filter({ hasText: 'Saldo atual' })).toContainText('20');
  const credit = page.getByRole('article').filter({ hasText: 'Bonificação' });
  await expect(credit.getByText('+20', { exact: true })).toBeVisible();
  await expect(credit.getByRole('heading', { name: 'Crédito' })).toBeVisible();

  await page.getByRole('button', { name: 'Ajustar pontos' }).click();
  await page.getByLabel('Tipo').selectOption({ label: 'Débito' });
  await page.getByLabel('Quantidade').fill('5');
  await page.getByLabel('Motivo').fill('Correção');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('dt', { hasText: 'Saldo atual' }).locator('..').locator('dd')).toHaveText('20');
  await expect(page.locator('dt', { hasText: 'Débito' }).locator('..').locator('dd')).toHaveText('5');
  await expect(page.locator('dt', { hasText: 'Saldo após' }).locator('..').locator('dd')).toHaveText('15');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.locator('p').filter({ hasText: 'Saldo atual' })).toContainText('15');
  const debit = page.getByRole('article').filter({ hasText: 'Correção' });
  await expect(debit.getByText('-5', { exact: true })).toBeVisible();
  await expect(debit.getByRole('heading', { name: 'Débito' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('professional cannot open the points administration', async ({ page, request }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const email = `e2e-pro-pontos-${stamp}@example.com`;
  const token = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'Profissional Pontos',
      email,
      password: 'senha-segura',
      displayName: `Área pontos ${stamp}`,
    },
  });
  expect(created.status()).toBe(201);

  await login(page, email, 'senha-segura');
  await expect(page.getByText('Pontos disponíveis')).toHaveCount(0);
  await page.goto('/admin/clients/00000000-0000-4000-8000-000000000001/points');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByText('Sessão')).toBeVisible();
  await expect(page.getByText('Pontos disponíveis')).toHaveCount(0);
});

test('client books with points, the professional sees the redemption, and cancellation returns the points', async ({
  page,
  request,
}, testInfo) => {
  const adminToken = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const serviceName = `Corte resgate ${stamp}`;
  const displayName = `! Barbeiro ${stamp}`;
  const clientEmail = `e2e-resgate-${stamp}@example.com`;
  const professionalEmail = `e2e-resgate-pro-${stamp}@example.com`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Barbeiro Resgate',
      email: professionalEmail,
      password: 'senha-segura',
      displayName,
    },
  });
  expect(created.status()).toBe(201);
  const professional = (await created.json()) as { id: string };
  await openWeek(request, adminToken, professional.id);
  const service = await request.post(`${apiOrigin}/api/v1/services`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: serviceName, price: 45, durationMinutes: 30, points: 10, redemptionPoints: 50 },
  });
  expect(service.status()).toBe(201);
  const registered = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: { name: 'Cliente Resgate', email: clientEmail, password: 'senha-segura' },
  });
  expect(registered.status()).toBe(201);
  const clientToken = ((await registered.json()) as { accessToken: string }).accessToken;
  const profile = await request.get(`${apiOrigin}/api/v1/clients/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  expect(profile.status()).toBe(200);
  const client = (await profile.json()) as { id: string };
  const credited = await request.post(`${apiOrigin}/api/v1/clients/${client.id}/points/adjustments`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { type: 'ADJUSTMENT_CREDIT', points: 80, reason: 'Saldo para resgate' },
  });
  expect(credited.status()).toBe(201);

  await login(page, clientEmail, 'senha-segura');
  const date = nextWeekday(2);
  await page.goto('/agendar');
  await page.getByRole('button', { name: displayName }).click();
  await page.getByRole('button', { name: serviceName }).click();
  await page.getByLabel('Data').fill(date);
  await expect(page.getByRole('list', { name: 'Horários disponíveis' })).toBeVisible();
  await page.getByRole('list', { name: 'Horários disponíveis' }).getByRole('button', { name: '10:00' }).click();
  await expect(page.getByText('80 pontos', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Usar 50 pontos' }).check();
  await expect(page.getByText('50 pontos serão utilizados no momento do agendamento.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await expect(page.getByText('Agendamento confirmado')).toBeVisible();
  await expect(page.locator('dt', { hasText: 'Pontos utilizados' }).locator('..').locator('dd')).toHaveText('50');
  await expect(page.locator('dt', { hasText: 'Novo saldo' }).locator('..').locator('dd')).toHaveText('30 pontos');
  await expectNoHorizontalOverflow(page);

  await page.goto('/conta');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, professionalEmail, 'senha-segura');
  await page.goto('/profissional/agendamentos');
  const booked = page.getByRole('article').filter({ hasText: serviceName });
  await expect(booked.getByText('50 pontos utilizados')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajustar pontos' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto('/conta');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, clientEmail, 'senha-segura');
  await page.goto('/agendamentos');
  const upcoming = page.getByRole('article').filter({ hasText: serviceName });
  await expect(upcoming.getByText('50 pontos utilizados')).toBeVisible();
  await upcoming.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('article').filter({ hasText: serviceName }).getByText('Cancelado')).toBeVisible();
  await page.goto('/pontos');
  await expect(page.getByRole('article').filter({ hasText: 'Pontos devolvidos' }).getByText('+50', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'Pontos utilizados' }).getByText('-50', { exact: true })).toBeVisible();
  await expect(page.locator('p').filter({ hasText: 'Saldo atual' })).toContainText('80');
  await expectNoHorizontalOverflow(page);
});
