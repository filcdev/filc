import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/utils';
import { getDateFnsLocale } from '@/utils/date-locale';

type DatePickerProps = {
  date?: Date;
  disabledDays?: Matcher | Matcher[];
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
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
}: DatePickerProps) {
  const { i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);

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
            variant={'outline'}
          >
            <CalendarIcon />
            {date ? (
              format(date, 'PPP', { locale })
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          autoFocus
          disabled={disabledDays}
          locale={locale}
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
