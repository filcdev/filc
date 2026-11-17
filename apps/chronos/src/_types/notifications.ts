import type { NotificationDetail } from '@filcdev/api/domains/notifications';
import type { EmailDetail } from '@filcdev/mail';

/**
 * Compile-time proof that the inbox's detail row and the mail template's are
 * still the same shape. They are declared separately on purpose — the mail
 * package must not depend on the API contract — so this is what turns a drift
 * between them into a type error instead of a rendering bug.
 */
export const notificationDetailMatchesEmail: NotificationDetail extends EmailDetail
  ? EmailDetail extends NotificationDetail
    ? true
    : never
  : never = true;
