const configuredUrl = import.meta.env.VITE_API_URL;

function resolveApiUrl(value: string | undefined): string {
  if (value === undefined) {
    return 'http://127.0.0.1:43111';
  }
  return value.replace(/\/$/, '');
}

export const env = {
  apiUrl: resolveApiUrl(configuredUrl),
  tenantSlug: import.meta.env.VITE_TENANT_SLUG || 'web',
};
