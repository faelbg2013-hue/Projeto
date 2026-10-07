import type { AdminProfessionalDetail, AuthUser } from '@ravion/types';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import type { AuthService } from '../services/auth.service';
import { professionalsService } from '../services/professionals.service';
import { AdminProfessionalDetailPage } from './AdminProfessionalDetailPage';

vi.mock('../services/professionals.service', () => ({
  professionalsService: {
    overview: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const professionalId = '11111111-1111-4111-8111-111111111111';

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

function detail(overrides: Partial<AdminProfessionalDetail> = {}): AdminProfessionalDetail {
  return {
    displayName: 'Nando',
    name: 'Rafael Prof',
    email: 'rafael.pro@example.com',
    isActive: true,
    createdAt: '2026-01-15T15:00:00.000Z',
    services: [{ name: 'Corte', durationMinutes: 30, isActive: true, price: '45.00' }],
    week: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }],
    appointments: {
      summary: {
        total: 4,
        today: 1,
        upcoming: 1,
        pending: 0,
        confirmed: 1,
        completed: 1,
        cancelled: 1,
        noShow: 1,
      },
      upcoming: [
        {
          date: '2099-01-02',
          time: '09:00',
          clientName: 'Ana Cliente',
          serviceName: 'Corte',
          status: 'CONFIRMED',
          bookingMode: 'NORMAL',
        },
      ],
      history: [
        {
          date: '2025-06-01',
          time: '09:00',
          clientName: 'Ana Cliente',
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
    <MemoryRouter initialEntries={[`/admin/professionals/${professionalId}`]}>
      <AuthProvider service={authService()}>
        <Routes>
          <Route path="/admin/professionals/:professionalId" element={<AdminProfessionalDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminProfessionalDetailPage', () => {
  beforeEach(() => {
    vi.mocked(professionalsService.overview).mockResolvedValue(detail());
  });

  it('shows a loading state while the professional is requested', () => {
    vi.mocked(professionalsService.overview).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando profissional')).toBeInTheDocument();
  });

  it('shows the request error', async () => {
    vi.mocked(professionalsService.overview).mockRejectedValue(new Error('Recurso não encontrado'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Recurso não encontrado');
  });

  it('shows the registration, services, week and appointments', async () => {
    renderPage();
    expect(await screen.findByText('Nando')).toBeInTheDocument();
    expect(screen.getByText('Rafael Prof')).toBeInTheDocument();
    expect(screen.getByText('rafael.pro@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Ativo').length).toBeGreaterThan(0);
    expect(screen.getByText('Cadastro em 15/01/2026')).toBeInTheDocument();
    expect(screen.getAllByText('Corte').length).toBeGreaterThan(0);
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('Valor do serviço R$ 45,00')).toBeInTheDocument();
    expect(screen.getByText('Segunda')).toBeInTheDocument();
    expect(screen.getByText('09:00–18:00')).toBeInTheDocument();
    expect(screen.getByText('Quarta')).toBeInTheDocument();
    expect(screen.getAllByText('Folga').length).toBeGreaterThan(0);
    expect(screen.getByText('Hoje')).toBeInTheDocument();
    expect(screen.getAllByText('Ana Cliente').length).toBeGreaterThan(0);
    expect(screen.getByText('02/01/2099 · 09:00')).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByText('Histórico recente')).toBeInTheDocument();
    expect(screen.getByText('Barba')).toBeInTheDocument();
    expect(screen.getByText('Concluído')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurar agenda' })).toHaveAttribute(
      'href',
      `/admin/professionals/${professionalId}/schedule`,
    );
    expect(screen.getByRole('link', { name: 'Ver todos os agendamentos' })).toHaveAttribute(
      'href',
      `/admin/appointments?professionalId=${professionalId}`,
    );
    expect(screen.queryByText(professionalId)).not.toBeInTheDocument();
    expect(screen.queryByText('tenant-web')).not.toBeInTheDocument();
    expect(screen.queryByText(/tenantId/)).not.toBeInTheDocument();
  });

  it('shows empty services, week and appointments', async () => {
    vi.mocked(professionalsService.overview).mockResolvedValue(
      detail({
        services: [],
        week: [],
        appointments: {
          summary: {
            total: 0,
            today: 0,
            upcoming: 0,
            pending: 0,
            confirmed: 0,
            completed: 0,
            cancelled: 0,
            noShow: 0,
          },
          upcoming: [],
          history: [],
        },
      }),
    );
    renderPage();
    expect(await screen.findByText('Nenhum serviço cadastrado.')).toBeInTheDocument();
    expect(screen.getAllByText('Folga')).toHaveLength(7);
    expect(screen.getByText('Nenhum próximo atendimento.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum atendimento encerrado.')).toBeInTheDocument();
  });
});
