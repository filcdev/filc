import { resolveAudienceForDoorlock } from '#utils/notifications/engine';
import { isHungarianLocale } from '#utils/notifications/locale';
import type { NotificationHandler } from '#utils/notifications/types';

/**
 * The notification the door lock owns: a card was used, told to the user the
 * card belongs to. Dispatched the moment the device socket reports it, so it
 * carries no delay.
 */
export const doorlockNotifications: readonly NotificationHandler[] = [
  {
    buildContent: (payload, locale) => {
      const p = payload as { deviceName: string };
      const device = p.deviceName;
      let content: string;
      if (device) {
        content = isHungarianLocale(locale)
          ? `A belépőkártyád használatát észleltük: ${device}.`
          : `Your access card was just used at ${device}.`;
      } else {
        content = isHungarianLocale(locale)
          ? 'A belépőkártyád használatát észleltük.'
          : 'Your access card was just used.';
      }
      return {
        content,
        title: isHungarianLocale(locale)
          ? 'Belépőkártya használat'
          : 'Card Used',
      };
    },
    getAudience: (payload) => resolveAudienceForDoorlock(payload),
    getDelay: () => 0,
    preferenceKey: 'doorlockCardUsed',
    type: 'doorlock_card_used',
  },
];
