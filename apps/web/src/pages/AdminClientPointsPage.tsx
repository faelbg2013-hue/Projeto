import type { ClientPointsSummary, PointsTransactionItem } from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { pointsDate, pointsService, pointsTypeLabel, signedPoints } from '../services/points.service';

type AdjustmentType = 'ADJUSTMENT_CREDIT' | 'ADJUSTMENT_DEBIT';

export function AdminClientPointsPage() {
  useDocumentTitle('Pontos do cliente — Ravion Barber');
  const { clientId = '' } = useParams();
  const [summary, setSummary] = useState<ClientPointsSummary | null>(null);
  const [items, setItems] = useState<PointsTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AdjustmentType>('ADJUSTMENT_CREDIT');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      pointsService.clientSummary(clientId),
      pointsService.clientTransactions(clientId, { pageSize: 50 }),
    ])
      .then(([nextSummary, page]) => {
        if (!active) {
          return;
        }
        setSummary(nextSummary);
        setItems(page.data);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os pontos.');
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

  function parsedPoints(): number | null {
    if (!/^\d+$/.test(points)) {
      return null;
    }
    const value = Number(points);
    if (!Number.isInteger(value) || value < 1 || value > 100000) {
      return null;
    }
    return value;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const amount = parsedPoints();
    if (!amount || reason.trim().length === 0) {
      setError('Informe uma quantidade inteira e o motivo.');
      return;
    }
    if (type === 'ADJUSTMENT_DEBIT' && !preview) {
      setPreview(true);
      setError(null);
      return;
    }
    void confirm(amount);
  }

  async function confirm(amount: number): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await pointsService.adjust(clientId, { type, points: amount, reason: reason.trim() });
      setOpen(false);
      setPreview(false);
      setPoints('');
      setReason('');
      setReloadKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível ajustar os pontos.');
    } finally {
      setPending(false);
    }
  }

  const amount = parsedPoints();
  const balance = summary?.balance ?? 0;

  return (
    <SessionFrame eyebrow="Administração" title="Pontos" links={adminLinks}>
      {loading ? <p className="text-sm text-muted">Carregando pontos</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {summary ? (
        <p className="text-sm text-foreground">
          Saldo atual <span className="font-display text-3xl">{summary.balance}</span>
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setPreview(false);
        }}
        className="mt-6 border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-foreground"
      >
        Ajustar pontos
      </button>
      {open ? (
        <form className="mt-6 flex min-w-0 flex-col gap-4 border border-line bg-surface p-4" onSubmit={onSubmit}>
          <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
            Tipo
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as AdjustmentType);
                setPreview(false);
              }}
              className="w-full border border-line bg-background px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none"
            >
              <option value="ADJUSTMENT_CREDIT">Crédito</option>
              <option value="ADJUSTMENT_DEBIT">Débito</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
            Quantidade
            <input
              inputMode="numeric"
              value={points}
              onChange={(event) => {
                setPoints(event.target.value);
                setPreview(false);
              }}
              className="w-full border border-line bg-background px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
            Motivo
            <input
              value={reason}
              maxLength={240}
              onChange={(event) => setReason(event.target.value)}
              className="w-full border border-line bg-background px-4 py-3 text-base font-normal normal-case tracking-normal text-foreground outline-none"
            />
          </label>
          {preview && type === 'ADJUSTMENT_DEBIT' && amount ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Saldo atual</dt>
                <dd className="mt-1 text-foreground">{balance}</dd>
              </div>
              <div>
                <dt className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Débito</dt>
                <dd className="mt-1 text-foreground">{amount}</dd>
              </div>
              <div>
                <dt className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Saldo após</dt>
                <dd className="mt-1 text-foreground">{balance - amount}</dd>
              </div>
            </dl>
          ) : null}
          <div className="flex flex-wrap gap-4">
            <button
              type="submit"
              disabled={pending}
              className="bg-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-background disabled:opacity-60"
            >
              {type === 'ADJUSTMENT_DEBIT' && !preview ? 'Continuar' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPreview(false);
              }}
              className="text-[0.68rem] uppercase tracking-[0.22em] text-muted"
            >
              Fechar
            </button>
          </div>
        </form>
      ) : null}
      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <article key={item.id} className="min-w-0 border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-muted">{pointsDate(item.createdAt)}</p>
              <p className="shrink-0 text-sm text-foreground">{signedPoints(item.type, item.points)}</p>
            </div>
            <h2 className="mt-3 break-words text-lg text-foreground">{pointsTypeLabel[item.type]}</h2>
            <p className="mt-1 break-words text-sm text-muted">{item.reason}</p>
            {item.appointmentId ? (
              <p className="mt-1 break-all text-sm text-muted">Agendamento {item.appointmentId}</p>
            ) : null}
          </article>
        ))}
      </div>
    </SessionFrame>
  );
}
