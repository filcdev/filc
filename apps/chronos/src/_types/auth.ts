import type { AuthSession } from '@filcdev/auth';
import type { auth } from '#utils/authentication';

/**
 * Compile-time proof that `@filcdev/auth` still describes this better-auth
 * instance: the moment the server's session carries something the shared types
 * do not promise, the apps would silently lose a field, and this stops
 * compiling instead.
 */
export const authSessionMatchesPackage: AuthSession extends (typeof auth)['$Infer']['Session']
  ? true
  : never = true;
