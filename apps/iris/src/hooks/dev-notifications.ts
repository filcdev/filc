import { notificationTypeValues } from '@filcdev/api/domains/notifications';

import { useMutation } from '@tanstack/react-query';
import { type InferRequestType, parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';

export const NOTIFICATION_TYPES = notificationTypeValues;

type MockText = { content: string; title: string };

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
      title: 'Lesson moved',
    },
    hu: {
      content:
        'A 10.C osztály Biológia órája (Kovács Péter) a kedd 6. óráról csütörtök 2. órára lett áthelyezve, 201. terem.',
      title: 'Óra áthelyezve',
    },
  },
  substitution: {
    en: {
      content:
        'Lesson 3 (Math – Peter Kovacs) for class 11.A is cancelled today. Replacement: period 5, room 204.',
      title: 'Substitution – 2026-09-03',
    },
    hu: {
      content:
        'A mai napon a 11.A osztály 3. órája (Matematika – Kovács Péter) elmarad. Helyettesítés: 5. óra, 204. terem.',
      title: 'Órarendcsere – 2026-09-03',
    },
  },
  substitution_teacher: {
    en: {
      content:
        'Peter Kovacs will substitute Edit Nagy tomorrow in period 2 for class 11.B (Physics). Please prepare the material.',
      title: 'Substitution for your lesson',
    },
    hu: {
      content:
        'Kovács Péter helyettesíti Nagy Editet holnap 2. órában a 11.B osztályban (Fizika). Kérjük, készülj fel az anyagból.',
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

type SendTestPayload = InferRequestType<
  (typeof api.notifications)['send-test']['$post']
>['json'];

type PreviewTestPayload = InferRequestType<
  (typeof api.notifications)['preview-test']['$post']
>['json'];

type MutationCallbacks = { silent?: boolean };

/** Send a dev-only test notification with granular channel options. */
export function useSendTestNotification({
  silent = false,
}: MutationCallbacks = {}) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: SendTestPayload) => {
      const res = await parseResponse(
        api.notifications['send-test'].$post({ json: payload })
      );
      if (!res.success) {
        throw new Error(t('devNotifications.sendError'));
      }
      return res.data;
    },
    onError: () => {
      if (!silent) {
        toast.error(t('devNotifications.sendError'));
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
  });
}

/** Render a notification template to HTML without sending it. */
export function usePreviewTestNotification() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: PreviewTestPayload): Promise<string> => {
      const res = await parseResponse(
        api.notifications['preview-test'].$post({ json: payload })
      );
      if (!res.success) {
        throw new Error(t('devNotifications.previewError'));
      }
      return res.data?.html ?? '';
    },
    onError: () => {
      toast.error(t('devNotifications.previewError'));
    },
  });
}
