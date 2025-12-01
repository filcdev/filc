import type { AuthType } from '@filcdev/chronos/types/auth';
import {
  customSessionClient,
  inferAdditionalFields,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<AuthType>(), customSessionClient<AuthType>()],
});

export type User = (typeof authClient.$Infer.Session)['user'];
export type Session = typeof authClient.$Infer.Session;
