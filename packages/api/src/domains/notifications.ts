import z from 'zod';

export const paginationSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  type: z.string().optional(),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const timetableGroupDisplayValues = ['highlight', 'hide'] as const;
export type TimetableGroupDisplay =
  (typeof timetableGroupDisplayValues)[number];

export const updateSettingsSchema = z.object({
  language: z.string().optional(),
  notificationPreferences: z.record(z.string(), z.unknown()).optional(),
  theme: z.string().optional(),
  timetableClassColors: z.record(z.string(), z.number()).optional(),
  timetableGroupDisplay: z.enum(timetableGroupDisplayValues).optional(),
  timetableView: z.string().optional(),
});

export type UpdateNotificationSettingsInput = z.infer<
  typeof updateSettingsSchema
>;

export const fcmTokenSchema = z.object({
  deviceInfo: z.string().optional(),
  token: z.string(),
});

export type RegisterFcmTokenInput = z.infer<typeof fcmTokenSchema>;

export const tokenDeleteSchema = z.object({
  token: z.string(),
});

export type UnregisterFcmTokenInput = z.infer<typeof tokenDeleteSchema>;

export const notificationIdParamsSchema = z.object({ id: z.string().uuid() });

export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;

export const unsubscribeSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid unsubscribe token'),
  userId: z.string().uuid(),
});

export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;

export const notificationTypeValues = [
  'substitution',
  'substitution_teacher',
  'moved_lesson',
  'announcement',
  'system_message',
  'blog_post',
  'doorlock_card_used',
  'cohort_reselection_required',
  'test',
] as const;

export type NotificationTypeValue = (typeof notificationTypeValues)[number];

export const notificationTypeSchema = z.enum(notificationTypeValues);

export const testNotificationChannelsSchema = z
  .object({
    email: z.boolean().default(false),
    inApp: z.boolean().default(false),
    push: z.boolean().default(false),
  })
  .refine((channels) => channels.email || channels.inApp || channels.push, {
    message: 'At least one channel must be enabled',
  });

export const sendTestNotificationSchema = z.object({
  channels: testNotificationChannelsSchema,
  content: z.string().optional(),
  email: z.email().optional(),
  language: z.enum(['en', 'hu']).optional(),
  subject: z.string().optional(),
  type: notificationTypeSchema,
});

export type SendTestNotificationInput = z.infer<
  typeof sendTestNotificationSchema
>;

export const previewTestNotificationSchema = z.object({
  content: z.string().optional(),
  language: z.enum(['en', 'hu']).optional(),
  subject: z.string().optional(),
  type: notificationTypeSchema,
});

export type PreviewTestNotificationInput = z.infer<
  typeof previewTestNotificationSchema
>;

/** The per-type email/push toggles stored in `user_preferences.notification_preferences`. */
export const notificationPreferencesSchema = z.object({
  announcement: z.boolean(),
  blogPost: z.boolean(),
  channelsEnabled: z.boolean(),
  doorlockCardUsed: z.boolean(),
  movedLesson: z.boolean(),
  substitution: z.boolean(),
  systemMessage: z.boolean(),
});

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

/** One `notification` row: a single inbox entry. */
export const notificationRowSchema = z.object({
  content: z.string(),
  createdAt: z.date(),
  id: z.uuid(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  read: z.boolean(),
  title: z.string(),
  type: z.string(),
  userId: z.uuid(),
});

export type NotificationRow = z.infer<typeof notificationRowSchema>;

/**
 * Paged notification history. The row count used to travel in the response
 * envelope's `total`; it is part of the payload now.
 */
export const notificationListResponseSchema = z.object({
  items: z.array(notificationRowSchema),
  total: z.number(),
});

export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;

/** Unread badge count for the signed-in user. */
export const unreadCountResponseSchema = z.object({ count: z.number() });

export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;

/** One `user_preferences` row: notification, language and timetable settings. */
export const userPreferencesSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  language: z.string(),
  notificationPreferences: notificationPreferencesSchema,
  theme: z.string(),
  timetableClassColors: z.record(z.string(), z.number()),
  timetableGroupDisplay: z.string(),
  timetableView: z.string(),
  updatedAt: z.date(),
  userId: z.uuid(),
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

/** Which channels a dev-only test notification actually went out on. */
export const sendTestResultSchema = z.object({
  email: z.boolean(),
  inApp: z.boolean(),
  push: z.boolean(),
});

export type SendTestResult = z.infer<typeof sendTestResultSchema>;

/** Rendered HTML of a notification template, for the dev preview pane. */
export const previewTestResponseSchema = z.object({ html: z.string() });

export type PreviewTestResponse = z.infer<typeof previewTestResponseSchema>;

/** Payload of the notification writes that have nothing to return. */
export const notificationsOkResponseSchema = z.object({ ok: z.literal(true) });

export type NotificationsOkResponse = z.infer<
  typeof notificationsOkResponseSchema
>;
