import type { AuthUser, Paginated } from '@ravion/types';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import { appointmentsService } from '../services/appointments.service';
import { clientsService } from '../services/clients.service';
import type { AuthService } from '../services/auth.service';
import { pointsService } from '../services/points.service';
import { professionalsService } from '../services/professionals.service';
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

const destinations = [
  ['Início', '/cliente'],
  ['Agendar', '/agendar'],
  ['Meus agendamentos', '/agendamentos'],
  ['Meus pontos', '/pontos'],
  ['Minha conta', '/conta'],
] as const;

function emptyPage<TItem>(): Paginated<TItem> {
  return { data: [], meta: { page: 1, pageSize: 1, total: 0, pageCount: 0 } };
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

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(
    <AuthProvider service={authService()}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('client navigation', () => {
  beforeEach(() => {
    vi.spyOn(appointmentsService, 'mine').mockResolvedValue(emptyPage());
    vi.spyOn(pointsService, 'mine').mockResolvedValue({ balance: 0 });
    vi.spyOn(pointsService, 'mineTransactions').mockResolvedValue(emptyPage());
    vi.spyOn(servicesService, 'list').mockResolvedValue(emptyPage());
    vi.spyOn(professionalsService, 'bookable').mockResolvedValue(emptyPage());
    vi.spyOn(clientsService, 'me').mockResolvedValue({
      id: 'client-1',
      tenantId: 'tenant-web',
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
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['/cliente', 'Início'],
    ['/agendar', 'Agendar'],
    ['/agendamentos', 'Meus agendamentos'],
    ['/pontos', 'Meus pontos'],
    ['/conta', 'Minha conta'],
  ] as const)('%s shows the client navigation with %s active', async (path, activeLabel) => {
    renderAt(path);

    const nav = await screen.findByRole('navigation', { name: 'Área do cliente' });
    for (const [label, href] of destinations) {
      const link = within(nav).getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', href);
      if (label === activeLabel) {
        expect(link).toHaveAttribute('aria-current', 'page');
        expect(link.className).toContain('decoration-2');
      } else {
        expect(link).not.toHaveAttribute('aria-current');
        expect(link.className).toContain('no-underline');
      }
    }
  });
});
