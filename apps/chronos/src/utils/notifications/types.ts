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
 * The literal baked into the `user_preferences.notification_preferences`
 * column default. Kept in the pre-split shape on purpose: changing a column
 * default is a schema migration, while every reader merges
 * `DEFAULT_NOTIFICATION_PREFERENCES` over the stored row — so a row created
 * with this default still resolves email as enabled.
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
 * The single read shape of a stored preferences row: defaults merged over the
 * stored value, then the email flag replaced by its *effective* value with
 * `channelsEnabled` raised.
 *
 * A legacy row (`channelsEnabled: false`, no `emailEnabled` key) therefore
 * reads back as email off, which is what the user chose, instead of the
 * defaults' `true`. An email flag the row does not name falls back to the
 * caller-supplied role default, then to the global default. Everything that
 * reads a row — the settings endpoint, the delivery engine, the dev helpers —
 * goes through this so the write path and the read path agree on what the row
 * means.
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
 * Apply a preference patch over a stored record and return the complete value
 * to persist.
 *
 * `base` may be a raw/partial row, the same shape `completePreferences` takes:
 * it is completed first, so a legacy `channelsEnabled: false` row reads as
 * email off and a patch that names only a type flag leaves it off rather than
 * reviving the defaults. An email flag the base does not name falls back to
 * `defaults` — which is why the role defaults have to be forwarded here, not
 * only to the read path. A patch that names the email flag sets it
 * explicitly, and the stored record always ends up in the current shape
 * (`channelsEnabled: true`, every key present).
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
  /**
   * Delivery bookkeeping owned by the queue: a channel marked `true` has been
   * delivered and is not attempted again when the job is retried.
   */
  delivered?: { email: boolean; push: boolean };
  /** Locale the recipient's `buildContent` ran with; the email wrapper uses it too. */
  language: string;
};
