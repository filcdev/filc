import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { MailCheck, MailX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiMutation } from '@/utils/api';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type NotificationListResult = {
  data: NotificationItem[];
  success: boolean;
  total?: number;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
};

const NOTIFICATION_TYPES = [
  'substitution',
  'moved_lesson',
  'announcement',
  'system_message',
  'blog_post',
  'doorlock_card_used',
] as const;

function typeLabel(type: string, t: ReturnType<typeof useTranslation>['t']) {
  const map: Record<string, string> = {
    announcement: t('notifications.types.announcement'),
    blog_post: t('notifications.types.blogPost'),
    doorlock_card_used: t('notifications.types.doorlockCardUsed'),
    moved_lesson: t('notifications.types.movedLesson'),
    substitution: t('notifications.types.substitution'),
    system_message: t('notifications.types.systemMessage'),
  };
  return map[type] ?? type;
}

export const Route = createFileRoute('/_private/notifications')({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [unreadFilter, setUnreadFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery<NotificationListResult>({
    queryFn: () => {
      const query: Record<string, string | undefined> = {
        limit: String(pageSize),
        offset: String(page * pageSize),
      };
      if (typeFilter !== 'all') {
        query.type = typeFilter;
      }
      if (unreadFilter === 'true') {
        query.unread = 'true';
      } else if (unreadFilter === 'false') {
        query.unread = 'false';
      }
      if (dateFrom) {
        query.dateFrom = dateFrom;
      }
      if (dateTo) {
        query.dateTo = dateTo;
      }
      return parseResponse(
        api.notifications.index.$get({ query })
      ) as unknown as NotificationListResult;
    },
    queryKey: [
      ...queryKeys.notifications.list(
        typeFilter,
        unreadFilter,
        page,
        dateFrom,
        dateTo
      ),
      pageSize,
    ],
  });

  const markReadMutation = useApiMutation({
    mutationFn: (id: string) =>
      api.notifications[':id'].read.$patch({ param: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all(),
      });
    },
  });

  const markAllReadMutation = useApiMutation({
    mutationFn: () => api.notifications['read-all'].$patch(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all(),
      });
      toast.success(t('notifications.history.markRead'));
    },
  });

  const handleSelectChange = (
    setter: (v: string) => void
  ): ((value: string | null) => void) => {
    return (value: string | null) => {
      if (value === null) {
        return;
      }
      setter(value);
      setPage(0);
    };
  };

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('notifications.history.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select
              onValueChange={handleSelectChange(setTypeFilter)}
              value={typeFilter}
            >
              <SelectTrigger className="w-44">
                <SelectValue
                  placeholder={t('notifications.history.filterType')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('notifications.history.filterAll')}
                </SelectItem>
                {NOTIFICATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {typeLabel(type, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={handleSelectChange(setUnreadFilter)}
              value={unreadFilter}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Unread</SelectItem>
                <SelectItem value="false">Read</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="w-36"
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
              type="date"
              value={dateFrom}
            />
            <Input
              className="w-36"
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              type="date"
              value={dateTo}
            />
            <Button
              onClick={() => markAllReadMutation.mutate(undefined)}
              size="sm"
              variant="outline"
            >
              <MailCheck className="mr-1 h-4 w-4" />
              {t('notifications.history.markRead')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton className="h-16 w-full" key={i} />
          ))}
        </div>
      ) : null}
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('notifications.history.loadError')}</AlertTitle>
          <AlertDescription>
            {t('notifications.history.loadErrorMessage')}
          </AlertDescription>
        </Alert>
      ) : null}
      {items.length === 0 && !isLoading && !isError ? (
        <div className="py-12 text-center text-muted-foreground">
          {t('notifications.history.noNotifications')}
        </div>
      ) : null}
      {items.length > 0 && !isLoading && !isError ? (
        <div className="space-y-2">
          {items.map((notif) => (
            <Card
              className="transition-colors hover:bg-muted/50"
              key={notif.id}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        notif.read
                          ? 'font-normal text-sm'
                          : 'font-medium text-sm'
                      }
                    >
                      {notif.title}
                    </span>
                    <Badge className="text-xs" variant="secondary">
                      {typeLabel(notif.type, t)}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                    {notif.content}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {new Date(notif.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    onClick={() => markReadMutation.mutate(notif.id)}
                    size="sm"
                    variant="ghost"
                  >
                    {notif.read ? (
                      <MailX className="h-4 w-4" />
                    ) : (
                      <MailCheck className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                size="sm"
                variant="outline"
              >
                {t('common.back')}
              </Button>
              <span className="text-muted-foreground text-sm">
                {page + 1} / {totalPages}
              </span>
              <Button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                size="sm"
                variant="outline"
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
