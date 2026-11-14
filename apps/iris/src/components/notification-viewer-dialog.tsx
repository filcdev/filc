import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { MailCheck, MailX } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsDialog } from '@/components/settings-dialog-store';
import {
  type NotificationItem,
  useMarkNotificationRead,
} from '@/hooks/notifications';
import { formatLocalizedDate } from '@/utils/date-locale';
import { typeLabel } from '@/utils/notification-labels';

type NotificationViewerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: NotificationItem | null;
};

export function NotificationViewerDialog({
  open,
  onOpenChange,
  notification,
}: NotificationViewerDialogProps) {
  const { i18n, t } = useTranslation();
  const { openSettings } = useSettingsDialog();
  const markReadMutation = useMarkNotificationRead();

  useEffect(() => {
    if (open && notification && !notification.read) {
      markReadMutation.mutate({ id: notification.id });
    }
  }, [open, notification, markReadMutation.mutate]);

  if (!notification) {
    return null;
  }

  const highlights = [...new Set(notification.metadata?.highlights ?? [])];
  const details = notification.metadata?.details ?? [];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{notification.title}</DialogTitle>
            <Badge className="text-xs" variant="secondary">
              {typeLabel(notification.type, t)}
            </Badge>
          </div>
        </DialogHeader>

        <p className="whitespace-pre-wrap text-sm">{notification.content}</p>

        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {highlights.map((highlight) => (
              <span
                className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
                key={highlight}
              >
                {highlight}
              </span>
            ))}
          </div>
        )}

        {details.length > 0 && (
          <dl className="divide-y rounded-md border text-xs">
            {details.map((detail) => (
              <div
                className="flex items-start justify-between gap-4 px-3 py-1.5"
                key={detail.label}
              >
                <dt className="text-muted-foreground uppercase tracking-wide">
                  {detail.label}
                </dt>
                <dd className="text-right">{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="text-muted-foreground text-xs">
          {formatLocalizedDate(notification.createdAt, i18n.language, {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'Europe/Budapest',
          })}
        </p>

        <DialogFooter>
          <Button
            onClick={() => markReadMutation.mutate({ id: notification.id })}
            size="sm"
            variant="ghost"
          >
            {notification.read ? (
              <MailX className="h-4 w-4" />
            ) : (
              <MailCheck className="h-4 w-4" />
            )}
          </Button>
          {notification.metadata?.action === 'cohort_reselection' && (
            <Button
              onClick={() => {
                onOpenChange(false);
                openSettings('general');
              }}
              size="sm"
              variant="outline"
            >
              {t('notifications.viewer.changeCohort')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
