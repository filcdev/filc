import { createTranslator } from '@filcdev/i18n';
import { env } from '#utils/environment';
import { resolveAudienceByCohortOrAll } from '#utils/notifications/engine';
import type {
  NotificationContent,
  NotificationHandler,
} from '#utils/notifications/types';

/** The payload is the record this module's own handlers dispatch with. */
function byCohortOrAll(payload: unknown) {
  const p = payload as { cohortIds?: string[] };
  return resolveAudienceByCohortOrAll(p.cohortIds);
}

export function buildAnnouncementContent(
  payload: { title: string },
  locale: string
): NotificationContent {
  const t = createTranslator(locale);
  const title = payload.title || '';
  return {
    content: t('announcement.content', {
      prefix: t('announcement.prefix'),
      title,
    }),
    title: t('announcement.title'),
  };
}

export function buildSystemMessageContent(
  payload: { title: string },
  locale: string
): NotificationContent {
  const t = createTranslator(locale);
  const title = payload.title || '';
  return {
    content: t('systemMessage.content', {
      prefix: t('systemMessage.prefix'),
      title,
    }),
    title: t('systemMessage.title'),
  };
}

export function buildBlogPostContent(
  payload: { slug?: string; title: string },
  locale: string
): NotificationContent {
  const t = createTranslator(locale);
  const title = payload.title || '';
  const result: NotificationContent = {
    content: t('blogPost.content', {
      cta: t('blogPost.cta'),
      prefix: t('blogPost.prefix'),
      title,
    }),
    title: t('blogPost.title'),
  };
  if (payload.slug) {
    result.metadata = { slug: payload.slug };
  }
  return result;
}

/**
 * The notifications the news module owns: an announcement, a system notice and
 * a published blog post. Each is written in the recipient's language, because
 * every notification goes out per user rather than once per event.
 */
export const newsNotifications: readonly NotificationHandler[] = [
  {
    buildContent: (payload, locale) =>
      buildAnnouncementContent(payload as { title: string }, locale),
    getAudience: byCohortOrAll,
    getDelay: () => env.notificationDelayAnnouncement,
    preferenceKey: 'announcement',
    type: 'announcement',
  },
  {
    buildContent: (payload, locale) =>
      buildSystemMessageContent(payload as { title: string }, locale),
    getAudience: byCohortOrAll,
    getDelay: () => env.notificationDelaySystemMessage,
    preferenceKey: 'systemMessage',
    type: 'system_message',
  },
  {
    buildContent: (payload, locale) =>
      buildBlogPostContent(payload as { slug?: string; title: string }, locale),
    getAudience: () => resolveAudienceByCohortOrAll(),
    getDelay: () => env.notificationDelayBlogPost,
    preferenceKey: 'blogPost',
    type: 'blog_post',
  },
];
