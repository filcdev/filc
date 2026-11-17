import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { cn } from '@filcdev/ui/lib/utils';
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

/**
 * The metadata highlights of one notification, deduplicated. `max` collapses
 * the remainder into a `+N` badge for the compact history rows.
 */
export function NotificationHighlights({
  className,
  highlights,
  max,
}: {
  className?: string;
  highlights: string[];
  max?: number;
}) {
  const unique = [...new Set(highlights)];
  if (unique.length === 0) {
    return null;
  }
  const shown = max === undefined ? unique : unique.slice(0, max);
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {shown.map((highlight) => (
        <Badge key={highlight} variant="secondary">
          {highlight}
        </Badge>
      ))}
      {max !== undefined && unique.length > max ? (
        <Badge variant="secondary">+{unique.length - max}</Badge>
      ) : null}
    </div>
  );
}

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

  const highlights = notification.metadata?.highlights ?? [];
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
          <NotificationHighlights className="gap-1.5" highlights={highlights} />
        )}

        {details.length > 0 && (
          <dl className="divide-y rounded-md border text-xs">
            {details.map((detail, index) => (
              <div
                className="flex items-start justify-between gap-4 px-3 py-1.5"
                // biome-ignore lint/suspicious/noArrayIndexKey: two rows can carry the same label, so the position is part of the identity
                key={`${detail.label}-${index}`}
              >
                <dt className="text-muted-foreground uppercase tracking-wide">
                  {detail.label}
                </dt>
                <dd className="min-w-0 break-words text-right">
                  {detail.value}
                </dd>
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

        {notification.metadata?.action === 'cohort_reselection' && (
          <DialogFooter>
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
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
