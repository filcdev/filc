import { base } from '#orpc';
import { env } from '#utils/environment';
import { serviceUnavailable } from '#utils/http';

/**
 * Every WiFi procedure except `status` is unavailable while the module is off.
 * `status` must stay reachable — it is what the apps use to decide whether to
 * render any WiFi surface at all.
 */
export const requireWifiEnabled = base.middleware(({ next }) => {
  if (!env.wifiEnabled) {
    throw serviceUnavailable('WiFi is disabled.');
  }
  return next();
});
