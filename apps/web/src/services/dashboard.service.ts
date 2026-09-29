import type { AppointmentStatus, OperationalDashboard } from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';
import { withQuery } from './query';

export interface DashboardQuery {
  date?: string;
  professionalId?: string;
  status?: AppointmentStatus;
}

const client = new ApiClient(env.apiUrl);

export const dashboardService = {
  get(query: DashboardQuery = {}): Promise<OperationalDashboard> {
    return client.get(withQuery('/api/v1/admin/dashboard', query));
  },
};
