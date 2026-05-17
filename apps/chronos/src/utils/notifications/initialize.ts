import { getLogger } from '@logtape/logtape';
import { env } from '#utils/environment';
import { registerHandler } from '#utils/notifications/engine';
import { initializeFcm } from '#utils/notifications/providers/fcm';

const logger = getLogger(['chronos', 'notifications', 'initialize']);

const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_NAMES_HU = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'];

function dayName(day: string, locale: string): string {
  const names = locale === 'hu' ? DAY_NAMES_HU : DAY_NAMES_EN;
  const num = Number.parseInt(day, 10);
  if (num >= 1 && num <= names.length) {
    return names[num - 1] ?? day;
  }
  return day;
}

function buildSubstitutionContent(
  p: { date?: Date; substituter?: string | null; lessonIds?: string[] },
  locale: string
): string {
  const dateStr = p.date ? new Date(p.date).toISOString().slice(0, 10) : '';
  const subName = p.substituter ?? '';
  const lessonCount = p.lessonIds?.length ?? 0;

  const detailParts: string[] = [];
  if (subName && subName !== '') {
    detailParts.push(
      locale === 'hu' ? `Helyettesítő: ${subName}` : `Substitute: ${subName}`
    );
  }
  if (lessonCount > 0) {
    detailParts.push(
      locale === 'hu'
        ? `${lessonCount} érintett óra`
        : `${lessonCount} affected lessons`
    );
  }

  const detailStr =
    detailParts.length > 0 ? ` — ${detailParts.join(', ')}` : '';

  return locale === 'hu'
    ? `Új helyettesítés ${dateStr}${detailStr}.`
    : `New substitution for ${dateStr}${detailStr}.`;
}

function periodLabel(period: string): string {
  return `${period}. óra`;
}

export function initializeNotificationEngine(): void {
  logger.info('Initializing notification engine');

  registerHandler({
    buildContent: (payload, locale) => {
      const p = payload as {
        date?: Date;
        substituter?: string | null;
        lessonIds?: string[];
      };
      return {
        content: buildSubstitutionContent(p, locale),
        title: locale === 'hu' ? 'Új helyettesítés' : 'New Substitution',
      };
    },
    getAudience: async () => [],
    getDelay: () => env.notificationDelaySubstitution,
    type: 'substitution',
  });

  registerHandler({
    buildContent: (payload, locale) => {
      const p = payload as {
        date?: Date;
        room?: string;
        startingDay?: string;
        startingPeriod?: string;
      };
      const dateStr = p.date ? new Date(p.date).toISOString().slice(0, 10) : '';

      const details: string[] = [];
      if (p.startingDay) {
        details.push(dayName(p.startingDay, locale));
      }
      if (p.startingPeriod) {
        details.push(periodLabel(p.startingPeriod));
      }
      if (p.room) {
        details.push(p.room);
      }
      const detailsStr = details.length > 0 ? ` → ${details.join(', ')}` : '';

      const content =
        locale === 'hu'
          ? `Óra áthelyezve ${dateStr}${detailsStr}.`
          : `Lesson moved to ${dateStr}${detailsStr}.`;

      return {
        content,
        title: locale === 'hu' ? 'Áthelyezett óra' : 'Moved Lesson',
      };
    },
    getAudience: async () => [],
    getDelay: () => env.notificationDelayMovedLesson,
    type: 'moved_lesson',
  });

  registerHandler({
    buildContent: (payload, locale) => {
      const p = payload as { title: string };
      return {
        content: p.title || '',
        title: locale === 'hu' ? 'Új bejelentés' : 'New Announcement',
      };
    },
    getAudience: async () => [],
    getDelay: () => env.notificationDelayAnnouncement,
    type: 'announcement',
  });

  registerHandler({
    buildContent: (payload, locale) => {
      const p = payload as { title: string };
      return {
        content: p.title || '',
        title: locale === 'hu' ? 'Rendszerüzenet' : 'System Message',
      };
    },
    getAudience: async () => [],
    getDelay: () => env.notificationDelaySystemMessage,
    type: 'system_message',
  });

  registerHandler({
    buildContent: (payload, locale) => {
      const p = payload as { title: string; slug?: string };
      const blogPayload = {
        content: p.title || '',
        title: locale === 'hu' ? 'Új blogbejegyzés' : 'New Blog Post',
      };
      if (p.slug) {
        return {
          ...blogPayload,
          metadata: { slug: p.slug },
        };
      }
      return blogPayload;
    },
    getAudience: async () => [],
    getDelay: () => env.notificationDelayBlogPost,
    type: 'blog_post',
  });

  registerHandler({
    buildContent: (payload, locale) => {
      const p = payload as { deviceName: string };
      const content =
        locale === 'hu'
          ? `Belépőkártya használat — ${p.deviceName}`
          : `Access card used — ${p.deviceName}`;
      return {
        content,
        title: locale === 'hu' ? 'Belépőkártya használat' : 'Card Used',
      };
    },
    getAudience: async () => [],
    getDelay: () => 0,
    type: 'doorlock_card_used',
  });

  initializeFcm();

  logger.info('Notification engine initialized with 6 handlers');
}
