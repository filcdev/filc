import { Calendar as CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { enUS } from 'react-day-picker/locale/en-US';
import { hu } from 'react-day-picker/locale/hu';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

type DatePickerProps = {
  date?: Date;
  disabledDays?: Matcher | Matcher[];
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Visible heading rendered at the top of the calendar popover. */
  title?: string;
  /** BCP-47 tag used for the month names and the trigger label, e.g. `hu-HU`. */
  locale: string;
};

// Indexed by JS weekday (Sunday first), so `getDay()` maps directly.
const HUNGARIAN_WEEKDAYS = ['Va', 'Hé', 'Ke', 'Sze', 'Csü', 'Pé', 'Szo'];

const formatHungarianWeekday = (weekday: Date): string =>
  HUNGARIAN_WEEKDAYS[weekday.getDay()] ?? '';

function toLocalNoon(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0
  );
}

export function DatePicker({
  date,
  disabledDays,
  onDateChange,
  placeholder = 'Pick a date',
  disabled = false,
  title,
  locale,
}: DatePickerProps) {
  const hungarian = locale.toLowerCase().startsWith('hu');
  const dayPickerLocale = hungarian ? hu : enUS;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              'w-full min-w-0 justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
            disabled={disabled}
            translate="no"
            variant={'outline'}
          >
            <CalendarIcon className="shrink-0" />
            {date ? (
              <span className="truncate">
                {new Intl.DateTimeFormat(locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(date)}
              </span>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-auto max-w-[calc(100vw-2rem)] p-0"
        translate="no"
      >
        {title ? (
          <div className="border-b px-3 pt-3 pb-2 font-medium text-sm">
            {title}
          </div>
        ) : null}
        <Calendar
          autoFocus
          disabled={disabledDays}
          formatters={
            hungarian
              ? { formatWeekdayName: formatHungarianWeekday }
              : undefined
          }
          locale={dayPickerLocale}
          mode="single"
          onSelect={(selectedDate) => {
            onDateChange?.(
              selectedDate ? toLocalNoon(selectedDate) : undefined
            );
          }}
          required={false}
          selected={date}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  );
}
