import type { AuthUser, ClientProfile, Paginated } from '@ravion/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import type { AuthService } from '../services/auth.service';
import { clientsService } from '../services/clients.service';
import { AdminClientsPage } from './AdminClientsPage';

vi.mock('../services/clients.service', () => ({
  clientsService: {
    list: vi.fn(),
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

function profile(overrides: Partial<ClientProfile> = {}): ClientProfile {
  return {
    id: clientId,
    tenantId: 'tenant-web',
    userId: 'user-1',
    isActive: true,
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
    user: {
      id: 'user-1',
      name: 'Rafael Busca',
      email: 'rafael@example.com',
      role: 'CLIENT',
      isActive: true,
    },
    ...overrides,
  };
}

function page(data: ClientProfile[], meta: Partial<Paginated<ClientProfile>['meta']> = {}): Paginated<ClientProfile> {
  return {
    data,
    meta: { page: 1, pageSize: 20, total: data.length, pageCount: data.length === 0 ? 0 : 1, ...meta },
  };
}

function renderPage(path = '/admin/clients'): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={authService()}>
        <AdminClientsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminClientsPage', () => {
  beforeEach(() => {
    vi.mocked(clientsService.list).mockResolvedValue(page([]));
    vi.mocked(clientsService.update).mockResolvedValue(profile({ isActive: false }));
  });

  it('shows a loading state while the list is requested', () => {
    vi.mocked(clientsService.list).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando clientes')).toBeInTheDocument();
  });

  it('shows the request error', async () => {
    vi.mocked(clientsService.list).mockRejectedValue(new Error('Falha na consulta'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na consulta');
  });

  it('shows an empty result', async () => {
    renderPage();
    expect(await screen.findByText('Nenhum cliente encontrado.')).toBeInTheDocument();
  });

  it('shows clients without technical ids', async () => {
    vi.mocked(clientsService.list).mockResolvedValue(page([profile()]));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Rafael Busca' })).toBeInTheDocument();
    expect(screen.getByText('rafael@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalhes' })).toHaveAttribute('href', `/admin/clients/${clientId}`);
    expect(screen.queryByText(clientId)).not.toBeInTheDocument();
    expect(screen.queryByText('tenant-web')).not.toBeInTheDocument();
    expect(screen.queryByText('user-1')).not.toBeInTheDocument();
  });

  it('searches and returns to the first page', async () => {
    renderPage('/admin/clients?search=ana&page=2');
    await screen.findByText('Nenhum cliente encontrado.');
    expect(vi.mocked(clientsService.list).mock.calls.at(-1)?.[0]).toMatchObject({
      search: 'ana',
      page: 2,
      pageSize: 20,
    });
    fireEvent.change(screen.getByLabelText('Busca'), { target: { value: 'rafael' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => {
      expect(vi.mocked(clientsService.list).mock.calls.at(-1)?.[0]).toEqual({
        search: 'rafael',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('clears the search', async () => {
    renderPage('/admin/clients?search=rafael');
    await screen.findByText('Nenhum cliente encontrado.');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() => {
      expect(vi.mocked(clientsService.list).mock.calls.at(-1)?.[0]).toEqual({ page: 1, pageSize: 20 });
    });
  });

  it('moves between pages', async () => {
    vi.mocked(clientsService.list).mockResolvedValue(page([profile()], { page: 1, pageCount: 3, total: 41 }));
    renderPage();
    expect(await screen.findByText('Página 1 de 3 · 41 clientes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => {
      expect(vi.mocked(clientsService.list).mock.calls.at(-1)?.[0]).toMatchObject({ page: 2, pageSize: 20 });
    });
  });
});
