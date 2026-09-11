import type { BetterAuthPlugin } from 'better-auth';
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
} from 'better-auth/api';
import z from 'zod';

/**
 * Native OAuth bridge for the Mergen Kotlin Multiplatform client.
 *
 * This mirrors Better Auth's official Expo authorization-proxy flow without
 * adding a React Native dependency to Chronos. The mobile app starts social
 * sign-in through Better Auth, opens this proxy in the system browser, and the
 * callback returns to the trusted `mergen://` scheme with the session cookie.
 */
export const mergenMobile = () =>
  ({
    endpoints: {
      mergenAuthorizationProxy: createAuthEndpoint(
        '/mergen-authorization-proxy',
        {
          method: 'GET',
          query: z.object({
            authorizationURL: z.string(),
            oauthState: z.string().optional(),
          }),
        },
        async (ctx) => {
          const { authorizationURL, oauthState } = ctx.query;
          if (authorizationURL.includes('#')) {
            throw new APIError('BAD_REQUEST', {
              message: 'Invalid authorizationURL',
            });
          }

          let url: URL;
          try {
            url = new URL(authorizationURL);
          } catch {
            throw new APIError('BAD_REQUEST', {
              message: 'Invalid authorizationURL',
            });
          }

          if (
            url.protocol !== 'https:' ||
            url.hostname !== 'login.microsoftonline.com' ||
            url.origin === new URL(ctx.context.baseURL).origin
          ) {
            throw new APIError('BAD_REQUEST', {
              message: 'Invalid authorizationURL',
            });
          }

          if (oauthState) {
            const oauthStateCookie = ctx.context.createAuthCookie(
              'oauth_state',
              {
                maxAge: 10 * 60,
              }
            );
            ctx.setCookie(
              oauthStateCookie.name,
              oauthState,
              oauthStateCookie.attributes
            );
            return ctx.redirect(authorizationURL);
          }

          const state = url.searchParams.get('state');
          if (!state) {
            throw new APIError('BAD_REQUEST', { message: 'Unexpected error' });
          }

          const stateCookie = ctx.context.createAuthCookie('state', {
            maxAge: 5 * 60,
          });
          await ctx.setSignedCookie(
            stateCookie.name,
            state,
            ctx.context.secret,
            stateCookie.attributes
          );
          return ctx.redirect(authorizationURL);
        }
      ),
    },
    hooks: {
      after: [
        {
          handler: createAuthMiddleware((ctx) => {
            const headers = ctx.context.responseHeaders;
            const location = headers?.get('location');
            if (!location) {
              return;
            }

            let redirectURL: URL;
            try {
              redirectURL = new URL(location);
            } catch {
              return;
            }

            if (
              redirectURL.protocol === 'http:' ||
              redirectURL.protocol === 'https:' ||
              !ctx.context.isTrustedOrigin(location)
            ) {
              return;
            }

            const cookie = headers?.get('set-cookie');
            if (!cookie) {
              return;
            }

            redirectURL.searchParams.set('cookie', cookie);
            ctx.setHeader('location', redirectURL.toString());
          }),
          matcher(context) {
            return !!context.path?.startsWith('/callback');
          },
        },
      ],
    },
    id: 'mergen-mobile',
    onRequest(request: Request) {
      if (request.headers.get('origin')) {
        return;
      }

      const mergenOrigin = request.headers.get('mergen-origin');
      if (!mergenOrigin) {
        return;
      }

      try {
        request.headers.set('origin', mergenOrigin);
        return { request };
      } catch {
        const headers = new Headers(request.headers);
        headers.set('origin', mergenOrigin);
        return { request: new Request(request, { headers }) };
      }
    },
  }) satisfies BetterAuthPlugin;
