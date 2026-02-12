import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { Calendar, CircleAlert, CircleCheck, FileUp, X } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { PermissionGuard } from '@/components/util/permission-guard';
import { api } from '@/utils/hc';

export const Route = createFileRoute('/_private/admin/timetable/import')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <PermissionGuard permission="import:timetable">
      <TimetableImportPage />
    </PermissionGuard>
  );
}

type ImportStatus = 'idle' | 'uploading' | 'success' | 'error';
type ImportPayload = {
  file: File;
  name: string;
  validFrom: Date;
};

function TimetableImportPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('');
  const [validStartDate, setValidStartDate] = useState<Date | undefined>();
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: async ({ file, name, validFrom }: ImportPayload) => {
      const res = await parseResponse(
        api.timetable.import.$post({
          form: { name, omanXml: file, validFrom: validFrom.toISOString() },
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
      setSelectedFile(null);
      setImportName('');
      setValidStartDate(undefined);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Invalidate any timetable-related queries
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
    },
  });

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
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
    }
  };

  const handleImport = () => {
    if (!selectedFile) {
      return;
    }

    const trimmedName = importName.trim();
    if (!trimmedName) {
      return;
    }

    if (!validStartDate) {
      return;
    }

    importMutation.mutate({
      file: selectedFile,
      name: trimmedName,
      validFrom: validStartDate,
    });
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setImportStatus('idle');
    setErrorMessage(null);
    setValidStartDate(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('timetable.import')}
        </h1>
        <p className="text-muted-foreground">
          {t('timetable.importDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('timetable.uploadFile')}</CardTitle>
          <CardDescription>
            {t('timetable.uploadFileDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="timetable-import-name">
              {t('timetable.importNameLabel')}
            </Label>
            <Input
              autoComplete="off"
              id="timetable-import-name"
              onChange={(event) => setImportName(event.target.value)}
              placeholder={t('timetable.importNamePlaceholder')}
              required
              value={importName}
            />
            <p className="text-muted-foreground text-xs">
              {t('timetable.importNameDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timetable-import-validFrom">
              {t('timetable.validFromLabel')}
            </Label>
            <DatePicker
              date={validStartDate ?? new Date()}
              onDateChange={setValidStartDate}
              placeholder={t('timetable.validFromPlaceholder')}
            />
            <p className="text-muted-foreground text-xs">
              {t('timetable.validFromDescription')}
            </p>
          </div>

          {/* File Upload Area */}
          {/** biome-ignore lint/a11y/useKeyWithClickEvents: it's a file input disguised as a div, so keyboard interaction isn't necessary here */}
          {/** biome-ignore lint/a11y/noStaticElementInteractions: it's a file input disguised as a div, so keyboard interaction isn't necessary here */}
          {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: it's a file input disguised as a div, so keyboard interaction isn't necessary here */}
          <div
            className="relative flex min-h-50 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-muted-foreground/25 border-dashed bg-transparent p-8 text-center transition-colors hover:border-muted-foreground/50"
            onClick={handleBrowseClick}
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
              <div className="flex w-full items-center justify-between rounded-md bg-muted p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-6 w-6 text-primary" />
                  <div className="flex flex-col">
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
                    handleClearFile();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <FileUp className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-2 font-semibold text-sm">
                  {t('timetable.clickToUpload')}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('timetable.dragAndDrop')}
                </p>
                <p className="mt-2 text-muted-foreground text-xs">
                  {t('timetable.supportedFormats')}
                </p>
              </>
            )}
          </div>

          {/* Status Messages */}
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

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              disabled={
                !(selectedFile && importName.trim() && validStartDate) ||
                importStatus === 'uploading'
              }
              onClick={handleImport}
              size="lg"
            >
              {importStatus === 'uploading' ? (
                <>
                  <Spinner className="mr-2" />
                  {t('timetable.importing')}
                </>
              ) : (
                <>
                  <FileUp />
                  {t('timetable.importButton')}
                </>
              )}
            </Button>
            {selectedFile && importStatus !== 'uploading' && (
              <Button onClick={handleClearFile} size="lg" variant="outline">
                {t('common.cancel')}
              </Button>
            )}
          </div>

          {/* Information Card */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">
                {t('timetable.importInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground text-sm">
              <p>• {t('timetable.importInfoPoint1')}</p>
              <p>• {t('timetable.importInfoPoint2')}</p>
              <p>• {t('timetable.importInfoPoint3')}</p>
              <p>• {t('timetable.importInfoPoint4')}</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
