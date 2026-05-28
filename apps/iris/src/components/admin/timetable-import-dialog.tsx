import { useForm, useStore } from '@tanstack/react-form';
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
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { timetableImportSchema } from '@/utils/form-schemas';
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
      form.reset();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.timetables.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.lessons() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
      onOpenChange(false);
    },
  });

  const form = useForm({
    defaultValues: {
      file: null as File | null,
      name: '',
      validFrom: new Date(),
      validTo: undefined as Date | undefined,
    },
    onSubmit: ({ value: { name, validFrom, validTo, file } }) => {
      if (!file) {
        return;
      }
      importMutation.mutate({
        file,
        name: name.trim(),
        validFrom,
        validTo,
      });
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = timetableImportSchema.safeParse(value);
        if (!result.success) {
          return result.error.issues.map((i) => i.message).join(', ');
        }
        return undefined;
      },
    },
  });

  const selectedFile = useStore(form.store, (s) => s.values.file);

  const validateAndSetFile = (f: File) => {
    if (
      f.type !== 'text/xml' &&
      f.type !== 'application/xml' &&
      !f.name.endsWith('.xml')
    ) {
      toast.error(t('timetable.invalidFileType'));
      return;
    }
    form.setFieldValue('file', f);
    setImportStatus('idle');
    setErrorMessage(null);
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files?.[0];
    if (f) {
      validateAndSetFile(f);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      form.reset();
      setImportStatus('idle');
      setErrorMessage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    onOpenChange(value);
  };

  const canImport =
    form.state.canSubmit && selectedFile && importStatus !== 'uploading';

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('timetable.import')}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  {t('timetable.importNameLabel')}
                </FieldLabel>
                <Input
                  autoComplete="off"
                  id={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('timetable.importNamePlaceholder')}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
                <p className="text-muted-foreground text-xs">
                  {t('timetable.importNameDescription')}
                </p>
              </Field>
            )}
          </form.Field>

          <form.Field name="validFrom">
            {(field) => (
              <Field>
                <FieldLabel>{t('timetable.validFromLabel')}</FieldLabel>
                <DatePicker
                  date={field.state.value}
                  onDateChange={(date) =>
                    field.handleChange(date ?? new Date())
                  }
                  placeholder={t('timetable.validFromPlaceholder')}
                />
                <FieldError errors={field.state.meta.errors} />
                <p className="text-muted-foreground text-xs">
                  {t('timetable.validFromDescription')}
                </p>
              </Field>
            )}
          </form.Field>

          <form.Field name="validTo">
            {(field) => (
              <Field>
                <FieldLabel>{t('timetable.validToLabel')}</FieldLabel>
                <DatePicker
                  date={field.state.value}
                  onDateChange={field.handleChange}
                  placeholder={t('timetable.validToPlaceholder')}
                />
                <FieldError errors={field.state.meta.errors} />
                <p className="text-muted-foreground text-xs">
                  {t('timetable.validToDescription')}
                </p>
              </Field>
            )}
          </form.Field>

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
              const f = e.dataTransfer.files[0];
              if (f) {
                validateAndSetFile(f);
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
                    form.setFieldValue('file', null);
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
              disabled={!canImport}
              onClick={() => form.handleSubmit()}
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
            <Button onClick={() => handleOpenChange(false)} variant="outline">
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
