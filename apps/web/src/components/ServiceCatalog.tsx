import type { ServiceItem } from '@ravion/types';

export function ServiceCatalog({
  services,
  loading,
  error,
}: {
  services: ServiceItem[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-[0.72rem] uppercase tracking-[0.38em] text-accent">
        Serviços disponíveis
      </h2>
      {loading ? <p className="mt-4 text-sm text-muted">Carregando serviços</p> : null}
      {error ? <p className="mt-4 text-sm text-foreground">{error}</p> : null}
      {!loading && !error && services.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhum serviço ativo.</p>
      ) : null}
      <ul className="mt-6 space-y-4">
        {services.map((service) => (
          <li key={service.id} className="min-w-0 border-t border-line pt-4">
            <p className="break-words text-base text-foreground">{service.name}</p>
            {service.description ? (
              <p className="mt-1 break-words text-sm text-muted">{service.description}</p>
            ) : null}
            <p className="mt-2 text-sm text-muted">
              {service.durationMinutes} min · R$ {service.price}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
