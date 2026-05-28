import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { Bell, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationHistoryDialog } from '@/components/notification-history-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

type UnreadCountData = { count: number };

export function NotificationBell() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const { data: unreadData } = useQuery({
    enabled: !!user,
    queryFn: async () => {
      const res = await parseResponse(api.notifications['unread-count'].$get());
      if (!res.success) {
        throw new Error('Failed to load unread count');
      }
      return res.data as UnreadCountData;
    },
    queryKey: queryKeys.notifications.unreadCount(),
    refetchInterval: 30_000,
  });

  const { data: recentData } = useQuery({
    enabled: !!user,
    queryFn: async () => {
      const res = await parseResponse(
        api.notifications.index.$get({
          query: { limit: '5', offset: '0', unread: 'true' },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load recent notifications');
      }
      return (res.data ?? []) as NotificationItem[];
    },
    queryKey: ['notifications', 'recent'] as const,
    refetchInterval: 30_000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) =>
      parseResponse(api.notifications[':id'].read.$patch({ param: { id } })),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all(),
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () =>
      parseResponse(api.notifications['read-all'].$patch()),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all(),
      });
    },
  });

  const unreadCount = unreadData?.count ?? 0;
  const recent = recentData ?? [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className="relative text-muted-foreground hover:text-foreground"
              size="sm"
              variant="ghost"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-primary p-0 text-center text-primary-foreground text-xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="flex items-center justify-between">
                <span>{t('notifications.title')}</span>
                {recent.length > 0 && (
                  <Button
                    className="-my-1 h-auto px-2 py-0.5 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllAsReadMutation.mutate(undefined);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <MailCheck className="mr-1 h-3 w-3" />
                    {t('notifications.history.markRead')}
                  </Button>
                )}
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {recent.length === 0 ? (
            <div className="px-2 py-4 text-center text-muted-foreground text-sm">
              {t('notifications.bell.empty')}
            </div>
          ) : (
            recent.map((notif) => (
              <DropdownMenuItem
                className="cursor-pointer"
                key={notif.id}
                onClick={() => {
                  markAsReadMutation.mutate(notif.id);
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <span
                    className={notif.read ? 'text-sm' : 'font-medium text-sm'}
                  >
                    {notif.title}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(notif.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer justify-center text-muted-foreground text-sm"
            onClick={() => setHistoryOpen(true)}
          >
            {t('notifications.bell.viewAll')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NotificationHistoryDialog
        onOpenChange={setHistoryOpen}
        open={historyOpen}
      />
    </>
  );
}
