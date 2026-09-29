import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { pointsService } from '../services/points.service';

export function PointsCard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    pointsService
      .mine()
      .then((summary) => {
        if (active) {
          setBalance(summary.balance);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os pontos.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mt-10 max-w-md border border-line bg-surface p-5">
      <p className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">Pontos disponíveis</p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-foreground">
          {error}
        </p>
      ) : (
        <p className="mt-3 font-display text-5xl text-foreground">{balance === null ? '—' : balance}</p>
      )}
      <Link to="/pontos" className="mt-5 inline-block text-[0.68rem] uppercase tracking-[0.28em] text-accent">
        Ver extrato
      </Link>
    </section>
  );
}
