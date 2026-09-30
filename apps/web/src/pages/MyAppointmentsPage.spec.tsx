import type { AppointmentItem, AuthUser, Paginated } from '@ravion/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import { appointmentsService } from '../services/appointments.service';
import type { AuthService } from '../services/auth.service';
import { appRoutes } from '../routes/router';

const ana: AuthUser = {
  id: 'user-1',
  tenantId: 'tenant-web',
  name: 'Ana Costa',
  email: 'ana@example.com',
  role: 'CLIENT',
  isActive: true,
};

function appointment(overrides: Partial<AppointmentItem> = {}): AppointmentItem {
  return {
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
    ...overrides,
  };
}

function page<TItem>(data: TItem[]): Paginated<TItem> {
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

function renderAppointments() {
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/agendamentos'] });
  return render(
    <AuthProvider service={authService()}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

function mockLists(upcoming: AppointmentItem[], history: AppointmentItem[]) {
  vi.spyOn(appointmentsService, 'mine').mockImplementation(async (query) => {
    return page(query?.view === 'history' ? history : upcoming);
  });
}

describe('MyAppointmentsPage', () => {
  beforeEach(() => {
    mockLists([], []);
    vi.spyOn(appointmentsService, 'cancel').mockResolvedValue(appointment({ status: 'CANCELLED' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks Meus agendamentos as the current page', async () => {
    renderAppointments();

    const nav = await screen.findByRole('navigation', { name: 'Área do cliente' });
    expect(within(nav).getByRole('link', { name: 'Meus agendamentos' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Agendar' })).not.toHaveAttribute('aria-current');
  });

  it('shows a loading state before the lists arrive', async () => {
    vi.mocked(appointmentsService.mine).mockReturnValue(new Promise(() => undefined));
    renderAppointments();

    expect(await screen.findByText('Carregando agendamentos')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum agendamento próximo.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Agendar agora' })).not.toBeInTheDocument();
  });

  it('shows one upcoming appointment with status, professional and normal mode', async () => {
    mockLists([appointment()], []);
    renderAppointments();

    const card = await screen.findByRole('article');
    expect(within(card).getByRole('heading', { name: 'Corte' })).toBeInTheDocument();
    expect(within(card).getByText('Caio Mendes')).toBeInTheDocument();
    expect(within(card).getByText('02/10/2026 · 14:30')).toBeInTheDocument();
    expect(within(card).getByText('Confirmado')).toBeInTheDocument();
    expect(within(card).getByText('Normal')).toBeInTheDocument();
    expect(within(card).queryByText(/pontos utilizados/)).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('lists more than one upcoming appointment', async () => {
    mockLists(
      [
        appointment(),
        appointment({ id: 'appt-2', serviceName: 'Barba', time: '16:00' }),
      ],
      [],
    );
    renderAppointments();

    expect(await screen.findByRole('heading', { name: 'Corte' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Barba' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cancelar' })).toHaveLength(2);
  });

  it('shows history without a cancel action', async () => {
    mockLists(
      [],
      [
        appointment({
          id: 'past-1',
          serviceName: 'Barba',
          status: 'COMPLETED',
          notes: 'Deixar mais curto',
          date: '2026-09-01',
          time: '09:00',
        }),
      ],
    );
    renderAppointments();

    const card = await screen.findByRole('article');
    expect(within(card).getByText('Concluído')).toBeInTheDocument();
    expect(within(card).getByText('Deixar mais curto')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum agendamento próximo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agendar agora' })).toHaveAttribute('href', '/agendar');
  });

  it('offers a booking link when there are no appointments', async () => {
    renderAppointments();

    expect(await screen.findByText('Nenhum agendamento próximo.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum agendamento no histórico.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agendar agora' })).toHaveAttribute('href', '/agendar');
  });

  it('shows the load error without the empty state', async () => {
    vi.mocked(appointmentsService.mine).mockRejectedValue(new Error('Não foi possível carregar os agendamentos.'));
    renderAppointments();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os agendamentos.');
    expect(screen.queryByText('Nenhum agendamento próximo.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Agendar agora' })).not.toBeInTheDocument();
  });

  it('cancels a confirmed appointment and refreshes both lists once', async () => {
    const confirmed = appointment();
    let upcoming = [confirmed];
    let history: AppointmentItem[] = [];
    vi.mocked(appointmentsService.mine).mockImplementation(async (query) => {
      return page(query?.view === 'history' ? history : upcoming);
    });
    vi.mocked(appointmentsService.cancel).mockImplementation(async () => {
      const cancelled = appointment({ status: 'CANCELLED', cancelledAt: '2026-09-30T18:00:00.000Z' });
      upcoming = [];
      history = [cancelled];
      return cancelled;
    });
    renderAppointments();

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
    expect(screen.getByText('Nenhum agendamento próximo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(appointmentsService.cancel).toHaveBeenCalledTimes(1);
    expect(appointmentsService.cancel).toHaveBeenCalledWith('appt-1');
    expect(appointmentsService.mine).toHaveBeenCalledTimes(4);
  });

  it('shows a loading label and ignores a second click while cancelling', async () => {
    let finish: (value: AppointmentItem) => void = () => undefined;
    vi.mocked(appointmentsService.cancel).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mockLists([appointment()], []);
    renderAppointments();

    const button = await screen.findByRole('button', { name: 'Cancelar' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByRole('button', { name: 'Cancelando' })).toBeDisabled();
    expect(appointmentsService.cancel).toHaveBeenCalledTimes(1);
    finish(appointment({ status: 'CANCELLED' }));
    expect(await screen.findByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('keeps the appointment when cancellation fails', async () => {
    mockLists([appointment({ notes: 'Janela' })], []);
    vi.mocked(appointmentsService.cancel).mockRejectedValue(new Error('Este agendamento não pode ser cancelado.'));
    renderAppointments();

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este agendamento não pode ser cancelado.');
    expect(screen.getByRole('heading', { name: 'Corte' })).toBeInTheDocument();
    expect(screen.getByText('Janela')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('shows points mode from the appointment without calculating a balance', async () => {
    mockLists(
      [
        appointment({
          bookingMode: 'POINTS',
          redemptionPointsSnapshot: 80,
        }),
      ],
      [],
    );
    renderAppointments();

    const card = await screen.findByRole('article');
    expect(within(card).getByText('Pontos')).toBeInTheDocument();
    expect(within(card).getByText('80 pontos utilizados')).toBeInTheDocument();
    expect(within(card).queryByText(/saldo/i)).not.toBeInTheDocument();
  });

  it('does not render a note when the appointment has none', async () => {
    mockLists([appointment({ notes: null })], [appointment({ id: 'past-1', status: 'NO_SHOW', notes: null })]);
    renderAppointments();

    expect(await screen.findByText('Não compareceu')).toBeInTheDocument();
    expect(screen.queryByText('Janela')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });
});
