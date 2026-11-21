import { createApiClient } from '@filcdev/api/client';

/**
 * Chronos is reached on the app's own origin: the Vite dev proxy and the
 * platform proxy both route `/api` there, which is also what keeps the session
 * cookie and better-auth's endpoints same-origin (the camera needs HTTPS, and
 * with it a refused cross-site cookie would sign the helper out on every call).
 */
const { client, orpc } = createApiClient({
  credentials: 'include',
  url: `${window.location.origin}/api/rpc`,
});

export { orpc };
/** Imperative calls, outside React Query. */
export const api = client;
