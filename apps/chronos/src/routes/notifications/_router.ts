import { notificationsFactory } from '#routes/notifications/_factory';
import {
  getNotificationSettings,
  getUnreadCount,
  getUnsubscribePage,
  listNotifications,
  markAllAsRead,
  markAsRead,
  processUnsubscribe,
  registerFcmToken,
  testNotification,
  unregisterFcmToken,
  updateNotificationSettings,
} from '#routes/notifications/notifications';

export const notificationsRouter = notificationsFactory
  .createApp()
  .get('/', ...listNotifications)
  .get('/unread-count', ...getUnreadCount)
  .get('/test', ...testNotification)
  .get('/settings', ...getNotificationSettings)
  .patch('/settings', ...updateNotificationSettings)
  .post('/fcm-token', ...registerFcmToken)
  .delete('/fcm-token', ...unregisterFcmToken)
  .patch('/:id/read', ...markAsRead)
  .patch('/read-all', ...markAllAsRead)
  .get('/unsubscribe', ...getUnsubscribePage)
  .post('/unsubscribe', ...processUnsubscribe);
