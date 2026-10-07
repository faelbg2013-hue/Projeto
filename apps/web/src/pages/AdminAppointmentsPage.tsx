import type { AppointmentItem, AppointmentStatus, BookingMode, Paginated, ProfessionalProfile, ServiceItem } from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AppointmentCard } from '../components/AppointmentCard';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { appointmentsService } from '../services/appointments.service';
import { professionalsService } from '../services/professionals.service';
import { servicesService } from '../services/services.service';

const PAGE_SIZE = 20;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const statuses: Array<{ value: AppointmentStatus; label: string }> = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'NO_SHOW', label: 'Não compareceu' },
];
const modes: Array<{ value: BookingMode; label: string }> = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'POINTS', label: 'Pontos' },
];

const CLIENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Filters {
  from: string;
  to: string;
  status: '' | AppointmentStatus;
  professionalId: string;
  client: string;
  clientId: string;
  serviceId: string;
  bookingMode: '' | BookingMode;
  page: number;
}

function isStatus(value: string): value is AppointmentStatus {
  return statuses.some((option) => option.value === value);
}

function isMode(value: string): value is BookingMode {
  return value === 'NORMAL' || value === 'POINTS';
}

function readFilters(params: URLSearchParams): Filters {
  const status = params.get('status') ?? '';
  const bookingMode = params.get('bookingMode') ?? '';
  const page = Number(params.get('page') ?? '1');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  return {
    from: DATE.test(from) ? from : '',
    to: DATE.test(to) ? to : '',
    status: isStatus(status) ? status : '',
    professionalId: params.get('professionalId') ?? '',
    client: params.get('client') ?? '',
    clientId: CLIENT_ID.test(params.get('clientId') ?? '') ? (params.get('clientId') ?? '') : '',
    serviceId: params.get('serviceId') ?? '',
    bookingMode: isMode(bookingMode) ? bookingMode : '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeParams(filters: Filters): Record<string, string> {
  const next: Record<string, string> = {};
  if (filters.from) {
    next.from = filters.from;
  }
  if (filters.to) {
    next.to = filters.to;
  }
  if (filters.status) {
    next.status = filters.status;
  }
  if (filters.professionalId) {
    next.professionalId = filters.professionalId;
  }
  if (filters.client.trim()) {
    next.client = filters.client.trim();
  }
  if (filters.clientId) {
    next.clientId = filters.clientId;
  }
  if (filters.serviceId) {
    next.serviceId = filters.serviceId;
  }
  if (filters.bookingMode) {
    next.bookingMode = filters.bookingMode;
  }
  if (filters.page > 1) {
    next.page = String(filters.page);
  }
  return next;
}

export function AdminAppointmentsPage() {
  useDocumentTitle('Agendamentos — Ravion Barber');
  const [params, setParams] = useSearchParams();
  const applied = readFilters(params);
  const [professionals, setProfessionals] = useState<ProfessionalProfile[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [draft, setDraft] = useState<Filters>(applied);
  const [page, setPage] = useState<Paginated<AppointmentItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const queryKey = params.toString();

  useEffect(() => {
    setDraft(readFilters(new URLSearchParams(queryKey)));
    setPage(null);
  }, [queryKey]);

  useEffect(() => {
    let active = true;
    Promise.all([
      professionalsService.list({ pageSize: 100 }),
      servicesService.list({ pageSize: 100 }),
    ])
      .then(([professionalPage, servicePage]) => {
        if (!active) {
          return;
        }
        setProfessionals(professionalPage.data);
        setServices(servicePage.data);
      })
      .catch(() => {
        if (active) {
          setProfessionals([]);
          setServices([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const filters = readFilters(new URLSearchParams(queryKey));
    appointmentsService
      .list({
        page: filters.page,
        pageSize: PAGE_SIZE,
        ...(filters.from ? { startDate: filters.from } : {}),
        ...(filters.to ? { endDate: filters.to } : {}),
        ...(filters.professionalId ? { professionalId: filters.professionalId } : {}),
        ...(filters.client.trim() ? { clientName: filters.client.trim() } : {}),
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.bookingMode ? { bookingMode: filters.bookingMode } : {}),
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
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os agendamentos.');
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

  function onFilter(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get('status') ?? '');
    const bookingMode = String(form.get('bookingMode') ?? '');
    const client = String(form.get('client') ?? '');
    setParams(
      writeParams({
        from: String(form.get('from') ?? ''),
        to: String(form.get('to') ?? ''),
        professionalId: String(form.get('professionalId') ?? ''),
        client,
        clientId: client.trim() ? '' : applied.clientId,
        serviceId: String(form.get('serviceId') ?? ''),
        status: isStatus(status) ? status : '',
        bookingMode: isMode(bookingMode) ? bookingMode : '',
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

  const items = page?.data ?? [];
  const meta = page?.meta;
  const showPager = meta != null && meta.pageCount > 1;

  return (
    <SessionFrame eyebrow="Administração" title="Agendamentos" links={adminLinks}>
      <form className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onFilter}>
        <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Período inicial
          <input
            name="from"
            type="date"
            value={draft.from}
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            className="w-full min-w-0 border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Período final
          <input
            name="to"
            type="date"
            value={draft.to}
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            className="w-full min-w-0 border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          />
        </label>
        <FilterSelect
          name="status"
          label="Status"
          value={draft.status}
          onChange={(status) => setDraft((current) => ({ ...current, status: isStatus(status) ? status : '' }))}
          options={statuses}
        />
        <FilterSelect
          name="professionalId"
          label="Profissional"
          value={draft.professionalId}
          onChange={(professionalId) => setDraft((current) => ({ ...current, professionalId }))}
          options={professionals.map((item) => ({ value: item.id, label: item.displayName }))}
        />
        <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Cliente
          <input
            name="client"
            type="search"
            value={draft.client}
            maxLength={80}
            onChange={(event) => setDraft((current) => ({ ...current, client: event.target.value }))}
            className="w-full min-w-0 border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          />
        </label>
        <FilterSelect
          name="serviceId"
          label="Serviço"
          value={draft.serviceId}
          onChange={(serviceId) => setDraft((current) => ({ ...current, serviceId }))}
          options={services.map((item) => ({ value: item.id, label: item.name }))}
        />
        <FilterSelect
          name="bookingMode"
          label="Modalidade"
          value={draft.bookingMode}
          onChange={(bookingMode) =>
            setDraft((current) => ({ ...current, bookingMode: isMode(bookingMode) ? bookingMode : '' }))
          }
          options={modes}
        />
        <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-2">
          <button
            type="submit"
            className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
          >
            Filtrar
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
      <p className="mt-4 text-sm text-muted">
        O período usa o dia civil em America/Sao_Paulo e aceita no máximo 90 dias. O valor do serviço é o registrado no
        agendamento.
      </p>
      {applied.clientId ? (
        <p className="mt-3 text-sm text-muted">
          A lista está restrita a um cliente.{' '}
          <Link to={`/admin/clients/${applied.clientId}`} className="text-accent">
            Ver cadastro
          </Link>
        </p>
      ) : null}
      {applied.professionalId ? (
        <p className="mt-3 text-sm text-muted">
          A lista está restrita a um profissional.{' '}
          <Link to={`/admin/professionals/${applied.professionalId}`} className="text-accent">
            Ver cadastro
          </Link>
        </p>
      ) : null}
      {loading && items.length === 0 ? <p className="mt-8 text-sm text-muted">Carregando agendamentos</p> : null}
      {error ? (
        <p role="alert" className="mt-6 text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nenhum agendamento neste filtro.</p>
      ) : null}
      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <AppointmentCard
            key={item.id}
            item={item}
            showBookingMode
            showCommercialValue
            actions={
              item.status === 'CONFIRMED' ? (
                <AdminActions
                  id={item.id}
                  onDone={() => setReloadKey((value) => value + 1)}
                  onError={setError}
                />
              ) : null
            }
          />
        ))}
      </div>
      {showPager && meta ? (
        <nav aria-label="Paginação" className="mt-8 flex min-w-0 flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => goTo(meta.page - 1)}
            className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground disabled:opacity-60"
          >
            Anterior
          </button>
          <p className="text-sm text-muted">
            Página {meta.page} de {meta.pageCount} · {meta.total} agendamentos
          </p>
          <button
            type="button"
            disabled={meta.page >= meta.pageCount}
            onClick={() => goTo(meta.page + 1)}
            className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground disabled:opacity-60"
          >
            Próxima
          </button>
        </nav>
      ) : null}
    </SessionFrame>
  );
}

function FilterSelect({
  name,
  label,
  value,
  onChange,
  options,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
      {label}
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminActions({
  id,
  onDone,
  onError,
}: {
  id: string;
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setPending(true);
    onError(null);
    try {
      await action();
      onDone();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Não foi possível atualizar o agendamento.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => void run(() => appointmentsService.complete(id))}
        className="text-[0.68rem] uppercase tracking-[0.22em] text-foreground disabled:opacity-60"
      >
        Concluir
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => void run(() => appointmentsService.noShow(id))}
        className="text-[0.68rem] uppercase tracking-[0.22em] text-foreground disabled:opacity-60"
      >
        Não compareceu
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => void run(() => appointmentsService.cancel(id))}
        className="text-[0.68rem] uppercase tracking-[0.22em] text-muted disabled:opacity-60"
      >
        Cancelar
      </button>
    </>
  );
}
