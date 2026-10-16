import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import { DatePicker } from '@filcdev/ui/components/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import {
  type ReactFormExtendedApi,
  useForm,
  useStore,
} from '@tanstack/react-form';
import { Save, Trash, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKiosks } from '@/hooks/kiosks';
import {
  type AnnouncementItem,
  type AnnouncementPayload,
  useCohorts,
  useCreateAnnouncement,
  useDeleteAnnouncementImage,
  useUpdateAnnouncement,
  useUploadAnnouncementImage,
} from '@/hooks/news';
import { useHasPermission } from '@/hooks/use-has-permission';
import { getIntlLocale } from '@/utils/date-locale';
import { apiBaseUrl } from '@/utils/orpc';
import type { BaseDialogProps } from './admin.types';

type AnnouncementsDialogProps = BaseDialogProps & {
  item?: AnnouncementItem | null;
};

const startOfDay = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
};

const endOfDay = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
};

type AnnouncementFormValues = {
  cohortIds: string[];
  content: Array<{ content: string; type: string }>;
  highlighted: boolean;
  kioskOnly: boolean;
  kioskIds: string[];
  title: string;
  validFrom: Date;
  validUntil: Date;
};

const initialState = (
  item?: AnnouncementItem | null
): AnnouncementFormValues => {
  const defaultContent: Array<{ content: string; type: string }> = [
    {
      content: '',
      type: 'text',
    },
  ];

  return {
    cohortIds: item?.cohortIds ?? [],
    content: (Array.isArray(item?.content)
      ? item.content
      : defaultContent) as Array<{
      content: string;
      type: string;
    }>,
    highlighted: item?.highlighted ?? false,
    kioskIds: item?.kioskIds ?? [],
    kioskOnly: item?.kioskOnly ?? false,
    title: item?.title ?? '',
    validFrom: startOfDay(
      item?.validFrom ? new Date(item.validFrom) : new Date()
    ),
    validUntil: endOfDay(
      item?.validUntil ? new Date(item.validUntil) : new Date()
    ),
  };
};

const hasDateRange = (item?: AnnouncementItem | null): boolean => {
  if (!item) {
    return false;
  }
  return (
    startOfDay(new Date(item.validFrom)).getTime() !==
    startOfDay(new Date(item.validUntil)).getTime()
  );
};

type AnnouncementImageFieldProps = {
  /** Null while creating: there is no row to upload against yet. */
  announcementId: string | null;
  /** The file picked locally, uploaded together with the save. */
  file: File | null;
  imageKey: string | null;
  imageUrl: string | null;
  isRemoving: boolean;
  onFileChange: (file: File | null) => void;
  onRemove: (id: string) => void;
  upload: (file: File, id: string) => Promise<unknown>;
};

/**
 * The kiosk image field: preview, file picker, and — for an announcement that
 * already exists — an immediate upload and a remove button. A newly picked file
 * is previewed from a local object URL until the dialog saves it.
 */
function AnnouncementImageField({
  announcementId,
  file,
  imageKey,
  imageUrl,
  isRemoving,
  onFileChange,
  onRemove,
  upload,
}: AnnouncementImageFieldProps) {
  const { t } = useTranslation();
  const imageId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedPreview, setPickedPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!file) {
      setPickedPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPickedPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleUpload = async () => {
    if (!(announcementId && file)) {
      return;
    }

    setIsUploading(true);
    try {
      await upload(file, announcementId);
      onFileChange(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch {
      // The hook toasted the failure; keep the file picked for a retry.
    } finally {
      setIsUploading(false);
    }
  };

  const previewUrl = pickedPreview ?? imageUrl;

  return (
    <div className="space-y-2">
      <Label htmlFor={imageId}>{t('announcements.image')}</Label>
      {previewUrl && (
        <img
          alt=""
          className="max-h-48 w-full rounded-md object-contain"
          height={600}
          src={previewUrl}
          width={800}
        />
      )}
      <input
        accept="image/png,image/jpeg,image/webp"
        className="w-full cursor-pointer rounded-lg border-2 border-muted-foreground/25 border-dashed p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:font-medium file:text-secondary-foreground hover:border-muted-foreground/50"
        id={imageId}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        ref={inputRef}
        type="file"
      />
      {announcementId && (
        <div className="flex items-center gap-2">
          <Button
            disabled={!(file && !isUploading)}
            onClick={handleUpload}
            size="sm"
            type="button"
          >
            <Upload className="h-4 w-4" />
            {t('announcements.imageUpload')}
          </Button>
          {imageKey && (
            <Button
              disabled={isRemoving}
              onClick={() => onRemove(announcementId)}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Trash className="h-4 w-4" />
              {t('announcements.imageRemove')}
            </Button>
          )}
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        {t('announcements.imageHint')}
      </p>
      {!announcementId && (
        <p className="text-muted-foreground text-xs">
          {t('announcements.imageOnSave')}
        </p>
      )}
    </div>
  );
}

type AudiencePickerProps = {
  /** Shown when nothing is picked, i.e. the selection means "everyone". */
  allHint: string;
  allLabel: string;
  /** Shown when at least one entry is picked. */
  hint: string;
  idPrefix: string;
  items: { id: string; name: string }[];
  label: string;
  /** Clears the selection, which means "everyone". */
  onClear: () => void;
  onToggle: (id: string, checked: boolean) => void;
  selectedIds: string[];
};

/**
 * The cohort / kiosk picker: an "all" row that clears the selection, then one
 * checkbox per entry. Both pickers in this dialog are the same control.
 */
function AudiencePicker({
  allHint,
  allLabel,
  hint,
  idPrefix,
  items,
  label,
  onClear,
  onToggle,
  selectedIds,
}: AudiencePickerProps) {
  const allId = useId();
  const selectedIdSet = new Set(selectedIds);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedIds.length === 0}
            id={allId}
            onCheckedChange={(checked) => {
              if (checked) {
                onClear();
              }
            }}
          />
          <label
            className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor={allId}
          >
            {allLabel}
          </label>
        </div>
        {items.map((item) => (
          <div className="flex items-center gap-2" key={item.id}>
            <Checkbox
              checked={selectedIdSet.has(item.id)}
              id={`${idPrefix}-${item.id}`}
              onCheckedChange={(checked) => onToggle(item.id, Boolean(checked))}
            />
            <label
              className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              htmlFor={`${idPrefix}-${item.id}`}
            >
              {item.name}
            </label>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {selectedIds.length === 0 ? allHint : hint}
      </p>
    </div>
  );
}

/**
 * The dialog form's API, as handed to its field-group components. TanStack's
 * validator generics are invariant, so they are spelled out to match the
 * `useForm` call below.
 */
type AnnouncementFormApi = ReactFormExtendedApi<
  AnnouncementFormValues,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  unknown
>;

type AnnouncementFieldsProps = {
  contentId: string;
  dateRangeId: string;
  form: AnnouncementFormApi;
  locale: string;
  setShowDateRange: (show: boolean) => void;
  showDateRange: boolean;
};

/**
 * The announcement's text and validity: title, content, the start date, and —
 * when a range is enabled — the end date and its toggle.
 */
function AnnouncementFields({
  contentId,
  dateRangeId,
  form,
  locale,
  setShowDateRange,
  showDateRange,
}: AnnouncementFieldsProps) {
  const { t } = useTranslation();
  // The earliest selectable day, computed once per render rather than inside
  // the DatePicker prop so the value is stable across the field's renders.
  const today = startOfDay(new Date());

  return (
    <>
      <form.Field name="title">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>{t('announcements.titleLabel')}</Label>
            <Input
              id={field.name}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={t('announcements.titlePlaceholder')}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="content">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={contentId}>{t('announcements.content')}</Label>
            <textarea
              className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              id={contentId}
              onChange={(e) =>
                field.handleChange([{ content: e.target.value, type: 'text' }])
              }
              placeholder={t('announcements.contentPlaceholder')}
              value={field.state.value[0]?.content || ''}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="validFrom">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="validFrom">
              {showDateRange
                ? t('announcements.validFrom')
                : t('announcements.date')}
            </Label>
            <DatePicker
              date={field.state.value}
              disabledDays={{ before: today }}
              locale={locale}
              onDateChange={(date) => {
                const newFrom = startOfDay(date ?? new Date());
                field.handleChange(newFrom);
                if (form.getFieldValue('validUntil') < newFrom) {
                  form.setFieldValue('validUntil', endOfDay(newFrom));
                }
              }}
            />
          </div>
        )}
      </form.Field>

      {showDateRange && (
        <form.Field name="validUntil">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="validUntil">
                {t('announcements.validUntil')}
              </Label>
              <DatePicker
                date={field.state.value}
                disabledDays={{ before: form.getFieldValue('validFrom') }}
                locale={locale}
                onDateChange={(date) =>
                  field.handleChange(endOfDay(date ?? new Date()))
                }
              />
            </div>
          )}
        </form.Field>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          checked={showDateRange}
          id={dateRangeId}
          onCheckedChange={(checked) => {
            setShowDateRange(Boolean(checked));
            if (!checked) {
              form.setFieldValue(
                'validUntil',
                endOfDay(form.getFieldValue('validFrom'))
              );
            }
          }}
        />
        <label
          className="cursor-pointer font-medium text-sm leading-none"
          htmlFor={dateRangeId}
        >
          {t('announcements.setDateRange')}
        </label>
      </div>
    </>
  );
}

export function AnnouncementsDialog({
  item,
  onOpenChange,
  open,
}: AnnouncementsDialogProps) {
  const { i18n, t } = useTranslation();
  const close = () => onOpenChange(false);
  // The dialog closes itself after saving: a picked image has to be uploaded
  // with the row's id before it may go away.
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const uploadImage = useUploadAnnouncementImage();
  const removeImage = useDeleteAnnouncementImage();
  const { data: cohorts = [] } = useCohorts(open);
  const { data: session } = useSession();
  const canManageKiosks = useHasPermission(
    permissions.kiosksManage,
    session?.user?.permissions
  );
  const { data: kiosks = [] } = useKiosks(open && canManageKiosks);
  // The navigator kiosk has no news surface, so only TV boxes can be picked.
  const tvKiosks = kiosks.filter((kiosk) => kiosk.kind === 'tv');

  const formId = useId();
  const contentId = useId();
  const dateRangeId = useId();
  const highlightedId = useId();
  const kioskOnlyId = useId();

  const [showDateRange, setShowDateRange] = useState(() => hasDateRange(item));
  const [imageFile, setImageFile] = useState<File | null>(null);

  // An upload/removal answers with the row it produced, so the preview can
  // reflect it right away instead of waiting for the dialog to be reopened.
  const imageRow = uploadImage.data ?? removeImage.data ?? item;
  const imageKey = imageRow?.imageKey ?? null;
  const imageUrl = imageKey
    ? `${apiBaseUrl}/kiosk/news/${imageRow?.id}/image?v=${imageRow?.imageUpdatedAt}`
    : null;

  const form = useForm<
    AnnouncementFormValues,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    unknown
  >({
    defaultValues: initialState(item),
    onSubmit: async ({ value }) => {
      const payload = {
        cohortIds: value.cohortIds,
        content: value.content,
        highlighted: value.highlighted,
        kioskIds: value.kioskIds,
        kioskOnly: value.kioskOnly,
        title: value.title,
        validFrom: value.validFrom,
        validUntil: value.validUntil,
      } as AnnouncementPayload;

      try {
        let announcementId = item?.id ?? null;

        if (item) {
          await updateMutation.mutateAsync({ ...payload, id: item.id });
        } else {
          const created = await createMutation.mutateAsync(payload);
          announcementId = created.id;
        }

        // An image picked before the announcement existed rides along with
        // this save: uploading it needs the row's id.
        if (announcementId && imageFile) {
          await uploadImage.mutateAsync({
            file: imageFile,
            id: announcementId,
          });
        }

        close();
      } catch {
        // The hooks already toasted the failure; keep the dialog open so the
        // entered values and the picked file survive a retry.
      }
    },
  });

  const cohortIds = useStore(form.store, (state) => state.values.cohortIds);
  const kioskIds = useStore(form.store, (state) => state.values.kioskIds);

  const toggleCohort = (cohortId: string, checked: boolean) => {
    const current = form.getFieldValue('cohortIds');
    if (checked) {
      form.setFieldValue('cohortIds', [...current, cohortId]);
    } else {
      form.setFieldValue(
        'cohortIds',
        current.filter((id) => id !== cohortId)
      );
    }
  };

  const toggleKiosk = (kioskId: string, checked: boolean) => {
    const current = form.getFieldValue('kioskIds');
    if (checked) {
      form.setFieldValue('kioskIds', [...current, kioskId]);
    } else {
      form.setFieldValue(
        'kioskIds',
        current.filter((id) => id !== kioskId)
      );
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-2">
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>
              {item ? t('announcements.edit') : t('announcements.create')}
            </DialogTitle>
          </DialogHeader>

          <form
            className="mt-4 space-y-4"
            id={formId}
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <AnnouncementFields
              contentId={contentId}
              dateRangeId={dateRangeId}
              form={form}
              locale={getIntlLocale(i18n.language)}
              setShowDateRange={setShowDateRange}
              showDateRange={showDateRange}
            />

            <AudiencePicker
              allHint={t('announcements.everyoneHint')}
              allLabel={t('announcements.everyone')}
              hint={t('announcements.cohortsHint')}
              idPrefix="cohort"
              items={cohorts}
              label={t('announcements.cohorts')}
              onClear={() => form.setFieldValue('cohortIds', [])}
              onToggle={toggleCohort}
              selectedIds={cohortIds}
            />

            <form.Field name="highlighted">
              {(field) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={field.state.value}
                    id={highlightedId}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  <label
                    className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor={highlightedId}
                  >
                    {t('announcements.highlighted')}
                  </label>
                </div>
              )}
            </form.Field>

            <form.Field name="kioskOnly">
              {(field) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={field.state.value}
                    id={kioskOnlyId}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  <label
                    className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor={kioskOnlyId}
                  >
                    {t('announcements.kioskOnly')}
                  </label>
                </div>
              )}
            </form.Field>

            {canManageKiosks && (
              <AudiencePicker
                allHint={t('announcements.allKiosksHint')}
                allLabel={t('announcements.allKiosks')}
                hint={t('announcements.kiosksHint')}
                idPrefix="kiosk"
                items={tvKiosks}
                label={t('announcements.kiosks')}
                onClear={() => form.setFieldValue('kioskIds', [])}
                onToggle={toggleKiosk}
                selectedIds={kioskIds}
              />
            )}

            <AnnouncementImageField
              announcementId={item?.id ?? null}
              file={imageFile}
              imageKey={imageKey}
              imageUrl={imageUrl}
              isRemoving={removeImage.isPending}
              onFileChange={setImageFile}
              onRemove={(id) => removeImage.mutate({ id })}
              upload={(file, id) => uploadImage.mutateAsync({ file, id })}
            />
          </form>
        </div>

        <DialogFooter className="border-t p-4">
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {t('common.cancel')}
          </Button>
          <Button
            disabled={
              !form.state.canSubmit ||
              createMutation.isPending ||
              updateMutation.isPending
            }
            form={formId}
            type="submit"
          >
            <Save className="h-4 w-4" />
            {t('announcements.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
