export const NOTIFICATION_TYPES = [
  'substitution',
  'substitution_teacher',
  'moved_lesson',
  'announcement',
  'system_message',
  'blog_post',
  'doorlock_card_used',
] as const;

export function typeLabel(
  type: string,
  t: ReturnType<typeof import('react-i18next').useTranslation>['t']
) {
  const map: Record<string, string> = {
    announcement: t('notifications.types.announcement'),
    blog_post: t('notifications.types.blogPost'),
    doorlock_card_used: t('notifications.types.doorlockCardUsed'),
    moved_lesson: t('notifications.types.movedLesson'),
    substitution: t('notifications.types.substitution'),
    substitution_teacher: t('notifications.types.substitutionTeacher'),
    system_message: t('notifications.types.systemMessage'),
  };
  return map[type] ?? type;
}
