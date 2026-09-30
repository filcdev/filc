import type { Module } from '#modules/module';
import { timetableNotifications } from '#modules/timetable/_notifications';
import { cleanupOrphanedCohorts } from '#modules/timetable/utils/cleanup';

/**
 * The timetable: lessons, substitutions and moved lessons, the daily trim of
 * cohorts no lesson refers to, and the four notifications it raises.
 */
export const timetableModule = {
  jobs: [
    {
      // The cleanup reports how many rows it removed; the baker ignores it.
      callback: async () => {
        await cleanupOrphanedCohorts();
      },
      cron: '@daily',
      name: 'clean-up-orphaned-cohorts',
    },
  ],
  notifications: timetableNotifications,
} satisfies Module;
