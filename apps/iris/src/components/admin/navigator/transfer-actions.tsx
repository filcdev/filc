import { Download, Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  exportNavigatorJson,
  type NavigatorExportPayload,
  useImportNavigator,
} from '@/hooks/navigator';
import { confirmDestructiveAction } from '@/utils/confirm';

/**
 * Export the current navigator graph as JSON and import a JSON file to replace
 * it. Import is destructive (it wipes every navigator table), so it is styled
 * as a destructive action and gated behind a confirmation.
 */
export function TransferActions() {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
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

    const confirmed = confirmDestructiveAction(
      t('navigator.transfer.importConfirm')
    );
    if (!confirmed) {
      return;
    }

    importMutation.mutate(payload);
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
    </div>
  );
}
