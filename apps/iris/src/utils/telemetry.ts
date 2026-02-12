import { init } from '@sentry/react';

const dsn = import.meta.env.VITE_TELEMETRY_DSN;
const mode = import.meta.env.MODE;

export const initializeTelemetry = () => {
  if (mode === 'production' && dsn) {
    // biome-ignore lint/suspicious/noConsole: we want to log the initialization for debugging purposes
    console.log('Initializing telemetry with DSN:', dsn, 'and mode:', mode);

    init({
      dsn,
      environment: mode,
      sendDefaultPii: true,
    });
  }
};
