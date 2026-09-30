import type { AppointmentItem } from '@ravion/types';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AppointmentCard } from '../components/AppointmentCard';
import { ClientNavigation } from '../components/ClientNavigation';
import { SessionFrame } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { appointmentsService } from '../services/appointments.service';

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function MyAppointmentsPage() {
  useDocumentTitle('Meus agendamentos — Ravion Barber');
  const [upcoming, setUpcoming] = useState<AppointmentItem[]>([]);
  const [history, setHistory] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const cancelling = useRef(false);

  async function fetchLists(): Promise<void> {
    const [next, past] = await Promise.all([
      appointmentsService.mine({ view: 'upcoming', pageSize: 50 }),
      appointmentsService.mine({ view: 'history', pageSize: 50 }),
    ]);
    setUpcoming(next.data);
    setHistory(past.data);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    fetchLists()
      .catch((caught: unknown) => {
        if (active) {
          setLoadError(messageOf(caught, 'Não foi possível carregar os agendamentos.'));
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
  }, []);

  async function cancel(id: string): Promise<void> {
    if (cancelling.current) {
      return;
    }
    cancelling.current = true;
    setPendingId(id);
    setCancelError(null);
    try {
      await appointmentsService.cancel(id);
      await fetchLists();
    } catch (caught) {
      setCancelError(messageOf(caught, 'Não foi possível cancelar o agendamento.'));
    } finally {
      cancelling.current = false;
      setPendingId(null);
    }
  }

  const ready = !loading && loadError == null;

  return (
    <SessionFrame eyebrow="Cliente" title="Agendamentos" navigation={<ClientNavigation />}>
      {loading ? <p className="text-sm text-muted">Carregando agendamentos</p> : null}
      {loadError ? (
        <p role="alert" className="text-sm text-foreground">
          {loadError}
        </p>
      ) : null}
      {cancelError ? (
        <p role="alert" className="mb-6 text-sm text-foreground">
          {cancelError}
        </p>
      ) : null}
      {ready ? (
        <>
          <section className="min-w-0">
            <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Próximos</h2>
            {upcoming.length === 0 ? (
              <div className="mt-4">
                <p className="text-sm text-muted">Nenhum agendamento próximo.</p>
                <Link
                  to="/agendar"
                  className="mt-4 inline-flex min-h-11 items-center text-[0.68rem] uppercase tracking-[0.28em] text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                >
                  Agendar agora
                </Link>
              </div>
            ) : null}
            <div className="mt-4 space-y-4">
              {upcoming.map((item) => (
                <AppointmentCard
                  key={item.id}
                  item={item}
                  showBookingMode
                  actions={
                    item.status === 'CONFIRMED' ? (
                      <button
                        type="button"
                        disabled={pendingId !== null}
                        aria-busy={pendingId === item.id}
                        onClick={() => void cancel(item.id)}
                        className="min-h-11 text-[0.68rem] uppercase tracking-[0.22em] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground disabled:opacity-60"
                      >
                        {pendingId === item.id ? 'Cancelando' : 'Cancelar'}
                      </button>
                    ) : null
                  }
                />
              ))}
            </div>
          </section>
          <section className="mt-10 min-w-0">
            <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Histórico</h2>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nenhum agendamento no histórico.</p>
            ) : null}
            <div className="mt-4 space-y-4">
              {history.map((item) => (
                <AppointmentCard key={item.id} item={item} showBookingMode />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </SessionFrame>
  );
}
