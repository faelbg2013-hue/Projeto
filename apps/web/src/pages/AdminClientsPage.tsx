import type { ClientProfile } from '@ravion/types';
import { useEffect, useState } from 'react';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { clientsService } from '../services/clients.service';

export function AdminClientsPage() {
  useDocumentTitle('Clientes — Ravion Barber');
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const page = await clientsService.list();
      setClients(page.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    clientsService
      .list()
      .then((page) => {
        if (active) {
          setClients(page.data);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : 'Não foi possível carregar os clientes.',
          );
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

  async function toggle(client: ClientProfile): Promise<void> {
    setError(null);
    try {
      await clientsService.update(client.id, { isActive: !client.isActive });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar o cliente.');
    }
  }

  return (
    <SessionFrame eyebrow="Administração" title="Clientes" links={adminLinks}>
      {loading ? <p className="text-sm text-muted">Carregando clientes</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {!loading && !error && clients.length === 0 ? (
        <p className="text-sm text-muted">Nenhum cliente neste contexto.</p>
      ) : null}
      <div className="space-y-4">
        {clients.map((client) => (
          <article key={client.id} className="min-w-0 border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="break-words text-lg text-foreground">{client.user.name}</h2>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                {client.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="mt-2 break-all text-sm text-muted">{client.user.email}</p>
            <p className="mt-1 text-sm text-muted">Cliente</p>
            <button
              type="button"
              onClick={() => void toggle(client)}
              className="mt-4 text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
            >
              {client.isActive ? 'Desativar' : 'Ativar'}
            </button>
          </article>
        ))}
      </div>
    </SessionFrame>
  );
}
