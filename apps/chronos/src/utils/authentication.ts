import { apiKey } from '@better-auth/api-key';
import { userAdditionalFields } from '@filcdev/auth';
import { getLogger } from '@logtape/logtape';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { customSession, oAuthProxy } from 'better-auth/plugins';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '#database';
import { apiKeySchema } from '#database/schema/api-keys';
import {
  authenticationSchema,
  user as userTable,
} from '#database/schema/authentication';
import { teacher } from '#modules/timetable/schema';
import { getUserPermissions } from '#utils/authorization';
import { createEntraIdTokenVerifier } from '#utils/entra-id-token';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'auth']);

/**
 * The `Authorization: Bearer <token>` form the aegis door-lock firmware sends.
 * The api-key plugin only reads `x-api-key` by default, so `customAPIKeyGetter`
 * below also accepts this shape.
 */
const BEARER_TOKEN_REGEX = /^Bearer\s+(.+)$/i;

/**
 * Preview deployments sign in through the production origin: Entra rejects
 * wildcard redirect URIs, and registering one URI per pull request does not
 * scale. Production terminates the real OAuth flow, then hands an encrypted
 * profile back to the preview, which creates the session in its own database.
 *
 * `currentURL` is set explicitly because behind a reverse proxy the request URL
 * is plain HTTP, and this value is what the encrypted profile is redirected to.
 * On production the two origins match, so the plugin stands down and the
 * ordinary callback runs. Without both variables the plugin is not registered.
 */
const oauthProxyPlugin =
  env.oauthProxyUrl && env.oauthProxySecret
    ? [
        oAuthProxy({
          currentURL: env.baseUrl,
          productionURL: env.oauthProxyUrl,
          secret: env.oauthProxySecret,
        }),
      ]
    : [];

const authOptions = {
  account: {
    accountLinking: {
      allowUnlinkingAll: true,
      enabled: true,
      trustedProviders: ['microsoft'],
      updateUserInfoOnLink: true,
    },
  },
  advanced: {
    cookiePrefix: 'filc',
    database: {
      generateId: 'uuid',
    },
  },
  baseURL: env.baseUrl,
  database: drizzleAdapter(db, {
    provider: 'pg',
    // The plugin's `apikey` table must be in the adapter's schema or
    // better-auth's own schema check rejects every api-key call. The rest of
    // the auth tables stay in `authenticationSchema`.
    schema: { ...authenticationSchema, ...apiKeySchema },
  }),
  databaseHooks: {
    session: {
      create: {
        // Link the user account to any teacher row whose email or full name
        // matches. This runs on both registration and login (a session is
        // created either way), so an import carrying teacher emails/names gets
        // reconciled with user accounts over time.
        after: async (session) => {
          try {
            const [linkedUser] = await db
              .select({ email: userTable.email, name: userTable.name })
              .from(userTable)
              .where(eq(userTable.id, session.userId))
              .limit(1);
            if (!linkedUser) {
              return;
            }

            const userEmail = linkedUser.email?.toLowerCase();
            if (userEmail) {
              await db
                .update(teacher)
                .set({ userId: session.userId })
                .where(
                  and(
                    eq(sql`lower(${teacher.email})`, userEmail),
                    // Never clobber a manual assignment made in the teacher UI.
                    or(
                      isNull(teacher.userId),
                      eq(teacher.userId, session.userId)
                    )
                  )
                );
            }

            const fullName = linkedUser.name?.trim().toLowerCase();
            if (fullName) {
              // Select candidates first and link only when the name resolves
              // to exactly one unlinked/owned teacher row. A name collision
              // (e.g. a student sharing a teacher's name) must not attach the
              // account to the wrong person, so ambiguous matches are skipped.
              const candidates = await db
                .select({ id: teacher.id })
                .from(teacher)
                .where(
                  and(
                    eq(
                      sql`lower(trim(concat(${teacher.firstName}, ' ', ${teacher.lastName})))`,
                      fullName
                    ),
                    or(
                      isNull(teacher.userId),
                      eq(teacher.userId, session.userId)
                    )
                  )
                );
              const [candidate] = candidates;
              if (candidates.length === 1 && candidate) {
                await db
                  .update(teacher)
                  .set({ userId: session.userId })
                  .where(
                    and(
                      eq(teacher.id, candidate.id),
                      or(
                        isNull(teacher.userId),
                        eq(teacher.userId, session.userId)
                      )
                    )
                  );
              }
            }
          } catch (err) {
            logger.error('Failed to link user to teacher', {
              err,
              userId: session.userId,
            });
          }
        },
      },
    },
    user: {
      create: {
        before: async (user, _ctx) => ({
          data: {
            ...user,
            roles: user.email === env.adminEmail ? ['user', 'admin'] : ['user'],
          },
        }),
      },
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  logger: {
    level: env.mode === 'development' ? 'debug' : 'info',
    log: (level, message, ...args) => {
      logger[level]({ message, ...args });
    },
  },
  plugins: [...oauthProxyPlugin],
  secret: env.authSecret,
  socialProviders: {
    microsoft: {
      clientId: env.entraClientId,
      // A proxied environment (a preview) never exchanges a code itself — the
      // proxy origin does — so it runs without an Entra client secret. The
      // provider type still requires a string.
      clientSecret: env.entraClientSecret ?? '',
      enabled: true,
      prompt: env.mode === 'development' ? 'consent' : undefined,
      tenantId: env.entraTenantId,
      // Clients that sign in natively (Mergen) submit an Entra ID token to
      // `/api/auth/sign-in/social`; Better Auth's built-in Microsoft verifier rejects all of
      // them, so the token is verified against the tenant's JWKS here instead.
      verifyIdToken: createEntraIdTokenVerifier({
        clientId: env.entraClientId,
        tenantId: env.entraTenantId,
      }),
    },
  },
  telemetry: {
    enabled: false,
  },
  trustedOrigins: env.trustedOrigins ?? [env.baseUrl],
  user: {
    additionalFields: userAdditionalFields,
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...authOptions,
  plugins: [
    ...(authOptions.plugins ?? []),
    // API keys come from better-auth's official plugin, which owns the
    // `apikey` table, hashing (SHA-256), expiry, enable/disable and per-key
    // rate limiting. `enableSessionForAPIKeys` lets a valid key stand in for a
    // session, which is what lets the oRPC middleware treat a key holder like
    // any other caller.
    //
    // `x-api-key` is the plugin's default header; the `Authorization: Bearer`
    // form is added here because the aegis door-lock firmware sends a bearer
    // token, and the plugin has no built-in support for it.
    apiKey({
      customAPIKeyGetter: (ctx) => {
        const headers = ctx.headers;
        if (!headers) {
          return null;
        }
        const bearer = headers.get('authorization');
        if (bearer) {
          const match = BEARER_TOKEN_REGEX.exec(bearer.trim());
          if (match?.[1]) {
            return match[1].trim();
          }
        }
        return headers.get('x-api-key');
      },
      enableSessionForAPIKeys: true,
      // The public timetable and door-lock surfaces are the point of these
      // keys, so a key must not be able to reach the whole API by default.
      // `getUserPermissions` is resolved per owner when a key is created, and
      // the middleware still enforces the route's own permission.
      rateLimit: {
        enabled: true,
        maxRequests: env.apiKeyRateLimitMax,
        timeWindow: env.apiKeyRateLimitWindowMs,
      },
      requireName: true,
    }),
    customSession(async ({ user, session }) => {
      const permissions = await getUserPermissions(user.id);
      const displayName = user.nickname
        ? user.nickname
        : user.name || 'Unknown user';
      return {
        session,
        user: {
          ...user,
          displayName,
          permissions,
        },
      };
    }, authOptions),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = (typeof auth.$Infer.Session)['user'];
