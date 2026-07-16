import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { MailCheck, MailX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type NotificationHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NotificationHistoryDialog({
  open,
  onOpenChange,
}: NotificationHistoryDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery({
    enabled: open,
    queryFn: async () => {
      const query: Record<string, string | undefined> = {
        limit: String(pageSize),
        offset: String(page * pageSize),
      };
      if (typeFilter !== 'all') {
        query.type = typeFilter;
      }
      const res = await parseResponse(api.notifications.index.$get({ query }));
      if (!res.success) {
        throw new Error('Failed to load notifications');
      }
      return {
        items: (res.data ?? []) as NotificationItem[],
        total: (res as { total?: number }).total ?? 0,
      };
    },
    queryKey: [
      ...queryKeys.notifications.list(typeFilter, 'all', page, '', ''),
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

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const ready = !(isLoading || isError);

  const typeItems = [
    { label: t('notifications.history.filterAll'), value: 'all' },
    ...NOTIFICATION_TYPES.map((type) => ({
      label: typeLabel(type, t),
      value: type,
    })),
  ];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('notifications.history.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select
              items={typeItems}
              onValueChange={handleSelectChange(setTypeFilter)}
              value={typeFilter}
            >
              <SelectTrigger className="w-40">
                <SelectValue
                  placeholder={t('notifications.history.filterType')}
                />
              </SelectTrigger>
              <SelectContent>
                {typeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => markAllReadMutation.mutate(undefined)}
              size="sm"
              variant="outline"
            >
              <MailCheck className="mr-1 h-4 w-4" />
              {t('notifications.history.markRead')}
            </Button>
          </div>

          {isLoading && (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton className="h-16 w-full" key={i} />
              ))}
            </div>
          )}

          {isError && (
            <Alert variant="destructive">
              <AlertTitle>{t('notifications.history.loadError')}</AlertTitle>

              <AlertDescription>
                {t('notifications.history.loadErrorMessage')}
              </AlertDescription>
            </Alert>
          )}

          {ready && items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {t('notifications.history.noNotifications')}
            </div>
          ) : null}

          {items.length > 0 ? (
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
      </DialogContent>
    </Dialog>
  );
}
