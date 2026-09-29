import type { ProfessionalDay, ProfessionalProfile } from '@ravion/types';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { AppointmentDetailDialog } from '../components/AppointmentDetailDialog';
import { ProfessionalAppointmentActions } from '../components/ProfessionalAppointmentActions';
import { ProfessionalDaySummaryCards } from '../components/ProfessionalDaySummary';
import { ServiceCatalog } from '../components/ServiceCatalog';
import { SessionFrame, professionalLinks } from '../components/SessionFrame';
import { useActiveServices } from '../hooks/useActiveServices';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatCivilDate } from '../lib/civil-date';
import { appointmentStatusLabel } from '../services/appointments.service';
import { professionalDayService } from '../services/professional-day.service';
import { professionalsService } from '../services/professionals.service';

export function ProfessionalPage() {
  const { user } = useAuth();
  const catalog = useActiveServices();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [day, setDay] = useState<ProfessionalDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeDetail = useCallback(() => setSelectedId(null), []);
  const title = profile?.displayName ?? user?.name ?? 'Profissional';
  useDocumentTitle(`${title} — Ravion Barber`);

  useEffect(() => {
    let active = true;
    professionalsService
      .me()
      .then((next) => {
        if (active) {
          setProfile(next);
        }
      })
      .catch(() => {
        if (active) {
          setError('Não foi possível carregar o perfil profissional.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    professionalDayService
      .get()
      .then((next) => {
        if (active) {
          setDay(next);
          setDayError(null);
        }
      })
      .catch(() => {
        if (active) {
          setDayError('Não foi possível carregar a agenda de hoje.');
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const selected =
    day?.appointments.find((item) => item.id === selectedId) ??
    (day?.currentAppointment?.id === selectedId ? day.currentAppointment : null) ??
    (day?.nextAppointment?.id === selectedId ? day.nextAppointment : null);
  const now = Date.now();
  const later =
    day?.appointments.filter(
      (item) =>
        item.status === 'CONFIRMED' &&
        item.id !== day.nextAppointment?.id &&
        item.id !== day.currentAppointment?.id &&
        new Date(item.startAt).getTime() > now,
    ) ?? [];

  return (
    <SessionFrame eyebrow="Profissional" title={title} links={professionalLinks}>
      <dl className="max-w-md space-y-4 text-sm">
        <ProfileRow label="E-mail" value={user?.email ?? ''} />
        <ProfileRow label="Perfil" value="Profissional" />
        <ProfileRow label="Status" value={profile ? (profile.isActive ? 'Ativo' : 'Inativo') : 'Carregando'} />
        <ProfileRow label="Data" value={day ? formatCivilDate(day.date) : 'Carregando'} />
      </dl>
      {error ? <p className="mt-6 text-sm text-foreground">{error}</p> : null}
      {dayError ? <p className="mt-6 text-sm text-foreground">{dayError}</p> : null}

      <nav aria-label="Ações rápidas" className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QuickLink to="/profissional/agenda">Ver agenda</QuickLink>
        <QuickLink to="#proximo">Próximo atendimento</QuickLink>
        <QuickLink to="#atual">Atendimento atual</QuickLink>
        <QuickLink to="/profissional/agenda#bloqueio">Bloquear horário</QuickLink>
      </nav>

      {day ? (
        <div className="mt-8 flex flex-col gap-8">
          <ProfessionalDaySummaryCards summary={day.summary} />
          <section id="atual" aria-label="Atendimento atual" className="min-w-0 border border-line p-4">
            <h2 className="font-display text-3xl">Atendimento atual</h2>
            {day.currentAppointment ? (
              <AppointmentHighlight item={day.currentAppointment} onOpen={() => setSelectedId(day.currentAppointment?.id ?? null)}>
                <ProfessionalAppointmentActions
                  id={day.currentAppointment.id}
                  status={day.currentAppointment.status}
                  bookingMode={day.currentAppointment.bookingMode}
                  onUpdated={() => setReloadKey((value) => value + 1)}
                />
              </AppointmentHighlight>
            ) : (
              <p className="mt-3 text-sm text-muted">Nenhum atendimento em andamento.</p>
            )}
          </section>
          <section id="proximo" aria-label="Próximo atendimento" className="min-w-0 border border-line p-4">
            <h2 className="font-display text-3xl">Próximo atendimento</h2>
            {day.nextAppointment ? (
              <AppointmentHighlight item={day.nextAppointment} onOpen={() => setSelectedId(day.nextAppointment?.id ?? null)} />
            ) : (
              <p className="mt-3 text-sm text-muted">Nenhum próximo atendimento para hoje.</p>
            )}
            {later.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {later.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => setSelectedId(item.id)} className="min-h-12 w-full break-words text-left text-sm">
                      {item.time} · {item.clientName} · {item.serviceName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      ) : null}

      <ServiceCatalog services={catalog.services} loading={catalog.loading} error={catalog.error} />
      {selected ? (
        <AppointmentDetailDialog
          item={selected}
          onClose={closeDetail}
          onUpdated={() => setReloadKey((value) => value + 1)}
        />
      ) : null}
    </SessionFrame>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-4">
      <dt className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">{label}</dt>
      <dd className="mt-2 break-all text-base text-foreground">{value}</dd>
    </div>
  );
}

function QuickLink({ to, children }: { to: string; children: string }) {
  const className =
    'flex min-h-12 items-center justify-center border border-line px-4 py-3 text-center text-sm uppercase tracking-[0.16em]';
  if (to.startsWith('#')) {
    return (
      <a href={to} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

function AppointmentHighlight({
  item,
  onOpen,
  children,
}: {
  item: NonNullable<ProfessionalDay['currentAppointment']>;
  onOpen: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="mt-4 min-w-0">
      <button type="button" onClick={onOpen} className="min-h-12 w-full break-words text-left">
        <p className="text-sm">
          {item.time}–{item.endTime}
        </p>
        <p className="mt-1 text-lg">{item.clientName}</p>
        <p className="text-sm text-muted">
          {item.serviceName} · {item.durationMinutes} min
        </p>
        <p className="mt-1 text-sm">{appointmentStatusLabel[item.status]}</p>
        <p className="mt-1 text-sm">{item.bookingMode === 'POINTS' ? 'POINTS' : 'NORMAL'}</p>
        {item.bookingMode === 'POINTS' && item.redemptionPointsSnapshot != null ? (
          <p className="mt-1 text-sm">Resgate de {item.redemptionPointsSnapshot} pontos</p>
        ) : null}
      </button>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
