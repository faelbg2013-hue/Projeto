import type { ProfessionalDaySummary } from '@ravion/types';

const cards: Array<{ key: keyof ProfessionalDaySummary; label: string }> = [
  { key: 'total', label: 'Hoje' },
  { key: 'confirmed', label: 'Confirmados' },
  { key: 'completed', label: 'Concluídos' },
  { key: 'noShow', label: 'Não compareceu' },
  { key: 'cancelled', label: 'Cancelados' },
];

export function ProfessionalDaySummaryCards({ summary }: { summary: ProfessionalDaySummary }) {
  return (
    <section aria-label="Resumo do dia" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <article key={card.key} className="min-w-0 border border-line bg-surface px-4 py-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-muted">{card.label}</p>
          <p className="mt-2 font-display text-4xl text-foreground">{summary[card.key]}</p>
        </article>
      ))}
    </section>
  );
}
