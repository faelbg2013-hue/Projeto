import { Link } from 'react-router';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada — Ravion Barber');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-16 sm:px-8">
      <p className="text-[0.72rem] uppercase tracking-[0.38em] text-accent">404</p>
      <h1 className="mt-4 font-display text-5xl text-foreground sm:text-6xl">
        Página não encontrada
      </h1>
      <p className="mt-6 max-w-md text-muted">Esse endereço não faz parte do Ravion Barber.</p>
      <Link
        to="/"
        className="mt-10 w-fit border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
