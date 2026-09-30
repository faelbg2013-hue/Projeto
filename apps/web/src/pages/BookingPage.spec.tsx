import type { AppointmentItem, AuthUser, Paginated, ServiceItem } from '@ravion/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import { ApiClientError } from '../services/api';
import { appointmentsService } from '../services/appointments.service';
import type { AuthService } from '../services/auth.service';
import { pointsService } from '../services/points.service';
import { professionalsService } from '../services/professionals.service';
import { scheduleService } from '../services/schedule.service';
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

const date = '2099-06-02';

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

const inactive: ServiceItem = {
  ...corte,
  id: 'svc-off',
  name: 'Serviço inativo',
  isActive: false,
};

const created: AppointmentItem = {
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
  date,
  time: '10:00',
  startAt: '2099-06-02T13:00:00.000Z',
  endAt: '2099-06-02T13:45:00.000Z',
  status: 'CONFIRMED',
  notes: null,
  createdAt: '2026-09-30T12:00:00.000Z',
  updatedAt: '2026-09-30T12:00:00.000Z',
  cancelledAt: null,
  completedAt: null,
};

function page<TItem>(data: TItem[]): Paginated<TItem> {
  return { data, meta: { page: 1, pageSize: 100, total: data.length, pageCount: 1 } };
}

function availability(slots: string[]) {
  return {
    date,
    professionalId: 'pro-1',
    serviceId: 'svc-1',
    durationMinutes: 45,
    slots,
  };
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

function renderBooking() {
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/agendar'] });
  return render(
    <AuthProvider service={authService()}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

async function chooseProfessionalAndService() {
  fireEvent.click(await screen.findByRole('button', { name: /Caio Mendes/ }));
  fireEvent.click(await screen.findByRole('button', { name: /^Corte/ }));
}

async function chooseDateAndTime() {
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: date } });
  fireEvent.click(await screen.findByRole('button', { name: '10:00' }));
}

describe('BookingPage', () => {
  beforeEach(() => {
    vi.spyOn(professionalsService, 'bookable').mockResolvedValue(
      page([{ id: 'pro-1', displayName: 'Caio Mendes' }]),
    );
    vi.spyOn(servicesService, 'list').mockResolvedValue(page([corte, inactive]));
    vi.spyOn(pointsService, 'mine').mockResolvedValue({ balance: 100 });
    vi.spyOn(scheduleService, 'availability').mockResolvedValue(availability(['10:00', '14:30']));
    vi.spyOn(appointmentsService, 'create').mockResolvedValue(created);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the booking page for a client', async () => {
    renderBooking();

    expect(await screen.findByRole('heading', { name: 'Agendar' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Área do cliente' });
    expect(nav).toHaveTextContent('Agendar');
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent('Agendar');
  });

  it('loads bookable professionals', async () => {
    renderBooking();

    expect(await screen.findByRole('button', { name: /Caio Mendes/ })).toBeInTheDocument();
    expect(professionalsService.bookable).toHaveBeenCalledWith({ pageSize: 100 });
  });

  it('loads active services after a professional is chosen', async () => {
    renderBooking();
    fireEvent.click(await screen.findByRole('button', { name: /Caio Mendes/ }));

    expect(await screen.findByRole('button', { name: /45 min/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /R\$ 45,00/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /80 pontos/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Serviço inativo/ })).not.toBeInTheDocument();
    expect(servicesService.list).toHaveBeenCalledWith({ isActive: true, pageSize: 100 });
  });

  it('selects a professional', async () => {
    renderBooking();
    const button = await screen.findByRole('button', { name: /Caio Mendes/ });
    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('Selecionado');
  });

  it('selects a service and clears the previous time when it changes', async () => {
    renderBooking();
    await chooseProfessionalAndService();
    await chooseDateAndTime();
    expect(screen.getByRole('button', { name: '10:00' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /^Corte/ }));

    expect(screen.getByRole('button', { name: /^Corte/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '10:00', pressed: true })).not.toBeInTheDocument();
  });

  it('selects a date and loads slots for that date', async () => {
    renderBooking();
    await chooseProfessionalAndService();
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: date } });

    expect(await screen.findByRole('button', { name: '10:00' })).toBeInTheDocument();
    expect(scheduleService.availability).toHaveBeenCalledWith('pro-1', date, 'svc-1');
  });

  it('selects a time', async () => {
    renderBooking();
    await chooseProfessionalAndService();
    await chooseDateAndTime();

    expect(screen.getByRole('button', { name: '10:00' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the points balance', async () => {
    renderBooking();
    await chooseProfessionalAndService();

    expect(await screen.findByText('Saldo atual 100 pontos')).toBeInTheDocument();
  });

  it('keeps normal booking without using points', async () => {
    renderBooking();
    await chooseProfessionalAndService();
    await chooseDateAndTime();

    expect(screen.getByRole('radio', { name: /Pagar normalmente/ })).toBeChecked();
    expect(screen.getByText('Normal', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.queryByText('80 pontos serão utilizados no momento do agendamento.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
    expect(await screen.findByText('Agendamento confirmado')).toBeInTheDocument();
    expect(appointmentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ bookingMode: 'NORMAL', notes: null }),
      expect.any(String),
    );
  });

  it('books with points when the balance is enough', async () => {
    vi.mocked(appointmentsService.create).mockResolvedValue({
      ...created,
      bookingMode: 'POINTS',
      redemptionPointsSnapshot: 80,
    });
    renderBooking();
    await chooseProfessionalAndService();
    await chooseDateAndTime();
    fireEvent.click(screen.getByRole('radio', { name: 'Usar 80 pontos' }));

    expect(screen.getByText('80 pontos serão utilizados no momento do agendamento.')).toBeInTheDocument();
    expect(screen.getByText('80 pontos', { selector: 'dd' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect(await screen.findByText('Agendamento confirmado')).toBeInTheDocument();
    expect(screen.getByText('Pontos', { selector: 'dd' })).toBeInTheDocument();
    expect(appointmentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ bookingMode: 'POINTS' }),
      expect.any(String),
    );
  });

  it('blocks points redemption when the balance is insufficient', async () => {
    vi.mocked(pointsService.mine).mockResolvedValue({ balance: 10 });
    renderBooking();
    await chooseProfessionalAndService();

    expect(await screen.findByRole('radio', { name: 'Usar 80 pontos' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Pagar normalmente/ })).toBeEnabled();
    expect(screen.getByText(/São necessários 80 pontos/)).toBeInTheDocument();
  });

  it('disables confirmation until the required choices exist', async () => {
    renderBooking();

    expect(await screen.findByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
    await chooseProfessionalAndService();
    expect(screen.getByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
    await chooseDateAndTime();
    expect(screen.getByRole('button', { name: 'Confirmar agendamento' })).toBeEnabled();
  });

  it('shows a loading state while the appointment is created', async () => {
    let finish: (value: AppointmentItem) => void = () => undefined;
    vi.mocked(appointmentsService.create).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderBooking();
    await chooseProfessionalAndService();
    await chooseDateAndTime();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect(await screen.findByRole('button', { name: 'Confirmando' })).toBeDisabled();
    finish(created);
    expect(await screen.findByText('Agendamento confirmado')).toBeInTheDocument();
  });

  it('keeps the selection when creation fails', async () => {
    vi.mocked(appointmentsService.create).mockRejectedValue(
      new ApiClientError({
        statusCode: 409,
        message: 'Este horário não está mais disponível.',
        error: 'Conflict',
      }),
    );
    renderBooking();
    await chooseProfessionalAndService();
    await chooseDateAndTime();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este horário não está mais disponível.');
    expect(screen.getByRole('button', { name: /Caio Mendes/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Corte/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Data')).toHaveValue(date);
  });

  it('confirms the booking and links back to appointments and home', async () => {
    renderBooking();
    await chooseProfessionalAndService();
    await chooseDateAndTime();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect(await screen.findByText('Agendamento confirmado')).toBeInTheDocument();
    expect(screen.getByText('Caio Mendes')).toBeInTheDocument();
    expect(screen.getByText('Corte')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver meus agendamentos' })).toHaveAttribute('href', '/agendamentos');
    expect(screen.getByRole('link', { name: 'Voltar para início' })).toHaveAttribute('href', '/cliente');
  });

  it('reuses the idempotency key when confirming again after an error', async () => {
    vi.mocked(appointmentsService.create)
      .mockRejectedValueOnce(
        new ApiClientError({
          statusCode: 409,
          message: 'Este horário não está mais disponível.',
          error: 'Conflict',
        }),
      )
      .mockResolvedValueOnce(created);
    renderBooking();
    await chooseProfessionalAndService();
    await chooseDateAndTime();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
    expect(await screen.findByText('Agendamento confirmado')).toBeInTheDocument();

    const calls = vi.mocked(appointmentsService.create).mock.calls;
    expect(calls[0]?.[1]).toEqual(expect.any(String));
    expect(calls[0]?.[1]).toBe(calls[1]?.[1]);
    expect(calls[0]?.[0]).toEqual({
      professionalId: 'pro-1',
      serviceId: 'svc-1',
      date,
      time: '10:00',
      notes: null,
      bookingMode: 'NORMAL',
    });
  });
});
