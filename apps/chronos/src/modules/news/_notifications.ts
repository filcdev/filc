import { env } from '#utils/environment';
import { resolveAudienceByCohortOrAll } from '#utils/notifications/engine';
import { isHungarianLocale } from '#utils/notifications/locale';
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
  const title = payload.title || '';
  const prefix = isHungarianLocale(locale)
    ? 'Új bejelentés'
    : 'New announcement';
  return {
    content: `${prefix}: ${title}`,
    title: isHungarianLocale(locale) ? 'Új bejelentés' : 'New Announcement',
  };
}

export function buildSystemMessageContent(
  payload: { title: string },
  locale: string
): NotificationContent {
  const title = payload.title || '';
  const prefix = isHungarianLocale(locale) ? 'Rendszerüzenet' : 'System notice';
  return {
    content: `${prefix}: ${title}`,
    title: isHungarianLocale(locale) ? 'Rendszerüzenet' : 'System Message',
  };
}

export function buildBlogPostContent(
  payload: { slug?: string; title: string },
  locale: string
): NotificationContent {
  const title = payload.title || '';
  const cta = isHungarianLocale(locale)
    ? 'koppints az olvasáshoz'
    : 'tap to read';
  const prefix = isHungarianLocale(locale) ? 'Új bejegyzés' : 'New post';
  const content = `${prefix}: ${title} — ${cta}`;
  const result: NotificationContent = {
    content,
    title: isHungarianLocale(locale) ? 'Új blogbejegyzés' : 'New Blog Post',
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
