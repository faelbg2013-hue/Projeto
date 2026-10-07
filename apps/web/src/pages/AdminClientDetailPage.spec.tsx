import type { AdminClientDetail, AuthUser } from '@ravion/types';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import type { AuthService } from '../services/auth.service';
import { clientsService } from '../services/clients.service';
import { AdminClientDetailPage } from './AdminClientDetailPage';

vi.mock('../services/clients.service', () => ({
  clientsService: {
    overview: vi.fn(),
    update: vi.fn(),
  },
}));

const clientId = '11111111-1111-4111-8111-111111111111';

const admin: AuthUser = {
  id: 'admin-1',
  tenantId: 'tenant-web',
  name: 'Admin Ravion',
  email: 'admin@example.com',
  role: 'ADMIN',
  isActive: true,
};

function authService(): AuthService {
  return {
    me: vi.fn(async () => admin),
    login: vi.fn(async () => admin),
    register: vi.fn(async () => admin),
    logout: vi.fn(async () => undefined),
    refresh: vi.fn(async () => admin),
  };
}

function detail(overrides: Partial<AdminClientDetail> = {}): AdminClientDetail {
  return {
    name: 'Rafael Busca',
    email: 'rafael@example.com',
    isActive: true,
    createdAt: '2026-01-15T15:00:00.000Z',
    points: {
      balance: 12,
      recent: [
        {
          type: 'EARN',
          points: 10,
          reason: 'Atendimento concluído: Corte',
          createdAt: '2026-03-01T15:00:00.000Z',
        },
      ],
    },
    appointments: {
      summary: { total: 4, upcoming: 1, pending: 0, confirmed: 1, completed: 1, cancelled: 1, noShow: 1 },
      upcoming: [
        {
          date: '2099-01-02',
          time: '09:00',
          professionalName: 'Nando',
          serviceName: 'Corte',
          status: 'CONFIRMED',
          bookingMode: 'NORMAL',
        },
      ],
      history: [
        {
          date: '2025-06-01',
          time: '09:00',
          professionalName: 'Nando',
          serviceName: 'Barba',
          status: 'COMPLETED',
          bookingMode: 'POINTS',
        },
      ],
    },
    ...overrides,
  };
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={[`/admin/clients/${clientId}`]}>
      <AuthProvider service={authService()}>
        <Routes>
          <Route path="/admin/clients/:clientId" element={<AdminClientDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminClientDetailPage', () => {
  beforeEach(() => {
    vi.mocked(clientsService.overview).mockResolvedValue(detail());
  });

  it('shows a loading state while the client is requested', () => {
    vi.mocked(clientsService.overview).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando cliente')).toBeInTheDocument();
  });

  it('shows the request error', async () => {
    vi.mocked(clientsService.overview).mockRejectedValue(new Error('Recurso não encontrado'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Recurso não encontrado');
  });

  it('shows the registration, balance, summary and recent activity', async () => {
    renderPage();
    expect(await screen.findByText('Rafael Busca')).toBeInTheDocument();
    expect(screen.getByText('rafael@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Cadastro em 15/01/2026')).toBeInTheDocument();
    expect(screen.getByText('12 pontos')).toBeInTheDocument();
    expect(screen.getByText('Atendimento')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('Atendimento concluído: Corte')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getAllByText('Próximos').length).toBeGreaterThan(0);
    expect(screen.getByText('Corte')).toBeInTheDocument();
    expect(screen.getByText('02/01/2099 · 09:00')).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByText('Histórico recente')).toBeInTheDocument();
    expect(screen.getByText('Barba')).toBeInTheDocument();
    expect(screen.getByText('Concluído')).toBeInTheDocument();
    expect(screen.getByText('Pontos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gerenciar pontos' })).toHaveAttribute(
      'href',
      `/admin/clients/${clientId}/points`,
    );
    expect(screen.getByRole('link', { name: 'Ver todos os agendamentos' })).toHaveAttribute(
      'href',
      `/admin/appointments?clientId=${clientId}`,
    );
    expect(screen.queryByText(clientId)).not.toBeInTheDocument();
    expect(screen.queryByText('tenant-web')).not.toBeInTheDocument();
    expect(screen.queryByText(/tenantId/)).not.toBeInTheDocument();
  });

  it('shows empty attendance and loyalty sections', async () => {
    vi.mocked(clientsService.overview).mockResolvedValue(
      detail({
        points: { balance: 0, recent: [] },
        appointments: {
          summary: { total: 0, upcoming: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 },
          upcoming: [],
          history: [],
        },
      }),
    );
    renderPage();
    expect(await screen.findByText('0 pontos')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma movimentação de pontos.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum próximo atendimento.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum atendimento encerrado.')).toBeInTheDocument();
  });
});
