import type { AppointmentItem, BookableProfessional, BookingMode, ServiceItem } from '@ravion/types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ClientNavigation } from '../components/ClientNavigation';
import { SessionFrame } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiClientError } from '../services/api';
import { appointmentsService, civilDate, money } from '../services/appointments.service';
import { pointsService } from '../services/points.service';
import { professionalsService } from '../services/professionals.service';
import { scheduleService } from '../services/schedule.service';
import { servicesService } from '../services/services.service';

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

function choiceClass(selected: boolean): string {
  return [
    'min-w-0 break-words border px-4 py-3 text-left text-sm',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
    selected
      ? 'border-foreground text-foreground underline decoration-foreground decoration-2 underline-offset-4'
      : 'border-line text-muted no-underline',
  ].join(' ');
}

export function BookingPage() {
  useDocumentTitle('Agendar — Ravion Barber');
  const [professionals, setProfessionals] = useState<BookableProfessional[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [professionalsError, setProfessionalsError] = useState<string | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingMode, setBookingMode] = useState<BookingMode>('NORMAL');
  const [balance, setBalance] = useState<number | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<AppointmentItem | null>(null);

  useEffect(() => {
    let active = true;
    professionalsService
      .bookable({ pageSize: 100 })
      .then((professionalPage) => {
        if (active) {
          setProfessionals(professionalPage.data);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setProfessionalsError(messageOf(caught, 'Não foi possível carregar os profissionais.'));
        }
      })
      .finally(() => {
        if (active) {
          setProfessionalsLoading(false);
        }
      });
    servicesService
      .list({ isActive: true, pageSize: 100 })
      .then((servicePage) => {
        if (active) {
          setServices(servicePage.data.filter((item) => item.isActive));
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
          setPointsError('Não foi possível carregar os pontos.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!professionalId || !serviceId || !date) {
      setSlots(null);
      setSlotsLoading(false);
      setSlotsError(null);
      return;
    }
    if (date < todayInSaoPaulo()) {
      setSlots([]);
      setSlotsLoading(false);
      setSlotsError(null);
      return;
    }
    let active = true;
    setSlotsLoading(true);
    setSlots(null);
    setSlotsError(null);
    scheduleService
      .availability(professionalId, date, serviceId)
      .then((availability) => {
        if (active) {
          setSlots(availability.slots);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setSlotsError(
            caught instanceof ApiClientError ? caught.message : 'Não foi possível consultar os horários.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setSlotsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [professionalId, serviceId, date]);

  const professional = professionals.find((item) => item.id === professionalId) ?? null;
  const service = services.find((item) => item.id === serviceId) ?? null;
  const pointsNeeded = service?.redemptionPoints ?? null;
  const pointsUnavailable = pointsNeeded != null && (balance == null || balance < pointsNeeded);
  const pastDate = date !== '' && date < todayInSaoPaulo();
  const canConfirm =
    professional != null &&
    service != null &&
    date !== '' &&
    time !== '' &&
    !pastDate &&
    !slotsLoading &&
    slots?.includes(time) === true &&
    (bookingMode !== 'POINTS' || (pointsNeeded != null && balance != null && balance >= pointsNeeded));

  function clearSlot(): void {
    setTime('');
    setIdempotencyKey('');
    setSlots(null);
  }

  function chooseProfessional(id: string): void {
    setProfessionalId(id);
    clearSlot();
    setError(null);
  }

  function chooseService(id: string): void {
    setServiceId(id);
    setBookingMode('NORMAL');
    clearSlot();
    setError(null);
  }

  function chooseDate(next: string): void {
    setDate(next);
    setTime('');
    setIdempotencyKey('');
    setError(null);
  }

  function chooseTime(next: string): void {
    setTime(next);
    setIdempotencyKey(crypto.randomUUID());
    setError(null);
  }

  function bookAnother(): void {
    setConfirmed(null);
    setProfessionalId('');
    setServiceId('');
    setDate('');
    setSlots(null);
    setTime('');
    setNotes('');
    setBookingMode('NORMAL');
    setError(null);
    setSlotsError(null);
    setIdempotencyKey('');
    setBalanceAfter(null);
  }

  async function confirm(): Promise<void> {
    if (!canConfirm || !professionalId || !serviceId || !date || !time) {
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
        try {
          const next = await pointsService.mine();
          setBalanceAfter(next.balance);
          setBalance(next.balance);
        } catch {
          setBalanceAfter(null);
        }
      }
      setConfirmed(created);
    } catch (caught) {
      setError(messageOf(caught, 'Não foi possível confirmar o agendamento.'));
      if (date >= todayInSaoPaulo()) {
        try {
          const availability = await scheduleService.availability(professionalId, date, serviceId);
          setSlots(availability.slots);
          if (!availability.slots.includes(time)) {
            setTime('');
            setIdempotencyKey('');
          }
        } catch {
          // A seleção permanece para o cliente tentar de novo.
        }
      }
    } finally {
      setPending(false);
    }
  }

  if (confirmed && professional && service) {
    const usedPoints =
      confirmed.bookingMode === 'POINTS' && confirmed.redemptionPointsSnapshot != null
        ? confirmed.redemptionPointsSnapshot
        : null;
    return (
      <SessionFrame eyebrow="Cliente" title="Agendamento" navigation={<ClientNavigation />}>
        <p className="text-sm uppercase tracking-[0.28em] text-accent">Agendamento confirmado</p>
        <dl className="mt-8 max-w-md space-y-4 text-sm">
          <SummaryRow label="Profissional" value={confirmed.professionalName} />
          <SummaryRow label="Serviço" value={confirmed.serviceName} />
          <SummaryRow label="Data" value={civilDate(confirmed.date)} />
          <SummaryRow label="Horário" value={confirmed.time} />
          <SummaryRow label="Duração" value={`${confirmed.durationMinutes} min`} />
          <SummaryRow label="Valor" value={money(confirmed.price)} />
          <SummaryRow label="Modalidade" value={confirmed.bookingMode === 'POINTS' ? 'Pontos' : 'Normal'} />
          {usedPoints != null ? <SummaryRow label="Pontos utilizados" value={String(usedPoints)} /> : null}
          {confirmed.bookingMode === 'POINTS' && balanceAfter != null ? (
            <SummaryRow label="Novo saldo" value={`${balanceAfter} pontos`} />
          ) : null}
        </dl>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <Link
            to="/agendamentos"
            className="inline-flex min-h-11 items-center text-[0.68rem] uppercase tracking-[0.28em] text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          >
            Ver meus agendamentos
          </Link>
          <Link
            to="/cliente"
            className="inline-flex min-h-11 items-center text-[0.68rem] uppercase tracking-[0.28em] text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          >
            Voltar para início
          </Link>
          <button
            type="button"
            onClick={bookAnother}
            className="min-h-11 border border-line px-4 py-3 text-left text-[0.68rem] uppercase tracking-[0.28em] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Fazer outro agendamento
          </button>
        </div>
      </SessionFrame>
    );
  }

  const modeLabel =
    bookingMode === 'POINTS' && pointsNeeded != null ? `${pointsNeeded} pontos` : 'Normal';

  return (
    <SessionFrame eyebrow="Cliente" title="Agendar" navigation={<ClientNavigation />}>
      <ol className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-4">
        <StepStatus label="Profissional" status={professional?.displayName ?? 'Pendente'} />
        <StepStatus label="Serviço" status={service?.name ?? 'Pendente'} />
        <StepStatus label="Data" status={date ? civilDate(date) : 'Pendente'} />
        <StepStatus label="Horário" status={time || 'Pendente'} />
        <StepStatus label="Forma" status={service ? modeLabel : 'Pendente'} />
        <StepStatus label="Observação" status={notes.trim() ? 'Preenchida' : 'Opcional'} />
        <StepStatus label="Resumo" status={time ? 'Pronto' : 'Pendente'} />
        <StepStatus label="Confirmar" status={canConfirm ? 'Pronto para confirmar' : 'Pendente'} />
      </ol>

      <div className="mt-10 flex min-w-0 flex-col gap-10">
        <section>
          <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Profissional</h2>
          {professionalsLoading ? <p className="mt-4 text-sm text-muted">Carregando profissionais</p> : null}
          {professionalsError ? (
            <p role="alert" className="mt-4 text-sm text-foreground">
              {professionalsError}
            </p>
          ) : null}
          {!professionalsLoading && !professionalsError && professionals.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhum profissional disponível.</p>
          ) : null}
          <div className="mt-4 flex flex-col gap-2">
            {professionals.map((item) => {
              const selected = item.id === professionalId;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseProfessional(item.id)}
                  className={choiceClass(selected)}
                >
                  {item.displayName}
                  {selected ? <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.22em]">Selecionado</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Serviço</h2>
          {!professional ? <p className="mt-4 text-sm text-muted">Escolha um profissional para ver os serviços.</p> : null}
          {professional && servicesLoading ? <p className="mt-4 text-sm text-muted">Carregando serviços</p> : null}
          {professional && servicesError ? (
            <p role="alert" className="mt-4 text-sm text-foreground">
              {servicesError}
            </p>
          ) : null}
          {professional && !servicesLoading && !servicesError && services.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhum serviço disponível.</p>
          ) : null}
          {professional ? (
            <div className="mt-4 flex flex-col gap-2">
              {services.map((item) => {
                const selected = item.id === serviceId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseService(item.id)}
                    className={choiceClass(selected)}
                  >
                    {item.name} · {item.durationMinutes} min · {money(item.price)}
                    {item.redemptionPoints ? ` ou ${item.redemptionPoints} pontos` : ''}
                    {selected ? (
                      <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.22em]">Selecionado</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        {professional && service ? (
          <section className="flex min-w-0 flex-col gap-4">
            <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
              Data
              <input
                type="date"
                value={date}
                min={todayInSaoPaulo()}
                onChange={(event) => chooseDate(event.target.value)}
                className="w-full min-w-0 max-w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
              />
            </label>
          </section>
        ) : null}

        {professional && service && date ? (
          <section className="flex min-w-0 flex-col gap-4">
            <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Horário</h2>
            {pastDate ? (
              <p className="text-sm text-muted">Não há horários disponíveis para esta data.</p>
            ) : null}
            {slotsLoading ? <p className="text-sm text-muted">Consultando horários</p> : null}
            {slotsError ? (
              <p role="alert" className="text-sm text-foreground">
                {slotsError}
              </p>
            ) : null}
            {!pastDate && !slotsLoading && !slotsError && slots && slots.length === 0 ? (
              <p className="text-sm text-muted">
                Não há horários disponíveis para o profissional, o serviço e a data escolhidos.
              </p>
            ) : null}
            {slots && slots.length > 0 ? (
              <ul aria-label="Horários disponíveis" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {slots.map((slot) => {
                  const selected = slot === time;
                  return (
                    <li key={slot} className="min-w-0">
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => chooseTime(slot)}
                        className={`w-full border px-2 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                          selected
                            ? 'border-foreground text-foreground underline decoration-2 underline-offset-4'
                            : 'border-line text-muted no-underline'
                        }`}
                      >
                        {slot}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        ) : null}

        {service ? (
          <section className="flex min-w-0 flex-col gap-4">
            <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Forma de agendamento</h2>
            {pointsError ? (
              <p role="alert" className="text-sm text-foreground">
                {pointsError}
              </p>
            ) : null}
            {balance != null ? <p className="text-sm text-foreground">Saldo atual {balance} pontos</p> : null}
            {pointsNeeded != null ? (
              <fieldset className="flex min-w-0 flex-col gap-3">
                <legend className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Como utilizar</legend>
                <p className="text-sm text-muted">Este serviço pode usar {pointsNeeded} pontos.</p>
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
                    disabled={pointsUnavailable}
                    onChange={() => setBookingMode('POINTS')}
                  />
                  <span className="break-words">Usar {pointsNeeded} pontos</span>
                </label>
                {balance != null && balance < pointsNeeded ? (
                  <p className="text-sm text-muted">
                    Você possui {balance} pontos. São necessários {pointsNeeded} pontos. O agendamento normal continua
                    disponível.
                  </p>
                ) : null}
                {bookingMode === 'POINTS' ? (
                  <p className="text-sm text-foreground">
                    {pointsNeeded} pontos serão utilizados no momento do agendamento.
                  </p>
                ) : null}
              </fieldset>
            ) : (
              <p className="text-sm text-foreground">Agendamento normal. Este serviço não utiliza pontos.</p>
            )}
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
                placeholder="Opcional"
                onChange={(event) => setNotes(event.target.value)}
                className="w-full min-w-0 resize-y border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent"
              />
            </label>
            <p className="text-sm text-muted">Até 500 caracteres. Opcional.</p>
            <div>
              <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Resumo</h2>
              <dl className="mt-4 max-w-md space-y-4 text-sm">
                <SummaryRow label="Profissional" value={professional.displayName} />
                <SummaryRow label="Serviço" value={service.name} />
                <SummaryRow label="Data" value={civilDate(date)} />
                <SummaryRow label="Horário" value={time} />
                <SummaryRow label="Duração" value={`${service.durationMinutes} min`} />
                <SummaryRow label="Valor" value={money(service.price)} />
                <SummaryRow label="Modalidade" value={modeLabel} />
                {bookingMode === 'POINTS' && pointsNeeded != null ? (
                  <SummaryRow label="Pontos utilizados" value={String(pointsNeeded)} />
                ) : null}
                {balance != null ? <SummaryRow label="Saldo atual" value={`${balance} pontos`} /> : null}
              </dl>
            </div>
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-foreground">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={!canConfirm || pending}
          aria-busy={pending}
          className="min-h-11 w-full bg-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-60 sm:w-auto"
        >
          {pending ? 'Confirmando' : 'Confirmar agendamento'}
        </button>
      </div>
    </SessionFrame>
  );
}

function StepStatus({ label, status }: { label: string; status: string }) {
  return (
    <li className="min-w-0 border-t border-line pt-3">
      <span className="text-[0.68rem] uppercase tracking-[0.22em] text-muted">{label}</span>
      <p className="mt-1 break-words text-sm text-foreground">{status}</p>
    </li>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-t border-line pt-4">
      <dt className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">{label}</dt>
      <dd className="mt-2 break-words text-base text-foreground">{value}</dd>
    </div>
  );
}
