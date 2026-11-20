import z from 'zod';
import { listResponse, paginationSchema } from './list';
import { colorSchemeSchema } from './theme';

/**
 * The per-type toggles and the email channel switch stored in
 * `user_preferences.notification_preferences`. Declared first because
 * `updateSettingsSchema` narrows it with `.partial()`: the column has to hold
 * a complete record, so a caller may patch a subset but never store one.
 */
export const notificationPreferencesSchema = z.object({
  announcement: z.boolean(),
  announcementEmail: z
    .boolean()
    .describe(
      'Email me about announcements; in-app announcements are unaffected'
    ),
  blogPost: z.boolean(),
  channelsEnabled: z
    .boolean()
    .describe(
      'Legacy master switch; ignored since the channel split — use emailEnabled. A stored false still forces email off, beating the role default'
    ),
  doorlockCardUsed: z.boolean(),
  emailEnabled: z
    .boolean()
    .describe(
      'Receive notification email; the only user-facing channel switch, on by default only for an account linked to a teacher'
    ),
  movedLesson: z.boolean(),
  substitution: z.boolean(),
  systemMessage: z
    .boolean()
    .describe('Ignored: system messages are always delivered'),
});

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

/** One label/value row of a notification's detail block; the same shape as the mail package's `EmailDetail`, asserted in `apps/chronos/src/_types/notifications.ts`. */
export const notificationDetailSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export type NotificationDetail = z.infer<typeof notificationDetailSchema>;

/** The history filters on top of the shared page window. */
export const notificationQuerySchema = paginationSchema.extend({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  type: z.string().optional(),
  unread: z
    .enum(['true', 'false'])
    .optional()
    // `undefined` must survive, or zod emits the key for an absent param and
    // the handler's `unread !== undefined` check never short-circuits — which
    // would filter the inbox to read rows only.
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;

export const timetableGroupDisplayValues = ['highlight', 'hide'] as const;
export type TimetableGroupDisplay =
  (typeof timetableGroupDisplayValues)[number];

export const updateSettingsSchema = z.object({
  colorScheme: colorSchemeSchema.optional(),
  language: z.string().optional(),
  notificationPreferences: notificationPreferencesSchema.partial().optional(),
  siteThemeAcknowledged: z.string().nullable().optional(),
  siteThemeEnabled: z.boolean().optional(),
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

export const notificationIdParamsSchema = z.object({ id: z.uuid() });

export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;

export const unsubscribeSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid unsubscribe token'),
  userId: z.uuid(),
});

export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;

export const notificationTypeValues = [
  'substitution',
  'substitution_teacher',
  'moved_lesson',
  'moved_lesson_teacher',
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
  details: z.array(notificationDetailSchema).optional(),
  email: z.email().optional(),
  highlights: z.array(z.string()).optional(),
  language: z.enum(['en', 'hu']).optional(),
  subject: z.string().optional(),
  type: notificationTypeSchema,
});

export type SendTestNotificationInput = z.infer<
  typeof sendTestNotificationSchema
>;

export const previewTestNotificationSchema = z.object({
  content: z.string().optional(),
  details: z.array(notificationDetailSchema).optional(),
  entityId: z
    .uuid()
    .optional()
    .describe(
      'Id of a real record to render instead of the supplied text; only the types previewTest resolves accept one'
    ),
  highlights: z.array(z.string()).optional(),
  language: z.enum(['en', 'hu']).optional(),
  subject: z.string().optional(),
  type: notificationTypeSchema,
});

export type PreviewTestNotificationInput = z.infer<
  typeof previewTestNotificationSchema
>;

/**
 * The structured payload stored in `notification.metadata`. The known keys are
 * the ones the inbox renders or reacts to; the catchall keeps the handler-owned
 * keys (and anything added before this schema) instead of stripping them.
 */
export const notificationMetadataSchema = z
  .object({
    action: z.string().optional(),
    details: z.array(notificationDetailSchema).optional(),
    highlights: z.array(z.string()).optional(),
    slug: z.string().optional(),
    userId: z.uuid().optional(),
  })
  .catchall(z.unknown());

export type NotificationMetadata = z.infer<typeof notificationMetadataSchema>;

/**
 * Read shape of `notification.metadata`.
 *
 * The column is handler-owned jsonb, so a row written by an older handler (or
 * by hand) may not match the typed shape above; one such row must not fail the
 * whole inbox response. A value that does not parse reads as `null` — no
 * detail block — the same way `colorSchemeSchema.catch(...)` tolerates a bad
 * `color_scheme`.
 */
const notificationMetadataReadSchema = notificationMetadataSchema
  .nullable()
  .catch(null);

/** One `notification` row: a single inbox entry. */
export const notificationRowSchema = z.object({
  content: z.string(),
  createdAt: z.date(),
  id: z.uuid(),
  metadata: notificationMetadataReadSchema,
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
export const notificationListResponseSchema = listResponse(
  notificationRowSchema
);

export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;

/** Unread badge count for the signed-in user. */
export const unreadCountResponseSchema = z.object({ count: z.number() });

export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;

/** One `user_preferences` row: notification, language and timetable settings. */
export const userPreferencesSchema = z.object({
  colorScheme: colorSchemeSchema,
  createdAt: z.date(),
  id: z.uuid(),
  language: z.string(),
  notificationPreferences: notificationPreferencesSchema,
  /** The seasonal skin the visitor last acknowledged, or null for never. */
  siteThemeAcknowledged: z.string().nullable(),
  /** Whether the site-wide seasonal skin may paint over the visitor's scheme. */
  siteThemeEnabled: z.boolean(),
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
