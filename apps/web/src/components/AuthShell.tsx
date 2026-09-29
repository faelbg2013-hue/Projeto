import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandMark } from './BrandMark';

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8 sm:px-8">
      <header>
        <Link to="/" aria-label="Ravion Barber">
          <BrandMark />
        </Link>
      </header>
      <main className="flex flex-1 flex-col justify-center py-10">
        <p className="text-[0.72rem] uppercase tracking-[0.38em] text-accent">Conta</p>
        <h1 className="mt-4 font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">{description}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 text-sm text-muted">{footer}</div>
      </main>
    </div>
  );
}

export function AuthForm({
  onSubmit,
  children,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      {children}
    </form>
  );
}

export function TextField({
  label,
  type,
  value,
  autoComplete,
  onChange,
}: {
  label: string;
  type: 'text' | 'email' | 'password';
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
      {label}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
      />
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 bg-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-background disabled:opacity-60"
    >
      {pending ? 'Aguarde' : children}
    </button>
  );
}
