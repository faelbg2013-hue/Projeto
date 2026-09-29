import type { ServiceItem } from '@ravion/types';
import { useEffect, useState } from 'react';
import { servicesService } from '../services/services.service';

export function useActiveServices(): {
  services: ServiceItem[];
  loading: boolean;
  error: string | null;
} {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    servicesService
      .list({ isActive: true })
      .then((page) => {
        if (active) {
          setServices(page.data);
        }
      })
      .catch(() => {
        if (active) {
          setError('Não foi possível carregar os serviços.');
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

  return { services, loading, error };
}
