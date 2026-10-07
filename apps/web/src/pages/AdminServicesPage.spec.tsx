import type { AuthUser, Paginated, ServiceItem } from '@ravion/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import type { AuthService } from '../services/auth.service';
import { servicesService } from '../services/services.service';
import { AdminServicesPage } from './AdminServicesPage';

vi.mock('../services/services.service', () => ({
  servicesService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const serviceId = '11111111-1111-4111-8111-111111111111';

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

function service(overrides: Partial<ServiceItem> = {}): ServiceItem {
  return {
    id: serviceId,
    tenantId: 'tenant-web',
    name: 'Corte',
    description: 'Corte masculino',
    price: '45.00',
    durationMinutes: 90,
    points: 10,
    redemptionPoints: 50,
    isActive: true,
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
    ...overrides,
  };
}

function page(data: ServiceItem[], meta: Partial<Paginated<ServiceItem>['meta']> = {}): Paginated<ServiceItem> {
  return {
    data,
    meta: { page: 1, pageSize: 20, total: data.length, pageCount: data.length === 0 ? 0 : 1, ...meta },
  };
}

function renderPage(path = '/admin/services'): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={authService()}>
        <AdminServicesPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AdminServicesPage', () => {
  beforeEach(() => {
    vi.mocked(servicesService.list).mockReset();
    vi.mocked(servicesService.create).mockReset();
    vi.mocked(servicesService.update).mockReset();
    vi.mocked(servicesService.deactivate).mockReset();
    vi.mocked(servicesService.list).mockResolvedValue(page([]));
  });

  it('shows a loading state while the list is requested', () => {
    vi.mocked(servicesService.list).mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Carregando serviços')).toBeInTheDocument();
  });

  it('shows the request error', async () => {
    vi.mocked(servicesService.list).mockRejectedValue(new Error('Falha na consulta'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na consulta');
  });

  it('shows an empty result', async () => {
    renderPage();
    expect(await screen.findByText('Nenhum serviço encontrado.')).toBeInTheDocument();
  });

  it('shows duration, commercial value, points and redemption without technical ids', async () => {
    vi.mocked(servicesService.list).mockResolvedValue(
      page([
        service(),
        service({
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Barba',
          description: null,
          price: '30.00',
          durationMinutes: 30,
          points: 0,
          redemptionPoints: null,
          isActive: false,
        }),
        service({
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Acabamento',
          description: null,
          price: '15.00',
          durationMinutes: 60,
          points: 2,
          redemptionPoints: null,
        }),
      ]),
    );
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Corte' })).toBeInTheDocument();
    expect(screen.getByText('Corte masculino')).toBeInTheDocument();
    expect(screen.getByText('Duração 1h 30min')).toBeInTheDocument();
    expect(screen.getByText('Duração 30 min')).toBeInTheDocument();
    expect(screen.getByText('Duração 1h')).toBeInTheDocument();
    expect(screen.getByText('Valor do serviço R$ 45,00')).toBeInTheDocument();
    expect(screen.getByText('Pontos ao concluir 10')).toBeInTheDocument();
    expect(screen.getByText('Pontos para resgate 50')).toBeInTheDocument();
    expect(screen.getAllByText('Não disponível para resgate')).toHaveLength(2);
    expect(screen.getByText('Pontos ao concluir 2')).toBeInTheDocument();
    expect(screen.getByText('Valor do serviço R$ 15,00')).toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
    expect(screen.getAllByText('Ativo')).toHaveLength(2);
    expect(screen.queryByText(serviceId)).not.toBeInTheDocument();
    expect(screen.queryByText('tenant-web')).not.toBeInTheDocument();
  });

  it('searches and returns to the first page', async () => {
    renderPage('/admin/services?search=barba&page=2');
    await screen.findByText('Nenhum serviço encontrado.');
    expect(vi.mocked(servicesService.list).mock.calls.at(-1)?.[0]).toMatchObject({
      search: 'barba',
      page: 2,
      pageSize: 20,
    });
    fireEvent.change(screen.getByLabelText('Busca'), { target: { value: 'corte' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => {
      expect(vi.mocked(servicesService.list).mock.calls.at(-1)?.[0]).toEqual({
        search: 'corte',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('filters inactive services and returns to the first page', async () => {
    renderPage('/admin/services?page=3');
    await screen.findByText('Nenhum serviço encontrado.');
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'false' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => {
      expect(vi.mocked(servicesService.list).mock.calls.at(-1)?.[0]).toEqual({
        isActive: false,
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('clears the filters', async () => {
    renderPage('/admin/services?search=corte&active=true');
    await screen.findByText('Nenhum serviço encontrado.');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() => {
      expect(vi.mocked(servicesService.list).mock.calls.at(-1)?.[0]).toEqual({ page: 1, pageSize: 20 });
    });
  });

  it('moves between pages', async () => {
    vi.mocked(servicesService.list).mockResolvedValue(page([service()], { page: 1, pageCount: 3, total: 41 }));
    renderPage();
    expect(await screen.findByText('Página 1 de 3 · 41 serviços')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => {
      expect(vi.mocked(servicesService.list).mock.calls.at(-1)?.[0]).toMatchObject({ page: 2, pageSize: 20 });
    });
  });

  it('creates a service with the current fields', async () => {
    vi.mocked(servicesService.create).mockResolvedValue(service());
    renderPage();
    await screen.findByText('Nenhum serviço encontrado.');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Barba' } });
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Barba completa' } });
    fireEvent.change(screen.getByLabelText('Valor do serviço'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Duração em minutos'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Pontos ao concluir'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Pontos para resgate'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar serviço' }));
    await waitFor(() => {
      expect(servicesService.create).toHaveBeenCalledWith({
        name: 'Barba',
        description: 'Barba completa',
        price: 30,
        durationMinutes: 20,
        points: 4,
        redemptionPoints: 40,
      });
    });
  });

  it('edits the selected service', async () => {
    vi.mocked(servicesService.list).mockResolvedValue(page([service()]));
    vi.mocked(servicesService.update).mockResolvedValue(service({ name: 'Corte novo' }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Corte novo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(servicesService.update).toHaveBeenCalledWith(serviceId, {
        name: 'Corte novo',
        description: 'Corte masculino',
        price: 45,
        durationMinutes: 90,
        points: 10,
        redemptionPoints: 50,
      });
    });
  });
});
