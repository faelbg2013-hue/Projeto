import type { AuthUser, DashboardAppointment, OperationalDashboard } from '@ravion/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import type { AuthService } from '../services/auth.service';
import { appointmentsService } from '../services/appointments.service';
import { dashboardService } from '../services/dashboard.service';
import { professionalsService } from '../services/professionals.service';
import { AdminDashboardPage } from './AdminDashboardPage';

vi.mock('../services/dashboard.service', () => ({
  dashboardService: { get: vi.fn() },
}));

vi.mock('../services/professionals.service', () => ({
  professionalsService: { list: vi.fn() },
}));

vi.mock('../services/appointments.service', async () => {
  const actual = await vi.importActual<typeof import('../services/appointments.service')>(
    '../services/appointments.service',
  );
  return {
    ...actual,
    appointmentsService: {
      complete: vi.fn(),
      noShow: vi.fn(),
      cancel: vi.fn(),
    },
  };
});

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

function appointment(overrides: Partial<DashboardAppointment> = {}): DashboardAppointment {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    date: '2026-10-07',
    time: '10:00',
    clientName: 'Ana Costa',
    professionalName: 'Carlos',
    serviceName: 'Corte',
    durationMinutes: 30,
    price: '45.00',
    status: 'CONFIRMED',
    bookingMode: 'NORMAL',
    redemptionPointsSnapshot: null,
    ...overrides,
  };
}

function dashboard(overrides: Partial<OperationalDashboard> = {}): OperationalDashboard {
  return {
    date: '2026-10-07',
    summary: {
      totalAppointments: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      servicesValue: '0.00',
      pointsRedeemed: 0,
      pointsReversed: 0,
      pointsEarned: 0,
    },
    totals: { clients: 0, activeProfessionals: 0, activeServices: 0 },
    upcoming: [],
    appointments: [],
    professionals: [],
    ...overrides,
  };
}

function renderPage(): void {
  render(
    <MemoryRouter>
      <AuthProvider service={authService()}>
        <AdminDashboardPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(professionalsService.list).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, pageCount: 0 },
    });
    vi.mocked(dashboardService.get).mockResolvedValue(dashboard());
    vi.mocked(appointmentsService.complete).mockResolvedValue({} as never);
  });

  it('shows a loading state while the dashboard is requested', () => {
    vi.mocked(dashboardService.get).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando o painel')).toBeInTheDocument();
  });

  it('shows the request error', async () => {
    vi.mocked(dashboardService.get).mockRejectedValue(new Error('Falha no painel'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha no painel');
  });

  it('shows zero cards and an empty upcoming list', async () => {
    renderPage();
    expect(await screen.findByRole('article', { name: 'Clientes' })).toHaveTextContent('0');
    expect(screen.getByRole('article', { name: 'Profissionais ativos' })).toHaveTextContent('0');
    expect(screen.getByRole('article', { name: 'Serviços ativos' })).toHaveTextContent('0');
    expect(screen.getByRole('article', { name: 'Atendimentos do dia' })).toHaveTextContent('0');
    expect(screen.getByRole('article', { name: 'Pendentes' })).toHaveTextContent('0');
    expect(screen.getByRole('article', { name: 'Confirmados' })).toHaveTextContent('0');
    expect(screen.getByText('Nenhum próximo atendimento.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeInTheDocument();
  });

  it('shows the day counts and the next normal and points appointments without internal ids', async () => {
    vi.mocked(dashboardService.get).mockResolvedValue(
      dashboard({
        summary: {
          totalAppointments: 4,
          pending: 1,
          confirmed: 1,
          completed: 1,
          cancelled: 1,
          noShow: 0,
          servicesValue: '90.00',
          pointsRedeemed: 20,
          pointsReversed: 0,
          pointsEarned: 10,
        },
        totals: { clients: 3, activeProfessionals: 2, activeServices: 4 },
        upcoming: [
          appointment({ bookingMode: 'NORMAL' }),
          appointment({
            id: '22222222-2222-2222-2222-222222222222',
            time: '11:00',
            bookingMode: 'POINTS',
            redemptionPointsSnapshot: 20,
            clientName: 'Bruno Lima',
          }),
        ],
        appointments: [appointment()],
      }),
    );
    renderPage();

    expect(await screen.findByRole('article', { name: 'Clientes' })).toHaveTextContent('3');
    expect(screen.getByRole('article', { name: 'Profissionais ativos' })).toHaveTextContent('2');
    expect(screen.getByRole('article', { name: 'Serviços ativos' })).toHaveTextContent('4');
    expect(screen.getByRole('article', { name: 'Atendimentos do dia' })).toHaveTextContent('4');
    expect(screen.getByRole('article', { name: 'Pendentes' })).toHaveTextContent('1');
    expect(screen.getByRole('article', { name: 'Concluídos' })).toHaveTextContent('1');
    expect(screen.getByRole('article', { name: 'Cancelados' })).toHaveTextContent('1');

    const upcoming = screen.getByRole('heading', { name: 'Próximos atendimentos' }).closest('section');
    expect(upcoming).not.toBeNull();
    expect(within(upcoming as HTMLElement).getByText('Normal')).toBeInTheDocument();
    expect(within(upcoming as HTMLElement).getByText('Pontos')).toBeInTheDocument();
    expect(within(upcoming as HTMLElement).getByText('Ana Costa')).toBeInTheDocument();
    expect(within(upcoming as HTMLElement).getByText('07/10/2026 · 10:00 · Corte')).toBeInTheDocument();
    expect(screen.queryByText('11111111-1111-1111-1111-111111111111')).not.toBeInTheDocument();
    expect(screen.queryByText('tenant-web')).not.toBeInTheDocument();
    expect(screen.queryByText(/tenantId/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(appointmentsService.complete).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  });
});
