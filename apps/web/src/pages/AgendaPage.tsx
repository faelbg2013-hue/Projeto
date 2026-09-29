import type { ScheduleException, ServiceItem, TimeBlock } from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { Field } from '../components/Field';
import { SessionFrame, adminLinks, professionalLinks } from '../components/SessionFrame';
import { useActiveServices } from '../hooks/useActiveServices';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiClientError } from '../services/api';
import { professionalsService } from '../services/professionals.service';
import { scheduleService } from '../services/schedule.service';

const DAYS = [
  { day: 1, label: 'Segunda' },
  { day: 2, label: 'Terça' },
  { day: 3, label: 'Quarta' },
  { day: 4, label: 'Quinta' },
  { day: 5, label: 'Sexta' },
  { day: 6, label: 'Sábado' },
  { day: 7, label: 'Domingo' },
] as const;

type DraftInterval = { key: string; startTime: string; endTime: string };

function emptyWeek(): Record<number, DraftInterval[]> {
  return { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
}

function minutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function wallInstant(date: string, time: string): string {
  return `${date}T${time}:00-03:00`;
}

function labelInstant(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]} ${match[2]}` : value;
}

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof ApiClientError || caught instanceof Error ? caught.message : fallback;
}

export function AgendaPage({ scope }: { scope: 'me' | 'admin' }) {
  const params = useParams();
  const routeId = scope === 'admin' ? params.professionalId : undefined;
  const catalog = useActiveServices();
  const [targetId, setTargetId] = useState<string | null>(scope === 'admin' ? (routeId ?? null) : null);
  const [week, setWeek] = useState<Record<number, DraftInterval[]>>(emptyWeek);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [blockDate, setBlockDate] = useState('');
  const [blockStart, setBlockStart] = useState('12:00');
  const [blockEnd, setBlockEnd] = useState('13:30');
  const [blockReason, setBlockReason] = useState('');
  const [blockFullDay, setBlockFullDay] = useState(false);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionType, setExceptionType] = useState<'BLOCK' | 'OPEN'>('OPEN');
  const [exceptionStart, setExceptionStart] = useState('08:00');
  const [exceptionEnd, setExceptionEnd] = useState('14:00');
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionFullDay, setExceptionFullDay] = useState(false);
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [serviceId, setServiceId] = useState('');
  useDocumentTitle('Agenda — Ravion Barber');

  const scheduleKey: 'me' | string | undefined = scope === 'me' ? 'me' : routeId;

  useEffect(() => {
    if (!scheduleKey) {
      setLoading(false);
      setLoadError('Profissional não informado.');
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);
    const profile =
      scope === 'me' ? professionalsService.me().then((profileRow) => profileRow.id) : Promise.resolve(scheduleKey);
    Promise.all([
      profile,
      scheduleService.getSchedule(scheduleKey),
      scheduleService.listBlocks(scheduleKey),
      scheduleService.listExceptions(scheduleKey),
    ])
      .then(([professionalId, schedule, blockPage, exceptionPage]) => {
        if (!active) {
          return;
        }
        setTargetId(professionalId);
        const next = emptyWeek();
        for (const interval of schedule.intervals) {
          next[interval.dayOfWeek] = [
            ...(next[interval.dayOfWeek] ?? []),
            {
              key: interval.id,
              startTime: interval.startTime,
              endTime: interval.endTime,
            },
          ];
        }
        setWeek(next);
        setBlocks(blockPage.data);
        setExceptions(exceptionPage.data);
      })
      .catch((caught: unknown) => {
        if (active) {
          setLoadError(messageOf(caught, 'Não foi possível carregar a agenda.'));
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
  }, [scheduleKey, scope]);

  function updateInterval(day: number, key: string, field: 'startTime' | 'endTime', value: string): void {
    setWeek((current) => ({
      ...current,
      [day]: (current[day] ?? []).map((interval) =>
        interval.key === key ? { ...interval, [field]: value } : interval,
      ),
    }));
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!scheduleKey) {
      return;
    }
    setScheduleError(null);
    setScheduleNotice(null);
    const intervals = DAYS.flatMap(({ day }) =>
      (week[day] ?? []).map((interval) => ({
        dayOfWeek: day,
        startTime: interval.startTime,
        endTime: interval.endTime,
      })),
    );
    const byDay = new Map<number, Array<{ start: number; end: number }>>();
    for (const interval of intervals) {
      const start = minutes(interval.startTime);
      const end = minutes(interval.endTime);
      if (start === null || end === null) {
        setScheduleError('Informe início e fim no formato HH:mm.');
        return;
      }
      if (start >= end) {
        setScheduleError('O horário inicial precisa ser anterior ao horário final.');
        return;
      }
      const current = byDay.get(interval.dayOfWeek) ?? [];
      if (current.some((range) => start < range.end && range.start < end)) {
        setScheduleError('Os intervalos se sobrepõem.');
        return;
      }
      current.push({ start, end });
      byDay.set(interval.dayOfWeek, current);
    }
    setPending(true);
    try {
      await scheduleService.replaceSchedule(scheduleKey, intervals);
      setScheduleNotice('Agenda salva.');
    } catch (caught) {
      setScheduleError(messageOf(caught, 'Não foi possível salvar a agenda.'));
    } finally {
      setPending(false);
    }
  }

  async function createBlock(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!scheduleKey) {
      return;
    }
    setBlockError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate)) {
      setBlockError('Informe a data do bloqueio.');
      return;
    }
    const startAt = blockFullDay ? wallInstant(blockDate, '00:00') : wallInstant(blockDate, blockStart);
    const endAt = blockFullDay ? `${blockDate}T23:59:59-03:00` : wallInstant(blockDate, blockEnd);
    if (!blockFullDay && (minutes(blockStart) === null || minutes(blockEnd) === null)) {
      setBlockError('Informe início e fim do bloqueio.');
      return;
    }
    setPending(true);
    try {
      await scheduleService.createBlock(scheduleKey, {
        startAt,
        endAt,
        reason: blockReason.trim() || null,
      });
      const page = await scheduleService.listBlocks(scheduleKey);
      setBlocks(page.data);
      setBlockReason('');
    } catch (caught) {
      setBlockError(messageOf(caught, 'Não foi possível criar o bloqueio.'));
    } finally {
      setPending(false);
    }
  }

  async function removeBlock(blockId: string): Promise<void> {
    if (!scheduleKey) {
      return;
    }
    setBlockError(null);
    try {
      await scheduleService.deleteBlock(scheduleKey, blockId);
      setBlocks((current) => current.filter((block) => block.id !== blockId));
    } catch (caught) {
      setBlockError(messageOf(caught, 'Não foi possível remover o bloqueio.'));
    }
  }

  async function createException(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!scheduleKey) {
      return;
    }
    setExceptionError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exceptionDate)) {
      setExceptionError('Informe a data da exceção.');
      return;
    }
    setPending(true);
    try {
      await scheduleService.createException(scheduleKey, {
        date: exceptionDate,
        type: exceptionType,
        startTime: exceptionFullDay ? null : exceptionStart,
        endTime: exceptionFullDay ? null : exceptionEnd,
        reason: exceptionReason.trim() || null,
      });
      const page = await scheduleService.listExceptions(scheduleKey);
      setExceptions(page.data);
      setExceptionReason('');
    } catch (caught) {
      setExceptionError(messageOf(caught, 'Não foi possível criar a exceção.'));
    } finally {
      setPending(false);
    }
  }

  async function removeException(exceptionId: string): Promise<void> {
    if (!scheduleKey) {
      return;
    }
    setExceptionError(null);
    try {
      await scheduleService.deleteException(scheduleKey, exceptionId);
      setExceptions((current) => current.filter((item) => item.id !== exceptionId));
    } catch (caught) {
      setExceptionError(messageOf(caught, 'Não foi possível remover a exceção.'));
    }
  }

  async function consultAvailability(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!targetId) {
      return;
    }
    setAvailabilityError(null);
    setSlots(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(availabilityDate) || !serviceId) {
      setAvailabilityError('Informe a data e o serviço.');
      return;
    }
    setPending(true);
    try {
      const result = await scheduleService.availability(targetId, availabilityDate, serviceId);
      setSlots(result.slots);
    } catch (caught) {
      setAvailabilityError(messageOf(caught, 'Não foi possível consultar a disponibilidade.'));
    } finally {
      setPending(false);
    }
  }

  const links =
    scope === 'admin'
      ? adminLinks
      : professionalLinks;

  return (
    <SessionFrame eyebrow={scope === 'admin' ? 'Administração' : 'Profissional'} title="Agenda" links={links}>
      {loading ? <p className="text-sm text-muted">Carregando agenda</p> : null}
      {loadError ? <p className="text-sm text-foreground">{loadError}</p> : null}
      {!loading && !loadError ? (
        <div className="min-w-0 space-y-12">
          <form className="space-y-6" onSubmit={(event) => void saveSchedule(event)}>
            <p className="text-sm text-muted">
              Horários de trabalho no fuso de Brasília. Um dia sem intervalo fica fechado.
            </p>
            {DAYS.map(({ day, label }) => (
              <section key={day} aria-label={label} className="min-w-0 border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg text-foreground">{label}</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setWeek((current) => ({
                        ...current,
                        [day]: [
                          ...(current[day] ?? []),
                          { key: crypto.randomUUID(), startTime: '08:00', endTime: '12:00' },
                        ],
                      }))
                    }
                    className="text-[0.68rem] uppercase tracking-[0.22em] text-foreground"
                  >
                    Adicionar intervalo
                  </button>
                </div>
                {(week[day] ?? []).length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Fechado</p>
                ) : null}
                <div className="mt-3 space-y-3">
                  {(week[day] ?? []).map((interval, index) => (
                    <div key={interval.key} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <Field
                        label={`Início ${label} ${index + 1}`}
                        type="time"
                        value={interval.startTime}
                        onChange={(value) => updateInterval(day, interval.key, 'startTime', value)}
                      />
                      <Field
                        label={`Fim ${label} ${index + 1}`}
                        type="time"
                        value={interval.endTime}
                        onChange={(value) => updateInterval(day, interval.key, 'endTime', value)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setWeek((current) => ({
                            ...current,
                            [day]: (current[day] ?? []).filter((item) => item.key !== interval.key),
                          }))
                        }
                        className="self-end px-2 py-3 text-[0.68rem] uppercase tracking-[0.22em] text-muted"
                      >
                        Remover {label} {index + 1}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {scheduleError ? (
              <p role="alert" className="text-sm text-foreground">
                {scheduleError}
              </p>
            ) : null}
            {scheduleNotice ? <p className="text-sm text-foreground">{scheduleNotice}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="bg-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-background disabled:opacity-60"
            >
              Salvar agenda
            </button>
          </form>

          <section aria-label="Bloqueios" className="min-w-0 space-y-4">
            <h2 className="font-display text-3xl text-foreground">Bloqueios</h2>
            <form className="space-y-4" onSubmit={(event) => void createBlock(event)}>
              <Field label="Data do bloqueio" type="date" value={blockDate} onChange={setBlockDate} />
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={blockFullDay}
                  onChange={(event) => setBlockFullDay(event.target.checked)}
                />
                Dia inteiro
              </label>
              {blockFullDay ? null : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Início do bloqueio" type="time" value={blockStart} onChange={setBlockStart} />
                  <Field label="Fim do bloqueio" type="time" value={blockEnd} onChange={setBlockEnd} />
                </div>
              )}
              <Field label="Motivo do bloqueio" value={blockReason} onChange={setBlockReason} />
              <p className="text-sm text-muted">Horário de Brasília. O fuso do navegador não é usado.</p>
              {blockError ? (
                <p role="alert" className="text-sm text-foreground">
                  {blockError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
              >
                Criar bloqueio
              </button>
            </form>
            {blocks.length === 0 ? <p className="text-sm text-muted">Nenhum bloqueio.</p> : null}
            <div className="space-y-3">
              {blocks.map((block) => (
                <article key={block.id} className="min-w-0 border border-line p-4">
                  <p className="break-words text-sm text-foreground">
                    {labelInstant(block.startAt)} — {labelInstant(block.endAt)}
                  </p>
                  <p className="mt-1 break-words text-sm text-muted">{block.reason ?? 'Sem motivo'}</p>
                  <button
                    type="button"
                    onClick={() => void removeBlock(block.id)}
                    className="mt-3 text-[0.68rem] uppercase tracking-[0.22em] text-muted"
                  >
                    Remover bloqueio {block.reason ?? block.id}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section aria-label="Exceções" className="min-w-0 space-y-4">
            <h2 className="font-display text-3xl text-foreground">Exceções</h2>
            <form className="space-y-4" onSubmit={(event) => void createException(event)}>
              <Field label="Data da exceção" type="date" value={exceptionDate} onChange={setExceptionDate} />
              <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                Tipo
                <select
                  value={exceptionType}
                  onChange={(event) => setExceptionType(event.target.value === 'BLOCK' ? 'BLOCK' : 'OPEN')}
                  className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground"
                >
                  <option value="OPEN">Abrir</option>
                  <option value="BLOCK">Bloquear</option>
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={exceptionFullDay}
                  onChange={(event) => setExceptionFullDay(event.target.checked)}
                />
                Dia inteiro na exceção
              </label>
              {exceptionFullDay ? null : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="Início da exceção"
                    type="time"
                    value={exceptionStart}
                    onChange={setExceptionStart}
                  />
                  <Field label="Fim da exceção" type="time" value={exceptionEnd} onChange={setExceptionEnd} />
                </div>
              )}
              <Field label="Motivo da exceção" value={exceptionReason} onChange={setExceptionReason} />
              {exceptionError ? (
                <p role="alert" className="text-sm text-foreground">
                  {exceptionError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
              >
                Criar exceção
              </button>
            </form>
            {exceptions.length === 0 ? <p className="text-sm text-muted">Nenhuma exceção.</p> : null}
            <div className="space-y-3">
              {exceptions.map((item) => (
                <article key={item.id} className="min-w-0 border border-line p-4">
                  <p className="text-sm text-foreground">
                    {item.date} · {item.type === 'OPEN' ? 'Abrir' : 'Bloquear'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {item.startTime && item.endTime ? `${item.startTime} — ${item.endTime}` : 'Dia inteiro'}
                  </p>
                  <p className="mt-1 break-words text-sm text-muted">{item.reason ?? 'Sem motivo'}</p>
                  <button
                    type="button"
                    onClick={() => void removeException(item.id)}
                    className="mt-3 text-[0.68rem] uppercase tracking-[0.22em] text-muted"
                  >
                    Remover exceção {item.reason ?? item.id}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <AvailabilityPreview
            services={catalog.services}
            servicesError={catalog.error}
            date={availabilityDate}
            serviceId={serviceId}
            slots={slots}
            error={availabilityError}
            onDate={setAvailabilityDate}
            onService={setServiceId}
            onSubmit={consultAvailability}
          />
        </div>
      ) : null}
    </SessionFrame>
  );
}

function AvailabilityPreview({
  services,
  servicesError,
  date,
  serviceId,
  slots,
  error,
  onDate,
  onService,
  onSubmit,
}: {
  services: ServiceItem[];
  servicesError: string | null;
  date: string;
  serviceId: string;
  slots: string[] | null;
  error: string | null;
  onDate: (value: string) => void;
  onService: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <section aria-label="Disponibilidade" className="min-w-0 space-y-4">
      <h2 className="font-display text-3xl text-foreground">Disponibilidade</h2>
      <p className="text-sm text-muted">Consulta de leitura. Não reserva horário.</p>
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <Field label="Data da consulta" type="date" value={date} onChange={onDate} />
        <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
          Serviço
          <select
            value={serviceId}
            onChange={(event) => onService(event.target.value)}
            className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground"
          >
            <option value="">Selecione</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        {servicesError ? <p className="text-sm text-foreground">{servicesError}</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-foreground">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
        >
          Consultar disponibilidade
        </button>
      </form>
      {slots ? (
        slots.length === 0 ? (
          <p className="text-sm text-muted">Nenhum horário disponível.</p>
        ) : (
          <ul aria-label="Horários disponíveis" className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <li key={slot} className="border border-line px-3 py-2 text-sm text-foreground">
                {slot}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
