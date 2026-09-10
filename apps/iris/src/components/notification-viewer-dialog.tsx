import { useNavigate } from '@tanstack/react-router';
import { MailCheck, MailX } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type NotificationItem,
  useMarkNotificationRead,
} from '@/hooks/notifications';
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const markReadMutation = useMarkNotificationRead();

  useEffect(() => {
    if (open && notification && !notification.read) {
      markReadMutation.mutate(notification.id);
    }
  }, [open, notification, markReadMutation.mutate]);

  if (!notification) {
    return null;
  }

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
        <p className="text-muted-foreground text-xs">
          {new Date(notification.createdAt).toLocaleString()}
        </p>

        <DialogFooter>
          <Button
            onClick={() => markReadMutation.mutate(notification.id)}
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
                navigate({ to: '/settings' });
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
