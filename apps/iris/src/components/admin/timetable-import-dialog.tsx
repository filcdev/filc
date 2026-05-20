import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type InferResponseType, parseResponse } from 'hono/client';
import { Calendar, CircleAlert, CircleCheck, FileUp, X } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type ImportStatus = 'idle' | 'uploading' | 'success' | 'error';
type ImportPayload = {
  file: File;
  name: string;
  validFrom: Date;
  validTo?: Date;
};

type TimetableImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TimetableImportDialog({
  open,
  onOpenChange,
}: TimetableImportDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('');
  const [validStartDate, setValidStartDate] = useState<Date | undefined>();
  const [validEndDate, setValidEndDate] = useState<Date | undefined>();
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const $import = api.timetable.import.$post;
  const importMutation = useMutation<
    InferResponseType<typeof $import>,
    Error,
    ImportPayload
  >({
    mutationFn: async ({ file, name, validFrom, validTo }: ImportPayload) => {
      const res = await parseResponse(
        api.timetable.import.$post({
          form: {
            name,
            omanXml: file,
            validFrom: validFrom.toISOString(),
            ...(validTo && { validTo: validTo.toISOString() }),
          },
        })
      );

      if (!res.success) {
        throw new Error('Failed to import timetable');
      }

      return res;
    },
    onError: (error: Error) => {
      setImportStatus('error');
      setErrorMessage(error.message);
      toast.error(t('timetable.importError'));
    },
    onMutate: () => {
      setImportStatus('uploading');
      setErrorMessage(null);
    },
    onSuccess: () => {
      setImportStatus('success');
      toast.success(t('timetable.importSuccess'));
      resetForm();
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.lessons() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
      onOpenChange(false);
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setImportName('');
    setValidStartDate(undefined);
    setValidEndDate(undefined);
    setImportStatus('idle');
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      resetForm();
    }
    onOpenChange(value);
  };

  const validateAndSetFile = (file: File) => {
    if (
      file.type !== 'text/xml' &&
      file.type !== 'application/xml' &&
      !file.name.endsWith('.xml')
    ) {
      toast.error(t('timetable.invalidFileType'));
      return;
    }
    setSelectedFile(file);
    setImportStatus('idle');
    setErrorMessage(null);
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleImport = () => {
    if (!selectedFile || !importName.trim() || !validStartDate) {
      return;
    }
    importMutation.mutate({
      file: selectedFile,
      name: importName.trim(),
      validFrom: validStartDate,
      validTo: validEndDate,
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('timetable.import')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-dialog-name">
              {t('timetable.importNameLabel')}
            </Label>
            <Input
              autoComplete="off"
              id="import-dialog-name"
              onChange={(e) => setImportName(e.target.value)}
              placeholder={t('timetable.importNamePlaceholder')}
              value={importName}
            />
            <p className="text-muted-foreground text-xs">
              {t('timetable.importNameDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('timetable.validFromLabel')}</Label>
            <DatePicker
              date={validStartDate ?? new Date()}
              onDateChange={setValidStartDate}
              placeholder={t('timetable.validFromPlaceholder')}
            />
            <p className="text-muted-foreground text-xs">
              {t('timetable.validFromDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('timetable.validToLabel')}</Label>
            <DatePicker
              date={validEndDate}
              onDateChange={setValidEndDate}
              placeholder={t('timetable.validToPlaceholder')}
            />
            <p className="text-muted-foreground text-xs">
              {t('timetable.validToDescription')}
            </p>
          </div>

          {/** biome-ignore lint/a11y/useKeyWithClickEvents: file input disguised as div */}
          {/** biome-ignore lint/a11y/noStaticElementInteractions: file input disguised as div */}
          {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: file input disguised as div */}
          <div
            className="relative flex min-h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-muted-foreground/25 border-dashed bg-transparent p-6 text-center transition-colors hover:border-muted-foreground/50"
            onClick={() => fileInputRef.current?.click()}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-primary');
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('border-primary');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-primary');
              const file = e.dataTransfer.files[0];
              if (file) {
                validateAndSetFile(file);
              }
            }}
          >
            <input
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={handleFileSelect}
              ref={fileInputRef}
              type="file"
            />

            {selectedFile ? (
              <div className="flex w-full items-center justify-between rounded-md bg-muted p-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div className="flex flex-col text-left">
                    <span className="font-medium text-sm">
                      {selectedFile.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setImportStatus('idle');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <FileUp className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="mb-1 font-semibold text-sm">
                  {t('timetable.clickToUpload')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('timetable.supportedFormats')}
                </p>
              </>
            )}
          </div>

          {importStatus === 'success' && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CircleCheck className="h-4 w-4 text-green-600" />
              <AlertTitle>{t('timetable.importSuccessTitle')}</AlertTitle>
              <AlertDescription>
                {t('timetable.importSuccessMessage')}
              </AlertDescription>
            </Alert>
          )}

          {importStatus === 'error' && errorMessage && (
            <Alert
              className="border-red-500 bg-red-50 dark:bg-red-950"
              variant="destructive"
            >
              <CircleAlert className="h-4 w-4" />
              <AlertTitle>{t('timetable.importErrorTitle')}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              className="flex-1"
              disabled={
                !(selectedFile && importName.trim() && validStartDate) ||
                importStatus === 'uploading'
              }
              onClick={handleImport}
            >
              {importStatus === 'uploading' ? (
                <>
                  <Spinner className="mr-2" />
                  {t('timetable.importing')}
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  {t('timetable.importButton')}
                </>
              )}
            </Button>
            <Button
              onClick={() => handleOpenChange(false)}
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
