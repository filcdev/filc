import { cleanUpExpiredCheckinGrants } from '#modules/events/utils/grant';
import type { Module } from '#modules/module';

/**
 * Events contribute scheduled work only: the door grants expire on their own
 * at request time, and this hourly job merely keeps the table small.
 */
export const eventsModule = {
  jobs: [
    {
      callback: cleanUpExpiredCheckinGrants,
      cron: '@hourly',
      name: 'clean-up-expired-event-checkin-grants',
    },
  ],
} satisfies Module;
