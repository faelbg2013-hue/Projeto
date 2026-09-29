import type { UserRole } from '@ravion/types';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from './auth-context';

export function RequireRole({ roles }: { roles: readonly UserRole[] }) {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return <p className="px-5 py-8 text-sm text-muted">Carregando sessão</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/conta" replace />;
  }

  return <Outlet />;
}
