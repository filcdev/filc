import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { useTranslation } from 'react-i18next';

type DeleteConfirmDialogProps = {
  /** i18n key of the confirm button; defaults to the delete copy. */
  confirmLabelKey?: string;
  description: string;
  /**
   * Styles the confirm button as destructive. A confirmation that opens
   * something instead (approving a helper) turns it off.
   */
  destructive?: boolean;
  /** Dismisses the dialog; the caller owns the open state. */
  onCancel: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Disables the confirm action while the deletion is in flight. */
  pending: boolean;
  /** i18n key of the pending confirm button; defaults to the delete copy. */
  pendingLabelKey?: string;
  title: string;
};

/** Confirmation dialog for deleting a row, with the shared button copy. */
export function DeleteConfirmDialog({
  confirmLabelKey = 'common.delete',
  description,
  destructive = true,
  onCancel,
  onConfirm,
  onOpenChange,
  open,
  pending,
  pendingLabelKey = 'common.deleting',
  title,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onCancel} variant="outline">
            {t('common.cancel')}
          </Button>
          <Button
            disabled={pending}
            onClick={onConfirm}
            variant={destructive ? 'destructive' : 'default'}
          >
            {pending ? t(pendingLabelKey) : t(confirmLabelKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
