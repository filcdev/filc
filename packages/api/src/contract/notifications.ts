import { oc } from '@orpc/contract';
import {
  fcmTokenSchema,
  notificationIdParamsSchema,
  notificationListResponseSchema,
  notificationRowSchema,
  notificationsOkResponseSchema,
  paginationSchema,
  previewTestNotificationSchema,
  previewTestResponseSchema,
  sendTestNotificationSchema,
  sendTestResultSchema,
  tokenDeleteSchema,
  unreadCountResponseSchema,
  updateSettingsSchema,
  userPreferencesSchema,
} from '../domains/notifications';

/**
 * The notification inbox and per-user preferences.
 *
 * These procedures deliberately have no `filcRoute` metadata, so the generated
 * document filters this subtree out and the endpoints exist only for the typed
 * RPC client. The original reason was keeping the document identical to the
 * pre-migration one; that document and the `x-filc_*` extensions are gone, so
 * this is now a standing choice rather than a constraint — worth revisiting if
 * an external client should ever reach the inbox. `GET|POST
 * /api/notifications/unsubscribe` is not part of the contract either — it
 * renders HTML from a plain handler in
 * `apps/chronos/src/routes/notifications/unsubscribe-html.ts`.
 */
export const notificationsContract = {
  fcmTokens: {
    register: oc.input(fcmTokenSchema).output(notificationsOkResponseSchema),
    unregister: oc
      .input(tokenDeleteSchema)
      .output(notificationsOkResponseSchema),
  },
  /** Paged history for the signed-in user, filtered by type/unread/date. */
  list: oc.input(paginationSchema).output(notificationListResponseSchema),
  markAllAsRead: oc.output(notificationsOkResponseSchema),
  markAsRead: oc
    .input(notificationIdParamsSchema)
    .output(notificationRowSchema),
  /** Dev-only: render a notification template without sending it. */
  previewTest: oc
    .input(previewTestNotificationSchema)
    .output(previewTestResponseSchema),
  /** Dev-only: send a test message over email, in-app and/or push. */
  sendTest: oc.input(sendTestNotificationSchema).output(sendTestResultSchema),
  settings: oc.output(userPreferencesSchema),
  /** Dev-only: drop a test notification into the caller's own inbox. */
  test: oc.output(notificationRowSchema),
  unreadCount: oc.output(unreadCountResponseSchema),
  updateSettings: oc.input(updateSettingsSchema).output(userPreferencesSchema),
};
