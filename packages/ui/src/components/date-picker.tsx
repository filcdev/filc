import { Calendar as CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
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
  /** BCP-47 tag used for the month names and the trigger label, e.g. `hu-HU`. */
  locale: string;
};

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
  locale,
}: DatePickerProps) {
  const dayPickerLocale = { code: locale } as const;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
            disabled={disabled}
            translate="no"
            variant={'outline'}
          >
            <CalendarIcon />
            {date ? (
              new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(date)
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0" translate="no">
        <Calendar
          autoFocus
          disabled={disabledDays}
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
