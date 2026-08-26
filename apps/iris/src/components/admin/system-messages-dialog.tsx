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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type SystemMessageItem,
  type SystemMessagePayload,
  useCohorts,
  useCreateSystemMessage,
  useUpdateSystemMessage,
} from '@/hooks/news';
import type { BaseDialogProps } from './admin.types';

type SystemMessagesDialogProps = BaseDialogProps & {
  item?: SystemMessageItem | null;
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

type SystemMessageFormValues = {
  cohortIds: string[];
  content: Array<{ content: string; type: string }>;
  title: string;
  validFrom: Date;
  validUntil: Date;
};

const initialState = (
  item?: SystemMessageItem | null
): SystemMessageFormValues => {
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
    title: item?.title ?? '',
    validFrom: startOfDay(
      item?.validFrom ? new Date(item.validFrom) : new Date()
    ),
    validUntil: endOfDay(
      item?.validUntil ? new Date(item.validUntil) : new Date()
    ),
  };
};

export function SystemMessagesDialog({
  item,
  onOpenChange,
  open,
}: SystemMessagesDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const createMutation = useCreateSystemMessage({ onSaved: close });
  const updateMutation = useUpdateSystemMessage({ onSaved: close });
  const { data: cohorts = [] } = useCohorts(open);

  const form = useForm({
    defaultValues: initialState(item),
    onSubmit: async ({ value }) => {
      const payload = {
        cohortIds: value.cohortIds,
        content: value.content,
        title: value.title,
        validFrom: value.validFrom,
        validUntil: value.validUntil,
      } as SystemMessagePayload;
      if (item) {
        await updateMutation.mutateAsync({ id: item.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    },
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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-2">
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>
              {item ? t('systemMessages.edit') : t('systemMessages.create')}
            </DialogTitle>
          </DialogHeader>

          <form
            className="mt-4 space-y-4"
            id="systemMessageForm"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.Field name="title">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    {t('systemMessages.title')}
                  </Label>
                  <Input
                    id={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('systemMessages.titlePlaceholder')}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="content">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="content">{t('systemMessages.content')}</Label>
                  <textarea
                    className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    id="content"
                    onChange={(e) =>
                      field.handleChange([
                        { content: e.target.value, type: 'text' },
                      ])
                    }
                    placeholder={t('systemMessages.contentPlaceholder')}
                    value={field.state.value[0]?.content || ''}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="validFrom">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="validFrom">
                    {t('systemMessages.validFrom')}
                  </Label>
                  <DatePicker
                    date={field.state.value}
                    onDateChange={(date) =>
                      field.handleChange(startOfDay(date ?? new Date()))
                    }
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="validUntil">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="validUntil">
                    {t('systemMessages.validUntil')}
                  </Label>
                  <DatePicker
                    date={field.state.value}
                    onDateChange={(date) =>
                      field.handleChange(endOfDay(date ?? new Date()))
                    }
                  />
                </div>
              )}
            </form.Field>

            <div className="space-y-2">
              <Label>{t('systemMessages.cohorts')}</Label>
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
            </div>
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
            form="systemMessageForm"
            type="submit"
          >
            <Save className="h-4 w-4" />
            {t('systemMessages.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
