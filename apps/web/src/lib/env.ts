const configuredUrl = import.meta.env.VITE_API_URL;
const fallbackUrl = 'http://127.0.0.1:43111';

export const env = {
  apiUrl: (configuredUrl && configuredUrl.length > 0 ? configuredUrl : fallbackUrl).replace(
    /\/$/,
    '',
  ),
};
