import { reactErrorHandler } from '@sentry/react';
import { StartClient } from '@tanstack/react-start/client';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { initializeTelemetry } from '@/utils/telemetry';
import { reportWebVitals } from '@/utils/web-vitals';

import './global.css';

initializeTelemetry();

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
  {
    onCaughtError: reactErrorHandler(),
    onRecoverableError: reactErrorHandler(),
    onUncaughtError: reactErrorHandler((_error, _errorInfo) => {
      // TODO: logger
    }),
  }
);

reportWebVitals();
