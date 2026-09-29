import type { PointsTransactionItem } from '@ravion/types';
import { useEffect, useState } from 'react';
import { SessionFrame } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { pointsDate, pointsService, pointsTypeLabel, signedPoints } from '../services/points.service';

const links = [
  { to: '/agendar', label: 'Agendar' },
  { to: '/agendamentos', label: 'Meus agendamentos' },
  { to: '/pontos', label: 'Meus pontos' },
  { to: '/conta', label: 'Conta' },
] as const;

export function PointsPage() {
  useDocumentTitle('Pontos — Ravion Barber');
  const [balance, setBalance] = useState<number | null>(null);
  const [items, setItems] = useState<PointsTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([pointsService.mine(), pointsService.mineTransactions({ pageSize: 50 })])
      .then(([summary, page]) => {
        if (!active) {
          return;
        }
        setBalance(summary.balance);
        setItems(page.data);
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
  }, []);

  return (
    <SessionFrame eyebrow="Cliente" title="Pontos" links={links}>
      {loading ? <p className="text-sm text-muted">Carregando pontos</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {balance !== null ? (
        <p className="text-sm text-foreground">
          Saldo atual <span className="font-display text-3xl">{balance}</span>
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nenhuma movimentação.</p>
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
