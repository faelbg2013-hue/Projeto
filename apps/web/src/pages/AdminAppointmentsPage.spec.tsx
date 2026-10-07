import type { AppointmentItem, AuthUser, Paginated } from '@ravion/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import type { AuthService } from '../services/auth.service';
import { appointmentsService } from '../services/appointments.service';
import { professionalsService } from '../services/professionals.service';
import { servicesService } from '../services/services.service';
import { AdminAppointmentsPage } from './AdminAppointmentsPage';

vi.mock('../services/appointments.service', async () => {
  const actual = await vi.importActual<typeof import('../services/appointments.service')>(
    '../services/appointments.service',
  );
  return {
    ...actual,
    appointmentsService: {
      list: vi.fn(),
      complete: vi.fn(),
      noShow: vi.fn(),
      cancel: vi.fn(),
    },
  };
});

vi.mock('../services/professionals.service', () => ({
  professionalsService: { list: vi.fn() },
}));

vi.mock('../services/services.service', () => ({
  servicesService: { list: vi.fn() },
}));

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

function appointment(overrides: Partial<AppointmentItem> = {}): AppointmentItem {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: 'tenant-web',
    clientId: 'client-1',
    professionalId: 'pro-1',
    serviceId: 'svc-1',
    clientName: 'Ana Costa',
    professionalName: 'Carlos',
    serviceName: 'Corte',
    price: '45.00',
    durationMinutes: 30,
    pointsSnapshot: 10,
    bookingMode: 'NORMAL',
    redemptionPointsSnapshot: null,
    date: '2026-10-07',
    time: '10:00',
    startAt: '2026-10-07T13:00:00.000Z',
    endAt: '2026-10-07T13:30:00.000Z',
    status: 'CONFIRMED',
    notes: null,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    cancelledAt: null,
    completedAt: null,
    ...overrides,
  };
}

function page(data: AppointmentItem[], meta: Partial<Paginated<AppointmentItem>['meta']> = {}): Paginated<AppointmentItem> {
  return {
    data,
    meta: { page: 1, pageSize: 20, total: data.length, pageCount: data.length === 0 ? 0 : 1, ...meta },
  };
}

function renderPage(path = '/admin/appointments'): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={authService()}>
        <AdminAppointmentsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminAppointmentsPage', () => {
  beforeEach(() => {
    vi.mocked(professionalsService.list).mockResolvedValue({
      data: [
        {
          id: 'pro-1',
          tenantId: 'tenant-web',
          userId: 'user-pro',
          displayName: 'Carlos',
          isActive: true,
          createdAt: '2026-10-01T12:00:00.000Z',
          updatedAt: '2026-10-01T12:00:00.000Z',
          user: {
            id: 'user-pro',
            name: 'Carlos',
            email: 'carlos@example.com',
            role: 'PROFESSIONAL',
            isActive: true,
          },
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1, pageCount: 1 },
    });
    vi.mocked(servicesService.list).mockResolvedValue({
      data: [
        {
          id: 'svc-1',
          tenantId: 'tenant-web',
          name: 'Corte',
          description: null,
          price: '45.00',
          durationMinutes: 30,
          points: 10,
          redemptionPoints: 20,
          isActive: true,
          createdAt: '2026-10-01T12:00:00.000Z',
          updatedAt: '2026-10-01T12:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1, pageCount: 1 },
    });
    vi.mocked(appointmentsService.list).mockResolvedValue(page([]));
    vi.mocked(appointmentsService.complete).mockResolvedValue(appointment({ status: 'COMPLETED' }));
    vi.mocked(appointmentsService.noShow).mockResolvedValue(appointment({ status: 'NO_SHOW' }));
    vi.mocked(appointmentsService.cancel).mockResolvedValue(appointment({ status: 'CANCELLED' }));
  });

  it('shows a loading state while the list is requested', () => {
    vi.mocked(appointmentsService.list).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando agendamentos')).toBeInTheDocument();
  });

  it('shows the request error', async () => {
    vi.mocked(appointmentsService.list).mockRejectedValue(new Error('Falha na consulta'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na consulta');
  });

  it('shows an empty result', async () => {
    renderPage();
    expect(await screen.findByText('Nenhum agendamento neste filtro.')).toBeInTheDocument();
  });

  it('shows normal and points appointments without internal ids', async () => {
    vi.mocked(appointmentsService.list).mockResolvedValue(
      page([
        appointment(),
        appointment({
          id: '22222222-2222-2222-2222-222222222222',
          time: '11:00',
          status: 'COMPLETED',
          bookingMode: 'POINTS',
          redemptionPointsSnapshot: 20,
          clientName: 'Bruno Lima',
        }),
      ]),
    );
    renderPage();
    expect(await screen.findByText('Ana Costa')).toBeInTheDocument();
    expect(screen.getByText('07/10/2026 · 10:00')).toBeInTheDocument();
    expect(screen.getAllByText('Carlos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Corte').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Confirmado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Normal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pontos').length).toBeGreaterThan(0);
    expect(screen.getByText('20 pontos utilizados')).toBeInTheDocument();
    expect(screen.getAllByText('Valor do serviço R$ 45,00')).toHaveLength(2);
    expect(screen.getAllByText('30 min')).toHaveLength(2);
    expect(screen.queryByText('11111111-1111-1111-1111-111111111111')).not.toBeInTheDocument();
    expect(screen.queryByText('tenant-web')).not.toBeInTheDocument();
    expect(screen.queryByText(/tenantId/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Concluir' })).toHaveLength(1);
  });

  it('sends the filters and returns to the first page', async () => {
    renderPage('/admin/appointments?status=CONFIRMED&page=2');
    await screen.findByText('Nenhum agendamento neste filtro.');
    await screen.findByRole('option', { name: 'Carlos' });
    expect(vi.mocked(appointmentsService.list).mock.calls.at(-1)?.[0]).toMatchObject({
      status: 'CONFIRMED',
      page: 2,
      pageSize: 20,
    });

    fireEvent.change(screen.getByLabelText('Período inicial'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Período final'), { target: { value: '2026-10-07' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CANCELLED' } });
    fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: 'pro-1' } });
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Serviço'), { target: { value: 'svc-1' } });
    fireEvent.change(screen.getByLabelText('Modalidade'), { target: { value: 'POINTS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    await waitFor(() => {
      expect(vi.mocked(appointmentsService.list).mock.calls.at(-1)?.[0]).toMatchObject({
        startDate: '2026-10-01',
        endDate: '2026-10-07',
        status: 'CANCELLED',
        professionalId: 'pro-1',
        clientName: 'Ana',
        serviceId: 'svc-1',
        bookingMode: 'POINTS',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('keeps a precise client and drops it when the name search is used', async () => {
    const clientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    renderPage(`/admin/appointments?clientId=${clientId}&page=2`);
    await screen.findByText('Nenhum agendamento neste filtro.');
    expect(screen.getByText(/A lista está restrita a um cliente/)).toBeInTheDocument();
    expect(vi.mocked(appointmentsService.list).mock.calls.at(-1)?.[0]).toMatchObject({
      clientId,
      page: 2,
      pageSize: 20,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    await waitFor(() => {
      expect(vi.mocked(appointmentsService.list).mock.calls.at(-1)?.[0]).toMatchObject({
        clientId,
        page: 1,
        pageSize: 20,
      });
    });

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    await waitFor(() => {
      expect(vi.mocked(appointmentsService.list).mock.calls.at(-1)?.[0]).toMatchObject({
        clientName: 'Ana',
        page: 1,
      });
      expect(vi.mocked(appointmentsService.list).mock.calls.at(-1)?.[0]).not.toHaveProperty('clientId');
    });
  });

  it('clears the filters', async () => {
    renderPage('/admin/appointments?status=NO_SHOW&client=Ana&from=2026-10-01&to=2026-10-07');
    await screen.findByText('Nenhum agendamento neste filtro.');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() => {
      expect(vi.mocked(appointmentsService.list).mock.calls.at(-1)?.[0]).toEqual({ page: 1, pageSize: 20 });
    });
  });

  it('moves between pages', async () => {
    vi.mocked(appointmentsService.list).mockResolvedValue(page([appointment()], { page: 1, pageCount: 3, total: 41 }));
    renderPage();
    expect(await screen.findByText('Página 1 de 3 · 41 agendamentos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => {
      expect(vi.mocked(appointmentsService.list).mock.calls.at(-1)?.[0]).toMatchObject({ page: 2, pageSize: 20 });
    });
  });

  it('disables the action while it is running and reports its error', async () => {
    vi.mocked(appointmentsService.list).mockResolvedValue(page([appointment()]));
    let settle: (value: AppointmentItem) => void = () => undefined;
    vi.mocked(appointmentsService.complete).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    renderPage();
    const conclude = await screen.findByRole('button', { name: 'Concluir' });
    const callsBefore = vi.mocked(appointmentsService.list).mock.calls.length;
    fireEvent.click(conclude);
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeDisabled();
    settle(appointment({ status: 'COMPLETED' }));
    await waitFor(() => expect(vi.mocked(appointmentsService.list).mock.calls.length).toBeGreaterThan(callsBefore));

    vi.mocked(appointmentsService.cancel).mockRejectedValue(new Error('Não foi possível cancelar'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível cancelar');
  });
});
