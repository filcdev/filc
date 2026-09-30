import { createApiClient } from '@filcdev/api/client';

/**
 * Chronos is always reached by absolute URL: a box runs a static build with
 * nothing in front of it that would proxy a relative `/api`.
 */
const baseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV
    ? 'http://localhost:3001/api'
    : 'https://filc.petrik.hu/api');

/** The API base as a URL prefix: image URLs are built from it by hand. */
export const apiBaseUrl = baseUrl;

const { client, orpc } = createApiClient({
  credentials: 'omit',
  url: `${baseUrl}/rpc`,
});

export { orpc };
/** Imperative calls, outside React Query. */
export const api = client;
