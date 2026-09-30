import type { AppointmentItem, ServiceItem } from '@ravion/types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { AppointmentCard } from '../components/AppointmentCard';
import { ClientNavigation } from '../components/ClientNavigation';
import { SessionFrame } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { appointmentsService, money } from '../services/appointments.service';
import { pointsService } from '../services/points.service';
import { servicesService } from '../services/services.service';

const quickActions = [
  { to: '/agendar', label: 'Agendar' },
  { to: '/agendamentos', label: 'Meus agendamentos' },
  { to: '/pontos', label: 'Meus pontos' },
  { to: '/conta', label: 'Minha conta' },
] as const;

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function ClientDashboardPage() {
  const { user } = useAuth();
  useDocumentTitle('Início — Ravion Barber');
  const [nextAppointment, setNextAppointment] = useState<AppointmentItem | null>(null);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    appointmentsService
      .mine({ view: 'upcoming', pageSize: 1 })
      .then((result) => {
        if (active) {
          setNextAppointment(result.data[0] ?? null);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setAppointmentsError(messageOf(caught, 'Não foi possível carregar os agendamentos.'));
        }
      })
      .finally(() => {
        if (active) {
          setAppointmentsLoading(false);
        }
      });

    pointsService
      .mine()
      .then((summary) => {
        if (active) {
          setBalance(summary.balance);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setPointsError(messageOf(caught, 'Não foi possível carregar os pontos.'));
        }
      })
      .finally(() => {
        if (active) {
          setPointsLoading(false);
        }
      });

    servicesService
      .list({ isActive: true, pageSize: 6 })
      .then((result) => {
        if (active) {
          setServices(result.data.slice(0, 6));
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setServicesError(messageOf(caught, 'Não foi possível carregar os serviços.'));
        }
      })
      .finally(() => {
        if (active) {
          setServicesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (!user) {
    return null;
  }

  return (
    <SessionFrame eyebrow="Cliente" title={`Olá, ${user.name}`} navigation={<ClientNavigation />}>
      <section>
        <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Próximo agendamento</h2>
        {appointmentsLoading ? <p className="mt-4 text-sm text-muted">Carregando agendamentos</p> : null}
        {appointmentsError ? (
          <p role="alert" className="mt-4 text-sm text-foreground">
            {appointmentsError}
          </p>
        ) : null}
        {!appointmentsLoading && !appointmentsError && nextAppointment == null ? (
          <div className="mt-4">
            <p className="text-sm text-muted">Você ainda não tem agendamentos.</p>
            <Link
              to="/agendar"
              className="mt-4 inline-block text-[0.68rem] uppercase tracking-[0.28em] text-accent"
            >
              Agendar agora
            </Link>
          </div>
        ) : null}
        {nextAppointment ? (
          <div className="mt-4">
            <AppointmentCard
              item={nextAppointment}
              actions={
                <Link
                  to="/agendamentos"
                  className="text-[0.68rem] uppercase tracking-[0.22em] text-foreground"
                >
                  Ver meus agendamentos
                </Link>
              }
            />
          </div>
        ) : null}
      </section>

      <section className="mt-10 max-w-md border border-line bg-surface p-5">
        <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Pontos disponíveis</h2>
        {pointsLoading ? <p className="mt-4 text-sm text-muted">Carregando pontos</p> : null}
        {pointsError ? (
          <p role="alert" className="mt-4 text-sm text-foreground">
            {pointsError}
          </p>
        ) : null}
        {!pointsError && balance !== null ? (
          <p className="mt-3 font-display text-5xl text-foreground">{balance}</p>
        ) : null}
        <Link
          to="/pontos"
          className="mt-5 inline-block text-[0.68rem] uppercase tracking-[0.28em] text-accent"
        >
          Ver meus pontos
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Ações rápidas</h2>
        <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-[0.68rem] uppercase tracking-[0.28em]">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.to} className="text-accent">
              {action.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="mt-10">
        <h2 className="text-[0.72rem] uppercase tracking-[0.38em] text-accent">Serviços disponíveis</h2>
        {servicesLoading ? <p className="mt-4 text-sm text-muted">Carregando serviços</p> : null}
        {servicesError ? (
          <p role="alert" className="mt-4 text-sm text-foreground">
            {servicesError}
          </p>
        ) : null}
        {!servicesLoading && !servicesError && services.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhum serviço ativo.</p>
        ) : null}
        <ul className="mt-6 space-y-4">
          {services.map((service) => (
            <li key={service.id} className="min-w-0 border-t border-line pt-4">
              <p className="break-words text-base text-foreground">{service.name}</p>
              <p className="mt-2 break-words text-sm text-muted">
                {service.durationMinutes} min · {money(service.price)}
                {service.redemptionPoints ? ` ou ${service.redemptionPoints} pontos` : ''}
              </p>
              <Link
                to="/agendar"
                className="mt-3 inline-block text-[0.68rem] uppercase tracking-[0.28em] text-accent"
              >
                Agendar
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </SessionFrame>
  );
}
