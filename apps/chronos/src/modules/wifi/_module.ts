import type { Module } from '#modules/module';
import { cleanUpWifiAuthLogs } from '#modules/wifi/utils/cleanup';
import { syncSpeedProfiles } from '#modules/wifi/utils/sync';
import { env } from '#utils/environment';

/**
 * The WiFi module: its tables live in `schema.ts`, and its scheduled work is
 * registered only while the module is enabled — a disabled module must not
 * keep a UniFi round-trip on the hourly timer.
 */
export const wifiModule = {
  jobs: env.wifiEnabled
    ? [
        {
          callback: cleanUpWifiAuthLogs,
          cron: '@monthly',
          name: 'clean-up-wifi-auth-logs',
        },
        {
          callback: syncSpeedProfiles,
          cron: '@hourly',
          name: 'sync-wifi-speed-profiles',
        },
      ]
    : [],
} satisfies Module;
