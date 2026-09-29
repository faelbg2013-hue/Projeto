import { Link } from 'react-router';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { PageMeta } from '../types/page';
import { BrandMark } from '../components/BrandMark';

const homeMeta = {
  title: 'Ravion Barber',
  description: 'Sistema de gestão para barbearia.',
} satisfies PageMeta;

export function HomePage() {
  useDocumentTitle(homeMeta.title);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-8 sm:px-8 md:px-12 lg:px-16 lg:py-12">
      <header className="flex items-center justify-between gap-4">
        <BrandMark />
        <nav className="flex items-center gap-4 text-[0.68rem] uppercase tracking-[0.28em]">
          <Link to="/login" className="text-muted">
            Entrar
          </Link>
          <Link to="/register" className="text-foreground">
            Criar conta
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-end pb-16 pt-20 md:justify-center md:pb-8 md:pt-0">
        <p className="text-[0.72rem] uppercase tracking-[0.38em] text-accent">Barbearia</p>
        <h1 className="mt-5 max-w-4xl text-balance font-display text-[clamp(3.25rem,11vw,7.25rem)] font-medium leading-[0.88] tracking-tight text-foreground">
          {homeMeta.title}
        </h1>
        <div className="mt-8 h-px w-16 bg-accent" />
        <p className="mt-8 max-w-md text-base leading-relaxed text-muted sm:text-lg">
          {homeMeta.description}
        </p>
      </section>

      <footer className="flex items-center justify-between gap-4 border-t border-line pt-5 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
        <span>Web</span>
        <span>PWA</span>
      </footer>
    </div>
  );
}
