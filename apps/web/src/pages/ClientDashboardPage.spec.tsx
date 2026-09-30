import type { AppointmentItem, AuthUser, Paginated, ServiceItem } from '@ravion/types';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import { appointmentsService } from '../services/appointments.service';
import type { AuthService } from '../services/auth.service';
import { pointsService } from '../services/points.service';
import { servicesService } from '../services/services.service';
import { appRoutes } from '../routes/router';

const ana: AuthUser = {
  id: 'user-1',
  tenantId: 'tenant-web',
  name: 'Ana Costa',
  email: 'ana@example.com',
  role: 'CLIENT',
  isActive: true,
};

const appointment: AppointmentItem = {
  id: 'appt-1',
  tenantId: 'tenant-web',
  clientId: 'user-1',
  professionalId: 'pro-1',
  serviceId: 'svc-1',
  clientName: 'Ana Costa',
  professionalName: 'Caio Mendes',
  serviceName: 'Corte',
  price: '45.00',
  durationMinutes: 45,
  pointsSnapshot: 10,
  bookingMode: 'NORMAL',
  redemptionPointsSnapshot: null,
  date: '2026-10-02',
  time: '14:30',
  startAt: '2026-10-02T17:30:00.000Z',
  endAt: '2026-10-02T18:15:00.000Z',
  status: 'CONFIRMED',
  notes: null,
  createdAt: '2026-09-30T12:00:00.000Z',
  updatedAt: '2026-09-30T12:00:00.000Z',
  cancelledAt: null,
  completedAt: null,
};

const corte: ServiceItem = {
  id: 'svc-1',
  tenantId: 'tenant-web',
  name: 'Corte',
  description: null,
  price: '45.00',
  durationMinutes: 45,
  points: 10,
  redemptionPoints: 80,
  isActive: true,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
};

const barba: ServiceItem = {
  id: 'svc-2',
  tenantId: 'tenant-web',
  name: 'Barba',
  description: null,
  price: '30.00',
  durationMinutes: 30,
  points: 6,
  redemptionPoints: null,
  isActive: true,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
};

function page<TItem>(data: TItem[]): Paginated<TItem> {
  return {
    data,
    meta: { page: 1, pageSize: 6, total: data.length, pageCount: data.length === 0 ? 0 : 1 },
  };
}

function authService(user: AuthUser = ana): AuthService {
  return {
    me: vi.fn(async () => user),
    login: vi.fn(async () => user),
    register: vi.fn(async () => user),
    logout: vi.fn(async () => undefined),
    refresh: vi.fn(async () => user),
  };
}

function renderDashboard() {
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/cliente'] });
  return render(
    <AuthProvider service={authService()}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('ClientDashboardPage', () => {
  beforeEach(() => {
    vi.spyOn(appointmentsService, 'mine').mockResolvedValue(page([]));
    vi.spyOn(pointsService, 'mine').mockResolvedValue({ balance: 42 });
    vi.spyOn(servicesService, 'list').mockResolvedValue(page([corte, barba]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the dashboard for a client', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Olá, Ana Costa' })).toBeInTheDocument();
    expect(appointmentsService.mine).toHaveBeenCalledWith({ view: 'upcoming', pageSize: 1 });
    expect(pointsService.mine).toHaveBeenCalledWith();
    expect(servicesService.list).toHaveBeenCalledWith({ isActive: true, pageSize: 6 });
  });

  it('shows the next appointment when one exists', async () => {
    vi.mocked(appointmentsService.mine).mockResolvedValue(page([appointment]));
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Corte' })).toBeInTheDocument();
    expect(screen.getByText('Caio Mendes')).toBeInTheDocument();
    expect(screen.getByText('02/10/2026 · 14:30')).toBeInTheDocument();
    expect(screen.getByText('45 min · R$ 45,00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver meus agendamentos' })).toHaveAttribute(
      'href',
      '/agendamentos',
    );
    expect(screen.queryByText('Você ainda não tem agendamentos.')).not.toBeInTheDocument();
  });

  it('shows the empty appointment state', async () => {
    renderDashboard();

    expect(await screen.findByText('Você ainda não tem agendamentos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agendar agora' })).toHaveAttribute('href', '/agendar');
    expect(screen.queryByRole('link', { name: 'Ver meus agendamentos' })).not.toBeInTheDocument();
  });

  it('shows the points balance', async () => {
    renderDashboard();

    expect(await screen.findByText('Pontos disponíveis')).toBeInTheDocument();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver meus pontos' })).toHaveAttribute('href', '/pontos');
  });

  it('shows active services', async () => {
    renderDashboard();

    expect(await screen.findByText('Barba')).toBeInTheDocument();
    expect(screen.getByText('Corte')).toBeInTheDocument();
    expect(screen.getByText('45 min · R$ 45,00 ou 80 pontos')).toBeInTheDocument();
    expect(screen.getByText('30 min · R$ 30,00')).toBeInTheDocument();
  });

  it('includes the main client links', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Olá, Ana Costa' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/cliente');
    expect(screen.getAllByRole('link', { name: 'Agendar' }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: 'Meus agendamentos' }).every((link) => link.getAttribute('href') === '/agendamentos'),
    ).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Meus pontos' }).some((link) => link.getAttribute('href') === '/pontos')).toBe(
      true,
    );
    expect(
      screen.getAllByRole('link', { name: 'Minha conta' }).every((link) => link.getAttribute('href') === '/conta'),
    ).toBe(true);
  });

  it('keeps the other sections when appointments fail', async () => {
    vi.mocked(appointmentsService.mine).mockRejectedValue(
      new Error('Não foi possível carregar os agendamentos.'),
    );
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os agendamentos.',
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Barba')).toBeInTheDocument();
    expect(screen.queryByText('Você ainda não tem agendamentos.')).not.toBeInTheDocument();
  });
});
