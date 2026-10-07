import type { ClientProfile, Paginated } from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { clientsService } from '../services/clients.service';

const PAGE_SIZE = 20;

interface Filters {
  search: string;
  page: number;
}

function readFilters(params: URLSearchParams): Filters {
  const page = Number(params.get('page') ?? '1');
  return {
    search: params.get('search') ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeParams(filters: Filters): Record<string, string> {
  const next: Record<string, string> = {};
  if (filters.search.trim()) {
    next.search = filters.search.trim();
  }
  if (filters.page > 1) {
    next.page = String(filters.page);
  }
  return next;
}

export function AdminClientsPage() {
  useDocumentTitle('Clientes — Ravion Barber');
  const [params, setParams] = useSearchParams();
  const applied = readFilters(params);
  const [draft, setDraft] = useState(applied.search);
  const [page, setPage] = useState<Paginated<ClientProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const queryKey = params.toString();

  useEffect(() => {
    setDraft(readFilters(new URLSearchParams(queryKey)).search);
    setPage(null);
  }, [queryKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const filters = readFilters(new URLSearchParams(queryKey));
    clientsService
      .list({
        page: filters.page,
        pageSize: PAGE_SIZE,
        ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
      })
      .then((body) => {
        if (!active) {
          return;
        }
        setPage(body);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (active) {
          setPage(null);
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os clientes.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [queryKey, reloadKey]);

  function onSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setParams(writeParams({ search: String(form.get('search') ?? ''), page: 1 }));
  }

  function onClear(): void {
    setParams({});
  }

  function goTo(nextPage: number): void {
    setParams(writeParams({ ...applied, page: nextPage }));
  }

  async function toggle(client: ClientProfile): Promise<void> {
    setError(null);
    try {
      await clientsService.update(client.id, { isActive: !client.isActive });
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar o cliente.');
    }
  }

  const items = page?.data ?? [];
  const meta = page?.meta;
  const showPager = meta != null && meta.pageCount > 1;

  return (
    <SessionFrame eyebrow="Administração" title="Clientes" links={adminLinks}>
      <form className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end" onSubmit={onSearch}>
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Busca
          <input
            name="search"
            type="search"
            maxLength={80}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nome ou e-mail"
            className="w-full min-w-0 border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none placeholder:text-muted focus:border-accent"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="border border-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-accent"
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={onClear}
            className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
          >
            Limpar
          </button>
        </div>
      </form>
      <p className="mt-4 text-sm text-muted">A busca compara um trecho do nome ou do e-mail.</p>
      {loading && items.length === 0 ? <p className="mt-8 text-sm text-muted">Carregando clientes</p> : null}
      {error ? (
        <p role="alert" className="mt-6 text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nenhum cliente encontrado.</p>
      ) : null}
      <div className="mt-8 space-y-4">
        {items.map((client) => (
          <article key={client.id} className="min-w-0 border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="break-words text-lg text-foreground">{client.user.name}</h2>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                {client.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="mt-2 break-all text-sm text-muted">{client.user.email}</p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                to={`/admin/clients/${client.id}`}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-accent"
              >
                Ver detalhes
              </Link>
              <Link
                to={`/admin/clients/${client.id}/points`}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
              >
                Pontos
              </Link>
              <button
                type="button"
                onClick={() => void toggle(client)}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
              >
                {client.isActive ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </article>
        ))}
      </div>
      {showPager && meta ? (
        <nav aria-label="Paginação" className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => goTo(meta.page - 1)}
            className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground disabled:text-muted"
          >
            Anterior
          </button>
          <p className="text-sm text-muted">
            Página {meta.page} de {meta.pageCount} · {meta.total} clientes
          </p>
          <button
            type="button"
            disabled={meta.page >= meta.pageCount}
            onClick={() => goTo(meta.page + 1)}
            className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground disabled:text-muted"
          >
            Próxima
          </button>
        </nav>
      ) : null}
    </SessionFrame>
  );
}
