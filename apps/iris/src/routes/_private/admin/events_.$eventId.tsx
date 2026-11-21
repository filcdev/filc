import {
  eventExportColumns,
  eventQuestionColumnHeaders,
} from '@filcdev/api/domains/events/export';
import type {
  EventRegistrationDecision,
  EventRegistrationRole,
  EventRegistrationStatus,
} from '@filcdev/api/domains/events/registration';
import { permissions } from '@filcdev/api/permissions';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { cn } from '@filcdev/ui/lib/utils';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  Ban,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Mail,
  Pencil,
  Plus,
  Settings2,
  ShieldOff,
  Trash2,
  X,
} from 'lucide-react';
import { Fragment, useDeferredValue, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteConfirmDialog } from '@/components/admin/delete-confirm-dialog';
import { EventRegistrationDialog } from '@/components/admin/event-registration-dialog';
import { EventRoomDialog } from '@/components/admin/event-room-dialog';
import { ExportButton, type ExportColumn } from '@/components/export-button';
import { Lazy } from '@/components/lazy';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import {
  type EventDetail,
  type EventParticipantItem,
  type EventRoomItem,
  type EventStatsData,
  PARTICIPANTS_PAGE_SIZE,
  useAdminEventDetail,
  useCancelEventParticipant,
  useDecideEventRegistration,
  useDeleteEventRoom,
  useEventParticipants,
  useEventStats,
  useResendEventTicket,
  useRevokeCheckinGrant,
} from '@/hooks/events';
import { formatLocalizedDate } from '@/utils/date-locale';
import { api, orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/events_/$eventId')({
  component: () => (
    <PermissionGuard permission={permissions.eventsManage}>
      <EventDetailPage />
    </PermissionGuard>
  ),
  loader: ({ context, params }) =>
    Promise.all([
      prefetch(
        context.queryClient,
        orpc.events.get.queryOptions({
          input: { id: params.eventId, includeDrafts: 'true' },
        })
      ),
      prefetch(
        context.queryClient,
        orpc.events.registrations.list.queryOptions({
          input: {
            id: params.eventId,
            limit: PARTICIPANTS_PAGE_SIZE,
            offset: 0,
          },
        })
      ),
    ]),
});

/** Recharts lives behind this module, so it is fetched with the stats panel. */
const loadEventStats = () => import('@/components/admin/event-stats');

const ROLES: readonly EventRegistrationRole[] = [
  'participant',
  'helper',
  'visitor',
];

const STATUSES: readonly EventRegistrationStatus[] = [
  'confirmed',
  'pending',
  'cancelled',
];

/** Mirrors the server's grant lifetime: the event's end plus one day. */
const GRANT_LIFETIME_MS = 24 * 60 * 60 * 1000;

type BadgeVariant = 'default' | 'secondary' | 'outline';

function eventStatusVariant(status: string): BadgeVariant {
  if (status === 'published') {
    return 'default';
  }
  return status === 'archived' ? 'outline' : 'secondary';
}

/**
 * A pending helper must never wear the confirmed badge: confirmed is the filled
 * one, a pending row is muted and a cancellation is outlined.
 */
function registrationStatusVariant(
  status: EventRegistrationStatus
): BadgeVariant {
  if (status === 'confirmed') {
    return 'default';
  }
  return status === 'pending' ? 'secondary' : 'outline';
}

/**
 * A pending helper gets the two decisions and nothing else; a confirmed row
 * keeps the resend and cancel actions it had.
 */
function ParticipantActions({
  decidePending,
  item,
  onCancel,
  onDecide,
  onResend,
  onRevoke,
  resendPending,
  revokePending,
}: {
  decidePending: boolean;
  item: EventParticipantItem;
  onCancel: (item: EventParticipantItem) => void;
  onDecide: (
    item: EventParticipantItem,
    decision: EventRegistrationDecision
  ) => void;
  onResend: (item: EventParticipantItem) => void;
  onRevoke: (item: EventParticipantItem) => void;
  resendPending: boolean;
  revokePending: boolean;
}) {
  const { t } = useTranslation();

  if (item.status === 'pending') {
    return (
      <div className="flex justify-end gap-1">
        <Button
          aria-label={t('events.participants.approveAria', { name: item.name })}
          disabled={decidePending}
          onClick={() => onDecide(item, 'approve')}
          size="sm"
        >
          <Check className="h-4 w-4" />
          {t('events.participants.approve')}
        </Button>
        <Button
          aria-label={t('events.participants.declineAria', { name: item.name })}
          disabled={decidePending}
          onClick={() => onDecide(item, 'decline')}
          size="sm"
          variant="outline"
        >
          <X className="h-4 w-4" />
          {t('events.participants.decline')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      {item.role === 'visitor' && item.status === 'confirmed' && (
        <Button
          aria-label={t('events.participants.resendAria', { name: item.name })}
          disabled={resendPending}
          onClick={() => onResend(item)}
          size="icon"
          variant="ghost"
        >
          <Mail className="h-4 w-4" />
        </Button>
      )}
      {item.status === 'confirmed' && item.checkinGrant && (
        <Button
          aria-label={t('events.participants.revokeGrantAria', {
            name: item.name,
          })}
          disabled={revokePending}
          onClick={() => onRevoke(item)}
          size="icon"
          variant="ghost"
        >
          <ShieldOff className="h-4 w-4" />
        </Button>
      )}
      {item.status === 'confirmed' && (
        <Button
          aria-label={t('events.participants.cancelAria', { name: item.name })}
          onClick={() => onCancel(item)}
          size="icon"
          variant="ghost"
        >
          <Ban className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * The room cell of the participant table. Its own component because the column
 * exists only for an event with rooms: the row stays free of the branch.
 */
function ParticipantRoomCell({
  hasRooms,
  room,
}: {
  hasRooms: boolean;
  room: EventParticipantItem['room'];
}) {
  const { t } = useTranslation();
  if (!hasRooms) {
    return null;
  }
  return <TableCell>{room?.name ?? t('events.participants.noRoom')}</TableCell>;
}

function RoomsSection({
  event,
  eventId,
}: {
  event: EventDetail;
  eventId: string;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  const rooms = event.rooms;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<EventRoomItem | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<EventRoomItem | null>(null);
  const deleteMutation = useDeleteEventRoom({
    onSaved: () => setRoomToDelete(null),
  });

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold text-xl" id={headingId}>
            {t('events.rooms.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('events.rooms.hint')}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRoom(null);
            setDialogOpen(true);
          }}
          size="sm"
          type="button"
        >
          <Plus className="h-4 w-4" />
          {t('events.rooms.add')}
        </Button>
      </div>

      {rooms.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t('events.rooms.empty')}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rooms.map((room) => {
            const taken = room.capacity - room.remaining;
            return (
              <li
                className="flex flex-wrap items-center justify-between gap-3 p-3"
                key={room.id}
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{room.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {t('events.rooms.seats', {
                      capacity: room.capacity,
                      taken,
                    })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    aria-label={t('events.rooms.editAria', {
                      name: room.name,
                    })}
                    onClick={() => {
                      setEditingRoom(room);
                      setDialogOpen(true);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label={t('events.rooms.deleteAria', {
                      name: room.name,
                    })}
                    onClick={() => setRoomToDelete(room)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EventRoomDialog
        eventId={eventId}
        key={`${dialogOpen ? 'open' : 'closed'}:${editingRoom?.id ?? 'new'}`}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingRoom(null);
          }
        }}
        open={dialogOpen}
        room={editingRoom}
      />

      <DeleteConfirmDialog
        description={t('events.rooms.deleteConfirmDescription', {
          name: roomToDelete?.name ?? '',
        })}
        onCancel={() => setRoomToDelete(null)}
        onConfirm={() => {
          if (roomToDelete) {
            deleteMutation.mutate({
              id: eventId,
              roomId: roomToDelete.id,
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setRoomToDelete(null);
          }
        }}
        open={roomToDelete !== null}
        pending={deleteMutation.isPending}
        title={t('events.rooms.deleteConfirmTitle')}
      />
    </section>
  );
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { i18n, t } = useTranslation();
  const roleId = useId();
  const statusId = useId();
  const searchId = useId();
  const participantsHeadingId = useId();
  const statisticsHeadingId = useId();
  const exportHeadingId = useId();

  const [role, setRole] = useState<EventRegistrationRole | undefined>();
  const [status, setStatus] = useState<EventRegistrationStatus | undefined>();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EventParticipantItem | null>(
    null
  );
  const [approveTarget, setApproveTarget] =
    useState<EventParticipantItem | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<EventParticipantItem | null>(
    null
  );
  const [detailTarget, setDetailTarget] = useState<EventParticipantItem | null>(
    null
  );

  // Typing narrows the list without a timer: React defers the value while the
  // user keeps typing, and the query keeps the previous page on screen.
  const deferredSearch = useDeferredValue(search.trim());

  const eventQuery = useAdminEventDetail(eventId);
  const participantsQuery = useEventParticipants({
    id: eventId,
    limit: PARTICIPANTS_PAGE_SIZE,
    offset,
    role,
    search: deferredSearch || undefined,
    status,
  });
  const statsQuery = useEventStats(eventId);

  const cancelMutation = useCancelEventParticipant({
    onSaved: () => setCancelTarget(null),
  });
  const resendMutation = useResendEventTicket();
  const decideMutation = useDecideEventRegistration({
    onSaved: () => setApproveTarget(null),
  });
  const revokeGrantMutation = useRevokeCheckinGrant({
    onSaved: () => setRevokeTarget(null),
  });

  const event = eventQuery.data;
  // The room column, the export column and the room card all exist only for an
  // event that has rooms.
  const hasRooms = (event?.rooms.length ?? 0) > 0;
  const participantColSpan = hasRooms ? 9 : 8;
  // What an approval grants, in the organizer's own words: this event's door
  // until a day after it ends.
  const grantUntil = event
    ? formatLocalizedDate(
        new Date(new Date(event.endsAt).getTime() + GRANT_LIFETIME_MS),
        i18n.language,
        { dateStyle: 'medium', timeStyle: 'short' }
      )
    : '';
  const participants = participantsQuery.data;
  const total = participants?.total ?? 0;
  // Pending helper signups wait for this page's decision, so their count sits
  // beside the seats instead of hiding in the statistics panel.
  const pendingCount = statsQuery.data?.byStatus.pending ?? 0;
  const page = Math.floor(offset / PARTICIPANTS_PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PARTICIPANTS_PAGE_SIZE));

  const roleFilters = [
    { label: t('events.participants.allRoles'), value: 'all' },
    ...ROLES.map((value) => ({
      label: t(`events.participants.roles.${value}`),
      value,
    })),
  ];
  const statusFilters = [
    { label: t('events.participants.allStatuses'), value: 'all' },
    ...STATUSES.map((value) => ({
      label: t(`events.participants.statuses.${value}`),
      value,
    })),
  ];

  const resetPage = () => {
    setOffset(0);
    setExpandedId(null);
  };

  const exportColumns = (
    fields: EventDetail['fields'],
    rooms: boolean
  ): ExportColumn[] => {
    const questionKeys = eventQuestionColumnHeaders(fields, rooms);
    // The fixed headers are localized, the keys stay the server's; the order
    // comes from the shared helper, so the room column appears exactly where
    // the CSV carries it.
    const fixedHeaders: Record<string, string> = {
      checked_in_at: t('events.participants.columns.checkedInAt'),
      class: t('events.participants.columns.class'),
      email: t('events.participants.columns.email'),
      name: t('events.participants.columns.name'),
      registered_at: t('events.participants.columns.registeredAt'),
      role: t('events.participants.columns.role'),
      room: t('events.participants.columns.room'),
      status: t('events.participants.columns.status'),
    };
    return [
      ...eventExportColumns(rooms).map((key) => ({
        header: fixedHeaders[key] ?? key,
        key,
      })),
      ...questionKeys.map((key, index) => ({
        header: fields[index]?.label ?? key,
        key,
      })),
    ];
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:underline"
          to="/admin/events"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('events.participants.back')}
        </Link>

        <QueryBoundary data={event} query={eventQuery}>
          {(detail) => (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-bold text-3xl tracking-tight">
                  {detail.title}
                </h1>
                <Badge variant={eventStatusVariant(detail.status)}>
                  {t(`events.statuses.${detail.status}`)}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {t(`events.categories.${detail.category}`)} ·{' '}
                {t('events.public.dateRange', {
                  endsAt: formatLocalizedDate(detail.endsAt, i18n.language),
                  startsAt: formatLocalizedDate(detail.startsAt, i18n.language),
                })}{' '}
                ·{' '}
                {t('events.participants.seats', {
                  capacity: detail.seats.capacity ?? t('events.unlimited'),
                  taken: detail.seats.taken,
                })}{' '}
                ·{' '}
                {t('events.participants.helpers', {
                  capacity: detail.helperCapacity ?? t('events.unlimited'),
                  count: statsQuery.data?.confirmedHelpers ?? 0,
                })}
                {pendingCount > 0 && (
                  <>
                    {' '}
                    ·{' '}
                    {t('events.participants.pendingCount', {
                      count: pendingCount,
                    })}
                  </>
                )}
              </p>
              <p className="max-w-2xl text-muted-foreground text-sm">
                {t('events.participants.description')}
              </p>
              <Button
                render={
                  <Link
                    params={{ eventId: detail.id }}
                    to="/admin/events/$eventId/helpers"
                  />
                }
                size="sm"
                variant="outline"
              >
                <Settings2 className="h-4 w-4" />
                {t('events.helpersPage.link')}
              </Button>
            </div>
          )}
        </QueryBoundary>
      </div>

      {event && <RoomsSection event={event} eventId={eventId} />}

      <section aria-labelledby={participantsHeadingId} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-xl" id={participantsHeadingId}>
            {t('events.participants.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('events.participants.total', { count: total })}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={roleId}>
              {t('events.participants.roleFilter')}
            </Label>
            <Select
              items={roleFilters}
              onValueChange={(value) => {
                setRole(
                  value === 'all' ? undefined : (value as EventRegistrationRole)
                );
                resetPage();
              }}
              value={role ?? 'all'}
            >
              <SelectTrigger className="w-full" id={roleId}>
                <SelectValue />
              </SelectTrigger>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={statusId}>
              {t('events.participants.statusFilter')}
            </Label>
            <Select
              items={statusFilters}
              onValueChange={(value) => {
                setStatus(
                  value === 'all'
                    ? undefined
                    : (value as EventRegistrationStatus)
                );
                resetPage();
              }}
              value={status ?? 'all'}
            >
              <SelectTrigger className="w-full" id={statusId}>
                <SelectValue />
              </SelectTrigger>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={searchId}>
              {t('events.participants.searchLabel')}
            </Label>
            <Input
              id={searchId}
              onChange={(changeEvent) => {
                setSearch(changeEvent.target.value);
                resetPage();
              }}
              placeholder={t('events.participants.searchPlaceholder')}
              value={search}
            />
          </div>
        </div>

        <QueryBoundary data={participants} query={participantsQuery}>
          {() => (
            <>
              <div className="w-full overflow-x-auto rounded-md border">
                <Table className="w-full min-w-4xl">
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t('events.participants.columns.name')}
                      </TableHead>
                      <TableHead>
                        {t('events.participants.columns.email')}
                      </TableHead>
                      {hasRooms && (
                        <TableHead>
                          {t('events.participants.columns.room')}
                        </TableHead>
                      )}
                      <TableHead>
                        {t('events.participants.columns.role')}
                      </TableHead>
                      <TableHead>
                        {t('events.participants.columns.status')}
                      </TableHead>
                      <TableHead>
                        {t('events.participants.columns.registeredAt')}
                      </TableHead>
                      <TableHead>
                        {t('events.participants.columns.checkedInAt')}
                      </TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">
                          {t('events.participants.answers')}
                        </span>
                      </TableHead>
                      <TableHead className="w-44 text-right">
                        {t('events.actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(participants?.items ?? []).length === 0 && (
                      <TableRow>
                        <TableCell
                          className="text-muted-foreground"
                          colSpan={participantColSpan}
                        >
                          {t('events.participants.empty')}
                        </TableCell>
                      </TableRow>
                    )}
                    {(participants?.items ?? []).map((item) => {
                      const answersId = `answers-${item.id}`;
                      const isExpanded = expandedId === item.id;
                      return (
                        <Fragment key={item.id}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={(clickEvent) => {
                              // A click on an action button or the answers
                              // disclosure keeps its own meaning; anywhere else
                              // opens the registration in full.
                              if (
                                clickEvent.target instanceof Element &&
                                clickEvent.target.closest('a, button')
                              ) {
                                return;
                              }
                              setDetailTarget(item);
                            }}
                          >
                            <TableCell className="font-medium">
                              <button
                                className="text-left hover:underline"
                                onClick={() => setDetailTarget(item)}
                                type="button"
                              >
                                {item.name}
                              </button>
                            </TableCell>
                            <TableCell>{item.email}</TableCell>
                            <ParticipantRoomCell
                              hasRooms={hasRooms}
                              room={item.room}
                            />
                            <TableCell>
                              <Badge variant="outline">
                                {t(`events.participants.roles.${item.role}`)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={registrationStatusVariant(item.status)}
                              >
                                {t(
                                  `events.participants.statuses.${item.status}`
                                )}
                              </Badge>
                              {item.checkinGrant && (
                                <p className="mt-1 whitespace-nowrap text-muted-foreground text-xs">
                                  {t('events.participants.grantUntil', {
                                    date: formatLocalizedDate(
                                      item.checkinGrant.expiresAt,
                                      i18n.language,
                                      {
                                        dateStyle: 'short',
                                        timeStyle: 'short',
                                      }
                                    ),
                                  })}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              {formatLocalizedDate(
                                item.registeredAt,
                                i18n.language,
                                { dateStyle: 'short', timeStyle: 'short' }
                              )}
                            </TableCell>
                            <TableCell>
                              {item.checkedInAt
                                ? formatLocalizedDate(
                                    item.checkedInAt,
                                    i18n.language,
                                    { dateStyle: 'short', timeStyle: 'short' }
                                  )
                                : t('events.participants.notCheckedIn')}
                            </TableCell>
                            <TableCell>
                              {item.answers.length > 0 && (
                                <Button
                                  aria-controls={answersId}
                                  aria-expanded={isExpanded}
                                  aria-label={t(
                                    'events.participants.answersAria',
                                    { name: item.name }
                                  )}
                                  onClick={() =>
                                    setExpandedId(isExpanded ? null : item.id)
                                  }
                                  size="icon"
                                  variant="ghost"
                                >
                                  <ChevronDown
                                    className={cn(
                                      'h-4 w-4 transition-transform',
                                      isExpanded && 'rotate-180'
                                    )}
                                  />
                                </Button>
                              )}
                            </TableCell>
                            <TableCell>
                              <ParticipantActions
                                decidePending={
                                  decideMutation.isPending &&
                                  decideMutation.variables?.registrationId ===
                                    item.id
                                }
                                item={item}
                                onCancel={setCancelTarget}
                                onDecide={(target, decision) => {
                                  if (decision === 'approve') {
                                    // The approval opens a door, so it says
                                    // what it grants before it does.
                                    setApproveTarget(target);
                                    return;
                                  }
                                  decideMutation.mutate({
                                    decision,
                                    id: eventId,
                                    registrationId: target.id,
                                  });
                                }}
                                onResend={(target) =>
                                  resendMutation.mutate({
                                    id: eventId,
                                    registrationId: target.id,
                                  })
                                }
                                onRevoke={setRevokeTarget}
                                resendPending={resendMutation.isPending}
                                revokePending={
                                  revokeGrantMutation.isPending &&
                                  revokeGrantMutation.variables
                                    ?.registrationId === item.id
                                }
                              />
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell
                                className="bg-muted/40"
                                colSpan={participantColSpan}
                                id={answersId}
                              >
                                {item.answers.length === 0 ? (
                                  <p className="text-muted-foreground text-sm">
                                    {t('events.participants.noAnswers')}
                                  </p>
                                ) : (
                                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {item.answers.map((answer) => (
                                      <div key={answer.fieldId}>
                                        <dt className="text-muted-foreground text-xs">
                                          {answer.label}
                                        </dt>
                                        <dd className="text-sm">
                                          {answer.value}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">
                  {t('events.participants.page', { page, pages })}
                </p>
                <div className="flex gap-2">
                  <Button
                    disabled={offset === 0}
                    onClick={() =>
                      setOffset(Math.max(0, offset - PARTICIPANTS_PAGE_SIZE))
                    }
                    size="sm"
                    variant="outline"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('common.previous')}
                  </Button>
                  <Button
                    disabled={offset + PARTICIPANTS_PAGE_SIZE >= total}
                    onClick={() => setOffset(offset + PARTICIPANTS_PAGE_SIZE)}
                    size="sm"
                    variant="outline"
                  >
                    {t('common.next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </QueryBoundary>
      </section>

      <section aria-labelledby={statisticsHeadingId} className="space-y-4">
        <h2 className="font-semibold text-xl" id={statisticsHeadingId}>
          {t('events.participants.stats.title')}
        </h2>
        <QueryBoundary data={statsQuery.data} query={statsQuery}>
          {(stats: EventStatsData) => (
            <Lazy load={loadEventStats} stats={stats} />
          )}
        </QueryBoundary>
      </section>

      <section aria-labelledby={exportHeadingId} className="space-y-3">
        <h2 className="font-semibold text-xl" id={exportHeadingId}>
          {t('events.participants.exportTitle')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('events.participants.exportHint')}
        </p>
        {event && (
          <ExportButton
            columns={exportColumns(event.fields, hasRooms)}
            errorKey="events.participants.exportError"
            fetchCsv={async () => {
              const file = await api.events.export({ id: eventId });
              return await file.text();
            }}
            filenamePrefix="event-participants"
            labelKey="events.participants.export"
            pdfTitle={event.title}
            rangeLabel={t('events.participants.total', { count: total })}
            successKey="events.participants.exportSuccess"
          />
        )}
      </section>

      <DeleteConfirmDialog
        confirmLabelKey="events.participants.approve"
        description={t('events.participants.approveConfirmDescription', {
          date: grantUntil,
          name: approveTarget?.name ?? '',
        })}
        destructive={false}
        onCancel={() => setApproveTarget(null)}
        onConfirm={() => {
          if (approveTarget) {
            decideMutation.mutate({
              decision: 'approve',
              id: eventId,
              registrationId: approveTarget.id,
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setApproveTarget(null);
          }
        }}
        open={approveTarget !== null}
        pending={decideMutation.isPending}
        pendingLabelKey="events.participants.approving"
        title={t('events.participants.approveConfirmTitle')}
      />

      <DeleteConfirmDialog
        confirmLabelKey="events.participants.revokeGrantConfirmAction"
        description={t('events.participants.revokeGrantConfirmDescription', {
          name: revokeTarget?.name ?? '',
        })}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) {
            revokeGrantMutation.mutate({
              id: eventId,
              registrationId: revokeTarget.id,
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
          }
        }}
        open={revokeTarget !== null}
        pending={revokeGrantMutation.isPending}
        pendingLabelKey="events.participants.revoking"
        title={t('events.participants.revokeGrantConfirmTitle')}
      />

      <DeleteConfirmDialog
        confirmLabelKey="events.participants.cancelConfirmAction"
        description={t('events.participants.cancelConfirmDescription', {
          name: cancelTarget?.name ?? '',
        })}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) {
            cancelMutation.mutate({
              id: eventId,
              registrationId: cancelTarget.id,
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
          }
        }}
        open={cancelTarget !== null}
        pending={cancelMutation.isPending}
        pendingLabelKey="events.participants.cancelling"
        title={t('events.participants.cancelConfirmTitle')}
      />

      <EventRegistrationDialog
        eventId={eventId}
        item={detailTarget}
        onCancel={(target) => {
          setDetailTarget(null);
          setCancelTarget(target);
        }}
        onDecide={(target, decision) => {
          setDetailTarget(null);
          if (decision === 'approve') {
            // The approval opens a door, so it says what it grants before it
            // does — the same confirmation the table action uses.
            setApproveTarget(target);
            return;
          }
          decideMutation.mutate({
            decision,
            id: eventId,
            registrationId: target.id,
          });
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTarget(null);
          }
        }}
        onRevoke={(target) => {
          setDetailTarget(null);
          setRevokeTarget(target);
        }}
        revokePending={
          revokeGrantMutation.isPending &&
          revokeGrantMutation.variables?.registrationId === detailTarget?.id
        }
      />
    </div>
  );
}
