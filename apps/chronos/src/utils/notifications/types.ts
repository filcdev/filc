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
  channelsEnabled: boolean;
};

export type AudienceUser = {
  id: string;
  email: string;
  cohortId: string | null;
  language: string;
};

export type NotificationContent = {
  title: string;
  content: string;
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
  channelsEnabled: boolean;
};
