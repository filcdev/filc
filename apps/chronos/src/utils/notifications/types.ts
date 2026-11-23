import type { EmailDetail } from '@filcdev/mail';

export type NotificationType =
  | 'substitution'
  | 'substitution_teacher'
  | 'moved_lesson'
  | 'moved_lesson_teacher'
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
  /**
   * Email for `announcement` only; in-app announcements are unaffected. Off by
   * default, and a stored row that predates the key must not start mailing.
   */
  announcementEmail: boolean;
  systemMessage: boolean;
  blogPost: boolean;
  doorlockCardUsed: boolean;
  /** Legacy master switch, read-only since the channel split. */
  channelsEnabled: boolean;
  emailEnabled: boolean;
};

/**
 * What a user who has never touched their settings gets. Also the base a
 * stored record is merged over, so a row written before a toggle existed — or
 * a partial one — falls back per key instead of reading `undefined`, which
 * would silently opt the user out of that type.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  announcement: true,
  announcementEmail: false,
  blogPost: false,
  channelsEnabled: true,
  doorlockCardUsed: false,
  emailEnabled: true,
  movedLesson: true,
  substitution: true,
  systemMessage: true,
};

/**
 * Role-aware fallback for the email flag, used when the stored row does not
 * name it. Teachers get email by default; everyone else has to opt in.
 */
export type ChannelDefaults = {
  email?: boolean;
};

/**
 * Pre-split shape on purpose: changing a column default is a migration, and
 * every reader merges `DEFAULT_NOTIFICATION_PREFERENCES` over the stored row.
 */
export const NOTIFICATION_PREFERENCES_COLUMN_DEFAULT: Partial<NotificationPreferences> =
  {
    announcement: true,
    blogPost: false,
    channelsEnabled: true,
    doorlockCardUsed: false,
    movedLesson: true,
    substitution: true,
    systemMessage: true,
  };

/**
 * Whether the user's preferences allow email.
 *
 * `channelsEnabled === false` is the pre-split "everything off" state left by
 * an old unsubscribe, so it wins over the per-channel flag. Otherwise an
 * explicit `emailEnabled` (or, for a row written before the split, the
 * caller's role default) decides, and `true` is the last fallback.
 */
export function resolveEmailEnabled(
  prefs: Partial<
    Pick<NotificationPreferences, 'channelsEnabled' | 'emailEnabled'>
  >,
  defaults?: ChannelDefaults
): boolean {
  if (prefs.channelsEnabled === false) {
    return false;
  }
  return prefs.emailEnabled ?? defaults?.email ?? true;
}

/**
 * The one read shape: defaults merged over the stored row, a legacy
 * `channelsEnabled: false` winning over them, role defaults filling only a
 * missing `emailEnabled` key.
 */
export function completePreferences(
  stored?: Partial<NotificationPreferences> | null,
  defaults?: ChannelDefaults
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...stored,
    channelsEnabled: true,
    emailEnabled: resolveEmailEnabled(stored ?? {}, defaults),
  };
}

/**
 * Whether the user's preferences allow this notification at all.
 *
 * `system_message` is policy, not a user choice: a message the school addresses
 * to a class has to reach every recipient, so it bypasses the per-type gate —
 * a stored `systemMessage: false` and a legacy `channelsEnabled: false` row
 * included. Every other type is gated on its handler's `preferenceKey`, and a
 * handler without one is never gated.
 *
 * Pure on purpose: the engine passes the row it already completed, so this
 * decision is unit-testable without a database or the environment.
 */
export function isNotificationAllowed(
  type: NotificationType,
  preferenceKey: keyof NotificationPreferences | undefined,
  preferences: NotificationPreferences
): boolean {
  if (type === 'system_message' || !preferenceKey) {
    return true;
  }
  return preferences[preferenceKey];
}

/**
 * Whether the notification's email leg runs, given the completed preferences.
 *
 * `system_message` forces email on, exactly like its in-app row: the type is
 * not opt-out-able, so neither the channel switch nor the legacy master switch
 * (already folded into `emailEnabled` by `completePreferences`) may drop the
 * mail. Every other type keeps the channel switch as its gate, and
 * `announcement` needs its own opt-in on top of it.
 */
export function resolveEmailAllowed(
  type: NotificationType,
  preferences: Pick<
    NotificationPreferences,
    'announcementEmail' | 'emailEnabled'
  >
): boolean {
  if (type === 'system_message') {
    return true;
  }
  return (
    preferences.emailEnabled &&
    (type !== 'announcement' || preferences.announcementEmail)
  );
}

/**
 * Complete the base first: a legacy `channelsEnabled: false` row stays off, so
 * `defaults` must be forwarded here too, not only to the read path.
 */
export function applyPreferencesPatch(
  base: Partial<NotificationPreferences>,
  patch: Partial<NotificationPreferences>,
  defaults?: ChannelDefaults
): NotificationPreferences {
  const next = completePreferences(base, defaults);
  for (const key of Object.keys(patch) as (keyof NotificationPreferences)[]) {
    const value = patch[key];
    if (value !== undefined) {
      next[key] = value;
    }
  }
  next.channelsEnabled = true;
  return next;
}

export type AudienceUser = {
  id: string;
  email: string;
  cohortId: string | null;
  language: string;
  /**
   * Display name for the mail's greeting. Carried on the audience so the
   * per-recipient row is already loaded and the email provider does not
   * re-select `user.name` for every mail it sends.
   */
  name: string;
  /**
   * The stored `user_preferences.notification_preferences` record, exactly as
   * written (partial, not merged with the defaults), or `undefined` when the
   * user has no preferences row. The engine resolves language from the same
   * row, so carrying the record here is what lets delivery gate on the user's
   * preferences without a second read per recipient.
   */
  notificationPreferences?: Partial<NotificationPreferences>;
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
  /** Recipient's display name for the mail greeting, resolved with the audience. */
  recipientName: string;
  type: NotificationType;
  title: string;
  content: string;
  details?: EmailDetail[];
  highlights?: string[];
  emailEnabled: boolean;
  /**
   * Delivery bookkeeping owned by the queue: a channel marked `true` has been
   * delivered and is not attempted again when the job is retried.
   */
  delivered?: { email: boolean; push: boolean };
  /**
   * Attempts started so far, owned by the queue and 1-based. Runtime-only:
   * never written to a store, so a job re-read from anywhere starts over.
   */
  attempt?: number;
  /** Locale the recipient's `buildContent` ran with; the email wrapper uses it too. */
  language: string;
};
