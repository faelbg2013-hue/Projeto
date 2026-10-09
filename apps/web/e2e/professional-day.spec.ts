import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { e2eAdminEmail, e2eAdminPassword, e2eApiOrigin, e2eDatabaseUrl, e2eTenantSlug } from './target';

const apiOrigin = e2eApiOrigin;

function saoPauloToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function futureWeekday(weekday: number): string {
  const today = saoPauloToday();
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

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, (day ?? 1) + days));
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

async function shiftIntoNow(id: string): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: e2eDatabaseUrl() } } });
  try {
    const now = new Date();
    const dayStart = new Date(`${saoPauloToday()}T00:00:00-03:00`);
    const start = new Date(now.getTime() - 2 * 60_000);
    await prisma.appointment.update({
      where: { id },
      data: {
        startAt: start < dayStart ? dayStart : start,
        endAt: new Date(now.getTime() + 25 * 60_000),
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

test('client cannot open the professional area', async ({ page }) => {
  const email = `e2e-op-cliente-${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Nome').fill('Cliente Operação');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Cliente Operação' })).toBeVisible();

  await page.goto('/profissional');
  await expect(page).toHaveURL(/\/conta$/);
  await page.goto('/profissional/agenda');
  await expect(page).toHaveURL(/\/conta$/);
  await expectNoHorizontalOverflow(page);
});

test('admin cannot use the professional area', async ({ page }) => {
  await login(page, e2eAdminEmail, e2eAdminPassword);
  await page.goto('/profissional');
  await expect(page).toHaveURL(/\/conta$/);
  await page.goto('/profissional/agenda');
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('professional runs the day from the phone-sized agenda', async ({ page, request }, testInfo) => {
  const stamp = `${testInfo.project.name}${Date.now()}`;
  const adminToken = await apiToken(request, e2eAdminEmail, e2eAdminPassword);
  const email = `e2e-op-pro-${stamp}@example.com`;
  const displayName = `Operação ${stamp}`;
  const clientName = `Cliente ${stamp}`;
  const serviceName = `Corte ${stamp}`;
  const created = await request.post(`${apiOrigin}/api/v1/professionals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: 'Profissional Operação', email, password: 'senha-segura', displayName },
  });
  expect(created.status()).toBe(201);
  const professional = (await created.json()) as { id: string };
  const schedule = await request.put(`${apiOrigin}/api/v1/professionals/${professional.id}/schedule`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      intervals: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        startTime: '08:00',
        endTime: '18:00',
      })),
    },
  });
  expect(schedule.status()).toBe(200);
  const service = await request.post(`${apiOrigin}/api/v1/services`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: serviceName,
      description: 'Corte clássico do dia',
      price: 45,
      durationMinutes: 30,
      points: 10,
      redemptionPoints: 50,
    },
  });
  expect(service.status()).toBe(201);
  const serviceId = ((await service.json()) as { id: string }).id;

  const clientEmail = `e2e-op-cli-${stamp}@example.com`;
  const registered = await request.post(`${apiOrigin}/api/v1/auth/register`, {
    data: { name: clientName, email: clientEmail, password: 'senha-segura' },
  });
  expect(registered.status()).toBe(201);
  const clientToken = await apiToken(request, clientEmail, 'senha-segura');
  const me = await request.get(`${apiOrigin}/api/v1/clients/me`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  expect(me.status()).toBe(200);
  const clientId = ((await me.json()) as { id: string }).id;
  const credit = await request.post(`${apiOrigin}/api/v1/clients/${clientId}/points/adjustments`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { type: 'ADJUSTMENT_CREDIT', points: 150, reason: 'Saldo da operação' },
  });
  expect(credit.status()).toBe(201);

  const date = futureWeekday(3);
  async function book(time: string, mode: 'NORMAL' | 'POINTS', key: string): Promise<string> {
    const response = await request.post(`${apiOrigin}/api/v1/appointments`, {
      headers: { Authorization: `Bearer ${clientToken}`, 'Idempotency-Key': key },
      data: { professionalId: professional.id, serviceId, date, time, bookingMode: mode },
    });
    expect(response.status(), await response.text()).toBe(201);
    return ((await response.json()) as { id: string }).id;
  }

  const currentId = await book('10:00', 'NORMAL', `op${stamp}a`.slice(0, 80));
  await book('11:00', 'POINTS', `op${stamp}b`.slice(0, 80));
  await book('12:00', 'POINTS', `op${stamp}c`.slice(0, 80));
  await book('14:00', 'NORMAL', `op${stamp}d`.slice(0, 80));
  await book('15:00', 'NORMAL', `op${stamp}e`.slice(0, 80));
  const conflictId = await book('16:00', 'NORMAL', `op${stamp}f`.slice(0, 80));
  await shiftIntoNow(currentId);

  await login(page, email, 'senha-segura');
  await page.goto('/profissional');
  await expect(page.getByRole('heading', { name: displayName, exact: true })).toBeVisible();
  await expect(page.getByText('Ativo')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Serviços disponíveis' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resumo do dia' })).toBeVisible();
  const current = page.getByRole('region', { name: 'Atendimento atual' });
  await expect(current.getByText(clientName)).toBeVisible();
  await expect(current.getByText(serviceName)).toBeVisible();
  await expect(current.getByRole('button', { name: 'Concluir' })).toBeVisible();
  await expect(current.getByRole('button', { name: 'Não compareceu' })).toBeVisible();
  await expect(current.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  await current.getByRole('button', { name: 'Concluir' }).click();
  await current.getByRole('button', { name: 'Confirmar conclusão' }).click();
  await expect(current.getByText('Nenhum atendimento em andamento.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Próximo atendimento' })).toContainText(
    'Nenhum próximo atendimento para hoje.',
  );
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: 'Ver agenda' }).click();
  await expect(page).toHaveURL(/\/profissional\/agenda$/);
  await page.goto(`/profissional/agenda?date=${date}`);
  await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toBeVisible();
  await expect(page.getByLabel('Data')).toHaveValue(date);
  const summary = page.getByRole('region', { name: 'Resumo do dia' });
  await expect(summary.getByText('Hoje')).toBeVisible();
  await expect(summary.getByText('Confirmados')).toBeVisible();

  await page.getByRole('button', { name: 'Próximo dia' }).click();
  await expect(page.getByLabel('Data')).toHaveValue(addDays(date, 1));
  await page.getByRole('button', { name: 'Dia anterior' }).click();
  await expect(page.getByLabel('Data')).toHaveValue(date);
  await page.getByRole('button', { name: 'Hoje' }).click();
  await expect(page.getByLabel('Data')).toHaveValue(saoPauloToday());
  await page.getByLabel('Data').fill(date);
  await expect(page.getByLabel('Data')).toHaveValue(date);

  const pointsCard = page.getByRole('article').filter({ hasText: '11:00' });
  await expect(pointsCard.getByText('Resgate de 50 pontos')).toBeVisible();
  await expect(pointsCard.getByText('POINTS')).toBeVisible();
  const normalCard = page.getByRole('article').filter({ hasText: '15:00' });
  await expect(normalCard.getByText(/Resgate de/)).toHaveCount(0);
  await expect(normalCard.getByText('NORMAL')).toBeVisible();

  await pointsCard.getByRole('button', { name: 'Abrir atendimento' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('region', { name: 'Pontos' })).toContainText('Pontos utilizados: 50');
  await expect(dialog.getByRole('region', { name: 'Pontos' })).toContainText('Pontos ao concluir: 10');
  await expect(dialog.getByText('Corte clássico do dia')).toBeVisible();
  await expect(dialog.getByText('valor registrado')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog.getByText('Este cancelamento devolverá os pontos utilizados neste agendamento.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(dialog.getByText('Cancelado')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar' }).click();

  const missedPoints = page.getByRole('article').filter({ hasText: '12:00' });
  await missedPoints.getByRole('button', { name: 'Abrir atendimento' }).click();
  await dialog.getByRole('button', { name: 'Não compareceu' }).click();
  await expect(
    dialog.getByText('Ao marcar como não compareceu, os pontos utilizados no agendamento não são devolvidos.'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar não comparecimento' }).click();
  await expect(dialog.getByText('Não compareceu')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar' }).click();

  const missedNormal = page.getByRole('article').filter({ hasText: '14:00' });
  await missedNormal.getByRole('button', { name: 'Abrir atendimento' }).click();
  await expect(dialog.getByRole('region', { name: 'Pontos' })).toContainText('Pontos utilizados: 0');
  await dialog.getByRole('button', { name: 'Não compareceu' }).click();
  await expect(dialog.getByText('Ao marcar como não compareceu')).toHaveCount(0);
  await expect(dialog.getByText('Este agendamento não possui resgate de pontos.')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Confirmar não comparecimento' }).click();
  await expect(dialog.getByText('Não compareceu')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar' }).click();

  await normalCard.getByRole('button', { name: 'Abrir atendimento' }).click();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog.getByText('Este agendamento não possui resgate de pontos.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Voltar' }).click();
  await dialog.getByRole('button', { name: 'Concluir' }).click();
  await dialog.getByRole('button', { name: 'Confirmar conclusão' }).click();
  await expect(dialog.getByText('Atendimento atualizado.')).toBeVisible();
  await expect(dialog.getByText('Concluído')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar' }).click();

  const conflictCard = page.getByRole('article').filter({ hasText: '16:00' });
  await conflictCard.getByRole('button', { name: 'Abrir atendimento' }).click();
  const professionalToken = await apiToken(request, email, 'senha-segura');
  const raced = await request.patch(`${apiOrigin}/api/v1/appointments/${conflictId}/complete`, {
    headers: { Authorization: `Bearer ${professionalToken}` },
  });
  expect(raced.status()).toBe(200);
  await dialog.getByRole('button', { name: 'Concluir' }).click();
  await dialog.getByRole('button', { name: 'Confirmar conclusão' }).click();
  await expect(dialog.getByText('A transição de status não é permitida.')).toBeVisible();
  await expect(dialog.getByText('Atendimento atualizado.')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Fechar' }).click();

  await page.locator('#bloqueio').scrollIntoViewIfNeeded();
  await page.getByLabel('Início do bloqueio').fill('12:30');
  await page.getByLabel('Fim do bloqueio').fill('13:00');
  await page.getByLabel('Motivo').fill('Pausa');
  await page.getByRole('button', { name: 'Bloquear horário' }).click();
  await expect(page.getByText('12:30–13:00 · Pausa')).toBeVisible();
  await page.getByRole('button', { name: 'Remover bloqueio Pausa' }).click();
  await expect(page.getByText('12:30–13:00 · Pausa')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
