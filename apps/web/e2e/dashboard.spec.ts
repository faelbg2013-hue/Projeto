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

test('client and professional cannot open the operational dashboard', async ({ page, request }, testInfo) => {
  const adminToken = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const professionalEmail = `e2e-painel-pro-${stamp}@example.com`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Barbeiro Painel',
      email: professionalEmail,
      password: 'senha-segura',
      displayName: `! Área painel ${stamp}`,
    },
  });
  expect(created.status()).toBe(201);
  const clientEmail = `e2e-painel-cliente-${stamp}@example.com`;
  const registered = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: { name: 'Cliente Painel', email: clientEmail, password: 'senha-segura' },
  });
  expect(registered.status()).toBe(201);

  await login(page, clientEmail, 'senha-segura');
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole('heading', { name: 'Painel', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sair' }).click();
  await login(page, professionalEmail, 'senha-segura');
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole('heading', { name: 'Painel', exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('admin filters the day, sees points and normal bookings, and updates status', async ({
  page,
  request,
}, testInfo) => {
  const adminToken = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const serviceName = `Corte painel ${stamp}`;
  const displayName = `! Painel ${stamp}`;
  const otherName = `! Outro painel ${stamp}`;
  const clientEmail = `e2e-dash-${stamp}@example.com`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Barbeiro Painel',
      email: `e2e-dash-pro-${stamp}@example.com`,
      password: 'senha-segura',
      displayName,
    },
  });
  expect(created.status()).toBe(201);
  const professional = (await created.json()) as { id: string };
  const otherCreated = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Outro Painel',
      email: `e2e-dash-pro2-${stamp}@example.com`,
      password: 'senha-segura',
      displayName: otherName,
    },
  });
  expect(otherCreated.status()).toBe(201);
  const other = (await otherCreated.json()) as { id: string };
  await openWeek(request, adminToken, professional.id);
  await openWeek(request, adminToken, other.id);
  const service = await request.post(`${apiOrigin}/api/v1/services`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: serviceName, price: 40, durationMinutes: 30, points: 10, redemptionPoints: 50 },
  });
  expect(service.status()).toBe(201);
  const serviceBody = (await service.json()) as { id: string };
  const registered = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: { name: 'Helena Painel', email: clientEmail, password: 'senha-segura' },
  });
  expect(registered.status()).toBe(201);
  const clientToken = ((await registered.json()) as { accessToken: string }).accessToken;
  const profile = await request.get(`${apiOrigin}/api/v1/clients/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const client = (await profile.json()) as { id: string };
  const credited = await request.post(`${apiOrigin}/api/v1/clients/${client.id}/points/adjustments`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { type: 'ADJUSTMENT_CREDIT', points: 80, reason: 'Saldo do painel' },
  });
  expect(credited.status()).toBe(201);
  const date = nextWeekday(4);
  async function book(professionalId: string, time: string, bookingMode: 'NORMAL' | 'POINTS'): Promise<void> {
    const response = await request.post(`${apiOrigin}/api/v1/appointments`, {
      headers: {
        Authorization: `Bearer ${clientToken}`,
        'Idempotency-Key': `dash-${time.replace(':', '')}-${professionalId.slice(0, 8)}-${stamp}`.slice(0, 80),
      },
      data: { professionalId, serviceId: serviceBody.id, date, time, bookingMode },
    });
    expect(response.status(), await response.text()).toBe(201);
  }
  await book(professional.id, '10:00', 'POINTS');
  await book(professional.id, '11:00', 'NORMAL');
  await book(professional.id, '12:00', 'NORMAL');
  await book(professional.id, '13:00', 'NORMAL');
  await book(other.id, '14:00', 'NORMAL');

  await login(page, e2eAdminEmail, e2eAdminPassword);
  await page.getByRole('link', { name: 'Painel' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Painel', exact: true })).toBeVisible();
  await expect(page.getByText('O Ravion Barber não processa pagamentos.')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel('Data').fill(date);
  await page.getByLabel('Profissional').selectOption({ label: displayName });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  const day = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Atendimentos do dia' }) });
  const pointsCard = day.getByRole('article').filter({ hasText: serviceName }).filter({ hasText: '10:00' });
  const normalCard = day.getByRole('article').filter({ hasText: serviceName }).filter({ hasText: '11:00' });
  await expect(pointsCard.getByText('Pontos utilizados: 50 pontos')).toBeVisible();
  await expect(normalCard.getByText('Pontos utilizados: —')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Valor dos serviços' })).toContainText('R$ 160,00');
  await expect(page.getByRole('article', { name: 'Pontos utilizados' })).toHaveText(/50/);
  await expect(day.getByRole('article').filter({ hasText: '14:00' })).toHaveCount(0);
  await expect(
    page.locator('section').filter({ has: page.getByRole('heading', { name: 'Próximos atendimentos' }) }),
  ).toContainText('10:00');
  await expectNoHorizontalOverflow(page);

  await page.getByLabel('Status').selectOption({ label: 'Confirmados' });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(day.getByText('Confirmado').first()).toBeVisible();
  await expect(day.getByRole('article').filter({ hasText: '11:00' })).toBeVisible();
  await page.getByRole('button', { name: 'Atualizar' }).click();
  await expect(day.getByRole('article').filter({ hasText: '11:00' })).toBeVisible();
  await page.getByLabel('Status').selectOption({ label: 'Todos' });
  await page.getByRole('button', { name: 'Filtrar' }).click();

  const completeCard = day.getByRole('article').filter({ hasText: '11:00' });
  await completeCard.getByRole('button', { name: 'Concluir' }).click();
  await expect(day.getByRole('article').filter({ hasText: '11:00' }).getByText('Concluído')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Pontos concedidos' })).toContainText('10');

  const missedCard = day.getByRole('article').filter({ hasText: '12:00' });
  await missedCard.getByRole('button', { name: 'Não compareceu' }).click();
  await expect(day.getByRole('article').filter({ hasText: '12:00' }).getByText('Não compareceu')).toBeVisible();

  const cancelCard = day.getByRole('article').filter({ hasText: '10:00' });
  await cancelCard.getByRole('button', { name: 'Cancelar' }).click();
  await expect(day.getByRole('article').filter({ hasText: '10:00' }).getByText('Cancelado')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Pontos devolvidos' })).toContainText('50');
  await expectNoHorizontalOverflow(page);
});
