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
  description: string;
  /** Dismisses the dialog; the caller owns the open state. */
  onCancel: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Disables the confirm action while the deletion is in flight. */
  pending: boolean;
  title: string;
};

/** Confirmation dialog for deleting a row, with the shared button copy. */
export function DeleteConfirmDialog({
  description,
  onCancel,
  onConfirm,
  onOpenChange,
  open,
  pending,
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
          <Button disabled={pending} onClick={onConfirm} variant="destructive">
            {pending ? t('common.deleting') : t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
