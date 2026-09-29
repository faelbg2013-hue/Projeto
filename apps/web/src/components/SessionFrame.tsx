import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { BrandMark } from './BrandMark';

export function SessionFrame({
  eyebrow,
  title,
  links,
  children,
}: {
  eyebrow: string;
  title: string;
  links: ReadonlyArray<{ to: string; label: string }>;
  children: ReactNode;
}) {
  const { logout } = useAuth();
  const [pending, setPending] = useState(false);

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
        <Link to="/conta" aria-label="Ravion Barber">
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
      <nav className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-[0.68rem] uppercase tracking-[0.28em]">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="text-muted">
            {link.label}
          </Link>
        ))}
      </nav>
      <main className="min-w-0 py-10">
        <p className="text-[0.72rem] uppercase tracking-[0.38em] text-accent">{eyebrow}</p>
        <h1 className="mt-4 break-words font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl">
          {title}
        </h1>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

export const adminLinks = [
  { to: '/admin/services', label: 'Serviços' },
  { to: '/admin/professionals', label: 'Profissionais' },
  { to: '/admin/clients', label: 'Clientes' },
  { to: '/admin/appointments', label: 'Agendamentos' },
  { to: '/conta', label: 'Conta' },
] as const;
