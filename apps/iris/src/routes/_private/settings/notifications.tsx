import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { NotificationsPane } from '@/components/settings/notifications-pane';
import { orpc, prefetch } from '@/utils/orpc';

const searchSchema = z.object({
  // Unknown values are ignored rather than failing the whole route.
  channel: z.enum(['email', 'push']).optional().catch(undefined),
});

export const Route = createFileRoute('/_private/settings/notifications')({
  component: NotificationSettingsPage,
  validateSearch: searchSchema,
  loader: ({ context }) =>
    prefetch(context.queryClient, orpc.notifications.settings.queryOptions()),
});

function NotificationSettingsPage() {
  const { t } = useTranslation();
  const { channel } = Route.useSearch();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <h1 className="font-bold text-2xl">{t('preferences.title')}</h1>
      <NotificationsPane active highlightChannel={channel} />
    </main>
  );
}
