import {
  type NotificationDetail,
  notificationTypeValues,
} from '@filcdev/api/domains/notifications';
import { ERROR_CODE } from '@filcdev/api/errors';
import { isDefinedError } from '@orpc/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMovedLessons } from '@/hooks/moved-lessons';
import { useAdminSystemMessages, useAnnouncements } from '@/hooks/news';
import { type SubstitutionItem, useSubstitutions } from '@/hooks/substitutions';
import { getLocalizedWeekdayName, parseDateOnly } from '@/utils/date-locale';
import { api, orpc } from '@/utils/orpc';

export const NOTIFICATION_TYPES = notificationTypeValues;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

type MockText = {
  content: string;
  details?: NotificationDetail[];
  highlights?: string[];
  title: string;
};

/** Realistic sample content per notification type, localized. */
export const NOTIFICATION_MOCKS: Record<
  (typeof NOTIFICATION_TYPES)[number],
  { en: MockText; hu: MockText }
> = {
  announcement: {
    en: {
      content:
        'The Sep 7 parent–teacher meeting starts at 17:00. Parents, please bring the student diary!',
      title: 'September school bulletin',
    },
    hu: {
      content:
        'A szept. 7-i szülői értekezlet 17:00-kor kezdődik. Kérjük, a szülők hozzák magukkal a naplót!',
      title: 'Szeptemberi iskolai értesítő',
    },
  },
  blog_post: {
    en: {
      content:
        "A new post is up: 'Student council intro'. Read it in the blog section!",
      title: 'New post on the school blog',
    },
    hu: {
      content:
        'Megjelent az új cikk: „Diákönkormányzat bemutatkozása”. Olvassátok el a blog szekcióban!',
      title: 'Új cikk az iskolai blogon',
    },
  },
  cohort_reselection_required: {
    en: {
      content:
        'Please pick your group for 11th-grade language classes at your next sign-in.',
      title: 'Group reselection required',
    },
    hu: {
      content:
        'Kérjük, válaszd ki a csoportodat a 11. évfolyam nyelvi óráihoz a következő bejelentkezéskor.',
      title: 'Csoportválasztás szükséges',
    },
  },
  doorlock_card_used: {
    en: {
      content:
        'The door-lock system recorded a card use at the 2nd-floor entrance (2026-09-03 10:32).',
      title: 'Card use detected',
    },
    hu: {
      content:
        'Az ajtózár rendszer rögzített egy kártyahasználatot a 2. emeleti bejáratnál (2026.09.03. 10:32).',
      title: 'Kártyahasználat észlelve',
    },
  },
  moved_lesson: {
    en: {
      content:
        'Class 10.C Biology (Peter Kovacs) moved from Tue period 6 to Thu period 2, room 201.',
      details: [
        { label: 'Date', value: '2026-09-03' },
        { label: 'Class', value: '10.C' },
        { label: 'Subject', value: 'Biology' },
        { label: 'Original', value: 'Tuesday, Period 6, 201' },
        { label: 'New', value: 'Thursday, Period 2, 201' },
        { label: 'Teacher', value: 'Peter Kovacs' },
      ],
      highlights: ['Thursday', 'Period 2', '201'],
      title: 'Lesson moved',
    },
    hu: {
      content:
        'A 10.C osztály Biológia órája (Kovács Péter) a kedd 6. óráról csütörtök 2. órára lett áthelyezve, 201. terem.',
      details: [
        { label: 'Dátum', value: '2026. 09. 03.' },
        { label: 'Osztály', value: '10.C' },
        { label: 'Tantárgy', value: 'Biológia' },
        { label: 'Eredeti', value: 'Kedd, 6. óra, 201' },
        { label: 'Új', value: 'Csütörtök, 2. óra, 201' },
        { label: 'Tanár', value: 'Kovács Péter' },
      ],
      highlights: ['Csütörtök', '2. óra', '201'],
      title: 'Óra áthelyezve',
    },
  },
  moved_lesson_teacher: {
    en: {
      content: 'Your 10.C Biology lesson was moved to Thursday, Period 2, 201.',
      details: [
        { label: 'Date', value: '2026-09-03' },
        { label: 'Class', value: '10.C' },
        { label: 'Subject', value: 'Biology' },
        { label: 'Original', value: 'Tuesday, Period 6, 201' },
        { label: 'New', value: 'Thursday, Period 2, 201' },
      ],
      highlights: ['Thursday', 'Period 2', '201'],
      title: 'Your lesson was moved – 10.C',
    },
    hu: {
      content:
        'A 10.C osztály Biológia órája áthelyezésre került: csütörtök, 2. óra, 201. terem.',
      details: [
        { label: 'Dátum', value: '2026. 09. 03.' },
        { label: 'Osztály', value: '10.C' },
        { label: 'Tantárgy', value: 'Biológia' },
        { label: 'Eredeti', value: 'Kedd, 6. óra, 201' },
        { label: 'Új', value: 'Csütörtök, 2. óra, 201' },
      ],
      highlights: ['Csütörtök', '2. óra', '201'],
      title: 'Az órád áthelyezve – 10.C',
    },
  },
  substitution: {
    en: {
      content:
        'Lesson 3 (Math – Peter Kovacs) for class 11.A is cancelled today. Replacement: period 5, room 204.',
      details: [
        { label: 'Date', value: '2026-09-03' },
        { label: 'Class', value: '11.A' },
        { label: 'Subject', value: 'Math' },
        { label: 'Lesson', value: 'Period 3 (8:00 - 8:45)' },
        { label: 'Room', value: '204' },
        { label: 'Substituted teacher', value: 'Peter Kovacs' },
        { label: 'Substitute', value: 'Anna Szabo' },
      ],
      highlights: ['Period 3', '11.A', '204'],
      title: 'Substitution – 2026-09-03',
    },
    hu: {
      content:
        'A mai napon a 11.A osztály 3. órája (Matematika – Kovács Péter) elmarad. Helyettesítés: 5. óra, 204. terem.',
      details: [
        { label: 'Dátum', value: '2026. 09. 03.' },
        { label: 'Osztály', value: '11.A' },
        { label: 'Tantárgy', value: 'Matematika' },
        { label: 'Óra', value: '3. óra (8:00 - 8:45)' },
        { label: 'Terem', value: '204' },
        { label: 'Helyettesített tanár', value: 'Kovács Péter' },
        { label: 'Helyettesítő', value: 'Szabó Anna' },
      ],
      highlights: ['3. óra', '11.A', '204'],
      title: 'Órarendcsere – 2026-09-03',
    },
  },
  substitution_teacher: {
    en: {
      content: 'You were assigned to substitute two lessons on Thursday.',
      details: [
        { label: 'Date', value: '2026-09-04' },
        { label: 'Period 2 · 11. B', value: 'Physics · 105 · Edit Nagy' },
        { label: 'Period 5 · 11. C', value: 'Physics · 106 · Edit Nagy' },
        { label: 'Comment', value: 'Bring the lab sheets.' },
      ],
      highlights: ['Period 2 · 11. B', 'Period 5 · 11. C'],
      title: 'Substitution for your lesson',
    },
    hu: {
      content: 'Két órára jelöltek ki helyettesítésre csütörtökön.',
      details: [
        { label: 'Dátum', value: '2026. 09. 04.' },
        { label: '2. óra · 11. B', value: 'Fizika · 105 · Nagy Edit' },
        { label: '5. óra · 11. C', value: 'Fizika · 106 · Nagy Edit' },
        { label: 'Megjegyzés', value: 'Hozd a mérőlapokat.' },
      ],
      highlights: ['2. óra · 11. B', '5. óra · 11. C'],
      title: 'Helyettesítés a mai órádra',
    },
  },
  system_message: {
    en: {
      content:
        'Filc will be unavailable between 22:00–24:00 on 2026-09-10 due to maintenance.',
      title: 'System maintenance',
    },
    hu: {
      content:
        'A Filc rendszer 2026.09.10. 22:00–24:00 között karbantartás miatt nem lesz elérhető.',
      title: 'Rendszerkarbantartás',
    },
  },
  test: {
    en: {
      content:
        'This is a development test message. If you received this, everything works.',
      title: 'Test Notification',
    },
    hu: {
      content:
        'Ez egy fejlesztési teszt üzenet. Ha megkaptad, minden rendben működik.',
      title: 'Teszt értesítés',
    },
  },
};

type PreviewTestPayload = Parameters<typeof api.notifications.previewTest>[0];

type MutationCallbacks = { silent?: boolean };

/**
 * `sendTest`/`previewTest` answer 403 when the server has
 * `CHRONOS_ENABLE_TEST_NOTIFICATIONS` off. Report that instead of a generic
 * send/render failure, which reads like a bug in the template.
 *
 * Generic so a typed mutation error and an `unknown` catch variable both fit:
 * `isDefinedError` only narrows a known error union.
 */
export const describeTestNotificationError = <T>(
  error: T,
  message: { disabled: string; fallback: string }
) =>
  isDefinedError(error) && error.code === ERROR_CODE.FORBIDDEN
    ? message.disabled
    : message.fallback;

/** Date-only ISO label for the record picker; the API sends a local midnight. */
function formatRecordDate(value: Date | string): string {
  const date = parseDateOnly(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "3. óra" / "Period 3", mirroring the backend's notification period label. */
function formatPeriodNumber(
  period: number,
  language: string,
  periodWord: string
): string {
  return language.toLowerCase().startsWith('hu')
    ? `${period}. ${periodWord.toLocaleLowerCase()}`
    : `${periodWord} ${period}`;
}

/**
 * Pickable real records for the dev preview, one short label per record. Every
 * list is gated on the selected type so the page only fetches what it shows.
 * Types the preview endpoint cannot render return an empty list.
 */
export function useTestNotificationRecordOptions(
  type: NotificationType
): { id: string; label: string }[] {
  const { i18n, t } = useTranslation();
  const substitutions = useSubstitutions(
    type === 'substitution' || type === 'substitution_teacher'
  );
  const movedLessons = useMovedLessons(
    type === 'moved_lesson' || type === 'moved_lesson_teacher'
  );
  const announcements = useAnnouncements(type === 'announcement');
  const systemMessages = useAdminSystemMessages(type === 'system_message');
  const blogPosts = useQuery({
    ...orpc.news.blogs.list.queryOptions({
      input: { limit: 50, offset: 0 },
    }),
    enabled: type === 'blog_post',
    select: (payload) => payload.items,
  });

  /**
   * One record label for the substitution pickers: date, class, subject and
   * period, plus the substitute teacher's name when the preview targets them.
   */
  const substitutionLabel = (
    item: SubstitutionItem,
    substituteName?: string
  ) => {
    const lesson = item.lessons[0];
    const cohort = lesson?.cohorts[0]?.name;
    const subject = lesson?.subject?.name;
    const period = lesson?.period?.period;
    const parts = [formatRecordDate(item.substitution.date)];
    if (cohort) {
      parts.push(cohort);
    }
    if (subject) {
      parts.push(subject);
    }
    if (period != null) {
      parts.push(
        formatPeriodNumber(period, i18n.language, t('substitution.period'))
      );
    }
    if (substituteName) {
      parts.push(substituteName);
    }
    if (!(cohort || subject || period != null)) {
      parts.push(
        t('devNotifications.recordLessonCount', {
          count: item.lessons.length,
        })
      );
    }
    return parts.join(' · ');
  };

  switch (type) {
    case 'substitution':
      return (substitutions.data ?? []).map((item) => ({
        id: item.substitution.id,
        label: substitutionLabel(item),
      }));
    case 'substitution_teacher':
      return (substitutions.data ?? []).map((item) => ({
        id: item.substitution.id,
        label: substitutionLabel(
          item,
          item.teacher
            ? `${item.teacher.firstName} ${item.teacher.lastName}`.trim()
            : undefined
        ),
      }));
    case 'moved_lesson':
    case 'moved_lesson_teacher':
      return (movedLessons.data ?? []).map((item) => {
        const subject =
          item.manual?.subject?.name ?? item.lessons[0]?.subject?.name;
        const day = item.dayDefinition
          ? getLocalizedWeekdayName(
              item.dayDefinition.name,
              item.dayDefinition.short,
              i18n.language,
              'long'
            )
          : null;
        const period = item.period?.period;
        const target = [
          day,
          period == null
            ? null
            : formatPeriodNumber(
                period,
                i18n.language,
                t('substitution.period')
              ),
        ]
          .filter(Boolean)
          .join(', ');
        const parts = [formatRecordDate(item.movedLesson.date)];
        if (subject) {
          parts.push(subject);
        }
        if (target) {
          parts.push(`→ ${target}`);
        }
        return { id: item.movedLesson.id, label: parts.join(' · ') };
      });
    case 'announcement':
      return (announcements.data ?? []).map((item) => ({
        id: item.id,
        label: `${formatRecordDate(item.validFrom)} · ${item.title ?? t('announcements.untitled')}`,
      }));
    case 'system_message':
      return (systemMessages.data ?? []).map((item) => ({
        id: item.id,
        label: `${formatRecordDate(item.validFrom)} · ${item.title}`,
      }));
    case 'blog_post':
      return (blogPosts.data ?? []).map((item) => ({
        id: item.id,
        label: `${formatRecordDate(item.publishedAt ?? item.createdAt)} · ${item.title}`,
      }));
    default:
      return [];
  }
}

/** Send a dev-only test notification with granular channel options. */
export function useSendTestNotification({
  silent = false,
}: MutationCallbacks = {}) {
  const { t } = useTranslation();
  return useMutation(
    orpc.notifications.sendTest.mutationOptions({
      onError: (error) => {
        if (!silent) {
          toast.error(
            describeTestNotificationError(error, {
              disabled: t('devNotifications.disabled'),
              fallback: t('devNotifications.sendError'),
            })
          );
        }
      },
      onSuccess: (data) => {
        if (silent) {
          return;
        }
        const active: string[] = [];
        if (data.email) {
          active.push(t('devNotifications.channelEmail'));
        }
        if (data.inApp) {
          active.push(t('devNotifications.channelInApp'));
        }
        if (data.push) {
          active.push(t('devNotifications.channelPush'));
        }
        toast.success(
          t('devNotifications.sendSuccess', { channels: active.join(', ') })
        );
      },
    })
  );
}

/** Render a notification template to HTML without sending it. */
export function usePreviewTestNotification() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: PreviewTestPayload) =>
      (await api.notifications.previewTest(payload)).html,
    onError: (error) => {
      toast.error(
        describeTestNotificationError(error, {
          disabled: t('devNotifications.disabled'),
          fallback: t('devNotifications.previewError'),
        })
      );
    },
  });
}
