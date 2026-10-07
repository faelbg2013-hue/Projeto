import type { Paginated, ProfessionalProfile } from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Field } from '../components/Field';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiClientError } from '../services/api';
import { professionalsService } from '../services/professionals.service';

const PAGE_SIZE = 20;

interface Filters {
  search: string;
  active: '' | 'true' | 'false';
  page: number;
}

function readFilters(params: URLSearchParams): Filters {
  const page = Number(params.get('page') ?? '1');
  const active = params.get('active') ?? '';
  return {
    search: params.get('search') ?? '',
    active: active === 'true' || active === 'false' ? active : '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeParams(filters: Filters): Record<string, string> {
  const next: Record<string, string> = {};
  if (filters.search.trim()) {
    next.search = filters.search.trim();
  }
  if (filters.active) {
    next.active = filters.active;
  }
  if (filters.page > 1) {
    next.page = String(filters.page);
  }
  return next;
}

export function AdminProfessionalsPage() {
  useDocumentTitle('Profissionais — Ravion Barber');
  const [params, setParams] = useSearchParams();
  const applied = readFilters(params);
  const [draftSearch, setDraftSearch] = useState(applied.search);
  const [draftActive, setDraftActive] = useState(applied.active);
  const [page, setPage] = useState<Paginated<ProfessionalProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const queryKey = params.toString();

  useEffect(() => {
    const filters = readFilters(new URLSearchParams(queryKey));
    setDraftSearch(filters.search);
    setDraftActive(filters.active);
    setPage(null);
  }, [queryKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const filters = readFilters(new URLSearchParams(queryKey));
    professionalsService
      .list({
        page: filters.page,
        pageSize: PAGE_SIZE,
        ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.active ? { isActive: filters.active === 'true' } : {}),
      })
      .then((body) => {
        if (!active) {
          return;
        }
        setPage(body);
        setListError(null);
      })
      .catch((caught: unknown) => {
        if (active) {
          setPage(null);
          setListError(
            caught instanceof Error ? caught.message : 'Não foi possível carregar os profissionais.',
          );
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

  function resetForm(): void {
    setEditingId(null);
    setName('');
    setEmail('');
    setPassword('');
    setDisplayName('');
  }

  function onSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const active = String(form.get('active') ?? '');
    setParams(
      writeParams({
        search: String(form.get('search') ?? ''),
        active: active === 'true' || active === 'false' ? active : '',
        page: 1,
      }),
    );
  }

  function onClear(): void {
    setParams({});
  }

  function goTo(nextPage: number): void {
    setParams(writeParams({ ...applied, page: nextPage }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    if (displayName.trim().length < 2) {
      setFormError('Informe o nome de exibição.');
      return;
    }
    if (!editingId) {
      if (name.trim().length < 2) {
        setFormError('Informe o nome.');
        return;
      }
      if (!email.includes('@')) {
        setFormError('Informe um e-mail válido.');
        return;
      }
      if (password.length < 8) {
        setFormError('A senha precisa ter pelo menos 8 caracteres.');
        return;
      }
    }
    setPending(true);
    try {
      if (editingId) {
        await professionalsService.update(editingId, { displayName: displayName.trim() });
      } else {
        await professionalsService.create({
          name: name.trim(),
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
      }
      resetForm();
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setFormError(
        caught instanceof ApiClientError
          ? caught.message
          : 'Não foi possível salvar o profissional.',
      );
    } finally {
      setPending(false);
    }
  }

  async function toggle(professional: ProfessionalProfile): Promise<void> {
    setFormError(null);
    try {
      if (professional.isActive) {
        await professionalsService.deactivate(professional.id);
      } else {
        await professionalsService.update(professional.id, { isActive: true });
      }
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'Não foi possível atualizar o profissional.',
      );
    }
  }

  const items = page?.data ?? [];
  const meta = page?.meta;
  const showPager = meta != null && meta.pageCount > 1;

  return (
    <SessionFrame eyebrow="Administração" title="Profissionais" links={adminLinks}>
      <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)} noValidate>
        {editingId ? null : (
          <>
            <Field label="Nome completo" value={name} onChange={setName} autoComplete="name" />
            <Field
              label="E-mail"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="off"
            />
            <Field
              label="Senha"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="new-password"
            />
          </>
        )}
        <Field label="Nome de exibição" value={displayName} onChange={setDisplayName} />
        {formError ? (
          <p role="alert" className="text-sm normal-case tracking-normal text-foreground">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-background disabled:opacity-60"
          >
            {pending ? 'Aguarde' : editingId ? 'Salvar' : 'Criar profissional'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-muted"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <form className="mt-10 flex min-w-0 flex-col gap-4" onSubmit={onSearch}>
        <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Busca
          <input
            name="search"
            type="search"
            maxLength={80}
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Nome ou e-mail"
            className="w-full min-w-0 border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none placeholder:text-muted focus:border-accent"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Situação
          <select
            name="active"
            value={draftActive}
            onChange={(event) => {
              const value = event.target.value;
              setDraftActive(value === 'true' || value === 'false' ? value : '');
            }}
            className="w-full min-w-0 border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
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
      <p className="mt-4 text-sm text-muted">A busca compara um trecho do nome de exibição, do nome ou do e-mail.</p>

      {loading && items.length === 0 ? <p className="mt-8 text-sm text-muted">Carregando profissionais</p> : null}
      {listError ? (
        <p role="alert" className="mt-6 text-sm text-foreground">
          {listError}
        </p>
      ) : null}
      {!loading && !listError && items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nenhum profissional encontrado.</p>
      ) : null}
      <div className="mt-6 space-y-4">
        {items.map((professional) => (
          <article key={professional.id} className="min-w-0 border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="break-words text-lg text-foreground">{professional.displayName}</h2>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                {professional.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="mt-2 break-words text-sm text-muted">{professional.user.name}</p>
            <p className="mt-1 break-all text-sm text-muted">{professional.user.email}</p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                to={`/admin/professionals/${professional.id}`}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-accent"
              >
                Ver detalhes
              </Link>
              <Link
                to={`/admin/professionals/${professional.id}/schedule`}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
              >
                Agenda
              </Link>
              <button
                type="button"
                onClick={() => {
                  setEditingId(professional.id);
                  setDisplayName(professional.displayName);
                  setFormError(null);
                }}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void toggle(professional)}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-muted"
              >
                {professional.isActive ? 'Desativar' : 'Ativar'}
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
            Página {meta.page} de {meta.pageCount} · {meta.total} profissionais
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
