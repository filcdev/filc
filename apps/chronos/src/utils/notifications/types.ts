import type { EmailDetail } from '@filcdev/mail';

export type NotificationType =
  | 'substitution'
  | 'substitution_teacher'
  | 'moved_lesson'
  | 'announcement'
  | 'system_message'
  | 'blog_post'
  | 'doorlock_card_used'
  | 'cohort_reselection_required'
  | 'test';

export type NotificationPreferences = {
  substitution: boolean;
  movedLesson: boolean;
  announcement: boolean;
  systemMessage: boolean;
  blogPost: boolean;
  doorlockCardUsed: boolean;
  /** Legacy master switch, read-only since the channel split. */
  channelsEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
};

/**
 * What a user who has never touched their settings gets. Also the base a
 * stored record is merged over, so a row written before a toggle existed — or
 * a partial one — falls back per key instead of reading `undefined`, which
 * would silently opt the user out of that type.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  announcement: true,
  blogPost: false,
  channelsEnabled: true,
  doorlockCardUsed: false,
  emailEnabled: true,
  inAppEnabled: true,
  movedLesson: true,
  pushEnabled: true,
  substitution: true,
  systemMessage: true,
};

/**
 * The literal baked into the `user_preferences.notification_preferences`
 * column default. Kept in the pre-split shape on purpose: changing a column
 * default is a schema migration, while every reader merges
 * `DEFAULT_NOTIFICATION_PREFERENCES` over the stored row — so a row created
 * with this default still resolves the three channels as enabled.
 */
export const NOTIFICATION_PREFERENCES_COLUMN_DEFAULT = {
  announcement: true,
  blogPost: false,
  channelsEnabled: true,
  doorlockCardUsed: false,
  movedLesson: true,
  substitution: true,
  systemMessage: true,
} as NotificationPreferences;

/**
 * Which delivery channels a user's preferences allow.
 *
 * `channelsEnabled === false` is the pre-split "everything off" state left by
 * an old unsubscribe, so it wins over the per-channel flags. Otherwise a flag
 * that is missing (a row written before the split) reads as enabled.
 */
export function resolveChannelFlags(
  prefs: Pick<
    NotificationPreferences,
    'channelsEnabled' | 'emailEnabled' | 'pushEnabled' | 'inAppEnabled'
  >
): { email: boolean; push: boolean; inApp: boolean } {
  if (prefs.channelsEnabled === false) {
    return { email: false, inApp: false, push: false };
  }
  return {
    email: prefs.emailEnabled !== false,
    inApp: prefs.inAppEnabled !== false,
    push: prefs.pushEnabled !== false,
  };
}

export type AudienceUser = {
  id: string;
  email: string;
  cohortId: string | null;
  language: string;
};

export type NotificationContent = {
  title: string;
  content: string;
  details?: EmailDetail[];
  highlights?: string[];
  metadata?: Record<string, unknown>;
};

/**
 * How one module declares the notification it owns: what it says, who gets it,
 * how long the engine waits, and the opt-out flag that gates it. The engine
 * holds no per-type bookkeeping of its own, so a new notification type is a
 * module-local change plus one union member.
 */
export type NotificationHandler<T = unknown> = {
  buildContent: (payload: T, locale: string) => NotificationContent;
  getAudience: (payload: T) => Promise<AudienceUser[]>;
  getDelay: () => number;
  /** Absent means the type is not gated on a user preference. */
  preferenceKey?: keyof NotificationPreferences;
  type: NotificationType;
};

export type DeliveryJob = {
  notificationId: string;
  userId: string;
  email: string;
  type: NotificationType;
  title: string;
  content: string;
  details?: EmailDetail[];
  highlights?: string[];
  emailEnabled: boolean;
  pushEnabled: boolean;
  /**
   * Delivery bookkeeping owned by the queue: a channel marked `true` has been
   * delivered and is not attempted again when the job is retried.
   */
  delivered?: { email: boolean; push: boolean };
  /** Locale the recipient's `buildContent` ran with; the email wrapper uses it too. */
  language: string;
};
