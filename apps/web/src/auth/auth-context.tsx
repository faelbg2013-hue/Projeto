import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@ravion/types';
import {
  authService as defaultAuthService,
  type AuthService,
  type LoginInput,
  type RegisterInput,
} from '../services/auth.service';

type SessionStatus = 'loading' | 'ready';

interface AuthContextValue {
  user: AuthUser | null;
  status: SessionStatus;
  login(input: LoginInput): Promise<AuthUser>;
  register(input: RegisterInput): Promise<AuthUser>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  service = defaultAuthService,
}: {
  children: ReactNode;
  service?: AuthService;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    service
      .me()
      .then((next) => {
        if (active) {
          setUser(next);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setStatus('ready');
        }
      });

    return () => {
      active = false;
    };
  }, [service]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      async login(input) {
        const next = await service.login(input);
        setUser(next);
        return next;
      },
      async register(input) {
        const next = await service.register(input);
        setUser(next);
        return next;
      },
      async logout() {
        await service.logout();
        setUser(null);
      },
    }),
    [service, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return value;
}
