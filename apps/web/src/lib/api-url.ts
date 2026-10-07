const LOCAL_DEV_API_URL = 'http://127.0.0.1:43111';

const PRODUCTION_URL_ERROR =
  'VITE_API_URL must be configured for production. Use an empty string for same-origin or an absolute https URL.';

export function resolveApiUrl(value: string | undefined, mode: string): string {
  if (value === undefined) {
    if (mode === 'production') {
      throw new Error(PRODUCTION_URL_ERROR);
    }
    return LOCAL_DEV_API_URL;
  }

  const configured = value.trim().replace(/\/$/, '');
  if (configured === '') {
    return '';
  }

  if (mode !== 'production') {
    return configured;
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(PRODUCTION_URL_ERROR);
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    throw new Error('VITE_API_URL cannot use localhost in production.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('VITE_API_URL must use https in production.');
  }

  return configured;
}
