import { captureException, reactErrorHandler } from '@sentry/react';
import { StartClient } from '@tanstack/react-start/client';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { initializeTelemetry } from '@/utils/telemetry';
import { reportWebVitals } from '@/utils/web-vitals';

initializeTelemetry();

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
  {
    onCaughtError: reactErrorHandler(),
    onRecoverableError: reactErrorHandler(),
    onUncaughtError: reactErrorHandler((error, errorInfo) => {
      // An error that escapes the React tree never reaches the query/mutation
      // caches either, so this is the only place it can be captured.
      captureException(error, {
        extra: { componentStack: errorInfo.componentStack },
      });
    }),
  }
);

reportWebVitals();
