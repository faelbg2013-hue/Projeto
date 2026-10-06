import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { Field } from '../components/Field';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  businessDays,
  draftFromSettings,
  payloadFromDraft,
  type BusinessDayId,
  type BusinessHoursDraft,
} from '../lib/business-hours';
import { ApiClientError } from '../services/api';
import { settingsService } from '../services/settings.service';

export function AdminSettingsPage() {
  useDocumentTitle('Configurações — Ravion Barber');
  const [draft, setDraft] = useState<BusinessHoursDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [bookingAdvance, setBookingAdvance] = useState('0');
  const [cancellationAdvance, setCancellationAdvance] = useState('0');
  const [bufferMinutes, setBufferMinutes] = useState('0');
  const [maxAdvanceDays, setMaxAdvanceDays] = useState('0');
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const [policyPending, setPolicyPending] = useState(false);

  useEffect(() => {
    let active = true;
    settingsService
      .get()
      .then((response) => {
        if (active) {
          setDraft(draftFromSettings(response.settings));
          setBookingAdvance(String(response.settings.booking_min_advance_minutes ?? 0));
          setCancellationAdvance(String(response.settings.cancellation_min_advance_minutes ?? 0));
          setBufferMinutes(String(response.settings.appointment_buffer_minutes ?? 0));
          setMaxAdvanceDays(String(response.settings.booking_max_advance_days ?? 0));
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setLoadError(messageFrom(caught, 'Não foi possível carregar as configurações.'));
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
  }, []);

  function updateDay(id: BusinessDayId, patch: Partial<BusinessHoursDraft[BusinessDayId]>): void {
    setDraft((current) => (current ? { ...current, [id]: { ...current[id], ...patch } } : current));
    setSavedMessage(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft || pending) {
      return;
    }

    const invalid = businessDays.find((day) => {
      const value = draft[day.id];
      return value.enabled && (!value.open || !value.close || value.open >= value.close);
    });
    if (invalid) {
      setSaveError('O horário inicial precisa ser anterior ao horário final.');
      setSavedMessage(null);
      return;
    }

    setPending(true);
    setSaveError(null);
    setSavedMessage(null);
    try {
      const response = await settingsService.update({ settings: { business_hours: payloadFromDraft(draft) } });
      setDraft(draftFromSettings(response.settings));
      setSavedMessage('Horário de funcionamento salvo.');
    } catch (caught) {
      setSaveError(messageFrom(caught, 'Não foi possível salvar o horário de funcionamento.'));
    } finally {
      setPending(false);
    }
  }

  async function onSavePolicy(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (policyPending) {
      return;
    }
    const booking = boundedMinutes(bookingAdvance, ADVANCE_MAX_MINUTES);
    const cancellation = boundedMinutes(cancellationAdvance, ADVANCE_MAX_MINUTES);
    const buffer = boundedMinutes(bufferMinutes, BUFFER_MAX_MINUTES);
    const horizon = boundedMinutes(maxAdvanceDays, HORIZON_MAX_DAYS);
    if (booking === null || cancellation === null) {
      setPolicyError('Informe minutos inteiros entre 0 e 43200.');
      setPolicyMessage(null);
      return;
    }
    if (buffer === null) {
      setPolicyError('Informe um intervalo inteiro entre 0 e 240.');
      setPolicyMessage(null);
      return;
    }
    if (horizon === null) {
      setPolicyError('Informe uma antecedência máxima inteira entre 0 e 365.');
      setPolicyMessage(null);
      return;
    }

    setPolicyPending(true);
    setPolicyError(null);
    setPolicyMessage(null);
    try {
      const response = await settingsService.update({
        settings: {
          booking_min_advance_minutes: booking,
          cancellation_min_advance_minutes: cancellation,
          appointment_buffer_minutes: buffer,
          booking_max_advance_days: horizon,
        },
      });
      setBookingAdvance(String(response.settings.booking_min_advance_minutes ?? booking));
      setCancellationAdvance(String(response.settings.cancellation_min_advance_minutes ?? cancellation));
      setBufferMinutes(String(response.settings.appointment_buffer_minutes ?? buffer));
      setMaxAdvanceDays(String(response.settings.booking_max_advance_days ?? horizon));
      setPolicyMessage('Políticas de antecedência salvas.');
    } catch (caught) {
      setPolicyError(messageFrom(caught, 'Não foi possível salvar as políticas de antecedência.'));
    } finally {
      setPolicyPending(false);
    }
  }

  return (
    <SessionFrame
      eyebrow="Administração"
      title="Configurações"
      links={adminLinks}
      shellClassName="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8"
    >
      <section className="min-w-0">
        <h2 className="font-display text-3xl font-medium tracking-tight text-foreground">
          Horário de funcionamento
        </h2>
        <p className="mt-3 max-w-xl text-sm text-muted">
          Estes horários representam o funcionamento do estabelecimento.
        </p>
      </section>

      {loading ? <p className="mt-8 text-sm text-muted">Carregando configurações</p> : null}
      {loadError ? (
        <p role="alert" className="mt-8 text-sm text-foreground">
          {loadError}
        </p>
      ) : null}

      {draft ? (
        <form
          className="@container/hours mt-8 flex min-w-0 flex-col gap-4"
          onSubmit={(event) => void onSubmit(event)}
          noValidate
        >
          {businessDays.map((day) => {
            const value = draft[day.id];
            return (
              <section
                key={day.id}
                role="region"
                aria-labelledby={`${day.id}-label`}
                className="min-w-0 border border-line bg-surface p-3 sm:p-4"
              >
                <div className="flex min-w-0 flex-col gap-3 @min-[52rem]/hours:flex-row @min-[52rem]/hours:items-end">
                  <h3
                    id={`${day.id}-label`}
                    className="min-w-0 break-words text-lg text-foreground @min-[52rem]/hours:w-40 @min-[52rem]/hours:shrink-0 @min-[52rem]/hours:pb-3"
                  >
                    {day.label}
                  </h3>
                  <div className="flex min-w-0 flex-1 flex-col gap-3 @min-[24rem]/hours:flex-row @min-[24rem]/hours:items-end">
                    <button
                      type="button"
                      aria-pressed={value.enabled}
                      onClick={() => updateDay(day.id, { enabled: !value.enabled })}
                      className="w-fit max-w-full shrink-0 border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-muted aria-pressed:border-accent aria-pressed:text-foreground"
                    >
                      {value.enabled ? 'Aberto' : 'Fechado'}
                    </button>
                    {value.enabled ? (
                      <div className="grid w-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 [&_input]:max-w-full [&_input]:min-w-0 [&_input]:px-2 [&_label]:min-w-0">
                        <Field
                          label="Início"
                          type="time"
                          value={value.open}
                          onChange={(open) => updateDay(day.id, { open })}
                        />
                        <span className="pb-3 text-sm normal-case tracking-normal text-muted">até</span>
                        <Field
                          label="Fim"
                          type="time"
                          value={value.close}
                          onChange={(close) => updateDay(day.id, { close })}
                        />
                      </div>
                    ) : (
                      <p className="pb-3 text-sm text-muted">Fechado</p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}

          {saveError ? (
            <p role="alert" className="text-sm text-foreground">
              {saveError}
            </p>
          ) : null}
          {savedMessage ? (
            <p role="status" className="text-sm text-foreground">
              {savedMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full max-w-full bg-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-background disabled:opacity-60 md:w-fit"
          >
            {pending ? 'Salvando' : 'Salvar alterações'}
          </button>
        </form>
      ) : null}

      {!loading && !loadError ? (
        <section className="mt-12 min-w-0 border-t border-line pt-10">
          <h2 className="font-display text-3xl font-medium tracking-tight text-foreground">Antecedência</h2>
          <p className="mt-3 max-w-xl text-sm text-muted">
            0 minutos = sem antecedência mínima. O máximo é 43200 minutos, o equivalente a 30 dias. O cancelamento
            vale só para o cliente.
          </p>
          <form className="mt-6 grid min-w-0 gap-4 md:grid-cols-2" onSubmit={(event) => void onSavePolicy(event)} noValidate>
            <Field
              label="Antecedência mínima para agendamento"
              value={bookingAdvance}
              onChange={(value) => {
                setBookingAdvance(value);
                setPolicyMessage(null);
              }}
              inputMode="numeric"
            />
            <Field
              label="Antecedência mínima para cancelamento pelo cliente"
              value={cancellationAdvance}
              onChange={(value) => {
                setCancellationAdvance(value);
                setPolicyMessage(null);
              }}
              inputMode="numeric"
            />
            <div className="min-w-0 md:col-span-2">
              <p className="mb-4 max-w-xl text-sm normal-case tracking-normal text-muted">
                Quantidade máxima de dias no futuro disponível para novos agendamentos. Use 0 para não limitar.
              </p>
              <Field
                label="Antecedência máxima para agendamento"
                value={maxAdvanceDays}
                onChange={(value) => {
                  setMaxAdvanceDays(value);
                  setPolicyMessage(null);
                }}
                inputMode="numeric"
              />
            </div>
            <div className="min-w-0 md:col-span-2">
              <p className="mb-4 max-w-xl text-sm normal-case tracking-normal text-muted">
                Tempo reservado após cada atendimento antes do próximo horário. Use 0 para não aplicar intervalo.
              </p>
              <Field
                label="Intervalo entre atendimentos"
                value={bufferMinutes}
                onChange={(value) => {
                  setBufferMinutes(value);
                  setPolicyMessage(null);
                }}
                inputMode="numeric"
              />
            </div>
            {policyError ? (
              <p role="alert" className="text-sm text-foreground md:col-span-2">
                {policyError}
              </p>
            ) : null}
            {policyMessage ? (
              <p role="status" className="text-sm text-foreground md:col-span-2">
                {policyMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={policyPending}
              className="w-full max-w-full bg-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-background disabled:opacity-60 md:col-span-2 md:w-fit"
            >
              {policyPending ? 'Salvando políticas' : 'Salvar políticas'}
            </button>
          </form>
        </section>
      ) : null}
    </SessionFrame>
  );
}

const ADVANCE_MINUTES = /^(0|[1-9]\d*)$/;
const ADVANCE_MAX_MINUTES = 43_200;
const BUFFER_MAX_MINUTES = 240;
const HORIZON_MAX_DAYS = 365;

function boundedMinutes(value: string, max: number): number | null {
  const trimmed = value.trim();
  if (!ADVANCE_MINUTES.test(trimmed)) {
    return null;
  }
  const minutes = Number(trimmed);
  if (minutes > max) {
    return null;
  }
  return minutes;
}

function messageFrom(caught: unknown, fallback: string): string {
  if (caught instanceof ApiClientError) {
    return caught.message;
  }
  return fallback;
}
