import { getLogger } from '@logtape/logtape';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { customSession } from 'better-auth/plugins';
import { magicLink } from 'better-auth/plugins/magic-link';
import type { SocialProviders } from 'better-auth/social-providers';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { db } from '~/database';
import { authenticationSchema } from '~/database/schema/authentication';
import { getUserPermissions } from '~/utils/authorization';
import { env } from '~/utils/environment';
import type { Context, SuccessResponse } from '~/utils/globals';

const logger = getLogger(['chronos', 'auth']);

export const getOauth = (): SocialProviders => {
  if (!(env.entraClientId && env.entraClientSecret && env.entraTenantId)) {
    logger.warn(
      'Disabling Entra OAuth provider because of missing environment variables.'
    );
    return {};
  }

  return {
    microsoft: {
      clientId: env.entraClientId,
      clientSecret: env.entraClientSecret,
      disableSignUp: true,
      enabled: true,
      prompt: 'select_account',
      tenantId: env.entraTenantId,
    },
  };
};

const authOptions = {
  account: {
    accountLinking: {
      allowUnlinkingAll: true,
      enabled: true,
      updateUserInfoOnLink: true,
    },
  },
  advanced: {
    cookiePrefix: 'filc',
    database: {
      generateId: false,
    },
  },

  baseURL: env.baseUrl,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authenticationSchema,
  }),
  databaseHooks: {
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
    disableSignUp: true,
    enabled: true,
  },
  logger: {
    level: env.mode === 'development' ? 'debug' : 'info',
    log: (level, message, ...args) => {
      logger[level]({ message, ...args });
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        await Promise.resolve(); // simulate async work
        logger.info(`Magic link requested for ${email}: ${url}?token=${token}`);
      },
    }),
  ],
  secret: env.authSecret,
  socialProviders: getOauth(),
  telemetry: {
    enabled: false,
  },
  trustedOrigins: [env.baseUrl],
  user: {
    additionalFields: {
      cohortId: {
        input: true,
        required: false,
        type: 'string',
      },
      roles: {
        input: false,
        required: true,
        type: 'string[]',
      },
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...authOptions,
  plugins: [
    ...(authOptions.plugins ?? []),
    customSession(async ({ user, session }) => {
      const permissions = await getUserPermissions(user.id);
      return {
        session,
        user: {
          ...user,
          permissions,
        },
      };
    }, authOptions),
  ],
});

export const authRouter = new Hono<Context>()
  .get('/sync-account', async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session?.user) {
      throw new HTTPException(StatusCodes.UNAUTHORIZED, {
        message: 'Not authenticated',
      });
    }

    const accounts = await auth.api.listUserAccounts({
      headers: c.req.raw.headers,
    });

    const msAccount = accounts.find((a) => a.providerId === 'microsoft');

    if (!msAccount || msAccount === undefined) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'No Microsoft account linked',
      });
    }

    const msData = await auth.api.accountInfo({
      body: { accountId: msAccount.accountId },
      headers: c.req.raw.headers,
    });

    if (!msData?.data) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch Microsoft account data',
      });
    }

    await auth.api.updateUser({
      body: {
        name: msData.data.name,
      },
      headers: c.req.raw.headers,
    });

    return c.json<SuccessResponse>({
      data: {
        message: 'Account synced',
      },
      success: true,
    });
  })
  .on(['POST', 'GET'], '*', (c) => auth.handler(c.req.raw));
