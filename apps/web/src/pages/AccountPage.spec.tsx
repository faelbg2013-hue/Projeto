import type { AuthUser, ClientProfile } from '@ravion/types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import { clientsService } from '../services/clients.service';
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

const profile: ClientProfile = {
  id: 'client-1',
  tenantId: 'tenant-secret',
  userId: 'user-1',
  isActive: true,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  user: {
    id: 'user-1',
    name: 'Ana Costa',
    email: 'ana@example.com',
    role: 'CLIENT',
    isActive: true,
  },
};

function authService(user: AuthUser | null = ana): AuthService {
  return {
    me: vi.fn(async () => {
      if (!user) {
        throw new Error('Não autenticado');
      }
      return user;
    }),
    login: vi.fn(async () => ana),
    register: vi.fn(async () => ana),
    logout: vi.fn(async () => undefined),
    refresh: vi.fn(async () => ana),
  };
}

function renderAccount(service = authService(), path = '/conta') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('AccountPage', () => {
  beforeEach(() => {
    vi.spyOn(clientsService, 'me').mockResolvedValue(profile);
    vi.spyOn(pointsService, 'mine').mockResolvedValue({ balance: 12 });
    vi.spyOn(servicesService, 'list').mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, pageCount: 0 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks Minha conta as the current page', async () => {
    renderAccount();

    const nav = await screen.findByRole('navigation', { name: 'Área do cliente' });
    expect(within(nav).getByRole('link', { name: 'Minha conta' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Agendar' })).not.toHaveAttribute('aria-current');
  });

  it('shows a loading state while the client profile is requested', async () => {
    vi.mocked(clientsService.me).mockReturnValue(new Promise(() => undefined));
    renderAccount();

    expect(await screen.findByText('Carregando conta')).toBeInTheDocument();
  });

  it('shows the session name, email and client role', async () => {
    renderAccount();

    expect(await screen.findByRole('heading', { name: 'Ana Costa' })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Carregando conta')).not.toBeInTheDocument();
    });
    expect(clientsService.me).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly message when the profile cannot be loaded', async () => {
    vi.mocked(clientsService.me).mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1'));
    renderAccount();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados da conta.');
    expect(screen.queryByText('ECONNREFUSED')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ana Costa' })).toBeInTheDocument();
  });

  it('keeps Sair available and ignores a second click while logging out', async () => {
    const service = authService();
    vi.mocked(service.logout).mockReturnValue(new Promise(() => undefined));
    renderAccount(service);

    const button = await screen.findByRole('button', { name: 'Sair' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByRole('button', { name: 'Saindo' })).toBeDisabled();
    expect(service.logout).toHaveBeenCalledTimes(1);
  });

  it('does not reveal secrets, tenant or administrative controls', async () => {
    renderAccount(authService(), '/conta?clientId=someone-else');

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();
    expect(screen.queryByText('tenant-web')).not.toBeInTheDocument();
    expect(screen.queryByText('tenant-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('client-1')).not.toBeInTheDocument();
    expect(screen.queryByText(/senha/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desativar/i })).not.toBeInTheDocument();
  });
});
