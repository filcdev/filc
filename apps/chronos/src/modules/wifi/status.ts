import { base } from '#orpc';
import { env } from '#utils/environment';

export const wifiStatus = base.wifi.status.handler(() => ({
  enabled: env.wifiEnabled,
  ssid: env.wifiSsid || null,
}));
