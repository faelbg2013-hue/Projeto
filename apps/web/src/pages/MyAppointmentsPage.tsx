import type { AppointmentItem } from '@ravion/types';
import { useEffect, useState } from 'react';
import { AppointmentCard } from '../components/AppointmentCard';
import { SessionFrame } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { appointmentsService } from '../services/appointments.service';

const links = [
  { to: '/cliente', label: 'Início' },
  { to: '/agendar', label: 'Agendar' },
  { to: '/agendamentos', label: 'Meus agendamentos' },
  { to: '/conta', label: 'Conta' },
] as const;

export function MyAppointmentsPage() {
  useDocumentTitle('Meus agendamentos — Ravion Barber');
  const [upcoming, setUpcoming] = useState<AppointmentItem[]>([]);
  const [history, setHistory] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [next, past] = await Promise.all([
        appointmentsService.mine({ view: 'upcoming', pageSize: 50 }),
        appointmentsService.mine({ view: 'history', pageSize: 50 }),
      ]);
      setUpcoming(next.data);
      setHistory(past.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os agendamentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function cancel(id: string): Promise<void> {
    setPendingId(id);
    setError(null);
    try {
      await appointmentsService.cancel(id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível cancelar o agendamento.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <SessionFrame eyebrow="Cliente" title="Agendamentos" links={links}>
      {loading ? <p className="text-sm text-muted">Carregando agendamentos</p> : null}
      {error ? (
        <p role="alert" className="mb-6 text-sm text-foreground">
          {error}
        </p>
      ) : null}
      <section>
        <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Próximos</h2>
        {!loading && upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhum agendamento próximo.</p>
        ) : null}
        <div className="mt-4 space-y-4">
          {upcoming.map((item) => (
            <AppointmentCard
              key={item.id}
              item={item}
              actions={
                <button
                  type="button"
                  disabled={pendingId === item.id}
                  onClick={() => void cancel(item.id)}
                  className="text-[0.68rem] uppercase tracking-[0.22em] text-foreground disabled:opacity-60"
                >
                  Cancelar
                </button>
              }
            />
          ))}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Histórico</h2>
        {!loading && history.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhum agendamento no histórico.</p>
        ) : null}
        <div className="mt-4 space-y-4">
          {history.map((item) => (
            <AppointmentCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </SessionFrame>
  );
}
