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
  const utc = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, (day ?? 1) + delta));
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

test('admin configures a weekly schedule, block, exception and availability', async ({
  page,
  request,
}, testInfo) => {
  const token = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const email = `e2e-agenda-${testInfo.project.name}-${Date.now()}@example.com`;
  const serviceName = `Agenda ${testInfo.project.name} ${Date.now()}`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'Carlos Agenda',
      email,
      password: 'senha-segura',
      displayName: `Agenda ${testInfo.project.name}`,
    },
  });
  expect(created.status()).toBe(201);
  const professional = (await created.json()) as { id: string };
  const service = await request.post(`${apiOrigin}/api/v1/services`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: serviceName, price: 40, durationMinutes: 30, points: 1 },
  });
  expect(service.status()).toBe(201);

  await login(page, e2eAdminEmail, e2eAdminPassword);
  await page.goto(`/admin/professionals/${professional.id}/schedule`);
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
  const monday = page.getByRole('region', { name: 'Segunda' });
  await expect(monday.getByText('Fechado')).toBeVisible();

  await monday.getByRole('button', { name: 'Adicionar intervalo' }).click();
  await monday.getByLabel('Início Segunda 1').fill('08:00');
  await monday.getByLabel('Fim Segunda 1').fill('12:00');
  await page.getByRole('button', { name: 'Salvar agenda' }).click();
  await expect(page.getByText('Agenda salva.')).toBeVisible();

  await monday.getByLabel('Fim Segunda 1').fill('07:00');
  await page.getByRole('button', { name: 'Salvar agenda' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'O horário inicial precisa ser anterior ao horário final.',
  );

  await monday.getByLabel('Início Segunda 1').fill('09:00');
  await monday.getByLabel('Fim Segunda 1').fill('12:00');
  await page.getByRole('button', { name: 'Salvar agenda' }).click();
  await expect(page.getByText('Agenda salva.')).toBeVisible();

  const date = nextWeekday(1);
  await page.getByLabel('Data do bloqueio').fill(date);
  await page.getByLabel('Início do bloqueio').fill('12:00');
  await page.getByLabel('Fim do bloqueio').fill('13:30');
  await page.getByLabel('Motivo do bloqueio').fill('Almoço');
  await page.getByRole('button', { name: 'Criar bloqueio' }).click();
  await expect(page.getByText('Almoço', { exact: true })).toBeVisible();

  await page.getByLabel('Data da exceção').fill(date);
  await page.getByLabel('Tipo').selectOption({ label: 'Abrir' });
  await page.getByLabel('Motivo da exceção').fill('Plantão');
  await page.getByRole('button', { name: 'Criar exceção' }).click();
  await expect(page.getByText('Plantão', { exact: true })).toBeVisible();

  await page.getByLabel('Data da consulta').fill(date);
  await page.getByLabel('Serviço').selectOption({ label: serviceName });
  await page.getByRole('button', { name: 'Consultar disponibilidade' }).click();
  await expect(page.getByRole('list', { name: 'Horários disponíveis' }).getByText('09:00')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'Remover bloqueio Almoço' }).click();
  await expect(page.getByText('Nenhum bloqueio.')).toBeVisible();
  await page.getByRole('button', { name: 'Remover exceção Plantão' }).click();
  await expect(page.getByText('Nenhuma exceção.')).toBeVisible();
  await monday.getByRole('button', { name: 'Remover Segunda 1' }).click();
  await expect(monday.getByText('Fechado')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar agenda' }).click();
  await expect(page.getByText('Agenda salva.')).toBeVisible();
});

test('professional edits the own agenda and cannot open administration', async ({
  page,
  request,
}, testInfo) => {
  const token = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const email = `e2e-pro-agenda-${testInfo.project.name}-${Date.now()}@example.com`;
  const password = 'senha-segura';
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'Pro Agenda',
      email,
      password,
      displayName: `Pro ${testInfo.project.name}`,
    },
  });
  expect(created.status()).toBe(201);
  const professional = (await created.json()) as { id: string };

  await login(page, email, password);
  await page.goto('/profissional/agenda/semana');
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
  const tuesday = page.getByRole('region', { name: 'Terça' });
  await tuesday.getByRole('button', { name: 'Adicionar intervalo' }).click();
  await tuesday.getByLabel('Início Terça 1').fill('10:00');
  await tuesday.getByLabel('Fim Terça 1').fill('16:00');
  await page.getByRole('button', { name: 'Salvar agenda' }).click();
  await expect(page.getByText('Agenda salva.')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(`/admin/professionals/${professional.id}/schedule`);
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByText('Sessão')).toBeVisible();
});

test('client can open the account and cannot edit a schedule', async ({ page }, testInfo) => {
  const email = `e2e-cliente-agenda-${testInfo.project.name}-${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nome').fill('Ana Agenda');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Agenda' })).toBeVisible();

  await page.goto('/profissional/agenda');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByText('Sessão')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
