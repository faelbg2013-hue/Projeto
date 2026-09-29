import type { AppointmentItem } from '@ravion/types';
import type { ReactNode } from 'react';
import { appointmentStatusLabel, civilDate, money } from '../services/appointments.service';

export function AppointmentCard({
  item,
  actions,
}: {
  item: AppointmentItem;
  actions?: ReactNode;
}) {
  return (
    <article className="min-w-0 border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="break-words text-lg text-foreground">{item.serviceName}</h2>
        <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.22em] text-muted">
          {appointmentStatusLabel[item.status]}
        </span>
      </div>
      <p className="mt-2 break-words text-sm text-foreground">{item.professionalName}</p>
      <p className="mt-1 break-words text-sm text-muted">{item.clientName}</p>
      <p className="mt-3 text-sm text-foreground">
        {civilDate(item.date)} · {item.time}
      </p>
      <p className="mt-1 text-sm text-muted">
        {item.durationMinutes} min · {money(item.price)}
      </p>
      {item.bookingMode === 'POINTS' && item.redemptionPointsSnapshot != null ? (
        <p className="mt-1 text-sm text-foreground">{item.redemptionPointsSnapshot} pontos utilizados</p>
      ) : null}
      {item.notes ? <p className="mt-2 break-words text-sm text-muted">{item.notes}</p> : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
    </article>
  );
}

export function actionClassName(muted = false): string {
  return muted
    ? 'text-[0.68rem] uppercase tracking-[0.22em] text-muted'
    : 'text-[0.68rem] uppercase tracking-[0.22em] text-foreground';
}
