import type { InferRequestType, InferResponseType } from 'hono/client';
import { Save } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
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
import type { api } from '@/utils/hc';

type AnnouncementApiResponse = InferResponseType<
  typeof api.news.announcements.$get
>;
type AnnouncementItem = NonNullable<AnnouncementApiResponse['data']>[number];

type CohortApiResponse = InferResponseType<typeof api.cohort.index.$get>;
type Cohort = NonNullable<CohortApiResponse['data']>[number];

type AnnouncementPayload = InferRequestType<
  typeof api.news.announcements.$post
>['json'];

type AnnouncementDialogProps = {
  cohorts: Cohort[];
  isSubmitting: boolean;
  item?: AnnouncementItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: AnnouncementPayload) => Promise<void>;
  open: boolean;
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

const initialState = (item?: AnnouncementItem | null) => {
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

const hasDateRange = (item?: AnnouncementItem | null): boolean => {
  if (!item) {
    return false;
  }
  return (
    startOfDay(new Date(item.validFrom)).getTime() !==
    startOfDay(new Date(item.validUntil)).getTime()
  );
};

export function AnnouncementsDialog({
  cohorts,
  isSubmitting,
  item,
  onOpenChange,
  onSubmit,
  open,
}: AnnouncementDialogProps) {
  const { t } = useTranslation();
  const [formState, setFormState] = useState(initialState(item));
  const [showDateRange, setShowDateRange] = useState(() => hasDateRange(item));

  useEffect(() => {
    if (open) {
      setFormState(initialState(item));
      setShowDateRange(hasDateRange(item));
    }
  }, [open, item]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit({
      cohortIds: formState.cohortIds,
      content: formState.content,
      title: formState.title,
      validFrom: formState.validFrom,
      validUntil: formState.validUntil,
    });
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
            id="announcementForm"
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <Label htmlFor="title">{t('announcements.title')}</Label>
              <Input
                id="title"
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder={t('announcements.titlePlaceholder')}
                value={formState.title}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">{t('announcements.content')}</Label>
              <textarea
                className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                id="content"
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    content: [{ content: e.target.value, type: 'text' }],
                  }))
                }
                placeholder={t('announcements.contentPlaceholder')}
                value={formState.content[0]?.content || ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="validFrom">
                {showDateRange
                  ? t('announcements.validFrom')
                  : t('announcements.date')}
              </Label>
              <DatePicker
                date={formState.validFrom}
                disabledDays={{ before: startOfDay(new Date()) }}
                onDateChange={(date) => {
                  const newFrom = startOfDay(date ?? new Date());
                  setFormState((prev) => ({
                    ...prev,
                    validFrom: newFrom,
                    validUntil:
                      prev.validUntil < newFrom
                        ? endOfDay(newFrom)
                        : prev.validUntil,
                  }));
                }}
              />
            </div>

            {showDateRange && (
              <div className="space-y-2">
                <Label htmlFor="validUntil">
                  {t('announcements.validUntil')}
                </Label>
                <DatePicker
                  date={formState.validUntil}
                  disabledDays={{ before: formState.validFrom }}
                  onDateChange={(date) =>
                    setFormState((prev) => ({
                      ...prev,
                      validUntil: endOfDay(date ?? new Date()),
                    }))
                  }
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                checked={showDateRange}
                id="setDateRange"
                onCheckedChange={(checked) => {
                  setShowDateRange(!!checked);
                  if (!checked) {
                    setFormState((prev) => ({
                      ...prev,
                      validUntil: endOfDay(prev.validFrom),
                    }));
                  }
                }}
              />
              <label
                className="cursor-pointer font-medium text-sm leading-none"
                htmlFor="setDateRange"
              >
                {t('announcements.setDateRange')}
              </label>
            </div>

            <div className="space-y-2">
              <Label>{t('announcements.cohorts')}</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={formState.cohortIds.length === 0}
                    id="cohort-everyone"
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormState((prev) => ({ ...prev, cohortIds: [] }));
                      }
                    }}
                  />
                  <label
                    className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor="cohort-everyone"
                  >
                    {t('announcements.everyone')}
                  </label>
                </div>
                {cohorts.map((cohort) => (
                  <div className="flex items-center gap-2" key={cohort.id}>
                    <Checkbox
                      checked={formState.cohortIds.includes(cohort.id)}
                      id={`cohort-${cohort.id}`}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormState((prev) => ({
                            ...prev,
                            cohortIds: [...prev.cohortIds, cohort.id],
                          }));
                        } else {
                          setFormState((prev) => ({
                            ...prev,
                            cohortIds: prev.cohortIds.filter(
                              (id) => id !== cohort.id
                            ),
                          }));
                        }
                      }}
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
              <p className="text-muted-foreground text-xs">
                {formState.cohortIds.length === 0
                  ? t('announcements.everyoneHint')
                  : t('announcements.cohortsHint')}
              </p>
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
          <Button disabled={isSubmitting} form="announcementForm" type="submit">
            <Save className="h-4 w-4" />
            {t('announcements.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
