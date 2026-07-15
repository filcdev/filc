import dayjs from 'dayjs';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/utils/index';

export type DateRangeValue = {
  from?: Date;
  to?: Date;
};

type DateRangePickerProps = {
  onChange: (range: DateRangeValue) => void;
  value: DateRangeValue;
};

export function DateRangePicker({ onChange, value }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const getRangeLabel = () => {
    if (!value.from) {
      return 'Date range';
    }
    if (!value.to) {
      return dayjs(value.from).format('YYYY-MM-DD');
    }
    return `${dayjs(value.from).format('YYYY-MM-DD')} - ${dayjs(value.to).format('YYYY-MM-DD')}`;
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              'w-full justify-start text-left font-normal sm:w-auto',
              !value.from && 'text-muted-foreground'
            )}
            variant="outline"
          >
            <CalendarIcon />
            <span>{getRangeLabel()}</span>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          autoFocus
          mode="range"
          numberOfMonths={2}
          onSelect={(range) => {
            onChange({
              ...(range?.from && { from: range.from }),
              ...(range?.to && { to: range.to }),
            });
            if (range?.from && range?.to) {
              setOpen(false);
            }
          }}
          selected={{ from: value.from, to: value.to }}
        />
      </PopoverContent>
    </Popover>
  );
}
