import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

// Every current caller confirms a destructive delete, so destructive styling
// and a "Delete" button label are the defaults; pass overrides otherwise.
type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Asks the user to confirm an action. Resolves `true` on confirm and `false`
 * on cancel, dismissal or Escape.
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);

  if (!confirm) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }

  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (nextOptions) =>
      new Promise<boolean>((resolve) => {
        // A second request replaces the open dialog, so settle the first one
        // as cancelled rather than leaving its caller hanging.
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setOptions(nextOptions);
      }),
    []
  );

  const settle = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            settle(false);
          }
        }}
        open={options !== null}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{options?.title}</DialogTitle>
            {options?.description && (
              <DialogDescription>{options.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {options?.cancelLabel ?? t('common.cancel')}
            </DialogClose>
            <Button
              onClick={() => settle(true)}
              variant={
                options?.destructive === false ? 'default' : 'destructive'
              }
            >
              {options?.confirmLabel ?? t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
