import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Plus, RefreshCw } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/admin/delete-confirm-dialog';
import { EventDialog } from '@/components/admin/event-dialog';
import { RowActions } from '@/components/admin/row-actions';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import {
  type EventDetail,
  type EventItem,
  useDeleteEvent,
  useEvents,
} from '@/hooks/events';
import { useCohorts } from '@/hooks/news';
import { useHasPermission } from '@/hooks/use-has-permission';
import {
  eventRegistrationInfo,
  formatEventDateRange,
} from '@/utils/event-registration-state';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/events')({
  component: () => (
    <PermissionGuard permission={permissions.eventsManage}>
      <EventsPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    Promise.all([
      prefetch(
        context.queryClient,
        orpc.events.list.queryOptions({
          input: { includeDrafts: 'true', limit: 100, offset: 0 },
        })
      ),
      prefetch(context.queryClient, orpc.cohort.cohort.queryOptions()),
    ]),
});

function EventsPage() {
  const { i18n, t } = useTranslation();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventDetail | null>(null);
  const itemToDelete = useRef<EventItem | null>(null);
  const searchId = useId();

  const hasWritePermission = useHasPermission(
    permissions.eventsManage,
    session?.user?.permissions
  );

  const eventsQuery = useEvents();
  const { data: cohorts } = useCohorts(hasWritePermission);

  const deleteMutation = useDeleteEvent({
    onSaved: () => {
      setDeleteDialogOpen(false);
      itemToDelete.current = null;
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = eventsQuery.data?.items ?? [];
    if (!term) {
      return list;
    }
    return list.filter((item) => {
      const titleMatches = item.title.toLowerCase().includes(term);
      const cohortsMatch = item.cohortIds.some((id) =>
        cohorts?.some(
          (cohort) =>
            cohort.id === id && cohort.name.toLowerCase().includes(term)
        )
      );
      return titleMatches || cohortsMatch;
    });
  }, [eventsQuery.data, search, cohorts]);

  const openCreate = () => {
    setSelectedItem(null);
    setDialogOpen(true);
  };

  // The dialog seeds every editor from the detail, so the complete event is
  // fetched before it mounts instead of re-seeding it from a prop in an effect.
  const openEdit = async (item: EventItem) => {
    try {
      const detail = await queryClient.ensureQueryData(
        orpc.events.get.queryOptions({
          input: { id: item.id, includeDrafts: 'true' },
        })
      );
      setSelectedItem(detail);
      setDialogOpen(true);
    } catch {
      toast.error(t('events.loadDetailError'));
    }
  };

  const confirmDelete = () => {
    if (itemToDelete.current) {
      deleteMutation.mutate({ id: itemToDelete.current.id });
    }
  };

  const openDetail = (id: string) =>
    navigate({ params: { eventId: id }, to: '/admin/events/$eventId' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('events.title')}
        </h1>
        <p className="text-muted-foreground">{t('events.description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-2">
          <Label htmlFor={searchId}>{t('events.searchLabel')}</Label>
          <Input
            aria-label={t('events.searchAria')}
            className="max-w-sm"
            id={searchId}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search')}
            value={search}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => eventsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('events.refresh')}
          </Button>
          {hasWritePermission && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('events.create')}
            </Button>
          )}
        </div>
      </div>

      <QueryBoundary data={eventsQuery.data} query={eventsQuery}>
        {() => (
          <>
            <p className="text-muted-foreground text-sm">
              {t('events.total', {
                count: eventsQuery.data?.total ?? filtered.length,
              })}
            </p>
            <div className="w-full overflow-x-auto rounded-md border">
              <Table className="w-full min-w-3xl">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[26%]">
                      {t('events.titleLabel')}
                    </TableHead>
                    <TableHead className="w-[6%]">
                      {t('events.category')}
                    </TableHead>
                    <TableHead className="w-[16%]">
                      {t('events.date')}
                    </TableHead>
                    <TableHead className="w-[22%]">
                      {t('events.public.registration.label')}
                    </TableHead>
                    <TableHead className="w-[10%]">
                      {t('events.status')}
                    </TableHead>
                    <TableHead className="w-[12%]">
                      {t('events.registered')}
                    </TableHead>
                    {hasWritePermission && (
                      <TableHead className="w-[8%]">
                        {t('events.actions')}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow
                      className="cursor-pointer"
                      key={item.id}
                      onClick={(event) => {
                        // A click on the title link or on the row's own buttons
                        // keeps its meaning; anywhere else opens the detail.
                        if (
                          event.target instanceof Element &&
                          event.target.closest('a, button')
                        ) {
                          return;
                        }
                        openDetail(item.id);
                      }}
                    >
                      <TableCell className="font-medium">
                        <Link
                          className="hover:underline"
                          params={{ eventId: item.id }}
                          to="/admin/events/$eventId"
                        >
                          {item.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {t(`events.categories.${item.category}`)}
                      </TableCell>
                      <TableCell>
                        {formatEventDateRange(
                          item.startsAt,
                          item.endsAt,
                          i18n.language
                        )}
                      </TableCell>
                      <TableCell>
                        <RegistrationCell event={item} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(item.status)}>
                          {t(`events.statuses.${item.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.seats.taken} /{' '}
                        {item.seats.capacity ?? t('events.unlimited')}
                      </TableCell>
                      {hasWritePermission && (
                        <TableCell>
                          <RowActions
                            isDeleting={deleteMutation.isPending}
                            onDelete={() => {
                              itemToDelete.current = item;
                              setDeleteDialogOpen(true);
                            }}
                            onEdit={() => openEdit(item)}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        className="text-muted-foreground"
                        colSpan={hasWritePermission ? 7 : 6}
                      >
                        {t('events.noEvents')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </QueryBoundary>

      {hasWritePermission && (
        <>
          <EventDialog
            item={selectedItem}
            // Remounting re-seeds the form and both list editors; no effect
            // writes state from a prop.
            key={`${dialogOpen ? 'open' : 'closed'}:${selectedItem?.id ?? 'new'}`}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setSelectedItem(null);
              }
            }}
            open={dialogOpen}
          />
          <DeleteConfirmDialog
            description={t('events.deleteDescription')}
            onCancel={() => setDeleteDialogOpen(false)}
            onConfirm={confirmDelete}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                itemToDelete.current = null;
              }
            }}
            open={deleteDialogOpen}
            pending={deleteMutation.isPending}
            title={t('events.deleteConfirm')}
          />
        </>
      )}
    </div>
  );
}

/** The signup window: the range, then the state it is in. */
function RegistrationCell({ event }: { event: EventItem }) {
  const { i18n, t } = useTranslation();
  const info = eventRegistrationInfo(event, { language: i18n.language, t });

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={info.state === 'open' ? 'secondary' : 'outline'}>
        {info.status}
      </Badge>
      <span className="text-muted-foreground text-xs">{info.range ?? '—'}</span>
    </div>
  );
}

function statusVariant(
  status: EventItem['status']
): 'default' | 'secondary' | 'outline' {
  if (status === 'published') {
    return 'default';
  }
  if (status === 'archived') {
    return 'outline';
  }
  return 'secondary';
}
