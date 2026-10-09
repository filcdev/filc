import type { Session, User } from 'better-auth';

/**
 * The user fields Chronos persists, in one place: the server passes them to
 * better-auth (`apps/chronos/src/utils/authentication.ts`) and the client
 * declares them so a signed-in session is typed. Changing a field here changes
 * both sides — and `apps/chronos/src/_types/auth.ts` fails to compile if the
 * server drifts from what this package promises.
 *
 * `as const` is load-bearing: better-auth types a field's `type` as a literal
 * union, and both the client's inference and the server's option type check
 * depend on those literals (`'string[]'`, `['user']`).
 */
export const userAdditionalFields = {
  cohortId: {
    input: true,
    required: false,
    type: 'string',
  },
  nickname: {
    input: true,
    required: false,
    type: 'string',
  },
  roles: {
    // `as string[]` keeps the array mutable: `as const` would make it a
    // readonly tuple, which better-auth's field type rejects (and that makes the
    // client's field inference silently fall back to `{}`).
    defaultValue: ['user'] as string[],
    input: false,
    required: true,
    type: 'string[]',
  },
} as const;

/**
 * What a session's user carries: the persisted fields plus `displayName` and
 * `permissions`, which the server computes in its custom session callback.
 * better-auth's client can only infer a custom session's payload from a server
 * instance it does not have, so the client declares the whole payload here.
 */
export const sessionUserFields = {
  ...userAdditionalFields,
  displayName: {
    input: false,
    required: true,
    type: 'string',
  },
  permissions: {
    input: false,
    required: true,
    type: 'string[]',
  },
} as const;

/** A signed-in user: better-auth's user plus the Filc fields. */
export type AuthUser = User & {
  cohortId: string | null;
  nickname: string | null;
  roles: string[];
  displayName: string;
  permissions: string[];
};

/** A signed-in session, as every client of the API sees it. */
export type AuthSession = {
  session: Session;
  user: AuthUser;
};

/**
 * The shape better-auth's *client* plugins infer from: they read a *server
 * instance* (`{ options: { user: { additionalFields }, plugins } }`), and this
 * package exists precisely so an app never imports another app's server code.
 * `apps/chronos/src/_types/auth.ts` proves at compile time that the real
 * instance still matches what is declared here.
 */
export type FilcAuth = {
  options: {
    user: { additionalFields: typeof sessionUserFields };
  };
};
