import { permissions } from '@filcdev/api/permissions';
import { Button } from '@filcdev/ui/components/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HelperSettings } from '@/components/admin/event-helper-settings';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { useAdminEventDetail } from '@/hooks/events';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute(
  '/_private/admin/events_/$eventId_/helpers'
)({
  component: () => (
    <PermissionGuard permission={permissions.eventsManage}>
      <EventHelperSettingsPage />
    </PermissionGuard>
  ),
  loader: ({ context, params }) =>
    prefetch(
      context.queryClient,
      orpc.events.get.queryOptions({
        input: { id: params.eventId, includeDrafts: 'true' },
      })
    ),
});

/**
 * The dedicated home of the helper and door configuration. The event page links
 * here instead of carrying the whole form on top of the participant table; the
 * event dialog remains the shortcut for the helper switches.
 */
function EventHelperSettingsPage() {
  const { eventId } = Route.useParams();
  const { t } = useTranslation();
  const eventQuery = useAdminEventDetail(eventId);
  const event = eventQuery.data;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:underline"
          params={{ eventId }}
          to="/admin/events/$eventId"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('events.helpersPage.back')}
        </Link>

        <QueryBoundary data={event} query={eventQuery}>
          {(detail) => (
            <div className="space-y-2">
              <h1 className="font-bold text-3xl tracking-tight">
                {t('events.helpersPage.title')}
              </h1>
              <p className="text-muted-foreground text-sm">{detail.title}</p>
              <p className="max-w-2xl text-muted-foreground text-sm">
                {t('events.helpersPage.hint')}
              </p>
            </div>
          )}
        </QueryBoundary>
      </div>

      {event && (
        <HelperSettings
          event={event}
          key={`${event.id}:${event.updatedAt.getTime()}`}
        />
      )}

      <div>
        <Button
          render={<Link params={{ eventId }} to="/admin/events/$eventId" />}
          variant="outline"
        >
          {t('events.helpersPage.back')}
        </Button>
      </div>
    </div>
  );
}
