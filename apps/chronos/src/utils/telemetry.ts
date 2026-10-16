import { getLogger } from '@logtape/logtape';
import { init, setUser } from '@sentry/bun';
import type { Session, User } from 'better-auth';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'telemetry']);

export const initSentry = () => {
  if (!env.sentryDsn) {
    logger.warn('Sentry DSN is not provided. Telemetry will be disabled.');
    return;
  }

  const release =
    env.sentryRelease ?? `chronos@${Bun.env.npm_package_version ?? 'dev'}`;
  const environment = env.sentryEnvironment ?? env.mode;

  logger.info(
    `Initializing Sentry - Release: ${release}, Environment: ${environment}, Sample Rate: ${env.sentrySampleRate}, Traces: ${env.sentryTracesSampleRate}`
  );

  init({
    // Filter out noise
    beforeSend(event, hint) {
      // Don't send 404s or other client errors
      if (event.exception?.values?.[0]?.value?.includes('404')) {
        return null;
      }

      // Filter out rate limit errors (we log these separately)
      if (
        hint.originalException instanceof Error &&
        hint.originalException.message.includes('Too many requests')
      ) {
        return null;
      }

      return event;
    },

    // Privacy: Sentry v11 collects all the categories below by default, so
    // each one is pinned explicitly; the values match the v10 behaviour this
    // backend relied on when it passed `sendDefaultPii: false`. Anything
    // omitted here (e.g. `stackFrameVariables`) keeps its permissive default.
    dataCollection: {
      cookies: false,
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
      httpBodies: [],
      userInfo: false,
    },
    dsn: env.sentryDsn,
    environment,

    // Add custom tags
    initialScope: {
      tags: {
        'app.name': 'chronos',
        runtime: 'bun',
        'runtime.version': Bun.version,
      },
    },

    release,
    sampleRate: env.sentrySampleRate,

    // Performance Monitoring
    tracesSampleRate: env.sentryTracesSampleRate,
  });
};

/**
 * Set user context for Sentry from session/user data
 */
export const setSentryUser = (session: Session | null, user?: User | null) => {
  if (!session) {
    setUser(null);
    return;
  }

  const userData: Record<string, string> = {
    id: session.userId,
  };

  if (user?.email) {
    userData.email = user.email;
  }
  if (user?.name) {
    userData.username = user.name;
  }

  setUser(userData);
};
