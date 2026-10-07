import type { AuthUser, Paginated, ProfessionalProfile } from '@ravion/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import type { AuthService } from '../services/auth.service';
import { professionalsService } from '../services/professionals.service';
import { AdminProfessionalsPage } from './AdminProfessionalsPage';

vi.mock('../services/professionals.service', () => ({
  professionalsService: {
    list: vi.fn(),
    create: vi.fn(),
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

function profile(overrides: Partial<ProfessionalProfile> = {}): ProfessionalProfile {
  return {
    id: professionalId,
    tenantId: 'tenant-web',
    userId: 'user-1',
    displayName: 'Nando',
    isActive: true,
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
    user: {
      id: 'user-1',
      name: 'Rafael Prof',
      email: 'rafael.pro@example.com',
      role: 'PROFESSIONAL',
      isActive: true,
    },
    ...overrides,
  };
}

function page(
  data: ProfessionalProfile[],
  meta: Partial<Paginated<ProfessionalProfile>['meta']> = {},
): Paginated<ProfessionalProfile> {
  return {
    data,
    meta: { page: 1, pageSize: 20, total: data.length, pageCount: data.length === 0 ? 0 : 1, ...meta },
  };
}

function renderPage(path = '/admin/professionals'): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={authService()}>
        <AdminProfessionalsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminProfessionalsPage', () => {
  beforeEach(() => {
    vi.mocked(professionalsService.list).mockResolvedValue(page([]));
  });

  it('shows a loading state while the list is requested', () => {
    vi.mocked(professionalsService.list).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando profissionais')).toBeInTheDocument();
  });

  it('shows the request error', async () => {
    vi.mocked(professionalsService.list).mockRejectedValue(new Error('Falha na consulta'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na consulta');
  });

  it('shows an empty result', async () => {
    renderPage();
    expect(await screen.findByText('Nenhum profissional encontrado.')).toBeInTheDocument();
  });

  it('shows professionals without technical ids', async () => {
    vi.mocked(professionalsService.list).mockResolvedValue(page([profile()]));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Nando' })).toBeInTheDocument();
    expect(screen.getByText('Rafael Prof')).toBeInTheDocument();
    expect(screen.getByText('rafael.pro@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalhes' })).toHaveAttribute(
      'href',
      `/admin/professionals/${professionalId}`,
    );
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute(
      'href',
      `/admin/professionals/${professionalId}/schedule`,
    );
    expect(screen.queryByText(professionalId)).not.toBeInTheDocument();
    expect(screen.queryByText('tenant-web')).not.toBeInTheDocument();
    expect(screen.queryByText('user-1')).not.toBeInTheDocument();
  });

  it('searches and returns to the first page', async () => {
    renderPage('/admin/professionals?search=ana&page=2');
    await screen.findByText('Nenhum profissional encontrado.');
    expect(vi.mocked(professionalsService.list).mock.calls.at(-1)?.[0]).toMatchObject({
      search: 'ana',
      page: 2,
      pageSize: 20,
    });
    fireEvent.change(screen.getByLabelText('Busca'), { target: { value: 'nando' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => {
      expect(vi.mocked(professionalsService.list).mock.calls.at(-1)?.[0]).toEqual({
        search: 'nando',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('filters active professionals and returns to the first page', async () => {
    renderPage('/admin/professionals?page=3');
    await screen.findByText('Nenhum profissional encontrado.');
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'false' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => {
      expect(vi.mocked(professionalsService.list).mock.calls.at(-1)?.[0]).toEqual({
        isActive: false,
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('clears the filters', async () => {
    renderPage('/admin/professionals?search=nando&active=true');
    await screen.findByText('Nenhum profissional encontrado.');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() => {
      expect(vi.mocked(professionalsService.list).mock.calls.at(-1)?.[0]).toEqual({ page: 1, pageSize: 20 });
    });
  });

  it('moves between pages', async () => {
    vi.mocked(professionalsService.list).mockResolvedValue(page([profile()], { page: 1, pageCount: 3, total: 41 }));
    renderPage();
    expect(await screen.findByText('Página 1 de 3 · 41 profissionais')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => {
      expect(vi.mocked(professionalsService.list).mock.calls.at(-1)?.[0]).toMatchObject({ page: 2, pageSize: 20 });
    });
  });
});
