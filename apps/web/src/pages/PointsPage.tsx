import type { PointsTransactionItem, PointsTransactionType } from '@ravion/types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ClientNavigation } from '../components/ClientNavigation';
import { SessionFrame } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { pointsDate, pointsService, pointsTypeLabel, signedPoints } from '../services/points.service';

const clientTypeLabel: Record<PointsTransactionType, string> = {
  EARN: 'Pontos ganhos',
  REDEEM: 'Pontos utilizados',
  REDEEM_REVERSAL: 'Pontos devolvidos',
  ADJUSTMENT_CREDIT: pointsTypeLabel.ADJUSTMENT_CREDIT,
  ADJUSTMENT_DEBIT: pointsTypeLabel.ADJUSTMENT_DEBIT,
};

export function PointsPage() {
  useDocumentTitle('Meus pontos — Ravion Barber');
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [items, setItems] = useState<PointsTransactionItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    pointsService
      .mine()
      .then((summary) => {
        if (active) {
          setBalance(summary.balance);
        }
      })
      .catch(() => {
        if (active) {
          setBalanceError('Não foi possível carregar o saldo.');
        }
      })
      .finally(() => {
        if (active) {
          setBalanceLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    pointsService
      .mineTransactions({ pageSize: 50 })
      .then((page) => {
        if (active) {
          setItems(page.data);
        }
      })
      .catch(() => {
        if (active) {
          setHistoryError('Não foi possível carregar as movimentações.');
        }
      })
      .finally(() => {
        if (active) {
          setHistoryLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const historyReady = !historyLoading && historyError == null;

  return (
    <SessionFrame eyebrow="Cliente" title="Pontos" navigation={<ClientNavigation />}>
      <section className="min-w-0">
        <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Meus pontos</h2>
        {balanceLoading ? <p className="mt-4 text-sm text-muted">Carregando saldo</p> : null}
        {balanceError ? (
          <p role="alert" className="mt-4 text-sm text-foreground">
            {balanceError}
          </p>
        ) : null}
        {balance !== null ? (
          <p className="mt-4 text-sm text-foreground">
            Saldo atual <span className="font-display text-3xl">{balance}</span>
          </p>
        ) : null}
      </section>

      <section className="mt-10 min-w-0">
        <h2 className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Movimentações</h2>
        {historyLoading ? <p className="mt-4 text-sm text-muted">Carregando movimentações</p> : null}
        {historyError ? (
          <p role="alert" className="mt-4 text-sm text-foreground">
            {historyError}
          </p>
        ) : null}
        {historyReady && items.length === 0 ? (
          <div className="mt-4">
            <p className="text-sm text-muted">Você ainda não possui movimentações de pontos.</p>
            <Link
              to="/agendar"
              className="mt-4 inline-flex min-h-11 items-center text-[0.68rem] uppercase tracking-[0.28em] text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
            >
              Agendar com pontos
            </Link>
          </div>
        ) : null}
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <article key={item.id} className="min-w-0 border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted">{pointsDate(item.createdAt)}</p>
                <p className="shrink-0 text-sm text-foreground">{signedPoints(item.type, item.points)}</p>
              </div>
              <h3 className="mt-3 break-words text-lg text-foreground">{clientTypeLabel[item.type]}</h3>
              {item.serviceName ? <p className="mt-1 break-words text-sm text-foreground">{item.serviceName}</p> : null}
              {item.reason ? <p className="mt-1 break-words text-sm text-muted">{item.reason}</p> : null}
            </article>
          ))}
        </div>
        {historyReady && items.length > 0 && balance !== null && balance > 0 ? (
          <Link
            to="/agendar"
            className="mt-6 inline-flex min-h-11 items-center text-[0.68rem] uppercase tracking-[0.28em] text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          >
            Usar meus pontos
          </Link>
        ) : null}
      </section>
    </SessionFrame>
  );
}
