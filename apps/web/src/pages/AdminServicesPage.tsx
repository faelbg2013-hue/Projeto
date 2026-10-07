import type { Paginated, ServiceItem } from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Field } from '../components/Field';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiClientError } from '../services/api';
import { servicesService } from '../services/services.service';

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

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

function formatCommercialValue(price: string): string {
  const [whole, fraction = '00'] = price.split('.');
  return `${whole},${fraction.padEnd(2, '0').slice(0, 2)}`;
}

export function AdminServicesPage() {
  useDocumentTitle('Serviços — Ravion Barber');
  const [params, setParams] = useSearchParams();
  const applied = readFilters(params);
  const [draftSearch, setDraftSearch] = useState(applied.search);
  const [draftActive, setDraftActive] = useState(applied.active);
  const [page, setPage] = useState<Paginated<ServiceItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0.00');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [points, setPoints] = useState('0');
  const [redemptionPoints, setRedemptionPoints] = useState('');
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
    servicesService
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
          setListError(caught instanceof Error ? caught.message : 'Não foi possível carregar os serviços.');
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
    setDescription('');
    setPrice('0.00');
    setDurationMinutes('30');
    setPoints('0');
    setRedemptionPoints('');
  }

  function beginEdit(service: ServiceItem): void {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description ?? '');
    setPrice(service.price);
    setDurationMinutes(String(service.durationMinutes));
    setPoints(String(service.points));
    setRedemptionPoints(service.redemptionPoints == null ? '' : String(service.redemptionPoints));
    setFormError(null);
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
    if (!name.trim()) {
      setFormError('Informe o nome do serviço.');
      return;
    }
    const parsedPrice = Number(price);
    const parsedDuration = Number(durationMinutes);
    const parsedPoints = Number(points);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setFormError('O valor do serviço não pode ser negativo.');
      return;
    }
    if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
      setFormError('A duração deve ser maior que zero.');
      return;
    }
    if (!Number.isInteger(parsedPoints) || parsedPoints < 0) {
      setFormError('A pontuação não pode ser negativa.');
      return;
    }
    const trimmedRedemption = redemptionPoints.trim();
    const parsedRedemption = trimmedRedemption === '' ? null : Number(trimmedRedemption);
    if (parsedRedemption !== null && (!Number.isInteger(parsedRedemption) || parsedRedemption < 1)) {
      setFormError('O resgate precisa ser um inteiro maior que zero.');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      price: parsedPrice,
      durationMinutes: parsedDuration,
      points: parsedPoints,
      redemptionPoints: parsedRedemption,
    };

    setPending(true);
    try {
      if (editingId) {
        await servicesService.update(editingId, payload);
      } else {
        await servicesService.create(payload);
      }
      resetForm();
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiClientError ? caught.message : 'Não foi possível salvar o serviço.');
    } finally {
      setPending(false);
    }
  }

  async function toggle(service: ServiceItem): Promise<void> {
    setFormError(null);
    try {
      if (service.isActive) {
        await servicesService.deactivate(service.id);
      } else {
        await servicesService.update(service.id, { isActive: true });
      }
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Não foi possível atualizar o serviço.');
    }
  }

  const items = page?.data ?? [];
  const meta = page?.meta;
  const showPager = meta != null && meta.pageCount > 1;

  return (
    <SessionFrame eyebrow="Administração" title="Serviços" links={adminLinks}>
      <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field label="Nome" value={name} onChange={setName} />
        <Field label="Descrição" value={description} onChange={setDescription} />
        <Field label="Valor do serviço" value={price} onChange={setPrice} type="number" />
        <Field label="Duração em minutos" value={durationMinutes} onChange={setDurationMinutes} type="number" />
        <Field label="Pontos ao concluir" value={points} onChange={setPoints} type="number" />
        <Field label="Pontos para resgate" value={redemptionPoints} onChange={setRedemptionPoints} type="number" />
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
            {pending ? 'Aguarde' : editingId ? 'Salvar' : 'Criar serviço'}
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

      <form className="mt-10 flex flex-col gap-4" onSubmit={onSearch}>
        <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Busca
          <input
            name="search"
            type="search"
            maxLength={80}
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Nome do serviço"
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
      <p className="mt-4 text-sm text-muted">A busca compara um trecho do nome do serviço.</p>

      {loading && items.length === 0 ? <p className="mt-8 text-sm text-muted">Carregando serviços</p> : null}
      {listError ? (
        <p role="alert" className="mt-6 text-sm text-foreground">
          {listError}
        </p>
      ) : null}
      {!loading && !listError && items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nenhum serviço encontrado.</p>
      ) : null}
      <div className="mt-6 space-y-4">
        {items.map((service) => (
          <article key={service.id} className="min-w-0 border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="break-words text-lg text-foreground">{service.name}</h2>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                {service.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            {service.description ? (
              <p className="mt-2 break-words text-sm text-muted">{service.description}</p>
            ) : null}
            <p className="mt-3 text-sm text-muted">Duração {formatDuration(service.durationMinutes)}</p>
            <p className="mt-1 text-sm text-muted">Valor do serviço R$ {formatCommercialValue(service.price)}</p>
            <p className="mt-1 text-sm text-muted">Pontos ao concluir {service.points}</p>
            <p className="mt-1 text-sm text-muted">
              {service.redemptionPoints == null
                ? 'Não disponível para resgate'
                : `Pontos para resgate ${service.redemptionPoints}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => beginEdit(service)}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void toggle(service)}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-muted"
              >
                {service.isActive ? 'Desativar' : 'Ativar'}
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
            Página {meta.page} de {meta.pageCount} · {meta.total} serviços
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
