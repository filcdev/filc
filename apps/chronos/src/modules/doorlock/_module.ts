import { doorlockNotifications } from '#modules/doorlock/_notifications';
import { cleanUpOldDeviceAuditLogs } from '#modules/doorlock/utils/cards';
import type { Module } from '#modules/module';

/**
 * The aegis door lock: its tables, the monthly audit-log trim, and the
 * "your card was used" notification the device socket dispatches.
 */
export const doorlockModule = {
  jobs: [
    {
      callback: cleanUpOldDeviceAuditLogs,
      cron: '@monthly',
      name: 'clean-up-old-card-audit-logs',
    },
  ],
  notifications: doorlockNotifications,
} satisfies Module;
