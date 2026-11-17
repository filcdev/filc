import type { SiteTheme } from '@filcdev/api/domains/theme';
import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Field, FieldLabel } from '@filcdev/ui/components/field';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { Spinner } from '@filcdev/ui/components/spinner';
import { useForm, useStore } from '@tanstack/react-form';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { BaseDialogProps } from '@/components/admin/admin.types';
import { THEMES } from '@/components/admin/theme-catalog';
import {
  type ThemeScheduleItem,
  useCreateThemeSchedule,
  useUpdateThemeSchedule,
} from '@/hooks/site-theme';
import { getIntlLocale } from '@/utils/date-locale';

/** A window is four month/day numbers plus the skin it selects. */
type ThemeScheduleFormValues = {
  theme: SiteTheme;
  endMonth: number;
  endDay: number;
  startMonth: number;
  startDay: number;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** Leap-free maximum each month can hold; 29 February stays representable. */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const daysInMonth = (month: number): number => DAYS_IN_MONTH[month - 1] ?? 31;

/**
 * Defaults for a new window: a one-day window starting today. Nothing in here
 * is random, so the dialog can seed `useForm` on mount and the parent's `key`
 * is what discards edits between openings.
 */
function toFormValues(
  item?: ThemeScheduleItem | null
): ThemeScheduleFormValues {
  if (item) {
    return {
      endDay: item.endDay,
      endMonth: item.endMonth,
      startDay: item.startDay,
      startMonth: item.startMonth,
      theme: item.theme,
    };
  }

  const today = new Date();

  return {
    endDay: today.getDate(),
    endMonth: today.getMonth() + 1,
    startDay: today.getDate(),
    startMonth: today.getMonth() + 1,
    theme: 'default',
  };
}

type ThemeScheduleDialogProps = BaseDialogProps & {
  item?: ThemeScheduleItem | null;
};

/**
 * Create or edit one annual window of the theme schedule. The dialog owns its
 * mutations and closes itself through `onSaved`, and the parent remounts it
 * with a `key` per opening so `useForm` seeds from `defaultValues` once.
 */
export function ThemeScheduleDialog({
  item,
  onOpenChange,
  open,
}: ThemeScheduleDialogProps) {
  const { i18n, t } = useTranslation();
  const close = () => onOpenChange(false);
  const createSchedule = useCreateThemeSchedule({ onSaved: close });
  const updateSchedule = useUpdateThemeSchedule({ onSaved: close });

  const defaultValues = useMemo(() => toFormValues(item), [item]);
  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      if (item) {
        updateSchedule.mutate({ ...value, id: item.id });
        return;
      }
      createSchedule.mutate(value);
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const isPending = createSchedule.isPending || updateSchedule.isPending;

  const locale = getIntlLocale(i18n.language);
  const monthName = (month: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(
      new Date(2024, month - 1, 1)
    );

  const monthItems = MONTHS.map((month) => ({
    label: monthName(month),
    value: String(month),
  }));
  const dayItems = (month: number) =>
    Array.from({ length: daysInMonth(month) }, (_, index) => ({
      label: String(index + 1),
      value: String(index + 1),
    }));

  const themeItems = THEMES.map((option) => ({
    label: t(option.nameKey),
    value: option.id,
  }));

  /** A shorter month must not leave the day select on an impossible day. */
  const changeMonth = (
    field: 'startMonth' | 'endMonth',
    dayField: 'startDay' | 'endDay',
    month: number
  ) => {
    form.setFieldValue(field, month);
    const max = daysInMonth(month);
    if (form.getFieldValue(dayField) > max) {
      form.setFieldValue(dayField, max);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item ? t('siteTheme.schedule.edit') : t('siteTheme.schedule.add')}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="theme">
            {(field) => (
              <Field>
                <FieldLabel>{t('siteTheme.schedule.theme')}</FieldLabel>
                <Select
                  items={themeItems}
                  onValueChange={(value) =>
                    field.handleChange((value ?? 'default') as SiteTheme)
                  }
                  value={field.state.value}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('siteTheme.schedule.theme')} />
                  </SelectTrigger>
                </Select>
              </Field>
            )}
          </form.Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="font-medium text-sm">
                {t('siteTheme.schedule.start')}
              </p>
              <form.Field name="startMonth">
                {(field) => (
                  <Select
                    items={monthItems}
                    onValueChange={(value) =>
                      changeMonth(
                        'startMonth',
                        'startDay',
                        Number(value ?? values.startMonth)
                      )
                    }
                    value={String(field.state.value)}
                  >
                    <SelectTrigger
                      aria-label={t('siteTheme.schedule.startMonth')}
                      className="w-full"
                    >
                      <SelectValue
                        placeholder={t('siteTheme.schedule.startMonth')}
                      />
                    </SelectTrigger>
                  </Select>
                )}
              </form.Field>
              <form.Field name="startDay">
                {(field) => (
                  <Select
                    items={dayItems(values.startMonth)}
                    onValueChange={(value) =>
                      field.handleChange(Number(value ?? values.startDay))
                    }
                    value={String(field.state.value)}
                  >
                    <SelectTrigger
                      aria-label={t('siteTheme.schedule.startDay')}
                      className="w-full"
                    >
                      <SelectValue
                        placeholder={t('siteTheme.schedule.startDay')}
                      />
                    </SelectTrigger>
                  </Select>
                )}
              </form.Field>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-sm">
                {t('siteTheme.schedule.end')}
              </p>
              <form.Field name="endMonth">
                {(field) => (
                  <Select
                    items={monthItems}
                    onValueChange={(value) =>
                      changeMonth(
                        'endMonth',
                        'endDay',
                        Number(value ?? values.endMonth)
                      )
                    }
                    value={String(field.state.value)}
                  >
                    <SelectTrigger
                      aria-label={t('siteTheme.schedule.endMonth')}
                      className="w-full"
                    >
                      <SelectValue
                        placeholder={t('siteTheme.schedule.endMonth')}
                      />
                    </SelectTrigger>
                  </Select>
                )}
              </form.Field>
              <form.Field name="endDay">
                {(field) => (
                  <Select
                    items={dayItems(values.endMonth)}
                    onValueChange={(value) =>
                      field.handleChange(Number(value ?? values.endDay))
                    }
                    value={String(field.state.value)}
                  >
                    <SelectTrigger
                      aria-label={t('siteTheme.schedule.endDay')}
                      className="w-full"
                    >
                      <SelectValue
                        placeholder={t('siteTheme.schedule.endDay')}
                      />
                    </SelectTrigger>
                  </Select>
                )}
              </form.Field>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            {t('siteTheme.schedule.hint')}
          </p>

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={isPending} type="submit">
              {isPending && <Spinner className="mr-2 h-4 w-4" />}
              {t('siteTheme.schedule.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
