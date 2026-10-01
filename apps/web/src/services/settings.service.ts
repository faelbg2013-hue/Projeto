import type { TenantSettingsResponse, UpdateTenantSettings } from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';

const client = new ApiClient(env.apiUrl);

export const settingsService = {
  get(): Promise<TenantSettingsResponse> {
    return client.get('/api/v1/settings');
  },
  update(input: UpdateTenantSettings): Promise<TenantSettingsResponse> {
    return client.patch('/api/v1/settings', input);
  },
};
