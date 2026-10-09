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

function civilDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
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

async function openWeek(
  request: APIRequestContext,
  token: string,
  professionalId: string,
): Promise<void> {
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

test('client books, sees the summary and cancels into history', async ({ page, request }, testInfo) => {
  const adminToken = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const displayName = `! Agenda ${stamp}`;
  const serviceName = `Corte ${stamp}`;
  const email = `e2e-agenda-cliente-${stamp}@example.com`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Barbeiro Agenda',
      email: `e2e-agenda-pro-${stamp}@example.com`,
      password: 'senha-segura',
      displayName,
    },
  });
  expect(created.status()).toBe(201);
  const professional = (await created.json()) as { id: string };
  await openWeek(request, adminToken, professional.id);
  const service = await request.post(`${apiOrigin}/api/v1/services`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: serviceName, price: 40, durationMinutes: 30, points: 1 },
  });
  expect(service.status()).toBe(201);
  const serviceBody = (await service.json()) as { id: string };

  await page.goto('/register');
  await page.getByLabel('Nome').fill('Ana Reserva');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Reserva' })).toBeVisible();

  const date = nextWeekday(1);
  await page.goto('/agendar');
  await expect(page.getByRole('heading', { name: 'Agendar' })).toBeVisible();
  await page.getByRole('button', { name: displayName }).click();
  await page.getByRole('button', { name: serviceName }).click();
  await page.getByLabel('Data').fill(date);
  await expect(page.getByRole('list', { name: 'Horários disponíveis' })).toBeVisible();
  await page.getByRole('list', { name: 'Horários disponíveis' }).getByRole('button', { name: '15:00' }).click();
  await page.getByLabel('Observação').fill('Janela');
  await expect(page.locator('dt', { hasText: 'Profissional' }).locator('..').locator('dd')).toHaveText(
    displayName,
  );
  await expect(page.getByText(civilDate(date)).first()).toBeVisible();
  await expect(page.getByText('R$ 40,00').first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await expect(page.getByText('Agendamento confirmado')).toBeVisible();
  await expect(page.getByText(serviceName)).toBeVisible();
  await expect(page.getByText(displayName)).toBeVisible();
  await expect(page.getByText('15:00')).toBeVisible();
  await expect(page.getByText('30 min')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: 'Ver meus agendamentos' }).click();
  await expect(page.getByRole('heading', { name: 'Próximos' })).toBeVisible();
  const upcoming = page.getByRole('article').filter({ hasText: serviceName });
  await expect(upcoming.getByText('Confirmado')).toBeVisible();
  await upcoming.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Histórico' })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: serviceName }).getByText('Cancelado')).toBeVisible();
  await expect(page.getByText('Nenhum agendamento próximo.')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const clientToken = await apiToken(request, email, 'senha-segura');
  const availability = await request.get(
    `${apiOrigin}/api/v1/professionals/${professional.id}/availability?date=${date}&serviceId=${serviceBody.id}`,
    { headers: { Authorization: `Bearer ${clientToken}` } },
  );
  expect(availability.status()).toBe(200);
  const slots = (await availability.json()) as { slots: string[] };
  expect(slots.slots).toContain('15:00');

  await page.goto('/profissional/agendamentos');
  await expect(page).toHaveURL(/\/conta$/);
  await page.goto('/admin/appointments');
  await expect(page).toHaveURL(/\/conta$/);
});

test('client sees the occupied slot error when the time is taken before confirm', async ({
  page,
  request,
}, testInfo) => {
  const adminToken = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const displayName = `! Ocupado ${stamp}`;
  const serviceName = `Barba ${stamp}`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Barbeiro Ocupado',
      email: `e2e-ocupado-pro-${stamp}@example.com`,
      password: 'senha-segura',
      displayName,
    },
  });
  expect(created.status()).toBe(201);
  const professional = (await created.json()) as { id: string };
  await openWeek(request, adminToken, professional.id);
  const service = await request.post(`${apiOrigin}/api/v1/services`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: serviceName, price: 30, durationMinutes: 30, points: 1 },
  });
  expect(service.status()).toBe(201);
  const serviceBody = (await service.json()) as { id: string };
  const other = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: {
      name: 'Bruno Ocupado',
      email: `e2e-ocupado-b-${stamp}@example.com`,
      password: 'senha-segura',
    },
  });
  expect(other.status()).toBe(201);
  const otherToken = ((await other.json()) as { accessToken: string }).accessToken;

  const email = `e2e-ocupado-a-${stamp}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nome').fill('Ana Ocupado');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/conta$/);

  const date = nextWeekday(3);
  await page.goto('/agendar');
  await page.getByRole('button', { name: displayName }).click();
  await page.getByRole('button', { name: serviceName }).click();
  await page.getByLabel('Data').fill(date);
  await expect(page.getByRole('list', { name: 'Horários disponíveis' })).toBeVisible();
  await page.getByRole('list', { name: 'Horários disponíveis' }).getByRole('button', { name: '11:00' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar agendamento' })).toBeVisible();

  const taken = await request.post(`${apiOrigin}/api/v1/appointments`, {
    headers: { Authorization: `Bearer ${otherToken}` },
    data: { professionalId: professional.id, serviceId: serviceBody.id, date, time: '11:00' },
  });
  expect(taken.status()).toBe(201);
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await expect(page.getByRole('alert')).toHaveText('Este horário não está mais disponível.');
  await expectNoHorizontalOverflow(page);
});

test('professional completes, marks no-show and cancels own appointments', async ({
  page,
  request,
}, testInfo) => {
  const adminToken = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const displayName = `00 Pro ${stamp}`;
  const serviceName = `Ritual ${stamp}`;
  const professionalEmail = `e2e-pro-apt-${stamp}@example.com`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Carlos Atendimento',
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
    data: { name: serviceName, price: 55, durationMinutes: 30, points: 1 },
  });
  expect(service.status()).toBe(201);
  const serviceBody = (await service.json()) as { id: string };
  const client = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: {
      name: 'Cliente Atendimento',
      email: `e2e-pro-cliente-${stamp}@example.com`,
      password: 'senha-segura',
    },
  });
  expect(client.status()).toBe(201);
  const clientToken = ((await client.json()) as { accessToken: string }).accessToken;
  const date = nextWeekday(4);
  for (const time of ['14:00', '14:30', '15:00']) {
    const booked = await request.post(`${apiOrigin}/api/v1/appointments`, {
      headers: { Authorization: `Bearer ${clientToken}` },
      data: { professionalId: professional.id, serviceId: serviceBody.id, date, time },
    });
    expect(booked.status()).toBe(201);
  }

  await login(page, professionalEmail, 'senha-segura');
  await page.goto('/profissional/agendamentos');
  await expect(page.getByRole('heading', { name: 'Agendamentos' })).toBeVisible();
  await page.getByLabel('Data').fill(date);
  await page.getByLabel('Status').selectOption({ label: 'Confirmado' });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByRole('article').filter({ hasText: '14:00' })).toBeVisible();
  await page.getByLabel('Status').selectOption({ label: 'Todos' });
  await page.getByRole('button', { name: 'Filtrar' }).click();

  const at1400 = page.getByRole('article').filter({ hasText: '14:00' });
  await at1400.getByRole('button', { name: 'Concluir' }).click();
  await expect(at1400.getByText('Concluído')).toBeVisible();

  const at1430 = page.getByRole('article').filter({ hasText: '14:30' });
  await at1430.getByRole('button', { name: 'Não compareceu' }).click();
  await expect(at1430.getByText('Não compareceu')).toBeVisible();

  const at1500 = page.getByRole('article').filter({ hasText: '15:00' });
  await at1500.getByRole('button', { name: 'Cancelar' }).click();
  await expect(at1500.getByText('Cancelado')).toBeVisible();
  await expect(at1400.getByText('Cliente Atendimento')).toBeVisible();
  await expect(at1400.getByText(serviceName)).toBeVisible();
  await expect(at1400.getByText('R$ 55,00')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto('/admin/appointments');
  await expect(page).toHaveURL(/\/conta$/);
});

test('admin filters appointments and updates status', async ({ page, request }, testInfo) => {
  const adminToken = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const displayName = `00 Admin ${stamp}`;
  const serviceName = `Acabamento ${stamp}`;
  const clientName = `Admin Cliente ${stamp}`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Barbeiro Admin',
      email: `e2e-admin-pro-${stamp}@example.com`,
      password: 'senha-segura',
      displayName,
    },
  });
  expect(created.status()).toBe(201);
  const professional = (await created.json()) as { id: string };
  await openWeek(request, adminToken, professional.id);
  const service = await request.post(`${apiOrigin}/api/v1/services`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: serviceName, price: 25, durationMinutes: 30, points: 1 },
  });
  expect(service.status()).toBe(201);
  const serviceBody = (await service.json()) as { id: string };
  const client = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: {
      name: clientName,
      email: `e2e-admin-cliente-${stamp}@example.com`,
      password: 'senha-segura',
    },
  });
  expect(client.status()).toBe(201);
  const clientToken = ((await client.json()) as { accessToken: string }).accessToken;
  const date = nextWeekday(5);
  for (const time of ['16:00', '16:30']) {
    const booked = await request.post(`${apiOrigin}/api/v1/appointments`, {
      headers: { Authorization: `Bearer ${clientToken}` },
      data: { professionalId: professional.id, serviceId: serviceBody.id, date, time },
    });
    expect(booked.status()).toBe(201);
  }

  await login(page, e2eAdminEmail, e2eAdminPassword);
  await page.goto('/admin/appointments');
  await expect(page.getByRole('heading', { name: 'Agendamentos' })).toBeVisible();
  await page.getByLabel('Profissional').selectOption({ label: displayName });
  await page.getByLabel('Cliente').fill(clientName);
  await page.getByLabel('Serviço').selectOption({ label: serviceName });
  await page.getByLabel('Período inicial').fill(date);
  await page.getByLabel('Período final').fill(date);
  await page.getByLabel('Status').selectOption({ label: 'Confirmado' });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  const mine = page.getByRole('article').filter({ hasText: serviceName });
  await expect(mine.filter({ hasText: '16:00' })).toBeVisible();
  await page.getByLabel('Status').selectOption({ label: 'Todos' });
  await page.getByRole('button', { name: 'Filtrar' }).click();

  const at1600 = mine.filter({ hasText: '16:00' });
  await expect(at1600.getByText(serviceName)).toBeVisible();
  await at1600.getByRole('button', { name: 'Concluir' }).click();
  await expect(at1600.getByText('Concluído')).toBeVisible();

  const at1630 = mine.filter({ hasText: '16:30' });
  await at1630.getByRole('button', { name: 'Não compareceu' }).click();
  await expect(at1630.getByText('Não compareceu')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
