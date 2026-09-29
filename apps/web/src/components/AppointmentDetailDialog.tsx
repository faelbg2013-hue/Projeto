import type { ProfessionalDayAppointment } from '@ravion/types';
import { useEffect, useRef } from 'react';
import { appointmentStatusLabel, civilDate, money } from '../services/appointments.service';
import { ProfessionalAppointmentActions } from './ProfessionalAppointmentActions';

export function AppointmentDetailDialog({
  item,
  onClose,
  onUpdated,
}: {
  item: ProfessionalDayAppointment;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    const handleClose = (): void => onClose();
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  const pointsUsed = item.bookingMode === 'POINTS' ? (item.redemptionPointsSnapshot ?? 0) : 0;

  return (
    <dialog
      ref={ref}
      aria-labelledby="appointment-detail-title"
      className="m-auto w-[min(32rem,calc(100vw-1.5rem))] max-w-lg border border-line bg-background p-5 text-foreground backdrop:bg-black/70"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="appointment-detail-title" className="break-words font-display text-4xl">
          {item.clientName}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="min-h-11 shrink-0 px-2 text-[0.68rem] uppercase tracking-[0.22em] text-muted"
        >
          Fechar
        </button>
      </div>

      <section className="mt-6" role="region" aria-label="Cliente">
        <h3 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Cliente</h3>
        <p className="mt-2 break-words text-base">{item.clientName}</p>
      </section>

      <section className="mt-6" role="region" aria-label="Serviço">
        <h3 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Serviço</h3>
        <p className="mt-2 break-words text-base">{item.serviceName}</p>
        {item.serviceDescription ? (
          <p className="mt-1 break-words text-sm text-muted">{item.serviceDescription}</p>
        ) : null}
        <p className="mt-2 text-sm">
          {item.durationMinutes} min · valor registrado {money(item.price)}
        </p>
        <p className="mt-1 text-sm">Pontos ao concluir: {item.pointsSnapshot}</p>
      </section>

      <section className="mt-6" role="region" aria-label="Agendamento">
        <h3 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Agendamento</h3>
        <p className="mt-2 text-sm">
          {civilDate(item.startAt.slice(0, 10))} · {item.time}–{item.endTime}
        </p>
        <p className="mt-1 text-sm">{appointmentStatusLabel[item.status]}</p>
        <p className="mt-1 text-sm">{item.bookingMode === 'POINTS' ? 'POINTS' : 'NORMAL'}</p>
      </section>

      <section className="mt-6" role="region" aria-label="Pontos">
        <h3 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Pontos</h3>
        <p className="mt-2 text-sm">Pontos utilizados: {pointsUsed}</p>
        <p className="mt-1 text-sm">Pontos ao concluir: {item.pointsSnapshot}</p>
        {item.bookingMode === 'POINTS' && item.redemptionPointsSnapshot != null ? (
          <p className="mt-2 text-sm">Resgate de {item.redemptionPointsSnapshot} pontos</p>
        ) : null}
      </section>

      <div className="mt-6">
        <ProfessionalAppointmentActions
          id={item.id}
          status={item.status}
          bookingMode={item.bookingMode}
          onUpdated={onUpdated}
        />
      </div>
    </dialog>
  );
}
