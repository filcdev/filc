import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Label } from '@filcdev/ui/components/label';
import { Spinner } from '@filcdev/ui/components/spinner';
import { Download, Upload } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  exportNavigatorJson,
  type NavigatorExportPayload,
  useImportNavigator,
} from '@/hooks/navigator';

/**
 * Export the current navigator data as JSON and import a JSON file to replace
 * it. Import is destructive (it wipes every navigator-only table), so it is
 * styled as a destructive action and gated behind a confirmation dialog.
 */
export function TransferActions() {
  const { t } = useTranslation();
  const clearFirstId = useId();
  const [exporting, setExporting] = useState(false);
  const [clearFirst, setClearFirst] = useState(false);
  const [pendingPayload, setPendingPayload] =
    useState<NavigatorExportPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportNavigator();

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportNavigatorJson();
    } catch {
      toast.error(t('navigator.transfer.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again still triggers a change event.
    event.target.value = '';
    if (!file) {
      return;
    }

    let payload: NavigatorExportPayload;
    try {
      payload = JSON.parse(await file.text()) as NavigatorExportPayload;
    } catch {
      toast.error(t('navigator.transfer.invalidFile'));
      return;
    }

    setPendingPayload(payload);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        disabled={exporting}
        onClick={handleExport}
        size="sm"
        variant="outline"
      >
        {exporting ? (
          <Spinner className="mr-2" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {exporting
          ? t('navigator.transfer.exportInProgress')
          : t('navigator.transfer.export')}
      </Button>

      <Button
        disabled={importMutation.isPending}
        onClick={() => fileInputRef.current?.click()}
        size="sm"
        variant="destructive"
      >
        {importMutation.isPending ? (
          <Spinner className="mr-2" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {t('navigator.transfer.import')}
      </Button>

      <input
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileSelect}
        ref={fileInputRef}
        type="file"
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingPayload(null);
            setClearFirst(false);
          }
        }}
        open={pendingPayload !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('navigator.transfer.import')}</DialogTitle>
            <DialogDescription>
              {t('navigator.transfer.importConfirm')}
            </DialogDescription>
          </DialogHeader>
          <Label className="cursor-pointer items-start" htmlFor={clearFirstId}>
            <Checkbox
              checked={clearFirst}
              id={clearFirstId}
              onCheckedChange={(checked) => setClearFirst(checked === true)}
            />
            {t('navigator.transfer.clearFirst')}
          </Label>
          <DialogFooter>
            <Button
              onClick={() => {
                setPendingPayload(null);
                setClearFirst(false);
              }}
              type="button"
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={importMutation.isPending}
              onClick={() => {
                if (pendingPayload) {
                  importMutation.mutate({
                    clear: clearFirst,
                    payload: pendingPayload,
                  });
                }
                setPendingPayload(null);
                setClearFirst(false);
              }}
              type="button"
              variant="destructive"
            >
              {t('navigator.transfer.import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
