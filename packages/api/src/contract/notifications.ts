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
 * These endpoints carried no OpenAPI metadata before the migration
 * (`apps/chronos/openapi/baseline.json` has no `/notifications` paths at all),
 * so the procedures deliberately have no `filcRoute` metadata: they exist for
 * the typed RPC client, and the generated document filters this subtree out so
 * it stays identical to the baseline. `GET|POST /api/notifications/unsubscribe`
 * is not part of the contract either — it renders HTML from a plain handler in
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
