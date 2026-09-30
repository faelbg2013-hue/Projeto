import type { AuthUser, ServiceItem, UserRole } from '@ravion/types';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { BrandMark } from '../components/BrandMark';
import { ClientNavigation } from '../components/ClientNavigation';
import { PointsCard } from '../components/PointsCard';
import { ServiceCatalog } from '../components/ServiceCatalog';
import { useActiveServices } from '../hooks/useActiveServices';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { clientsService } from '../services/clients.service';

const roleLabels: Record<UserRole, string> = {
  CLIENT: 'Cliente',
  PROFESSIONAL: 'Profissional',
  ADMIN: 'Administrador',
};

const accountLinks: Record<
  Exclude<UserRole, 'CLIENT'>,
  ReadonlyArray<{ to: string; label: string }>
> = {
  PROFESSIONAL: [
    { to: '/profissional', label: 'Área profissional' },
    { to: '/profissional/agenda', label: 'Agenda' },
    { to: '/profissional/agenda/semana', label: 'Horário semanal' },
    { to: '/profissional/agendamentos', label: 'Agendamentos' },
  ],
  ADMIN: [
    { to: '/admin/dashboard', label: 'Painel' },
    { to: '/admin/services', label: 'Serviços' },
    { to: '/admin/professionals', label: 'Profissionais' },
    { to: '/admin/clients', label: 'Clientes' },
    { to: '/admin/appointments', label: 'Agendamentos' },
  ],
};

export function AccountPage() {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(false);
  const catalog = useActiveServices();
  useDocumentTitle(user ? `${user.name} — Ravion Barber` : 'Conta — Ravion Barber');

  if (!user) {
    return null;
  }

  if (user.role === 'CLIENT') {
    return <ClientAccount user={user} logout={logout} catalog={catalog} />;
  }

  async function onLogout(): Promise<void> {
    setPending(true);
    try {
      await logout();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8 sm:px-8 md:px-12">
      <header className="flex items-center justify-between gap-4">
        <Link to="/" aria-label="Ravion Barber">
          <BrandMark />
        </Link>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={pending}
          className="text-[0.68rem] uppercase tracking-[0.28em] text-muted"
        >
          Sair
        </button>
      </header>
      <section className="flex flex-1 flex-col justify-end py-16 md:justify-center">
        <p className="text-[0.72rem] uppercase tracking-[0.38em] text-accent">Sessão</p>
        <h1 className="mt-5 font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl md:text-7xl">
          {user.name}
        </h1>
        <dl className="mt-10 max-w-md space-y-4 text-sm">
          <AccountRow label="E-mail" value={user.email} />
          <AccountRow label="Perfil" value={roleLabels[user.role]} />
        </dl>
        <nav className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-[0.68rem] uppercase tracking-[0.28em]">
          {accountLinks[user.role].map((link) => (
            <Link key={link.to} to={link.to} className="text-accent">
              {link.label}
            </Link>
          ))}
        </nav>
        <ServiceCatalog
          services={catalog.services}
          loading={catalog.loading}
          error={catalog.error}
        />
        {import.meta.env.DEV ? <DevTenant user={user} /> : null}
      </section>
    </div>
  );
}

function ClientAccount({
  user,
  logout,
  catalog,
}: {
  user: AuthUser;
  logout: () => Promise<void>;
  catalog: { services: ServiceItem[]; loading: boolean; error: string | null };
}) {
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    let active = true;
    setProfileLoading(true);
    setProfileError(null);
    clientsService
      .me()
      .then(() => undefined)
      .catch(() => {
        if (active) {
          setProfileError('Não foi possível carregar os dados da conta.');
        }
      })
      .finally(() => {
        if (active) {
          setProfileLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function onLogout(): Promise<void> {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    setPending(true);
    try {
      await logout();
    } finally {
      leaving.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-3xl flex-col px-5 py-8 sm:px-8 md:px-12">
      <header className="flex items-center justify-between gap-4">
        <Link to="/" aria-label="Ravion Barber">
          <BrandMark />
        </Link>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={pending}
          aria-busy={pending}
          className="min-h-11 text-[0.68rem] uppercase tracking-[0.28em] text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground disabled:opacity-60"
        >
          {pending ? 'Saindo' : 'Sair'}
        </button>
      </header>
      <ClientNavigation />
      <section className="flex min-w-0 flex-1 flex-col justify-end py-16 md:justify-center">
        <p className="text-[0.72rem] uppercase tracking-[0.38em] text-accent">Sessão</p>
        <h1 className="mt-5 break-words font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl md:text-7xl">
          {user.name}
        </h1>
        {profileLoading ? <p className="mt-6 text-sm text-muted">Carregando conta</p> : null}
        {profileError ? (
          <p role="alert" className="mt-6 text-sm text-foreground">
            {profileError}
          </p>
        ) : null}
        <dl className="mt-10 max-w-md space-y-4 text-sm">
          <AccountRow label="E-mail" value={user.email} />
          <AccountRow label="Perfil" value={roleLabels[user.role]} />
        </dl>
        <PointsCard />
        <ServiceCatalog services={catalog.services} loading={catalog.loading} error={catalog.error} />
      </section>
    </div>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-4">
      <dt className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">{label}</dt>
      <dd className="mt-2 break-all text-base text-foreground">{value}</dd>
    </div>
  );
}

function DevTenant({ user }: { user: AuthUser }) {
  return (
    <p className="mt-8 text-xs text-muted">
      Diagnóstico de desenvolvimento. Contexto: {user.tenantId}
    </p>
  );
}
