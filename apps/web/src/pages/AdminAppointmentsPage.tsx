import type {
  AppointmentItem,
  AppointmentStatus,
  ClientProfile,
  ProfessionalProfile,
  ServiceItem,
} from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { AppointmentCard } from '../components/AppointmentCard';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { appointmentsService } from '../services/appointments.service';
import { clientsService } from '../services/clients.service';
import { professionalsService } from '../services/professionals.service';
import { servicesService } from '../services/services.service';

const statuses: Array<{ value: '' | AppointmentStatus; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'NO_SHOW', label: 'Não compareceu' },
];

interface Filters {
  professionalId: string;
  clientId: string;
  serviceId: string;
  date: string;
  status: '' | AppointmentStatus;
}

const emptyFilters: Filters = {
  professionalId: '',
  clientId: '',
  serviceId: '',
  date: '',
  status: '',
};

export function AdminAppointmentsPage() {
  useDocumentTitle('Agendamentos — Ravion Barber');
  const [professionals, setProfessionals] = useState<ProfessionalProfile[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      professionalsService.list({ pageSize: 100 }),
      clientsService.list({ pageSize: 100 }),
      servicesService.list({ pageSize: 100 }),
    ])
      .then(([professionalPage, clientPage, servicePage]) => {
        if (!active) {
          return;
        }
        setProfessionals(professionalPage.data);
        setClients(clientPage.data);
        setServices(servicePage.data);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os filtros.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    appointmentsService
      .list({
        pageSize: 50,
        ...(applied.professionalId ? { professionalId: applied.professionalId } : {}),
        ...(applied.clientId ? { clientId: applied.clientId } : {}),
        ...(applied.serviceId ? { serviceId: applied.serviceId } : {}),
        ...(applied.date ? { date: applied.date } : {}),
        ...(applied.status ? { status: applied.status } : {}),
      })
      .then((page) => {
        if (active) {
          setItems(page.data);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setItems([]);
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
  }, [applied, reloadKey]);

  function onFilter(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setApplied({
      professionalId: String(form.get('professionalId') ?? ''),
      clientId: String(form.get('clientId') ?? ''),
      serviceId: String(form.get('serviceId') ?? ''),
      date: String(form.get('date') ?? ''),
      status: String(form.get('status') ?? '') as Filters['status'],
    });
  }

  return (
    <SessionFrame eyebrow="Administração" title="Agendamentos" links={adminLinks}>
      <form className="grid min-w-0 gap-4 sm:grid-cols-2" onSubmit={onFilter}>
        <FilterSelect
          name="professionalId"
          label="Profissional"
          value={draft.professionalId}
          onChange={(professionalId) => setDraft((current) => ({ ...current, professionalId }))}
          options={professionals.map((item) => ({ value: item.id, label: item.displayName }))}
        />
        <FilterSelect
          name="clientId"
          label="Cliente"
          value={draft.clientId}
          onChange={(clientId) => setDraft((current) => ({ ...current, clientId }))}
          options={clients.map((item) => ({ value: item.id, label: item.user.name }))}
        />
        <FilterSelect
          name="serviceId"
          label="Serviço"
          value={draft.serviceId}
          onChange={(serviceId) => setDraft((current) => ({ ...current, serviceId }))}
          options={services.map((item) => ({ value: item.id, label: item.name }))}
        />
        <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Data
          <input
            name="date"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
            className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          />
        </label>
        <FilterSelect
          name="status"
          label="Status"
          value={draft.status}
          onChange={(status) =>
            setDraft((current) => ({ ...current, status: status as Filters['status'] }))
          }
          options={statuses.filter((option) => option.value !== '').map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
        <div className="flex items-end">
          <button
            type="submit"
            className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
          >
            Filtrar
          </button>
        </div>
      </form>
      {loading ? <p className="mt-8 text-sm text-muted">Carregando agendamentos</p> : null}
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
        className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
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
