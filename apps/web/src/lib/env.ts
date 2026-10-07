import { resolveApiUrl } from './api-url';

export const env = {
  apiUrl: resolveApiUrl(import.meta.env.VITE_API_URL, import.meta.env.MODE),
  tenantSlug: import.meta.env.VITE_TENANT_SLUG || 'web',
};
