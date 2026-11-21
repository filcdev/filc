import { Button } from '@filcdev/ui/components/button';
import { Calendar } from '@filcdev/ui/components/calendar';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@filcdev/ui/components/popover';
import { cn } from '@filcdev/ui/lib/utils';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocalizedDate } from '@/utils/date-locale';
import { getDayPickerLocaleConfig } from '@/utils/day-picker-locale';

export type DateTimePickerProps = {
  /** Renders the clear button that sets the value back to `null`. */
  clearable?: boolean;
  /** Set on the trigger, so an external `<Label htmlFor>` names the control. */
  id?: string;
  /** Gives the trigger the same invalid ring the inputs carry. */
  invalid?: boolean;
  onChange: (value: Date | null) => void;
  value: Date | null;
};

const pad = (value: number): string => String(value).padStart(2, '0');

/** `HH:mm`, the shape a native time input reads and writes. */
function toTimeInput(date: Date | null): string {
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '';
}

/**
 * The picked day keeps the clock the value already had, and the picked time
 * keeps the day: one control, one `Date`, at the minute precision the old
 * `datetime-local` field carried.
 */
function withDay(value: Date | null, day: Date): Date {
  const next = new Date(day);
  next.setHours(value?.getHours() ?? 0, value?.getMinutes() ?? 0, 0, 0);
  return next;
}

/** `null` when the time input is emptied, so the value is left untouched. */
function withTime(value: Date | null, time: string): Date | null {
  if (!time) {
    return null;
  }
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const next = new Date(value ?? Date.now());
  next.setHours(hours, minutes, 0, 0);
  return next;
}

/**
 * The house date picker's single-date form, plus the time in the same panel.
 * Base UI's popover keeps the tab order inside the panel (`trap-focus`), and
 * `PopoverClose` is what gives keyboard and screen-reader users the way out.
 */
export function DateTimePicker({
  clearable,
  id,
  invalid,
  onChange,
  value,
}: DateTimePickerProps) {
  const { i18n, t } = useTranslation();
  const timeId = useId();
  const [open, setOpen] = useState(false);
  const { locale, weekStartsOn } = getDayPickerLocaleConfig(i18n.language);

  const label = value
    ? formatLocalizedDate(value, i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : t('dateTimePicker.placeholder');

  return (
    <div className="flex items-center gap-2">
      <Popover modal="trap-focus" onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <Button
              aria-invalid={invalid || undefined}
              className={cn(
                'min-w-0 flex-1 justify-start text-left font-normal',
                !value && 'text-muted-foreground'
              )}
              id={id}
              translate="no"
              variant="outline"
            >
              <CalendarIcon />
              <span className="truncate">{label}</span>
            </Button>
          }
        />
        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100dvw-1rem)] gap-0 overflow-x-auto p-0"
          translate="no"
        >
          <Calendar
            autoFocus
            locale={locale}
            mode="single"
            onSelect={(day) => {
              if (day) {
                onChange(withDay(value, day));
              }
            }}
            selected={value ?? undefined}
            weekStartsOn={weekStartsOn}
          />
          <div className="flex items-end gap-2 border-t p-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor={timeId}>{t('dateTimePicker.time')}</Label>
              <Input
                id={timeId}
                lang={i18n.language}
                onChange={(event) => {
                  const next = withTime(value, event.target.value);
                  if (next) {
                    onChange(next);
                  }
                }}
                type="time"
                value={toTimeInput(value)}
              />
            </div>
            <PopoverClose render={<Button type="button" variant="outline" />}>
              {t('dateTimePicker.done')}
            </PopoverClose>
          </div>
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <Button
          aria-label={t('dateTimePicker.clear')}
          onClick={() => onChange(null)}
          size="icon"
          type="button"
          variant="outline"
        >
          <X />
        </Button>
      )}
    </div>
  );
}
