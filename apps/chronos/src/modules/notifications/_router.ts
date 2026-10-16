import {
  getNotificationSettings,
  getUnreadCount,
  listNotifications,
  markAllAsRead,
  markAsRead,
  previewTestNotification,
  registerFcmToken,
  sendTestNotification,
  testNotification,
  unregisterFcmToken,
  updateNotificationSettings,
} from '#modules/notifications/notifications';

/**
 * Mirrors `notificationsContract`. `GET|POST /api/notifications/unsubscribe`
 * is not here: it is the plain HTML handler in `unsubscribe-html.ts`.
 */
export const notificationsRouter = {
  fcmTokens: {
    register: registerFcmToken,
    unregister: unregisterFcmToken,
  },
  list: listNotifications,
  markAllAsRead,
  markAsRead,
  previewTest: previewTestNotification,
  sendTest: sendTestNotification,
  settings: getNotificationSettings,
  test: testNotification,
  unreadCount: getUnreadCount,
  updateSettings: updateNotificationSettings,
};
