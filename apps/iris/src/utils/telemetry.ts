import {
  browserTracingIntegration,
  init,
  replayIntegration,
  setUser,
} from '@sentry/react';
import type { Session, User } from 'better-auth/types';

const dsn = import.meta.env.VITE_TELEMETRY_DSN;
const mode = import.meta.env.MODE;
const release =
  import.meta.env.VITE_TELEMETRY_RELEASE ??
  `iris@${import.meta.env.VITE_APP_VERSION ?? 'dev'}`;
const environment = import.meta.env.VITE_TELEMETRY_ENVIRONMENT ?? mode;

// Sample rates - configurable via env vars
const sampleRate = Number.parseFloat(
  import.meta.env.VITE_TELEMETRY_SAMPLE_RATE ?? '1.0'
);
const tracesSampleRate = Number.parseFloat(
  import.meta.env.VITE_TELEMETRY_TRACES_SAMPLE_RATE ?? '0.1'
);
const replaysSessionSampleRate = Number.parseFloat(
  import.meta.env.VITE_TELEMETRY_REPLAYS_SESSION_SAMPLE_RATE ?? '0.1'
);
const replaysOnErrorSampleRate = Number.parseFloat(
  import.meta.env.VITE_TELEMETRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? '1.0'
);

export const initializeTelemetry = () => {
  if (!dsn) {
    return;
  }

  init({
    // Filter out noise
    beforeSend(event, hint) {
      // Don't send certain errors
      const error = hint.originalException;

      if (error instanceof Error) {
        // Filter out network errors that are user-side issues
        if (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Load failed')
        ) {
          return null;
        }

        // Filter out ResizeObserver errors (benign browser quirk)
        if (error.message.includes('ResizeObserver')) {
          return null;
        }
      }

      return event;
    },
    dsn,
    environment,

    // Add custom tags
    initialScope: {
      tags: {
        'app.name': 'iris',
        runtime: 'browser',
      },
    },

    // Integrations
    integrations: [
      // Browser performance tracing
      browserTracingIntegration({
        // Track navigation and user interactions
        enableInp: true,
      }),
      // Session replay for debugging
      replayIntegration({
        blockAllMedia: true, // Don't capture images/videos
        maskAllInputs: true, // Mask sensitive input fields
        maskAllText: false, // We want to see text for debugging
      }),
    ],
    release,
    replaysOnErrorSampleRate,

    // Session Replay sample rates
    replaysSessionSampleRate,
    sampleRate,

    // Privacy: don't send PII by default
    sendDefaultPii: false,

    // Performance Monitoring
    tracesSampleRate,
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

  setUser({
    email: user?.email,
    id: session.userId,
    username: user?.name,
  });
};
