import { useForm, useStore } from '@tanstack/react-form';
import { Save } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  type AnnouncementItem,
  type AnnouncementPayload,
  type SystemMessageItem,
  type SystemMessagePayload,
  useCohorts,
  useCreateAnnouncement,
  useCreateSystemMessage,
  useUpdateAnnouncement,
  useUpdateSystemMessage,
} from '@/hooks/news';
import { newsItemSchema } from '@/utils/form-schemas';

import type { BaseDialogProps } from './admin.types';

type NewsItemLike = AnnouncementItem | SystemMessageItem;

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

const initialState = (item?: NewsItemLike | null) => {
  const defaultContent: Array<{ content: string; type: string }> = [
    { content: '', type: 'text' },
  ];

  return {
    cohortIds: item?.cohortIds ?? [],
    content: (Array.isArray(item?.content)
      ? item.content
      : defaultContent) as Array<{ content: string; type: string }>,
    title: item?.title ?? '',
    validFrom: startOfDay(
      item?.validFrom ? new Date(item.validFrom) : new Date()
    ),
    validUntil: endOfDay(
      item?.validUntil ? new Date(item.validUntil) : new Date()
    ),
  };
};

type NewsItemDialogProps = BaseDialogProps & {
  item?: NewsItemLike | null;
  mode: 'announcements' | 'system-messages';
};

export function NewsItemDialog({
  item,
  mode,
  onOpenChange,
  open,
}: NewsItemDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const createAnnouncement = useCreateAnnouncement({ onSaved: close });
  const updateAnnouncement = useUpdateAnnouncement({ onSaved: close });
  const createSystemMessage = useCreateSystemMessage({ onSaved: close });
  const updateSystemMessage = useUpdateSystemMessage({ onSaved: close });
  const { data: cohorts = [] } = useCohorts(open);

  const isAnnouncement = mode === 'announcements';

  const form = useForm({
    defaultValues: initialState(item),
    onSubmit: async ({ value }) => {
      if (isAnnouncement) {
        if (item) {
          await updateAnnouncement.mutateAsync({
            id: item.id,
            payload: value as AnnouncementPayload,
          });
        } else {
          await createAnnouncement.mutateAsync(value as AnnouncementPayload);
        }
      } else if (item) {
        await updateSystemMessage.mutateAsync({
          id: item.id,
          payload: value as SystemMessagePayload,
        });
      } else {
        await createSystemMessage.mutateAsync(value as SystemMessagePayload);
      }
    },
    validators: { onSubmit: newsItemSchema },
  });

  useEffect(() => {
    form.reset(initialState(item));
  }, [item, form.reset]);

  const cohortIds = useStore(form.store, (state) => state.values.cohortIds);

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

  const titleKey =
    mode === 'announcements' ? 'announcements' : 'systemMessages';
  const formId =
    mode === 'announcements' ? 'announcementForm' : 'systemMessageForm';

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-2">
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>
              {item ? t(`${titleKey}.edit`) : t(`${titleKey}.create`)}
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
            <form.Field name="title">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t(`${titleKey}.title`)}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={
                      mode === 'announcements'
                        ? 'Announcement title'
                        : t('systemMessages.titlePlaceholder')
                    }
                    value={field.state.value}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="content">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={`${field.name}-textarea`}>
                    {t(`${titleKey}.content`)}
                  </FieldLabel>
                  <Textarea
                    id={`${field.name}-textarea`}
                    onChange={(e) =>
                      field.handleChange([
                        { content: e.target.value, type: 'text' },
                      ])
                    }
                    placeholder={
                      mode === 'announcements'
                        ? 'Announcement content'
                        : t('systemMessages.contentPlaceholder')
                    }
                    value={field.state.value[0]?.content ?? ''}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="validFrom">
              {(field) => (
                <Field>
                  <FieldLabel>{t(`${titleKey}.validFrom`)}</FieldLabel>
                  <DatePicker
                    date={field.state.value}
                    onDateChange={(date) =>
                      field.handleChange(startOfDay(date ?? new Date()))
                    }
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="validUntil">
              {(field) => (
                <Field>
                  <FieldLabel>{t(`${titleKey}.validUntil`)}</FieldLabel>
                  <DatePicker
                    date={field.state.value}
                    onDateChange={(date) =>
                      field.handleChange(endOfDay(date ?? new Date()))
                    }
                  />
                </Field>
              )}
            </form.Field>

            <Field>
              <FieldLabel>{t(`${titleKey}.cohorts`)}</FieldLabel>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
                {cohorts.map((cohort) => (
                  <div className="flex items-center gap-2" key={cohort.id}>
                    <Checkbox
                      checked={cohortIds.includes(cohort.id)}
                      id={`cohort-${cohort.id}`}
                      onCheckedChange={(checked) =>
                        toggleCohort(cohort.id, Boolean(checked))
                      }
                    />
                    <label
                      className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      htmlFor={`cohort-${cohort.id}`}
                    >
                      {cohort.name}
                    </label>
                  </div>
                ))}
              </div>
            </Field>
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
          <Button disabled={!form.state.canSubmit} form={formId} type="submit">
            <Save className="h-4 w-4" />
            {t(`${titleKey}.save`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
