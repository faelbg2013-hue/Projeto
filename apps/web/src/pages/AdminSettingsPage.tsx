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

  useEffect(() => {
    let active = true;
    settingsService
      .get()
      .then((response) => {
        if (active) {
          setDraft(draftFromSettings(response.settings));
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
    </SessionFrame>
  );
}

function messageFrom(caught: unknown, fallback: string): string {
  if (caught instanceof ApiClientError) {
    return caught.message;
  }
  return fallback;
}
