import type { ProfessionalDay, ProfessionalDayAppointment, ProfessionalSchedule, TimeBlock } from '@ravion/types';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AppointmentDetailDialog } from '../components/AppointmentDetailDialog';
import { ProfessionalDaySummaryCards } from '../components/ProfessionalDaySummary';
import { SessionFrame, professionalLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { addCivilDays, civilWeekday, formatCivilDate } from '../lib/civil-date';
import { appointmentStatusLabel } from '../services/appointments.service';
import { professionalDayService } from '../services/professional-day.service';
import { scheduleService } from '../services/schedule.service';

const PX = 1.35;

function wallMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function labelMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function blocksOnDay(blocks: TimeBlock[], date: string): Array<{ block: TimeBlock; start: number; end: number }> {
  const dayStart = new Date(`${date}T00:00:00-03:00`).getTime();
  const dayEnd = new Date(`${addCivilDays(date, 1)}T00:00:00-03:00`).getTime();
  return blocks.flatMap((block) => {
    const from = Math.max(new Date(block.startAt).getTime(), dayStart);
    const to = Math.min(new Date(block.endAt).getTime(), dayEnd);
    if (to <= from) {
      return [];
    }
    return [{ block, start: Math.round((from - dayStart) / 60_000), end: Math.round((to - dayStart) / 60_000) }];
  });
}

function dayRange(
  date: string,
  schedule: ProfessionalSchedule | null,
  appointments: ProfessionalDayAppointment[],
  blocks: Array<{ start: number; end: number }>,
): { start: number; end: number } | null {
  const points: number[] = [];
  const weekday = civilWeekday(date);
  for (const interval of schedule?.intervals ?? []) {
    if (interval.dayOfWeek === weekday && interval.isActive) {
      points.push(wallMinutes(interval.startTime), wallMinutes(interval.endTime));
    }
  }
  for (const item of appointments) {
    points.push(wallMinutes(item.time), wallMinutes(item.endTime));
  }
  for (const block of blocks) {
    points.push(block.start, block.end);
  }
  if (points.length === 0) {
    return null;
  }
  const start = Math.floor(Math.min(...points) / 60) * 60;
  let end = Math.ceil(Math.max(...points) / 60) * 60;
  if (end <= start) {
    end = start + 60;
  }
  return { start, end };
}

export function ProfessionalAgendaPage() {
  useDocumentTitle('Agenda do dia — Ravion Barber');
  const [params, setParams] = useSearchParams();
  const requested = params.get('date') ?? '';
  const dateQuery = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : undefined;
  const [day, setDay] = useState<ProfessionalDay | null>(null);
  const [schedule, setSchedule] = useState<ProfessionalSchedule | null>(null);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blockStart, setBlockStart] = useState('12:00');
  const [blockEnd, setBlockEnd] = useState('13:00');
  const [blockReason, setBlockReason] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockPending, setBlockPending] = useState(false);
  const closeDetail = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    let active = true;
    scheduleService
      .getSchedule('me')
      .then((next) => {
        if (active) {
          setSchedule(next);
        }
      })
      .catch(() => {
        if (active) {
          setSchedule(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      professionalDayService.get(dateQuery),
      scheduleService.listBlocks('me', { pageSize: 100 }),
    ])
      .then(([nextDay, nextBlocks]) => {
        if (!active) {
          return;
        }
        setDay(nextDay);
        setBlocks(nextBlocks.data);
      })
      .catch((caught: unknown) => {
        if (active) {
          setDay(null);
          setError(messageOf(caught, 'Não foi possível carregar a agenda.'));
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
  }, [dateQuery, reloadKey]);

  useEffect(() => {
    if (!loading && window.location.hash === '#bloqueio') {
      document.getElementById('bloqueio')?.scrollIntoView();
    }
  }, [loading]);

  const resolvedDate = day?.date ?? dateQuery ?? '';
  const visibleBlocks = resolvedDate ? blocksOnDay(blocks, resolvedDate) : [];
  const range = resolvedDate ? dayRange(resolvedDate, schedule, day?.appointments ?? [], visibleBlocks) : null;
  const selected = day?.appointments.find((item) => item.id === selectedId) ?? null;

  function go(next: string | null): void {
    setParams(next ? { date: next } : {});
  }

  async function createBlock(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!resolvedDate) {
      return;
    }
    setBlockPending(true);
    setBlockError(null);
    try {
      await scheduleService.createBlock('me', {
        startAt: `${resolvedDate}T${blockStart}:00-03:00`,
        endAt: `${resolvedDate}T${blockEnd}:00-03:00`,
        reason: blockReason.trim() || null,
      });
      const page = await scheduleService.listBlocks('me', { pageSize: 100 });
      setBlocks(page.data);
      setBlockReason('');
    } catch (caught) {
      setBlockError(messageOf(caught, 'Não foi possível bloquear o horário.'));
    } finally {
      setBlockPending(false);
    }
  }

  async function removeBlock(blockId: string): Promise<void> {
    setBlockError(null);
    try {
      await scheduleService.deleteBlock('me', blockId);
      setBlocks((current) => current.filter((item) => item.id !== blockId));
    } catch (caught) {
      setBlockError(messageOf(caught, 'Não foi possível remover o bloqueio.'));
    }
  }

  return (
    <SessionFrame eyebrow="Profissional" title="Agenda do dia" links={professionalLinks}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => resolvedDate && go(addCivilDays(resolvedDate, -1))} className="min-h-12 border border-line px-4 py-3 text-sm">
          Dia anterior
        </button>
        <button type="button" onClick={() => go(null)} className="min-h-12 border border-line px-4 py-3 text-sm">
          Hoje
        </button>
        <button type="button" onClick={() => resolvedDate && go(addCivilDays(resolvedDate, 1))} className="min-h-12 border border-line px-4 py-3 text-sm">
          Próximo dia
        </button>
      </div>
      <label className="mt-4 flex min-w-0 max-w-xs flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
        Data
        <input
          type="date"
          value={resolvedDate}
          onChange={(event) => go(event.target.value || null)}
          className="w-full border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none"
        />
      </label>
      {resolvedDate ? <p className="mt-4 text-sm capitalize text-foreground">{formatCivilDate(resolvedDate)}</p> : null}
      <p className="mt-4">
        <Link to="/profissional/agenda/semana" className="text-sm text-muted">
          Horário semanal
        </Link>
      </p>

      {loading ? <p className="mt-8 text-sm text-muted">Carregando agenda</p> : null}
      {error ? <p className="mt-8 text-sm text-foreground">{error}</p> : null}

      {day && !loading ? (
        <div className="mt-8 flex min-w-0 flex-col gap-8">
          <ProfessionalDaySummaryCards summary={day.summary} />
          {range ? (
            <DayTimeline
              range={range}
              appointments={day.appointments}
              blocks={visibleBlocks}
              onOpen={setSelectedId}
            />
          ) : (
            <p className="text-sm text-muted">Nenhum atendimento neste dia.</p>
          )}
          <section aria-label="Atendimentos" className="flex flex-col gap-3">
            {day.appointments.map((item) => (
              <article key={item.id} className="min-w-0 border border-line bg-surface p-4">
                <p className="text-sm text-foreground">
                  {item.time}–{item.endTime}
                </p>
                <h2 className="mt-1 break-words text-lg">{item.clientName}</h2>
                <p className="break-words text-sm text-muted">
                  {item.serviceName} · {item.durationMinutes} min
                </p>
                <p className="mt-1 text-sm">{appointmentStatusLabel[item.status]}</p>
                <p className="mt-1 text-sm">{item.bookingMode === 'POINTS' ? 'POINTS' : 'NORMAL'}</p>
                {item.bookingMode === 'POINTS' && item.redemptionPointsSnapshot != null ? (
                  <p className="mt-1 text-sm">Resgate de {item.redemptionPointsSnapshot} pontos</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="mt-4 min-h-12 w-full border border-line px-4 py-3 text-sm uppercase tracking-[0.18em]"
                >
                  Abrir atendimento
                </button>
              </article>
            ))}
          </section>

          <section id="bloqueio" aria-label="Bloqueio de horário" className="min-w-0">
            <h2 className="font-display text-3xl">Bloquear horário</h2>
            <form className="mt-4 flex min-w-0 flex-col gap-4" onSubmit={(event) => void createBlock(event)}>
              <label className="flex flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                Início do bloqueio
                <input
                  type="time"
                  value={blockStart}
                  onChange={(event) => setBlockStart(event.target.value)}
                  required
                  className="border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="flex flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                Fim do bloqueio
                <input
                  type="time"
                  value={blockEnd}
                  onChange={(event) => setBlockEnd(event.target.value)}
                  required
                  className="border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="flex flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                Motivo
                <input
                  type="text"
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
                  maxLength={240}
                  className="border border-line bg-surface px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground"
                />
              </label>
              {blockError ? <p className="text-sm text-foreground">{blockError}</p> : null}
              <button
                type="submit"
                disabled={blockPending}
                className="min-h-12 bg-foreground px-4 py-3 text-sm uppercase tracking-[0.18em] text-background disabled:opacity-60"
              >
                Bloquear horário
              </button>
            </form>
            <ul className="mt-6 flex flex-col gap-3">
              {visibleBlocks.length === 0 ? <li className="text-sm text-muted">Nenhum bloqueio neste dia.</li> : null}
              {visibleBlocks.map(({ block }) => (
                <li key={block.id} className="flex min-w-0 flex-col gap-3 border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="break-words text-sm">
                    {block.startAt.slice(11, 16)}–{block.endAt.slice(11, 16)}
                    {block.reason ? ` · ${block.reason}` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => void removeBlock(block.id)}
                    className="min-h-12 border border-line px-4 py-3 text-sm"
                  >
                    Remover bloqueio {block.reason ?? block.startAt.slice(11, 16)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {selected ? (
        <AppointmentDetailDialog item={selected} onClose={closeDetail} onUpdated={() => setReloadKey((value) => value + 1)} />
      ) : null}
    </SessionFrame>
  );
}

function DayTimeline({
  range,
  appointments,
  blocks,
  onOpen,
}: {
  range: { start: number; end: number };
  appointments: ProfessionalDayAppointment[];
  blocks: Array<{ block: TimeBlock; start: number; end: number }>;
  onOpen: (id: string) => void;
}) {
  const height = (range.end - range.start) * PX;
  const hours: number[] = [];
  for (let minute = range.start; minute <= range.end; minute += 60) {
    hours.push(minute);
  }

  return (
    <div
      role="region"
      aria-label="Linha do tempo"
      className="relative min-w-0 overflow-hidden border border-line"
      style={{ height }}
    >
      {hours.map((minute) => (
        <div
          key={minute}
          className="absolute left-0 right-0 border-t border-line text-[0.68rem] text-muted"
          style={{ top: (minute - range.start) * PX }}
        >
          <span className="bg-background px-2">{labelMinutes(minute)}</span>
        </div>
      ))}
      {blocks.map(({ block, start, end }) => (
        <div
          key={block.id}
          className="absolute left-16 right-3 bg-line"
          style={{ top: (start - range.start) * PX, height: Math.max((end - start) * PX, 8) }}
        />
      ))}
      {appointments.map((item) => {
        const start = wallMinutes(item.time);
        const end = wallMinutes(item.endTime);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item.id)}
            aria-label={`${item.time} ${item.clientName}`}
            className="absolute left-16 right-3 overflow-hidden border border-foreground bg-surface px-2 text-left text-xs"
            style={{ top: (start - range.start) * PX, height: Math.max((end - start) * PX, 28) }}
          >
            <span className="block truncate">
              {item.time} {item.clientName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
