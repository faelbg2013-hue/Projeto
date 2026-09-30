import type { AppointmentItem, BookableProfessional, BookingMode, ServiceItem } from '@ravion/types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SessionFrame } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiClientError } from '../services/api';
import { appointmentsService, civilDate, money } from '../services/appointments.service';
import { pointsService } from '../services/points.service';
import { professionalsService } from '../services/professionals.service';
import { scheduleService } from '../services/schedule.service';
import { servicesService } from '../services/services.service';

const links = [
  { to: '/cliente', label: 'Início' },
  { to: '/agendar', label: 'Agendar' },
  { to: '/agendamentos', label: 'Meus agendamentos' },
  { to: '/conta', label: 'Conta' },
] as const;

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function BookingPage() {
  useDocumentTitle('Agendar — Ravion Barber');
  const [professionals, setProfessionals] = useState<BookableProfessional[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingMode, setBookingMode] = useState<BookingMode>('NORMAL');
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<AppointmentItem | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      professionalsService.bookable({ pageSize: 100 }),
      servicesService.list({ isActive: true, pageSize: 100 }),
    ])
      .then(([professionalPage, servicePage]) => {
        if (!active) {
          return;
        }
        setProfessionals(professionalPage.data);
        setServices(servicePage.data);
      })
      .catch((caught: unknown) => {
        if (active) {
          setLoadError(messageOf(caught, 'Não foi possível carregar o agendamento.'));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    pointsService
      .mine()
      .then((points) => {
        if (active) {
          setBalance(points.balance);
        }
      })
      .catch(() => {
        if (active) {
          setBalance(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const professional = professionals.find((item) => item.id === professionalId) ?? null;
  const service = services.find((item) => item.id === serviceId) ?? null;

  function chooseProfessional(id: string): void {
    setProfessionalId(id);
    setServiceId('');
    setBookingMode('NORMAL');
    setSlots(null);
    setTime('');
    setError(null);
  }

  function chooseService(id: string): void {
    setServiceId(id);
    setBookingMode('NORMAL');
    setSlots(null);
    setTime('');
    setError(null);
  }

  function chooseTime(next: string): void {
    setTime(next);
    setIdempotencyKey(crypto.randomUUID());
    setError(null);
  }

  async function loadSlots(): Promise<void> {
    if (!professionalId || !serviceId || !date) {
      setError('Escolha profissional, serviço e data.');
      return;
    }
    setError(null);
    setSlots(null);
    setTime('');
    setSlotsLoading(true);
    try {
      const availability = await scheduleService.availability(professionalId, date, serviceId);
      setSlots(availability.slots);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'Não foi possível consultar os horários.',
      );
    } finally {
      setSlotsLoading(false);
    }
  }

  async function confirm(): Promise<void> {
    if (!professionalId || !serviceId || !date || !time) {
      setError('Escolha um horário antes de confirmar.');
      return;
    }
    const key = idempotencyKey || crypto.randomUUID();
    if (!idempotencyKey) {
      setIdempotencyKey(key);
    }
    setPending(true);
    setError(null);
    try {
      const created = await appointmentsService.create(
        {
          professionalId,
          serviceId,
          date,
          time,
          notes: notes.trim() ? notes.trim() : null,
          bookingMode,
        },
        key,
      );
      if (created.bookingMode === 'POINTS') {
        const next = await pointsService.mine();
        setBalanceAfter(next.balance);
        setBalance(next.balance);
      }
      setConfirmed(created);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível confirmar o agendamento.');
    } finally {
      setPending(false);
    }
  }

  if (confirmed && professional && service) {
    return (
      <SessionFrame eyebrow="Cliente" title="Agendamento" links={links}>
        <p className="text-sm uppercase tracking-[0.28em] text-accent">Agendamento confirmado</p>
        <dl className="mt-8 max-w-md space-y-4 text-sm">
          <SummaryRow label="Serviço" value={confirmed.serviceName} />
          <SummaryRow label="Profissional" value={confirmed.professionalName} />
          <SummaryRow label="Data" value={civilDate(confirmed.date)} />
          <SummaryRow label="Horário" value={confirmed.time} />
          <SummaryRow label="Duração" value={`${confirmed.durationMinutes} min`} />
          <SummaryRow label="Valor" value={money(confirmed.price)} />
          {confirmed.bookingMode === 'POINTS' && confirmed.redemptionPointsSnapshot != null ? (
            <SummaryRow label="Pontos utilizados" value={String(confirmed.redemptionPointsSnapshot)} />
          ) : null}
          {confirmed.bookingMode === 'POINTS' && balanceAfter != null ? (
            <SummaryRow label="Novo saldo" value={`${balanceAfter} pontos`} />
          ) : null}
        </dl>
        <Link
          to="/agendamentos"
          className="mt-8 inline-block text-[0.68rem] uppercase tracking-[0.28em] text-accent"
        >
          Ver meus agendamentos
        </Link>
      </SessionFrame>
    );
  }

  return (
    <SessionFrame eyebrow="Cliente" title="Agendar" links={links}>
      {loading ? <p className="text-sm text-muted">Carregando</p> : null}
      {loadError ? (
        <p role="alert" className="text-sm text-foreground">
          {loadError}
        </p>
      ) : null}
      {!loading && !loadError ? (
        <div className="flex min-w-0 flex-col gap-10">
          <section>
            <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Profissional</h2>
            {professionals.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nenhum profissional disponível.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {professionals.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === professionalId}
                    onClick={() => chooseProfessional(item.id)}
                    className={`min-w-0 break-words border px-4 py-3 text-left text-sm ${
                      item.id === professionalId
                        ? 'border-accent text-foreground'
                        : 'border-line text-muted'
                    }`}
                  >
                    {item.displayName}
                  </button>
                ))}
              </div>
            )}
          </section>

          {professional ? (
            <section>
              <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Serviço</h2>
              {services.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Nenhum serviço disponível.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {services.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={item.id === serviceId}
                      onClick={() => chooseService(item.id)}
                      className={`min-w-0 break-words border px-4 py-3 text-left text-sm ${
                        item.id === serviceId
                          ? 'border-accent text-foreground'
                          : 'border-line text-muted'
                      }`}
                    >
                      {item.name} · {item.durationMinutes} min · {money(item.price)}
                      {item.redemptionPoints ? ` ou ${item.redemptionPoints} pontos` : ''}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {professional && service ? (
            <section className="flex min-w-0 flex-col gap-4">
              <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                Data
                <input
                  type="date"
                  value={date}
                  min={todayInSaoPaulo()}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setSlots(null);
                    setTime('');
                    setError(null);
                  }}
                  className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadSlots()}
                disabled={!date || slotsLoading}
                className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground disabled:opacity-60"
              >
                Ver horários
              </button>
              {slotsLoading ? <p className="text-sm text-muted">Consultando horários</p> : null}
              {slots && slots.length === 0 ? (
                <p className="text-sm text-muted">Nenhum horário disponível nesta data.</p>
              ) : null}
              {slots && slots.length > 0 ? (
                <ul
                  aria-label="Horários disponíveis"
                  className="grid grid-cols-3 gap-2 sm:grid-cols-4"
                >
                  {slots.map((slot) => (
                    <li key={slot}>
                      <button
                        type="button"
                        aria-pressed={slot === time}
                        onClick={() => chooseTime(slot)}
                        className={`w-full border px-2 py-3 text-sm ${
                          slot === time
                            ? 'border-accent text-foreground'
                            : 'border-line text-muted'
                        }`}
                      >
                        {slot}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {professional && service && time ? (
            <section className="flex min-w-0 flex-col gap-5">
              <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                Observação
                <textarea
                  value={notes}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full resize-y border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
                />
              </label>
              <dl className="max-w-md space-y-4 text-sm">
                <SummaryRow label="Profissional" value={professional.displayName} />
                <SummaryRow label="Serviço" value={service.name} />
                <SummaryRow label="Data" value={civilDate(date)} />
                <SummaryRow label="Horário" value={time} />
                <SummaryRow label="Duração" value={`${service.durationMinutes} min`} />
                <SummaryRow label="Valor" value={money(service.price)} />
                {balance != null ? <SummaryRow label="Saldo atual" value={`${balance} pontos`} /> : null}
                {service.redemptionPoints ? (
                  <SummaryRow
                    label="Opção"
                    value={
                      bookingMode === 'POINTS'
                        ? `${service.redemptionPoints} pontos`
                        : `Pagar normalmente — ${money(service.price)}`
                    }
                  />
                ) : null}
                {bookingMode === 'POINTS' && service.redemptionPoints && balance != null ? (
                  <SummaryRow label="Saldo após" value={`${balance - service.redemptionPoints} pontos`} />
                ) : null}
              </dl>
              {service.redemptionPoints ? (
                <fieldset className="flex min-w-0 flex-col gap-3">
                  <legend className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Como utilizar</legend>
                  <label className="flex min-w-0 items-start gap-3 text-sm text-foreground">
                    <input
                      type="radio"
                      name="bookingMode"
                      checked={bookingMode === 'NORMAL'}
                      onChange={() => setBookingMode('NORMAL')}
                    />
                    <span className="break-words">Pagar normalmente — {money(service.price)}</span>
                  </label>
                  <label className="flex min-w-0 items-start gap-3 text-sm text-foreground">
                    <input
                      type="radio"
                      name="bookingMode"
                      checked={bookingMode === 'POINTS'}
                      disabled={balance == null || balance < service.redemptionPoints}
                      onChange={() => setBookingMode('POINTS')}
                    />
                    <span className="break-words">Usar {service.redemptionPoints} pontos</span>
                  </label>
                  {balance != null && balance < service.redemptionPoints ? (
                    <p className="text-sm text-muted">
                      Você possui {balance} pontos. São necessários {service.redemptionPoints} pontos.
                    </p>
                  ) : null}
                  {bookingMode === 'POINTS' ? (
                    <p className="text-sm text-foreground">
                      {service.redemptionPoints} pontos serão utilizados no momento do agendamento.
                    </p>
                  ) : null}
                </fieldset>
              ) : null}
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={pending}
                className="bg-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-background disabled:opacity-60"
              >
                Confirmar agendamento
              </button>
            </section>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-foreground">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </SessionFrame>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-4">
      <dt className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">{label}</dt>
      <dd className="mt-2 break-words text-base text-foreground">{value}</dd>
    </div>
  );
}
