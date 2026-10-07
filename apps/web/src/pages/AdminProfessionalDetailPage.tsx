import type {
  AdminProfessionalAppointment,
  AdminProfessionalDetail,
  AdminProfessionalInterval,
  AdminProfessionalService,
} from '@ravion/types';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { appointmentStatusLabel, civilDate } from '../services/appointments.service';
import { professionalsService } from '../services/professionals.service';

const WEEKDAYS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export function AdminProfessionalDetailPage() {
  useDocumentTitle('Profissional — Ravion Barber');
  const { professionalId = '' } = useParams();
  const [detail, setDetail] = useState<AdminProfessionalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    professionalsService
      .overview(professionalId)
      .then((body) => {
        if (!active) {
          return;
        }
        setDetail(body);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (active) {
          setDetail(null);
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o profissional.');
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
  }, [professionalId, reloadKey]);

  async function toggle(): Promise<void> {
    if (!detail) {
      return;
    }
    setError(null);
    try {
      if (detail.isActive) {
        await professionalsService.deactivate(professionalId);
      } else {
        await professionalsService.update(professionalId, { isActive: true });
      }
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar o profissional.');
    }
  }

  return (
    <SessionFrame eyebrow="Administração" title="Profissional" links={adminLinks}>
      {loading && !detail ? <p className="text-sm text-muted">Carregando profissional</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {detail ? (
        <div className="space-y-10">
          <section>
            <h2 className="text-[0.72rem] uppercase tracking-[0.28em] text-accent">Profissional</h2>
            <div className="mt-4 flex items-start justify-between gap-3">
              <p className="break-words text-lg text-foreground">{detail.displayName}</p>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                {detail.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="mt-2 break-words text-sm text-muted">{detail.name}</p>
            <p className="mt-1 break-all text-sm text-muted">{detail.email}</p>
            <p className="mt-2 text-sm text-muted">Cadastro em {registeredAt(detail.createdAt)}</p>
            <button
              type="button"
              onClick={() => void toggle()}
              className="mt-4 text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
            >
              {detail.isActive ? 'Desativar' : 'Ativar'}
            </button>
          </section>
          <section>
            <h2 className="text-[0.72rem] uppercase tracking-[0.28em] text-accent">Serviços</h2>
            <p className="mt-4 text-sm text-muted">
              O catálogo é do estabelecimento. Não há vínculo individual entre profissional e serviço.
            </p>
            {detail.services.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nenhum serviço cadastrado.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {detail.services.map((service) => (
                  <ServiceCard key={serviceKey(service)} service={service} />
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="text-[0.72rem] uppercase tracking-[0.28em] text-accent">Agenda</h2>
            <div className="mt-4 space-y-3">
              {WEEKDAYS.slice(1).map((label, index) => (
                <Weekday key={label} label={label} intervals={detail.week.filter((item) => item.dayOfWeek === index + 1)} />
              ))}
            </div>
            <Link
              to={`/admin/professionals/${professionalId}/schedule`}
              className="mt-4 inline-block text-[0.68rem] uppercase tracking-[0.28em] text-accent"
            >
              Configurar agenda
            </Link>
          </section>
          <section>
            <h2 className="text-[0.72rem] uppercase tracking-[0.28em] text-accent">Atendimentos</h2>
            <p className="mt-4 text-sm text-muted">
              Hoje é o dia civil em America/Sao_Paulo. Os demais totais reúnem todo o histórico do profissional.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Total" value={detail.appointments.summary.total} />
              <Metric label="Hoje" value={detail.appointments.summary.today} />
              <Metric label="Próximos" value={detail.appointments.summary.upcoming} />
              <Metric label="Pendentes" value={detail.appointments.summary.pending} />
              <Metric label="Confirmados" value={detail.appointments.summary.confirmed} />
              <Metric label="Concluídos" value={detail.appointments.summary.completed} />
              <Metric label="Cancelados" value={detail.appointments.summary.cancelled} />
              <Metric label="Não compareceu" value={detail.appointments.summary.noShow} />
            </dl>
            <h3 className="mt-8 text-sm text-foreground">Próximos</h3>
            <AppointmentList items={detail.appointments.upcoming} empty="Nenhum próximo atendimento." />
            <h3 className="mt-8 text-sm text-foreground">Histórico recente</h3>
            <AppointmentList items={detail.appointments.history} empty="Nenhum atendimento encerrado." />
            <Link
              to={`/admin/appointments?professionalId=${professionalId}`}
              className="mt-6 inline-block text-[0.68rem] uppercase tracking-[0.28em] text-accent"
            >
              Ver todos os agendamentos
            </Link>
          </section>
        </div>
      ) : null}
    </SessionFrame>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 border border-line bg-surface p-3">
      <dt className="text-[0.68rem] uppercase tracking-[0.22em] text-muted">{label}</dt>
      <dd className="mt-2 text-lg text-foreground">{value}</dd>
    </div>
  );
}

function ServiceCard({ service }: { service: AdminProfessionalService }) {
  return (
    <article className="min-w-0 border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="break-words text-base text-foreground">{service.name}</h3>
        <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.22em] text-muted">
          {service.isActive ? 'Ativo' : 'Inativo'}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">{service.durationMinutes} min</p>
      <p className="mt-1 text-sm text-foreground">{serviceValue(service.price)}</p>
    </article>
  );
}

function Weekday({ label, intervals }: { label: string; intervals: AdminProfessionalInterval[] }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border border-line bg-surface p-3">
      <p className="text-sm text-foreground">{label}</p>
      <p className="break-words text-right text-sm text-muted">
        {intervals.length === 0 ? 'Folga' : intervals.map((item) => `${item.startTime}–${item.endTime}`).join(', ')}
      </p>
    </div>
  );
}

function AppointmentList({ items, empty }: { items: AdminProfessionalAppointment[]; empty: string }) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="mt-3 space-y-3">
      {items.map((item) => (
        <article key={appointmentKey(item)} className="min-w-0 border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <h4 className="break-words text-base text-foreground">{item.serviceName}</h4>
            <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.22em] text-muted">
              {appointmentStatusLabel[item.status]}
            </span>
          </div>
          <p className="mt-2 break-words text-sm text-foreground">{item.clientName}</p>
          <p className="mt-1 text-sm text-muted">
            {civilDate(item.date)} · {item.time}
          </p>
          <p className="mt-1 text-sm text-foreground">{item.bookingMode === 'POINTS' ? 'Pontos' : 'Normal'}</p>
        </article>
      ))}
    </div>
  );
}

function registeredAt(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function serviceValue(price: string): string {
  const [whole, fraction = '00'] = price.split('.');
  return `Valor do serviço R$ ${whole},${fraction.padEnd(2, '0').slice(0, 2)}`;
}

function serviceKey(service: AdminProfessionalService): string {
  return `${service.name}-${service.durationMinutes}-${service.price}-${service.isActive}`;
}

function appointmentKey(item: AdminProfessionalAppointment): string {
  return `${item.date}-${item.time}-${item.status}-${item.serviceName}-${item.clientName}`;
}
