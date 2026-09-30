import type { AuthUser, PointsTransactionItem } from '@ravion/types';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import type { AuthService } from '../services/auth.service';
import { pointsService } from '../services/points.service';
import { appRoutes } from '../routes/router';

const ana: AuthUser = {
  id: 'user-1',
  tenantId: 'tenant-web',
  name: 'Ana Costa',
  email: 'ana@example.com',
  role: 'CLIENT',
  isActive: true,
};

function movement(overrides: Partial<PointsTransactionItem> = {}): PointsTransactionItem {
  return {
    id: 'tx-secret',
    type: 'EARN',
    points: 10,
    reason: 'Atendimento concluído: Corte',
    appointmentId: 'appt-secret',
    serviceName: 'Corte',
    createdAt: '2026-09-30T15:00:00.000Z',
    ...overrides,
  };
}

function page<TItem>(data: TItem[]) {
  return { data, meta: { page: 1, pageSize: 50, total: data.length, pageCount: data.length === 0 ? 0 : 1 } };
}

function authService(): AuthService {
  return {
    me: vi.fn(async () => ana),
    login: vi.fn(async () => ana),
    register: vi.fn(async () => ana),
    logout: vi.fn(async () => undefined),
    refresh: vi.fn(async () => ana),
  };
}

function renderPoints() {
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/pontos?clientId=someone-else'] });
  return render(
    <AuthProvider service={authService()}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('PointsPage', () => {
  beforeEach(() => {
    vi.spyOn(pointsService, 'mine').mockResolvedValue({ balance: 40 });
    vi.spyOn(pointsService, 'mineTransactions').mockResolvedValue(page([]));
    vi.spyOn(pointsService, 'clientSummary');
    vi.spyOn(pointsService, 'clientTransactions');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks Meus pontos as the current page', async () => {
    renderPoints();

    const nav = await screen.findByRole('navigation', { name: 'Área do cliente' });
    expect(within(nav).getByRole('link', { name: 'Meus pontos' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Agendar' })).not.toHaveAttribute('aria-current');
  });

  it('shows loading states before the balance and the history arrive', async () => {
    vi.mocked(pointsService.mine).mockReturnValue(new Promise(() => undefined));
    vi.mocked(pointsService.mineTransactions).mockReturnValue(new Promise(() => undefined));
    renderPoints();

    expect(await screen.findByText('Carregando saldo')).toBeInTheDocument();
    expect(screen.getByText('Carregando movimentações')).toBeInTheDocument();
    expect(screen.queryByText('Você ainda não possui movimentações de pontos.')).not.toBeInTheDocument();
  });

  it('shows the balance returned by the points service', async () => {
    renderPoints();

    expect(await screen.findByText('Saldo atual')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(pointsService.mine).toHaveBeenCalledWith();
    expect(pointsService.mineTransactions).toHaveBeenCalledWith({ pageSize: 50 });
    expect(pointsService.clientSummary).not.toHaveBeenCalled();
    expect(pointsService.clientTransactions).not.toHaveBeenCalled();
  });

  it('shows earned, redeemed and reversed movements without internal ids', async () => {
    vi.mocked(pointsService.mineTransactions).mockResolvedValue(
      page([
        movement(),
        movement({
          id: 'tx-redeem',
          type: 'REDEEM',
          points: 80,
          reason: 'Resgate no agendamento',
          serviceName: 'Corte',
          appointmentId: 'appt-redeem',
        }),
        movement({
          id: 'tx-reversal',
          type: 'REDEEM_REVERSAL',
          points: 80,
          reason: 'Devolução do resgate',
          serviceName: null,
          appointmentId: 'appt-reversal',
        }),
      ]),
    );
    renderPoints();

    const earn = await screen.findByRole('heading', { name: 'Pontos ganhos' });
    expect(earn.closest('article')).toHaveTextContent('+10');
    expect(earn.closest('article')).toHaveTextContent('Corte');
    expect(earn.closest('article')).toHaveTextContent('Atendimento concluído: Corte');
    expect(screen.getByRole('heading', { name: 'Pontos utilizados' }).closest('article')).toHaveTextContent('-80');
    expect(screen.getByRole('heading', { name: 'Pontos devolvidos' }).closest('article')).toHaveTextContent('+80');
    expect(screen.getByRole('link', { name: 'Usar meus pontos' })).toHaveAttribute('href', '/agendar');
    expect(screen.queryByText('appt-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('tx-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('someone-else')).not.toBeInTheDocument();
    expect(screen.queryByText('tenant-web')).not.toBeInTheDocument();
  });

  it('shows an empty statement and a booking link when the balance is zero', async () => {
    vi.mocked(pointsService.mine).mockResolvedValue({ balance: 0 });
    renderPoints();

    expect(await screen.findByText('0')).toBeInTheDocument();
    expect(screen.getByText('Você ainda não possui movimentações de pontos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agendar com pontos' })).toHaveAttribute('href', '/agendar');
  });

  it('keeps the balance when the history fails', async () => {
    vi.mocked(pointsService.mineTransactions).mockRejectedValue(new Error('connect ECONNREFUSED'));
    renderPoints();

    expect(await screen.findByText('40')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as movimentações.');
    expect(screen.queryByText('ECONNREFUSED')).not.toBeInTheDocument();
  });

  it('keeps the history when the balance fails', async () => {
    vi.mocked(pointsService.mine).mockRejectedValue(new Error('connect ECONNREFUSED'));
    vi.mocked(pointsService.mineTransactions).mockResolvedValue(page([movement()]));
    renderPoints();

    expect(await screen.findByRole('heading', { name: 'Pontos ganhos' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o saldo.');
    expect(screen.queryByText('ECONNREFUSED')).not.toBeInTheDocument();
    expect(screen.queryByText('Saldo atual')).not.toBeInTheDocument();
  });

  it('shows the balance while the history is still loading', async () => {
    vi.mocked(pointsService.mineTransactions).mockReturnValue(new Promise(() => undefined));
    renderPoints();

    expect(await screen.findByText('40')).toBeInTheDocument();
    expect(screen.getByText('Carregando movimentações')).toBeInTheDocument();
    expect(screen.queryByText('Você ainda não possui movimentações de pontos.')).not.toBeInTheDocument();
  });
});
