import type { Paginated, ServiceItem } from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';
import { withQuery } from './query';

export interface ServiceInput {
  name: string;
  description?: string | null;
  price: number;
  durationMinutes: number;
  points: number;
}

export interface ServiceListQuery {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}

const client = new ApiClient(env.apiUrl);

export const servicesService = {
  list(query: ServiceListQuery = {}): Promise<Paginated<ServiceItem>> {
    return client.get(withQuery('/api/v1/services', query));
  },
  create(input: ServiceInput): Promise<ServiceItem> {
    return client.post('/api/v1/services', input);
  },
  update(id: string, input: Partial<ServiceInput> & { isActive?: boolean }): Promise<ServiceItem> {
    return client.patch(`/api/v1/services/${id}`, input);
  },
  deactivate(id: string): Promise<ServiceItem> {
    return client.delete(`/api/v1/services/${id}`);
  },
};
