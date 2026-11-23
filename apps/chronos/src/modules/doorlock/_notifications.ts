import { createTranslator } from '@filcdev/i18n';
import { resolveAudienceForUser } from '#utils/notifications/engine';
import type { NotificationHandler } from '#utils/notifications/types';

/**
 * The notification the door lock owns: a card was used, told to the user the
 * card belongs to. Dispatched the moment the device socket reports it, so it
 * carries no delay.
 */
export const doorlockNotifications: readonly NotificationHandler[] = [
  {
    buildContent: (payload, locale) => {
      const { deviceName } = payload as { deviceName: string };
      const t = createTranslator(locale);
      return {
        content: deviceName
          ? t('doorlock.withDevice', { device: deviceName })
          : t('doorlock.withoutDevice'),
        title: t('doorlock.title'),
      };
    },
    getAudience: (payload) => resolveAudienceForUser(payload),
    getDelay: () => 0,
    preferenceKey: 'doorlockCardUsed',
    type: 'doorlock_card_used',
  },
];
