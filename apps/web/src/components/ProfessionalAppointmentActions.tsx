import type { AppointmentStatus, BookingMode } from '@ravion/types';
import { useState } from 'react';
import { ApiClientError } from '../services/api';
import { appointmentsService } from '../services/appointments.service';

type Intent = 'complete' | 'no-show' | 'cancel';

const confirmLabel: Record<Intent, string> = {
  complete: 'Confirmar conclusão',
  'no-show': 'Confirmar não comparecimento',
  cancel: 'Confirmar cancelamento',
};

function consequence(intent: Intent, mode: BookingMode): string {
  if (intent === 'complete') {
    return 'Concluir este atendimento?';
  }
  if (intent === 'no-show') {
    return mode === 'POINTS'
      ? 'Ao marcar como não compareceu, os pontos utilizados no agendamento não são devolvidos.'
      : 'Marcar este atendimento como não compareceu?';
  }
  return mode === 'POINTS'
    ? 'Este cancelamento devolverá os pontos utilizados neste agendamento.'
    : 'Este agendamento não possui resgate de pontos.';
}

export function ProfessionalAppointmentActions({
  id,
  status,
  bookingMode,
  onUpdated,
}: {
  id: string;
  status: AppointmentStatus;
  bookingMode: BookingMode;
  onUpdated: () => void;
}) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (status !== 'CONFIRMED' && !error && !notice) {
    return null;
  }

  async function run(next: Intent): Promise<void> {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      if (next === 'complete') {
        await appointmentsService.complete(id);
      } else if (next === 'no-show') {
        await appointmentsService.noShow(id);
      } else {
        await appointmentsService.cancel(id);
      }
      setIntent(null);
      setNotice('Atendimento atualizado.');
      onUpdated();
    } catch (caught) {
      const message =
        caught instanceof ApiClientError
          ? caught.message
          : 'Não foi possível atualizar o atendimento.';
      setError(message);
      onUpdated();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {error ? <p className="text-sm text-foreground">{error}</p> : null}
      {notice ? <p className="text-sm text-foreground">{notice}</p> : null}
      {status === 'CONFIRMED' && intent ? (
        <div className="border border-line bg-surface p-4">
          <p className="text-sm text-foreground">{consequence(intent, bookingMode)}</p>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => void run(intent)}
              className="min-h-12 w-full bg-foreground px-4 py-3 text-sm uppercase tracking-[0.18em] text-background disabled:opacity-60"
            >
              {confirmLabel[intent]}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setIntent(null)}
              className="min-h-12 w-full border border-line px-4 py-3 text-sm uppercase tracking-[0.18em] text-foreground"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : null}
      {status === 'CONFIRMED' && !intent ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setIntent('complete')}
            className="min-h-12 w-full bg-foreground px-4 py-3 text-sm uppercase tracking-[0.18em] text-background"
          >
            Concluir
          </button>
          <button
            type="button"
            onClick={() => setIntent('no-show')}
            className="min-h-12 w-full border border-line px-4 py-3 text-sm uppercase tracking-[0.18em] text-foreground"
          >
            Não compareceu
          </button>
          <button
            type="button"
            onClick={() => setIntent('cancel')}
            className="min-h-12 w-full border border-line px-4 py-3 text-sm uppercase tracking-[0.18em] text-foreground"
          >
            Cancelar
          </button>
        </div>
      ) : null}
    </div>
  );
}
