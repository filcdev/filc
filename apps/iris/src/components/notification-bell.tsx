import { Bell, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationHistoryDialog } from '@/components/notification-history-dialog';
import { NotificationViewerDialog } from '@/components/notification-viewer-dialog';
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
import {
  useMarkAllNotificationsRead,
  useRecentNotifications,
  useUnreadNotificationCount,
} from '@/hooks/notifications';
import { authClient } from '@/utils/authentication';

export function NotificationBell() {
  const { t } = useTranslation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: session } = authClient.useSession();
  const userId = session?.session.userId;

  const { data: unreadData } = useUnreadNotificationCount(userId);

  const { data: recentData } = useRecentNotifications(userId);

  const markAllAsReadMutation = useMarkAllNotificationsRead();

  const unreadCount = unreadData?.count ?? 0;
  const recent = recentData ?? [];
  const selectedNotification = selectedId
    ? (recent.find((n) => n.id === selectedId) ?? null)
    : null;

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
                onClick={() => setSelectedId(notif.id)}
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
      <NotificationViewerDialog
        notification={selectedNotification}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
        open={!!selectedNotification}
      />
    </>
  );
}
