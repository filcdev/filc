import { notificationsFactory } from '#routes/notifications/_factory';
import {
  getNotificationSettings,
  getUnreadCount,
  getUnsubscribePage,
  listNotifications,
  markAllAsRead,
  markAsRead,
  previewTestNotification,
  processUnsubscribe,
  registerFcmToken,
  sendTestNotification,
  testNotification,
  unregisterFcmToken,
  updateNotificationSettings,
} from '#routes/notifications/notifications';

export const notificationsRouter = notificationsFactory
  .createApp()
  .get('/', ...listNotifications)
  .get('/unread-count', ...getUnreadCount)
  .get('/test', ...testNotification)
  .post('/send-test', ...sendTestNotification)
  .post('/preview-test', ...previewTestNotification)
  .get('/settings', ...getNotificationSettings)
  .patch('/settings', ...updateNotificationSettings)
  .post('/fcm-token', ...registerFcmToken)
  .delete('/fcm-token', ...unregisterFcmToken)
  .patch('/:id/read', ...markAsRead)
  .patch('/read-all', ...markAllAsRead)
  .get('/unsubscribe', ...getUnsubscribePage)
  .post('/unsubscribe', ...processUnsubscribe);
