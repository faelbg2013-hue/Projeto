import type { AdminProfessionalDetail, BookableProfessional, Paginated, ProfessionalProfile } from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';
import { withQuery } from './query';

export interface ProfessionalInput {
  name: string;
  email: string;
  password: string;
  displayName: string;
}

export interface ProfessionalListQuery {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  search?: string;
}

const client = new ApiClient(env.apiUrl);

export const professionalsService = {
  me(): Promise<ProfessionalProfile> {
    return client.get('/api/v1/professionals/me');
  },
  list(query: ProfessionalListQuery = {}): Promise<Paginated<ProfessionalProfile>> {
    return client.get(withQuery('/api/v1/professionals', query));
  },
  overview(id: string): Promise<AdminProfessionalDetail> {
    return client.get(`/api/v1/professionals/${id}/overview`);
  },
  bookable(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<BookableProfessional>> {
    return client.get(withQuery('/api/v1/professionals/bookable', query));
  },
  create(input: ProfessionalInput): Promise<ProfessionalProfile> {
    return client.post('/api/v1/professionals', input);
  },
  update(
    id: string,
    input: { displayName?: string; isActive?: boolean },
  ): Promise<ProfessionalProfile> {
    return client.patch(`/api/v1/professionals/${id}`, input);
  },
  deactivate(id: string): Promise<ProfessionalProfile> {
    return client.delete(`/api/v1/professionals/${id}`);
  },
};
