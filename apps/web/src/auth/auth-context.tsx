import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  const session = useRef(0);
  const established = useRef(false);

  useEffect(() => {
    const current = ++session.current;
    if (!established.current) {
      setStatus('loading');
    }
    service
      .me()
      .then((next) => {
        if (session.current === current) {
          established.current = true;
          setUser(next);
        }
      })
      .catch(() => {
        if (session.current === current && !established.current) {
          setUser(null);
        }
      })
      .finally(() => {
        if (session.current === current) {
          setStatus('ready');
        }
      });
  }, [service]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      async login(input) {
        const current = ++session.current;
        const next = await service.login(input);
        if (session.current === current) {
          established.current = true;
          setUser(next);
          setStatus('ready');
        }
        return next;
      },
      async register(input) {
        const current = ++session.current;
        const next = await service.register(input);
        if (session.current === current) {
          established.current = true;
          setUser(next);
          setStatus('ready');
        }
        return next;
      },
      async logout() {
        const current = ++session.current;
        established.current = false;
        await service.logout();
        if (session.current === current) {
          setUser(null);
          setStatus('ready');
        }
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
