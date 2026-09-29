import type { ProfessionalDay } from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';
import { withQuery } from './query';

const client = new ApiClient(env.apiUrl);

export const professionalDayService = {
  get(date?: string): Promise<ProfessionalDay> {
    return client.get(withQuery('/api/v1/professionals/me/dashboard', date ? { date } : {}));
  },
};
