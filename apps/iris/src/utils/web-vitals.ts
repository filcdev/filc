import { metrics } from '@sentry/react';
import type { Metric } from 'web-vitals';

/**
 * Send Web Vitals metrics to Sentry for performance monitoring
 */
const sendToSentry = (metric: Metric) => {
  // Send as Sentry measurement
  metrics.count(metric.name, metric.value);
};

export const reportWebVitals = (onPerfEntry?: (metric: Metric) => void) => {
  import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
    const handler = (metric: Metric) => {
      // Send to Sentry
      sendToSentry(metric);

      // Call custom handler if provided
      onPerfEntry?.(metric);
    };

    onCLS(handler);
    onINP(handler);
    onFCP(handler);
    onLCP(handler);
    onTTFB(handler);
  });
};
