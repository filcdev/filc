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
import { filcRoute } from './route';

/**
 * The notification inbox, the per-user preferences and push-token registration.
 *
 * Every procedure here is documented, because they are an external-client
 * surface: the mobile app registers its FCM token, reads the inbox and edits
 * its preferences through them.
 *
 * The three `*Test*` procedures are development helpers, each refused unless
 * `CHRONOS_ENABLE_TEST_NOTIFICATIONS` is set (it defaults to off, and
 * `sendTest` takes a free-form address to send real mail to), which is why
 * their descriptions say so.
 *
 * `GET|POST /api/notifications/unsubscribe` is not part of the contract: it
 * renders HTML from a plain handler in
 * `apps/chronos/src/modules/notifications/unsubscribe-html.ts`.
 */
export const notificationsContract = {
  fcmTokens: {
    register: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Register a push (FCM) token for the signed-in user',
          method: 'POST',
          operationId: 'postNotificationsFcmTokens',
          path: '/notifications/fcm-tokens',
          tags: ['Notifications'],
        })
      )
      .input(fcmTokenSchema)
      .output(notificationsOkResponseSchema),
    unregister: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Unregister a push (FCM) token',
          method: 'DELETE',
          operationId: 'deleteNotificationsFcmTokensByToken',
          path: '/notifications/fcm-tokens/{token}',
          tags: ['Notifications'],
        })
      )
      .input(tokenDeleteSchema)
      .output(notificationsOkResponseSchema),
  },
  /** Paged history for the signed-in user, filtered by type/unread/date. */
  list: oc
    .route(
      filcRoute({
        auth: true,
        description: "List the signed-in user's notifications",
        method: 'GET',
        operationId: 'getNotifications',
        path: '/notifications',
        tags: ['Notifications'],
      })
    )
    .input(paginationSchema)
    .output(notificationListResponseSchema),
  markAllAsRead: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Mark every notification of the signed-in user as read',
        method: 'POST',
        operationId: 'postNotificationsReadAll',
        path: '/notifications/read-all',
        tags: ['Notifications'],
      })
    )
    .output(notificationsOkResponseSchema),
  markAsRead: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Mark one notification as read',
        method: 'POST',
        operationId: 'postNotificationsByIdRead',
        path: '/notifications/{id}/read',
        tags: ['Notifications'],
      })
    )
    .input(notificationIdParamsSchema)
    .output(notificationRowSchema),
  previewTest: oc
    .route(
      filcRoute({
        auth: true,
        description:
          'Development helper: render a notification template without sending it (needs CHRONOS_ENABLE_TEST_NOTIFICATIONS)',
        method: 'POST',
        operationId: 'postNotificationsTestPreview',
        path: '/notifications/test/preview',
        tags: ['Notifications'],
      })
    )
    .input(previewTestNotificationSchema)
    .output(previewTestResponseSchema),
  sendTest: oc
    .route(
      filcRoute({
        auth: true,
        description:
          'Development helper: send a test message over email, in-app and/or push (needs CHRONOS_ENABLE_TEST_NOTIFICATIONS)',
        method: 'POST',
        operationId: 'postNotificationsTestSend',
        path: '/notifications/test/send',
        tags: ['Notifications'],
      })
    )
    .input(sendTestNotificationSchema)
    .output(sendTestResultSchema),
  settings: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Read the notification preferences of the signed-in user',
        method: 'GET',
        operationId: 'getNotificationsSettings',
        path: '/notifications/settings',
        tags: ['Notifications'],
      })
    )
    .output(userPreferencesSchema),
  test: oc
    .route(
      filcRoute({
        auth: true,
        description:
          "Development helper: drop a test notification into the caller's own inbox (needs CHRONOS_ENABLE_TEST_NOTIFICATIONS)",
        method: 'POST',
        operationId: 'postNotificationsTest',
        path: '/notifications/test',
        tags: ['Notifications'],
      })
    )
    .output(notificationRowSchema),
  unreadCount: oc
    .route(
      filcRoute({
        auth: true,
        description: "Count the signed-in user's unread notifications",
        method: 'GET',
        operationId: 'getNotificationsUnreadCount',
        path: '/notifications/unread-count',
        tags: ['Notifications'],
      })
    )
    .output(unreadCountResponseSchema),
  updateSettings: oc
    .route(
      filcRoute({
        auth: true,
        description:
          'Update the notification preferences of the signed-in user',
        method: 'PATCH',
        operationId: 'patchNotificationsSettings',
        path: '/notifications/settings',
        tags: ['Notifications'],
      })
    )
    .input(updateSettingsSchema)
    .output(userPreferencesSchema),
};
