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
  token: z.string(),
  userId: z.string().uuid(),
});

export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
