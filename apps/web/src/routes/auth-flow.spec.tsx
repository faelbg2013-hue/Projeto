import type { AuthUser } from '@ravion/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context';
import { ApiClientError } from '../services/api';
import type { AuthService } from '../services/auth.service';
import { appRoutes } from './router';

const ana: AuthUser = {
  id: 'user-1',
  tenantId: 'tenant-web',
  name: 'Ana Costa',
  email: 'ana@example.com',
  role: 'CLIENT',
  isActive: true,
};

function unauthorized(): ApiClientError {
  return new ApiClientError({
    statusCode: 401,
    message: 'Não autenticado',
    error: 'Unauthorized',
  });
}

function createService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    me: vi.fn(async () => {
      throw unauthorized();
    }),
    login: vi.fn(async () => ana),
    register: vi.fn(async () => ana),
    logout: vi.fn(async () => undefined),
    refresh: vi.fn(async () => {
      throw unauthorized();
    }),
    ...overrides,
  };
}

function renderAt(path: string, service: AuthService) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('authentication screens', () => {
  it('signs in and shows the authenticated user', async () => {
    renderAt('/login', createService());

    fireEvent.change(await screen.findByLabelText('E-mail'), {
      target: { value: 'ana@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Ana Costa' })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
  });

  it('shows the login error returned by the API', async () => {
    renderAt(
      '/login',
      createService({
        login: vi.fn(async () => {
          throw new ApiClientError({
            statusCode: 401,
            message: 'Credenciais inválidas',
            error: 'Unauthorized',
          });
        }),
      }),
    );

    fireEvent.change(await screen.findByLabelText('E-mail'), {
      target: { value: 'ana@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada-demais' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas');
  });

  it('registers a client and opens the session', async () => {
    const register = vi.fn(async () => ({ ...ana, name: 'Bruno Lima' }));
    renderAt('/register', createService({ register }));

    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Bruno Lima' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'bruno@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('heading', { name: 'Bruno Lima' })).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith({
      name: 'Bruno Lima',
      email: 'bruno@example.com',
      password: 'senha-segura',
    });
  });

  it('shows a registration error', async () => {
    renderAt(
      '/register',
      createService({
        register: vi.fn(async () => {
          throw new ApiClientError({
            statusCode: 409,
            message: 'Não foi possível concluir o cadastro.',
            error: 'Conflict',
          });
        }),
      }),
    );

    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Ana Costa' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir o cadastro.',
    );
  });

  it('sends an anonymous visitor away from the protected account page', async () => {
    renderAt('/conta', createService());

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('sends a client away from administration and the professional area', async () => {
    renderAt(
      '/admin/clients',
      createService({
        me: vi.fn(async () => ana),
      }),
    );

    expect(await screen.findByText('Sessão')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Clientes' })).not.toBeInTheDocument();
  });

  it('sends a client away from the professional area', async () => {
    renderAt(
      '/profissional',
      createService({
        me: vi.fn(async () => ana),
      }),
    );

    expect(await screen.findByText('Sessão')).toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('asks for a service name before creating one', async () => {
    const admin: AuthUser = { ...ana, role: 'ADMIN', name: 'Administrador' };
    renderAt(
      '/admin/services',
      createService({
        me: vi.fn(async () => admin),
      }),
    );

    expect(await screen.findByRole('heading', { name: 'Serviços' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Criar serviço' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o nome do serviço.');
  });

  it('logs out and returns to the login screen', async () => {
    renderAt(
      '/conta',
      createService({
        me: vi.fn(async () => ana),
      }),
    );

    expect(await screen.findByRole('heading', { name: 'Ana Costa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});
