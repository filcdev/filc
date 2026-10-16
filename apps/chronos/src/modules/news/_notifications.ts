import { env } from '#utils/environment';
import { resolveAudienceByCohortOrAll } from '#utils/notifications/engine';
import { isHungarianLocale } from '#utils/notifications/locale';
import type { NotificationHandler } from '#utils/notifications/types';

/** The payload is the record this module's own handlers dispatch with. */
function byCohortOrAll(payload: unknown) {
  const p = payload as { cohortIds?: string[] };
  return resolveAudienceByCohortOrAll(p.cohortIds);
}

/**
 * The notifications the news module owns: an announcement, a system notice and
 * a published blog post. Each is written in the recipient's language, because
 * every notification goes out per user rather than once per event.
 */
export const newsNotifications: readonly NotificationHandler[] = [
  {
    buildContent: (payload, locale) => {
      const p = payload as { title: string };
      const title = p.title || '';
      const prefix = isHungarianLocale(locale)
        ? 'Új bejelentés'
        : 'New announcement';
      const content = `${prefix}: ${title}`;
      return {
        content,
        title: isHungarianLocale(locale) ? 'Új bejelentés' : 'New Announcement',
      };
    },
    getAudience: byCohortOrAll,
    getDelay: () => env.notificationDelayAnnouncement,
    preferenceKey: 'announcement',
    type: 'announcement',
  },
  {
    buildContent: (payload, locale) => {
      const p = payload as { title: string };
      const title = p.title || '';
      const prefix = isHungarianLocale(locale)
        ? 'Rendszerüzenet'
        : 'System notice';
      const content = `${prefix}: ${title}`;
      return {
        content,
        title: isHungarianLocale(locale) ? 'Rendszerüzenet' : 'System Message',
      };
    },
    getAudience: byCohortOrAll,
    getDelay: () => env.notificationDelaySystemMessage,
    preferenceKey: 'systemMessage',
    type: 'system_message',
  },
  {
    buildContent: (payload, locale) => {
      const p = payload as { title: string; slug?: string };
      const title = p.title || '';
      const cta = isHungarianLocale(locale)
        ? 'koppints az olvasáshoz'
        : 'tap to read';
      const prefix = isHungarianLocale(locale) ? 'Új bejegyzés' : 'New post';
      const content = `${prefix}: ${title} — ${cta}`;
      const result: {
        content: string;
        title: string;
        metadata?: Record<string, unknown>;
      } = {
        content,
        title: isHungarianLocale(locale) ? 'Új blogbejegyzés' : 'New Blog Post',
      };
      if (p.slug) {
        result.metadata = { slug: p.slug };
      }
      return result;
    },
    getAudience: () => resolveAudienceByCohortOrAll(),
    getDelay: () => env.notificationDelayBlogPost,
    preferenceKey: 'blogPost',
    type: 'blog_post',
  },
];
