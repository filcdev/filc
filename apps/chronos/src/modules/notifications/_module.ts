import type { Module } from '#modules/module';
import { cleanUpOldNotifications } from '#utils/notifications/cleanup';

/**
 * The notification log itself: the table, the preference column and the daily
 * trim of delivered rows. What each *type* says is owned by the module that
 * raises it, not here.
 */
export const notificationsModule = {
  jobs: [
    {
      callback: cleanUpOldNotifications,
      cron: '@daily',
      name: 'clean-up-old-notifications',
    },
  ],
} satisfies Module;
