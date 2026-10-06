import type { AuthUser, BusinessHours, TenantSettingsResponse } from '@ravion/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider, useRoutes, type RouteObject } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import { clientsService } from '../services/clients.service';
import type { AuthService } from '../services/auth.service';
import { pointsService } from '../services/points.service';
import { servicesService } from '../services/services.service';
import { ApiClientError } from '../services/api';
import { settingsService } from '../services/settings.service';
import { appRoutes } from '../routes/router';

const admin: AuthUser = {
  id: 'admin-1',
  tenantId: 'tenant-web',
  name: 'Admin Ravion',
  email: 'admin@example.com',
  role: 'ADMIN',
  isActive: true,
};

const client: AuthUser = {
  ...admin,
  id: 'client-1',
  name: 'Ana Costa',
  email: 'ana@example.com',
  role: 'CLIENT',
};

const emptySettings: TenantSettingsResponse = { settings: {} };

function authService(user: AuthUser | null): AuthService {
  return {
    me: vi.fn(async () => {
      if (!user) {
        throw new Error('Não autenticado');
      }
      return user;
    }),
    login: vi.fn(async () => admin),
    register: vi.fn(async () => admin),
    logout: vi.fn(async () => undefined),
    refresh: vi.fn(async () => admin),
  };
}

function renderSettings(user: AuthUser | null = admin, path = '/admin/settings') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(
    <AuthProvider service={authService(user)}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

function savedHours(): BusinessHours {
  const open = { enabled: true as const, open: '09:30', close: '17:15' };
  return {
    monday: { ...open },
    tuesday: { ...open },
    wednesday: { ...open },
    thursday: { ...open },
    friday: { ...open },
    saturday: { enabled: true, open: '10:00', close: '14:00' },
    sunday: { enabled: false, open: null, close: null },
  };
}

describe('AdminSettingsPage', () => {
  beforeEach(() => {
    vi.spyOn(settingsService, 'get').mockResolvedValue(emptySettings);
    vi.spyOn(settingsService, 'update').mockResolvedValue(emptySettings);
    vi.spyOn(clientsService, 'me').mockResolvedValue({
      id: 'client-1',
      tenantId: 'tenant-secret',
      userId: 'client-1',
      isActive: true,
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
      user: {
        id: 'client-1',
        name: 'Ana Costa',
        email: 'ana@example.com',
        role: 'CLIENT',
        isActive: true,
      },
    });
    vi.spyOn(pointsService, 'mine').mockResolvedValue({ balance: 0 });
    vi.spyOn(servicesService, 'list').mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, pageCount: 0 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while settings are requested', async () => {
    vi.mocked(settingsService.get).mockReturnValue(new Promise(() => undefined));
    renderSettings();

    expect(await screen.findByText('Carregando configurações')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
  });

  it('shows the visual defaults when the tenant has no business hours', async () => {
    renderSettings();

    const monday = await screen.findByRole('region', { name: 'Segunda-feira' });
    expect(within(monday).getByLabelText('Início')).toHaveValue('08:00');
    expect(within(monday).getByLabelText('Fim')).toHaveValue('18:00');
    const saturday = screen.getByRole('region', { name: 'Sábado' });
    expect(within(saturday).getByLabelText('Fim')).toHaveValue('12:00');
    const sunday = screen.getByRole('region', { name: 'Domingo' });
    expect(within(sunday).getByRole('button', { name: 'Fechado' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(sunday).queryByLabelText('Início')).not.toBeInTheDocument();
    expect(settingsService.update).not.toHaveBeenCalled();
  });

  it('loads a saved configuration', async () => {
    const hours = savedHours();
    vi.mocked(settingsService.get).mockResolvedValue({ settings: { business_hours: hours } });
    renderSettings();

    const monday = await screen.findByRole('region', { name: 'Segunda-feira' });
    expect(within(monday).getByLabelText('Início')).toHaveValue('09:30');
    expect(within(monday).getByLabelText('Fim')).toHaveValue('17:15');
    expect(within(screen.getByRole('region', { name: 'Domingo' })).getByRole('button', { name: 'Fechado' })).toBeInTheDocument();
  });

  it('saves an edited opening time', async () => {
    vi.mocked(settingsService.update).mockImplementation(async (input) => ({
      settings: { business_hours: input.settings?.business_hours },
    }));
    renderSettings();

    const monday = await screen.findByRole('region', { name: 'Segunda-feira' });
    fireEvent.change(within(monday).getByLabelText('Início'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(settingsService.update).toHaveBeenCalledWith({
      settings: {
        business_hours: expect.objectContaining({
          monday: { enabled: true, open: '10:00', close: '18:00' },
          sunday: { enabled: false, open: null, close: null },
        }),
      },
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Horário de funcionamento salvo.');
  });

  it('closes a day and sends empty times', async () => {
    vi.mocked(settingsService.update).mockImplementation(async (input) => ({
      settings: { business_hours: input.settings?.business_hours },
    }));
    renderSettings();

    const monday = await screen.findByRole('region', { name: 'Segunda-feira' });
    fireEvent.click(within(monday).getByRole('button', { name: 'Aberto' }));
    expect(within(monday).getByRole('button', { name: 'Fechado' })).toBeInTheDocument();
    expect(within(monday).queryByLabelText('Início')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(settingsService.update).toHaveBeenCalledWith({
      settings: {
        business_hours: expect.objectContaining({
          monday: { enabled: false, open: null, close: null },
        }),
      },
    });
  });

  it('disables the save button while the request is pending', async () => {
    vi.mocked(settingsService.update).mockReturnValue(new Promise(() => undefined));
    renderSettings();

    fireEvent.click(await screen.findByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('button', { name: 'Salvando' })).toBeDisabled();
  });

  it('keeps the edited values when the API rejects the save', async () => {
    vi.mocked(settingsService.update).mockRejectedValue(
      new ApiClientError({ statusCode: 400, message: 'Horário inválido.', error: 'Bad Request' }),
    );
    renderSettings();

    const monday = await screen.findByRole('region', { name: 'Segunda-feira' });
    fireEvent.change(within(monday).getByLabelText('Início'), { target: { value: '11:15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Horário inválido.');
    expect(within(monday).getByLabelText('Início')).toHaveValue('11:15');
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
  });

  it('shows zero advance and saves the policies apart from the weekly hours', async () => {
    vi.mocked(settingsService.update).mockImplementation(async (input) => ({
      settings: {
        booking_min_advance_minutes: input.settings?.booking_min_advance_minutes,
        cancellation_min_advance_minutes: input.settings?.cancellation_min_advance_minutes,
      },
    }));
    renderSettings();

    expect(await screen.findByRole('heading', { name: 'Antecedência' })).toBeInTheDocument();
    expect(screen.getByText(/0 minutos = sem antecedência mínima/)).toBeInTheDocument();
    expect(screen.getByLabelText('Antecedência mínima para agendamento')).toHaveValue('0');
    expect(screen.getByLabelText('Antecedência mínima para cancelamento pelo cliente')).toHaveValue('0');
    fireEvent.change(screen.getByLabelText('Antecedência mínima para agendamento'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Antecedência mínima para cancelamento pelo cliente'), {
      target: { value: '60' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar políticas' }));

    expect(settingsService.update).toHaveBeenCalledWith({
      settings: { booking_min_advance_minutes: 120, cancellation_min_advance_minutes: 60 },
    });
    expect(await screen.findByText('Políticas de antecedência salvas.')).toBeInTheDocument();
  });

  it('lets an admin open the settings page', async () => {
    renderSettings();

    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute('href', '/admin/settings');
    expect(settingsService.get).toHaveBeenCalledTimes(1);
  });

  it('sends a client away from administrative settings', async () => {
    render(
      <AuthProvider service={authService(client)}>
        <MemoryRouter initialEntries={['/admin/settings']}>
          <Routed />
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Ana Costa' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Horário de funcionamento' })).not.toBeInTheDocument();
    expect(settingsService.get).not.toHaveBeenCalled();
    expect(adminSettingsRoles()).toEqual(['ADMIN']);
  });
});

function Routed() {
  return useRoutes(appRoutes);
}

function adminSettingsRoles(): readonly string[] | undefined {
  return findRoles(appRoutes, 'admin/settings');
}

function findRoles(routes: RouteObject[], path: string): readonly string[] | undefined {
  for (const route of routes) {
    if (route.path === path) {
      return undefined;
    }
    if (!route.children) {
      continue;
    }
    const nested = findRoles(route.children, path);
    if (nested !== undefined || route.children.some((child) => child.path === path)) {
      const roles = (route.element as { props?: { roles?: readonly string[] } } | null)?.props?.roles;
      return roles ?? nested;
    }
  }
  return undefined;
}
