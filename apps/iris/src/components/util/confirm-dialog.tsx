import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export function useConfirmDialog() {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmDialogOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions(next);
      }),
    []
  );

  const close = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const dialog = options ? (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          close(false);
        }
      }}
      open
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.description ? (
            <DialogDescription>{options.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => close(false)} variant="outline">
            {options.cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            onClick={() => close(true)}
            variant={options.destructive ? 'destructive' : 'default'}
          >
            {options.confirmLabel ?? t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return { confirm, dialog };
}
