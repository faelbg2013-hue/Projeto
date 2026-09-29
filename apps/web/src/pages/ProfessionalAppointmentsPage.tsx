import type { AppointmentItem, AppointmentStatus } from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { AppointmentCard } from '../components/AppointmentCard';
import { SessionFrame, professionalLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { appointmentsService } from '../services/appointments.service';

const statuses: Array<{ value: '' | AppointmentStatus; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'NO_SHOW', label: 'Não compareceu' },
];

export function ProfessionalAppointmentsPage() {
  useDocumentTitle('Agendamentos — Ravion Barber');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<'' | AppointmentStatus>('');
  const [applied, setApplied] = useState<{ date: string; status: '' | AppointmentStatus }>({
    date: '',
    status: '',
  });
  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    appointmentsService
      .professional({
        pageSize: 50,
        ...(applied.date ? { date: applied.date } : {}),
        ...(applied.status ? { status: applied.status } : {}),
      })
      .then((page) => {
        if (active) {
          setItems(page.data);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
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
      date: String(form.get('date') ?? ''),
      status: String(form.get('status') ?? '') as '' | AppointmentStatus,
    });
  }

  return (
    <SessionFrame eyebrow="Profissional" title="Agendamentos" links={professionalLinks}>
      <form className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end" onSubmit={onFilter}>
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Data
          <input
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Status
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as '' | AppointmentStatus)}
            className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
          >
            {statuses.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
        >
          Filtrar
        </button>
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
                <StaffActions
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

function StaffActions({
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
