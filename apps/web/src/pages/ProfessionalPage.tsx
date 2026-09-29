import type { ProfessionalProfile } from '@ravion/types';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { ServiceCatalog } from '../components/ServiceCatalog';
import { SessionFrame } from '../components/SessionFrame';
import { useActiveServices } from '../hooks/useActiveServices';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { professionalsService } from '../services/professionals.service';

export function ProfessionalPage() {
  const { user } = useAuth();
  const catalog = useActiveServices();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = profile?.displayName ?? user?.name ?? 'Profissional';
  useDocumentTitle(`${title} — Ravion Barber`);

  useEffect(() => {
    let active = true;
    professionalsService
      .me()
      .then((next) => {
        if (active) {
          setProfile(next);
        }
      })
      .catch(() => {
        if (active) {
          setError('Não foi possível carregar o perfil profissional.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SessionFrame eyebrow="Profissional" title={title} links={[{ to: '/conta', label: 'Conta' }]}>
      <dl className="max-w-md space-y-4 text-sm">
        <ProfileRow label="E-mail" value={user?.email ?? ''} />
        <ProfileRow label="Perfil" value="Profissional" />
        <ProfileRow
          label="Status"
          value={profile ? (profile.isActive ? 'Ativo' : 'Inativo') : 'Carregando'}
        />
      </dl>
      {error ? <p className="mt-6 text-sm text-foreground">{error}</p> : null}
      <ServiceCatalog services={catalog.services} loading={catalog.loading} error={catalog.error} />
    </SessionFrame>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-4">
      <dt className="text-[0.68rem] uppercase tracking-[0.28em] text-muted">{label}</dt>
      <dd className="mt-2 break-all text-base text-foreground">{value}</dd>
    </div>
  );
}
