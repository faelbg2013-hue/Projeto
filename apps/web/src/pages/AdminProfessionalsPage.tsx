import type { ProfessionalProfile } from '@ravion/types';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Field } from '../components/Field';
import { SessionFrame, adminLinks } from '../components/SessionFrame';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ApiClientError } from '../services/api';
import { professionalsService } from '../services/professionals.service';

export function AdminProfessionalsPage() {
  useDocumentTitle('Profissionais — Ravion Barber');
  const [professionals, setProfessionals] = useState<ProfessionalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  async function load(): Promise<void> {
    setLoading(true);
    setListError(null);
    try {
      const page = await professionalsService.list();
      setProfessionals(page.data);
    } catch (caught) {
      setListError(
        caught instanceof Error ? caught.message : 'Não foi possível carregar os profissionais.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    professionalsService
      .list()
      .then((page) => {
        if (active) {
          setProfessionals(page.data);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setListError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível carregar os profissionais.',
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
    setEmail('');
    setPassword('');
    setDisplayName('');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    if (displayName.trim().length < 2) {
      setFormError('Informe o nome de exibição.');
      return;
    }
    if (!editingId) {
      if (name.trim().length < 2) {
        setFormError('Informe o nome.');
        return;
      }
      if (!email.includes('@')) {
        setFormError('Informe um e-mail válido.');
        return;
      }
      if (password.length < 8) {
        setFormError('A senha precisa ter pelo menos 8 caracteres.');
        return;
      }
    }
    setPending(true);
    try {
      if (editingId) {
        await professionalsService.update(editingId, { displayName: displayName.trim() });
      } else {
        await professionalsService.create({
          name: name.trim(),
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
      }
      resetForm();
      await load();
    } catch (caught) {
      setFormError(
        caught instanceof ApiClientError
          ? caught.message
          : 'Não foi possível salvar o profissional.',
      );
    } finally {
      setPending(false);
    }
  }

  async function toggle(professional: ProfessionalProfile): Promise<void> {
    setFormError(null);
    try {
      if (professional.isActive) {
        await professionalsService.deactivate(professional.id);
      } else {
        await professionalsService.update(professional.id, { isActive: true });
      }
      await load();
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'Não foi possível atualizar o profissional.',
      );
    }
  }

  return (
    <SessionFrame eyebrow="Administração" title="Profissionais" links={adminLinks}>
      <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)} noValidate>
        {editingId ? null : (
          <>
            <Field label="Nome completo" value={name} onChange={setName} autoComplete="name" />
            <Field
              label="E-mail"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="off"
            />
            <Field
              label="Senha"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="new-password"
            />
          </>
        )}
        <Field label="Nome de exibição" value={displayName} onChange={setDisplayName} />
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
            {pending ? 'Aguarde' : editingId ? 'Salvar' : 'Criar profissional'}
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

      {loading ? <p className="mt-8 text-sm text-muted">Carregando profissionais</p> : null}
      {listError ? <p className="mt-8 text-sm text-foreground">{listError}</p> : null}
      {!loading && !listError && professionals.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nenhum profissional cadastrado.</p>
      ) : null}
      <div className="mt-6 space-y-4">
        {professionals.map((professional) => (
          <article key={professional.id} className="min-w-0 border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="break-words text-lg text-foreground">{professional.displayName}</h2>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.28em] text-muted">
                {professional.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="mt-2 break-all text-sm text-muted">{professional.user.email}</p>
            <p className="mt-1 text-sm text-muted">{professional.user.name}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to={`/admin/professionals/${professional.id}/schedule`}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
              >
                Agenda
              </Link>
              <button
                type="button"
                onClick={() => {
                  setEditingId(professional.id);
                  setDisplayName(professional.displayName);
                  setFormError(null);
                }}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => void toggle(professional)}
                className="text-[0.68rem] uppercase tracking-[0.28em] text-muted"
              >
                {professional.isActive ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </SessionFrame>
  );
}
