import type { ClientProfile, Paginated } from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';
import { withQuery } from './query';

export interface ClientListQuery {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}

const client = new ApiClient(env.apiUrl);

export const clientsService = {
  me(): Promise<ClientProfile> {
    return client.get('/api/v1/clients/me');
  },
  list(query: ClientListQuery = {}): Promise<Paginated<ClientProfile>> {
    return client.get(withQuery('/api/v1/clients', query));
  },
  update(id: string, input: { isActive: boolean }): Promise<ClientProfile> {
    return client.patch(`/api/v1/clients/${id}`, input);
  },
};
