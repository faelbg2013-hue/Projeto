import type { AdminClientAppointment, AdminClientDetail, AdminClientMovement } from '@ravion/types';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { appointmentStatusLabel, civilDate } from '../services/appointments.service';
import { clientsService } from '../services/clients.service';
import { pointsDate, pointsTypeLabel, signedPoints } from '../services/points.service';

export function AdminClientDetailPage() {
  useDocumentTitle('Cliente — Ravion Barber');
  const { clientId = '' } = useParams();
  const [detail, setDetail] = useState<AdminClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    clientsService
      .overview(clientId)
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
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o cliente.');
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
  }, [clientId, reloadKey]);

  async function toggle(): Promise<void> {
    if (!detail) {
      return;
    }
    setError(null);
    try {
      await clientsService.update(clientId, { isActive: !detail.isActive });
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar o cliente.');
    }
  }

  return (
    <SessionFrame eyebrow="Administração" title="Cliente" links={adminLinks}>
      {loading && !detail ? <p className="text-sm text-muted">Carregando cliente</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {detail ? (
        <div className="space-y-10">
          <section>
            <h2 className="text-[0.72rem] uppercase tracking-[0.28em] text-accent">Dados do cliente</h2>
            <div className="mt-4 flex items-start justify-between gap-3">
              <p className="break-words text-lg text-foreground">{detail.name}</p>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                {detail.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="mt-2 break-all text-sm text-muted">{detail.email}</p>
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
            <h2 className="text-[0.72rem] uppercase tracking-[0.28em] text-accent">Fidelidade</h2>
            <p className="mt-4 text-sm text-muted">Saldo atual</p>
            <p className="mt-1 text-lg text-foreground">{detail.points.balance} pontos</p>
            <p className="mt-2 text-sm text-muted">O saldo sai das movimentações do cliente.</p>
            <div className="mt-4 space-y-3">
              {detail.points.recent.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma movimentação de pontos.</p>
              ) : (
                detail.points.recent.map((item) => <Movement key={movementKey(item)} item={item} />)
              )}
            </div>
            <Link
              to={`/admin/clients/${clientId}/points`}
              className="mt-4 inline-block text-[0.68rem] uppercase tracking-[0.28em] text-accent"
            >
              Gerenciar pontos
            </Link>
          </section>
          <section>
            <h2 className="text-[0.72rem] uppercase tracking-[0.28em] text-accent">Atendimentos</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Total" value={detail.appointments.summary.total} />
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
              to={`/admin/appointments?clientId=${clientId}`}
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

function AppointmentList({ items, empty }: { items: AdminClientAppointment[]; empty: string }) {
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
          <p className="mt-2 break-words text-sm text-foreground">{item.professionalName}</p>
          <p className="mt-1 text-sm text-muted">
            {civilDate(item.date)} · {item.time}
          </p>
          <p className="mt-1 text-sm text-foreground">{item.bookingMode === 'POINTS' ? 'Pontos' : 'Normal'}</p>
        </article>
      ))}
    </div>
  );
}

function Movement({ item }: { item: AdminClientMovement }) {
  return (
    <article className="min-w-0 border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-foreground">{pointsTypeLabel[item.type]}</p>
        <p className="shrink-0 text-sm text-foreground">{signedPoints(item.type, item.points)}</p>
      </div>
      <p className="mt-2 break-words text-sm text-muted">{item.reason}</p>
      <p className="mt-1 text-sm text-muted">{pointsDate(item.createdAt)}</p>
    </article>
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

function movementKey(item: AdminClientMovement): string {
  return `${item.createdAt}-${item.type}-${item.points}-${item.reason}`;
}

function appointmentKey(item: AdminClientAppointment): string {
  return `${item.date}-${item.time}-${item.status}-${item.serviceName}-${item.professionalName}`;
}
