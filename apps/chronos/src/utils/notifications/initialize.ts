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

function substitutionContentHu(
  dateStr: string,
  subName: string,
  lessonCount: number
): string {
  const checkCta = lessonCount > 1 ? ' Nézd meg az órarendedben!' : '';
  if (subName && lessonCount > 0) {
    return `Helyettesítés ${dateStr}: ${subName} tart ${lessonCount} órát.${checkCta}`;
  }
  if (subName) {
    return `Helyettesítés ${dateStr}: ${subName} fogja tartani az órá(ka)t. Nézd meg az órarendedben!`;
  }
  if (lessonCount > 0) {
    return `Helyettesítés ${dateStr}: ${lessonCount} órát érint.${checkCta}`;
  }
  return `Új helyettesítés ${dateStr}. Nézd meg az órarendedben!`;
}

function substitutionContentEn(
  dateStr: string,
  subName: string,
  lessonCount: number
): string {
  const lessonWord = lessonCount > 1 ? 'lessons' : 'lesson';
  const checkCta = lessonCount > 1 ? ' Check your timetable for details.' : '';
  if (subName && lessonCount > 0) {
    return `Substitution on ${dateStr}: ${subName} is covering ${lessonCount} ${lessonWord}.${checkCta}`;
  }
  if (subName) {
    return `Substitution on ${dateStr}: ${subName} is covering your lesson(s). Check your timetable for details.`;
  }
  if (lessonCount > 0) {
    return `Substitution on ${dateStr} affects ${lessonCount} ${lessonWord}.${checkCta}`;
  }
  return `New substitution for ${dateStr}. Check your timetable for details.`;
}

function buildSubstitutionContent(
  p: { date?: Date; substituter?: string | null; lessonIds?: string[] },
  locale: string
): string {
  const dateStr = p.date ? new Date(p.date).toISOString().slice(0, 10) : '';
  const subName = p.substituter ?? '';
  const lessonCount = p.lessonIds?.length ?? 0;
  return locale === 'hu'
    ? substitutionContentHu(dateStr, subName, lessonCount)
    : substitutionContentEn(dateStr, subName, lessonCount);
}

function periodLabel(period: string, locale: string): string {
  return locale === 'hu' ? `${period}. óra` : `Period ${period}`;
}

function movedLessonContentHu(
  p: {
    room?: string;
    startingDay?: string;
    startingPeriod?: string;
  },
  multiple: boolean
): string {
  const roomPart = p.room ? `, ${p.room} terem` : '';
  const dayPart = p.startingDay ? dayName(p.startingDay, 'hu') : '';
  const periodPart = p.startingPeriod
    ? periodLabel(p.startingPeriod, 'hu')
    : '';
  const timePart = [dayPart, periodPart].filter(Boolean).join(' ');
  const suffix = multiple ? ' Nézd meg az órarendedben!' : '';
  return `Az órád át lett helyezve: ${timePart}${roomPart}.${suffix}`;
}

function movedLessonContentEn(
  p: {
    room?: string;
    startingDay?: string;
    startingPeriod?: string;
  },
  multiple: boolean
): string {
  const roomPart = p.room ? ` in room ${p.room}` : '';
  const dayPart = p.startingDay ? dayName(p.startingDay, 'en') : '';
  const periodPart = p.startingPeriod
    ? periodLabel(p.startingPeriod, 'en')
    : '';
  const atPart =
    dayPart && periodPart
      ? `${dayPart} at ${periodPart}`
      : dayPart || periodPart;
  const suffix = multiple ? ' Check your timetable for details.' : '';
  return `Your lesson has been moved to ${atPart}${roomPart}.${suffix}`;
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
        lessonIds?: string[];
        room?: string;
        startingDay?: string;
        startingPeriod?: string;
      };
      const multiple = (p.lessonIds?.length ?? 0) > 1;
      const content =
        locale === 'hu'
          ? movedLessonContentHu(p, multiple)
          : movedLessonContentEn(p, multiple);
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
      const title = p.title || '';
      const prefix =
        locale === 'hu'
          ? 'Új bejelentés figyelmedbe'
          : 'New announcement for your attention';
      return {
        content: `${prefix}: ${title}`,
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
      const title = p.title || '';
      const prefix = locale === 'hu' ? 'Rendszerüzenet' : 'System notice';
      return {
        content: `${prefix}: ${title}`,
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
      const title = p.title || '';
      const cta = locale === 'hu' ? 'koppints az olvasáshoz' : 'tap to read';
      const content =
        locale === 'hu'
          ? `Új bejegyzés elérhető: ${title} — ${cta}`
          : `New post available: ${title} — ${cta}`;
      const result: {
        content: string;
        title: string;
        metadata?: Record<string, unknown>;
      } = {
        content,
        title: locale === 'hu' ? 'Új blogbejegyzés' : 'New Blog Post',
      };
      if (p.slug) {
        result.metadata = { slug: p.slug };
      }
      return result;
    },
    getAudience: async () => [],
    getDelay: () => env.notificationDelayBlogPost,
    type: 'blog_post',
  });

  registerHandler({
    buildContent: (payload, locale) => {
      const p = payload as { deviceName: string };
      const device = p.deviceName || '';
      const content =
        locale === 'hu'
          ? `A belépőkártyádat épp most használták itt: ${device}.`
          : `Your access card was just used at ${device}.`;
      return {
        content,
        title: locale === 'hu' ? 'Belépőkártya használat' : 'Card Used',
      };
    },
    getAudience: async () => [],
    getDelay: () => 0,
    type: 'doorlock_card_used',
  });

  registerHandler({
    buildContent: (payload, locale) => {
      const p = payload as { userId: string };
      const content =
        locale === 'hu'
          ? 'A csoportod már nem elérhető. Kérjük, válassz új csoportot a Beállításokban.'
          : 'Your cohort is no longer available. Please go to Settings to select a new cohort.';
      return {
        content,
        metadata: { action: 'cohort_reselection', userId: p.userId },
        title:
          locale === 'hu'
            ? 'Csoport újraválasztása szükséges'
            : 'Cohort Reselection Required',
      };
    },
    getAudience: async () => [],
    getDelay: () => 0,
    type: 'cohort_reselection_required',
  });

  initializeFcm();

  logger.info('Notification engine initialized with 7 handlers');
}
