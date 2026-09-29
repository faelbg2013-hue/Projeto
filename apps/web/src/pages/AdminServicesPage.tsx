import type { ServiceItem } from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { Field } from '../components/Field';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiClientError } from '../services/api';
import { servicesService } from '../services/services.service';

type Filter = 'all' | 'active' | 'inactive';

const filters: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'inactive', label: 'Inativos' },
];

export function AdminServicesPage() {
  useDocumentTitle('Serviços — Ravion Barber');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0.00');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [points, setPoints] = useState('0');

  async function load(nextFilter: Filter): Promise<void> {
    setLoading(true);
    setListError(null);
    try {
      const page = await servicesService.list({
        isActive: nextFilter === 'all' ? undefined : nextFilter === 'active',
      });
      setServices(page.data);
    } catch (caught) {
      setListError(
        caught instanceof Error ? caught.message : 'Não foi possível carregar os serviços.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    servicesService
      .list()
      .then((page) => {
        if (active) {
          setServices(page.data);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setListError(
            caught instanceof Error ? caught.message : 'Não foi possível carregar os serviços.',
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

  function resetForm(): void {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('0.00');
    setDurationMinutes('30');
    setPoints('0');
  }

  function beginEdit(service: ServiceItem): void {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description ?? '');
    setPrice(service.price);
    setDurationMinutes(String(service.durationMinutes));
    setPoints(String(service.points));
    setFormError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Informe o nome do serviço.');
      return;
    }
    const parsedPrice = Number(price);
    const parsedDuration = Number(durationMinutes);
    const parsedPoints = Number(points);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setFormError('O preço não pode ser negativo.');
      return;
    }
    if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
      setFormError('A duração deve ser maior que zero.');
      return;
    }
    if (!Number.isInteger(parsedPoints) || parsedPoints < 0) {
      setFormError('A pontuação não pode ser negativa.');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      price: parsedPrice,
      durationMinutes: parsedDuration,
      points: parsedPoints,
    };

    setPending(true);
    try {
      if (editingId) {
        await servicesService.update(editingId, payload);
      } else {
        await servicesService.create(payload);
      }
      resetForm();
      await load(filter);
    } catch (caught) {
      setFormError(
        caught instanceof ApiClientError ? caught.message : 'Não foi possível salvar o serviço.',
      );
    } finally {
      setPending(false);
    }
  }

  async function toggle(service: ServiceItem): Promise<void> {
    setFormError(null);
    try {
      if (service.isActive) {
        await servicesService.deactivate(service.id);
      } else {
        await servicesService.update(service.id, { isActive: true });
      }
      await load(filter);
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'Não foi possível atualizar o serviço.',
      );
    }
  }

  return (
    <SessionFrame eyebrow="Administração" title="Serviços" links={adminLinks}>
      <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field label="Nome" value={name} onChange={setName} />
        <Field label="Descrição" value={description} onChange={setDescription} />
        <Field label="Preço" value={price} onChange={setPrice} type="number" />
        <Field
          label="Duração em minutos"
          value={durationMinutes}
          onChange={setDurationMinutes}
          type="number"
        />
        <Field label="Pontuação" value={points} onChange={setPoints} type="number" />
        {formError ? (
          <p role="alert" className="text-sm normal-case tracking-normal text-foreground">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-accent px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-background disabled:opacity-60"
          >
            {pending ? 'Aguarde' : editingId ? 'Salvar' : 'Criar serviço'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="border border-line px-4 py-3 text-[0.72rem] uppercase tracking-[0.28em] text-muted"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-10 flex flex-wrap gap-3">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => {
              setFilter(item.id);
              void load(item.id);
            }}
            className="border border-line px-3 py-2 text-[0.68rem] uppercase tracking-[0.28em] text-muted aria-pressed:border-accent aria-pressed:text-foreground"
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <p className="mt-8 text-sm text-muted">Carregando serviços</p> : null}
      {listError ? <p className="mt-8 text-sm text-foreground">{listError}</p> : null}
      {!loading && !listError && services.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nenhum serviço neste filtro.</p>
      ) : null}
      <div className="mt-6 space-y-4">
        {services.map((service) => (
          <article key={service.id} className="min-w-0 border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="break-words text-lg text-foreground">{service.name}</h2>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                {service.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            {service.description ? (
              <p className="mt-2 break-words text-sm text-muted">{service.description}</p>
            ) : null}
            <p className="mt-3 text-sm text-muted">
              R$ {service.price} · {service.durationMinutes} min · Pontuação {service.points}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => beginEdit(service)}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void toggle(service)}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-muted"
              >
                {service.isActive ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </SessionFrame>
  );
}
