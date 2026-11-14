import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { NotificationsPane } from '@/components/settings/notifications-pane';
import { createI18n } from '@/utils/i18n';
import { orpc, prefetch } from '@/utils/orpc';

const searchSchema = z.object({
  // Unknown values are ignored rather than failing the whole route.
  channel: z.enum(['email']).optional().catch(undefined),
});

export const Route = createFileRoute('/_private/settings/notifications')({
  component: NotificationSettingsPage,
  validateSearch: searchSchema,
  loader: ({ context }) =>
    prefetch(context.queryClient, orpc.notifications.settings.queryOptions()),
  // Built here rather than from a `document.title` effect so the title is
  // already right in the server render. The language comes from the root
  // route's context (resolved from the cookie per request).
  head: ({ matches }) => ({
    meta: [
      {
        title: `${createI18n(matches[0].context.language).t('preferences.notifications')} | Filc`,
      },
    ],
  }),
});

function NotificationSettingsPage() {
  const { t } = useTranslation();
  const { channel } = Route.useSearch();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <h1 className="font-bold text-2xl">{t('preferences.notifications')}</h1>
      <NotificationsPane active highlightChannel={channel} />
    </main>
  );
}
