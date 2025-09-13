import {
  inferAdditionalFields,
  magicLinkClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { auth } from '~/utils/authentication';

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), inferAdditionalFields<typeof auth>()],
  baseURL: import.meta.env.BASE_URL,
});

export type User = (typeof authClient.$Infer.Session)['user'];
export type Session = typeof authClient.$Infer.Session;
