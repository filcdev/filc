export type NotificationType =
  | 'substitution'
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

export type NotificationHandler<T = unknown> = {
  type: NotificationType;
  getDelay: () => number;
  getAudience: (payload: T) => Promise<AudienceUser[]>;
  buildContent: (payload: T, locale: string) => NotificationContent;
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
