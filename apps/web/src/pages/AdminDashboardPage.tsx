import type { AppointmentStatus, OperationalDashboard, ProfessionalProfile } from '@ravion/types';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { appointmentStatusLabel, appointmentsService, civilDate, money } from '../services/appointments.service';
import { dashboardService } from '../services/dashboard.service';
import { professionalsService } from '../services/professionals.service';

interface Filters {
  date: string;
  professionalId: string;
  status: '' | AppointmentStatus;
}

const emptyFilters: Filters = { date: '', professionalId: '', status: '' };

const statusOptions: Array<{ value: Filters['status']; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'CONFIRMED', label: 'Confirmados' },
  { value: 'COMPLETED', label: 'Concluídos' },
  { value: 'CANCELLED', label: 'Cancelados' },
  { value: 'NO_SHOW', label: 'Não compareceu' },
];

export function AdminDashboardPage() {
  useDocumentTitle('Painel — Ravion Barber');
  const [professionals, setProfessionals] = useState<ProfessionalProfile[]>([]);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [dashboard, setDashboard] = useState<OperationalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    professionalsService
      .list({ isActive: true, pageSize: 100 })
      .then((page) => {
        if (active) {
          setProfessionals(page.data);
        }
      })
      .catch(() => {
        if (active) {
          setProfessionals([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    dashboardService
      .get({
        ...(applied.date ? { date: applied.date } : {}),
        ...(applied.professionalId ? { professionalId: applied.professionalId } : {}),
        ...(applied.status ? { status: applied.status } : {}),
      })
      .then((body) => {
        if (!active) {
          return;
        }
        setDashboard(body);
        setError(null);
        setDraft((current) => (current.date === '' && applied.date === '' ? { ...current, date: body.date } : current));
      })
      .catch((caught: unknown) => {
        if (active) {
          setDashboard(null);
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o painel.');
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
    const next: Filters = {
      date: String(form.get('date') ?? ''),
      professionalId: String(form.get('professionalId') ?? ''),
      status: String(form.get('status') ?? '') as Filters['status'],
    };
    setDraft(next);
    setApplied(next);
  }

  function onToday(): void {
    const next = { ...draft, date: '' };
    setDraft(next);
    setApplied(next);
  }

  return (
    <SessionFrame eyebrow="Administração" title="Painel" links={adminLinks}>
      <form className="grid min-w-0 gap-4 sm:grid-cols-2" onSubmit={onFilter}>
        <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Data
          <input
            name="date"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
            className="w-full min-w-0 border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          />
        </label>
        <FilterSelect
          name="professionalId"
          label="Profissional"
          value={draft.professionalId}
          onChange={(professionalId) => setDraft((current) => ({ ...current, professionalId }))}
          options={professionals.map((item) => ({ value: item.id, label: item.displayName }))}
        />
        <FilterSelect
          name="status"
          label="Status"
          value={draft.status}
          onChange={(status) => setDraft((current) => ({ ...current, status: status as Filters['status'] }))}
          options={statusOptions.filter((option) => option.value !== '')}
        />
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="submit"
            className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={onToday}
            className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
          >
            Atualizar
          </button>
        </div>
      </form>
      {loading ? <p className="mt-8 text-sm text-muted">Carregando o painel</p> : null}
      {error ? (
        <p role="alert" className="mt-6 text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {dashboard ? (
        <div className="mt-8 min-w-0 space-y-10">
          <p className="text-sm text-muted">Dia {civilDate(dashboard.date)}, em America/Sao_Paulo.</p>
          <section aria-label="Estabelecimento" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Clientes" value={String(dashboard.totals.clients)} />
            <Metric label="Profissionais ativos" value={String(dashboard.totals.activeProfessionals)} />
            <Metric label="Serviços ativos" value={String(dashboard.totals.activeServices)} />
          </section>
          <section aria-label="Resumo do dia" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Atendimentos do dia" value={String(dashboard.summary.totalAppointments)} />
            <Metric label="Pendentes" value={String(dashboard.summary.pending)} />
            <Metric label="Confirmados" value={String(dashboard.summary.confirmed)} />
            <Metric label="Concluídos" value={String(dashboard.summary.completed)} />
            <Metric label="Cancelados" value={String(dashboard.summary.cancelled)} />
            <Metric label="Não compareceu" value={String(dashboard.summary.noShow)} />
            <Metric label="Valor dos serviços" value={money(dashboard.summary.servicesValue)} />
            <Metric label="Pontos utilizados" value={String(dashboard.summary.pointsRedeemed)} />
            <Metric label="Pontos devolvidos" value={String(dashboard.summary.pointsReversed)} />
            <Metric label="Pontos concedidos" value={String(dashboard.summary.pointsEarned)} />
          </section>
          <p className="text-sm text-muted">
            O valor dos serviços é o preço registrado no agendamento. O Ravion Barber não processa pagamentos.
          </p>
          <section className="min-w-0">
            <h2 className="font-display text-3xl text-foreground">Próximos atendimentos</h2>
            {dashboard.upcoming.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nenhum próximo atendimento.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {dashboard.upcoming.map((item) => (
                  <DayCard key={item.id} item={item} points="upcoming" />
                ))}
              </div>
            )}
          </section>
          <section className="min-w-0">
            <h2 className="font-display text-3xl text-foreground">Atendimentos por profissional</h2>
            {dashboard.professionals.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nenhum profissional com atendimento neste dia.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {dashboard.professionals.map((item) => (
                  <article key={item.professionalId} className="min-w-0 border border-line bg-surface p-4">
                    <h3 className="break-words text-lg text-foreground">{item.name}</h3>
                    <dl className="mt-3 space-y-1 text-sm text-muted">
                      <div className="flex justify-between gap-3">
                        <dt>Atendimentos</dt>
                        <dd className="text-foreground">{item.appointments}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Concluídos</dt>
                        <dd className="text-foreground">{item.completed}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Cancelados</dt>
                        <dd className="text-foreground">{item.cancelled}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Não compareceu</dt>
                        <dd className="text-foreground">{item.noShow}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Valor dos serviços</dt>
                        <dd className="text-foreground">{money(item.servicesValue)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="min-w-0">
            <h2 className="font-display text-3xl text-foreground">Atendimentos do dia</h2>
            {dashboard.appointments.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nenhum atendimento neste filtro.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {dashboard.appointments.map((item) => (
                  <DayCard
                    key={item.id}
                    item={item}
                    points="used"
                    actions={
                      item.status === 'CONFIRMED' ? (
                        <DashboardActions
                          id={item.id}
                          onDone={() => setReloadKey((value) => value + 1)}
                          onError={setError}
                        />
                      ) : null
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </SessionFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article aria-label={label} className="min-w-0 border border-line bg-surface p-4">
      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-muted">{label}</p>
      <p className="mt-3 break-words font-display text-3xl text-foreground">{value}</p>
    </article>
  );
}

function DayCard({
  item,
  points,
  actions,
}: {
  item: OperationalDashboard['appointments'][number];
  points: 'upcoming' | 'used';
  actions?: ReactNode;
}) {
  return (
    <article className="min-w-0 border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="break-words text-lg text-foreground">
          {points === 'upcoming' ? `${civilDate(item.date)} · ` : ''}
          {item.time} · {item.serviceName}
        </h3>
        <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.22em] text-muted">
          {appointmentStatusLabel[item.status]}
        </span>
      </div>
      <p className="mt-2 break-words text-sm text-foreground">{item.clientName}</p>
      <p className="mt-1 break-words text-sm text-muted">{item.professionalName}</p>
      <p className="mt-3 text-sm text-foreground">
        {item.durationMinutes} min · {money(item.price)}
      </p>
      {points === 'used' ? (
        <p className="mt-1 text-sm text-muted">
          Pontos utilizados:{' '}
          {item.bookingMode === 'POINTS' && item.redemptionPointsSnapshot != null
            ? `${item.redemptionPointsSnapshot} pontos`
            : '—'}
        </p>
      ) : null}
      {points === 'upcoming' ? (
        <p className="mt-1 text-sm text-foreground">{item.bookingMode === 'POINTS' ? 'Pontos' : 'Normal'}</p>
      ) : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
    </article>
  );
}

function DashboardActions({
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
