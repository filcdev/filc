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
