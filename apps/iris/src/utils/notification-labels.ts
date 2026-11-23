import type { NotificationTypeValue } from '@filcdev/api/domains/notifications';

// biome-ignore lint/performance/noBarrelFile: this module is the single source of the notification type list and its labels
export { notificationTypeValues as NOTIFICATION_TYPES } from '@filcdev/api/domains/notifications';

export function typeLabel(
  type: string,
  t: ReturnType<typeof import('react-i18next').useTranslation>['t']
) {
  // Typed against the wire values, so a new notification type fails `tsc`
  // until its label is added here and to both locale files.
  const map: Record<NotificationTypeValue, string> = {
    announcement: t('notifications.types.announcement'),
    blog_post: t('notifications.types.blogPost'),
    cohort_reselection_required: t(
      'notifications.types.cohortReselectionRequired'
    ),
    doorlock_card_used: t('notifications.types.doorlockCardUsed'),
    moved_lesson: t('notifications.types.movedLesson'),
    moved_lesson_teacher: t('notifications.types.movedLessonTeacher'),
    substitution: t('notifications.types.substitution'),
    substitution_teacher: t('notifications.types.substitutionTeacher'),
    system_message: t('notifications.types.systemMessage'),
    test: t('notifications.types.test'),
  };
  return map[type as NotificationTypeValue] ?? type;
}
