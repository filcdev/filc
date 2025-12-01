import { format } from 'date-fns';
import { FaCalendar } from 'react-icons/fa6';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverPositioner,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/utils';

type DatePickerProps = {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function DatePicker({
  date,
  onDateChange,
  placeholder = 'Pick a date',
  disabled = false,
}: DatePickerProps) {
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
            <FaCalendar className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : <span>{placeholder}</span>}
          </Button>
        }
      />
      <PopoverPositioner align="start">
        <PopoverContent className="w-auto p-0">
          <Calendar
            autoFocus
            mode="single"
            required={false}
            selected={date}
            {...(onDateChange && { onSelect: onDateChange })}
          />
        </PopoverContent>
      </PopoverPositioner>
    </Popover>
  );
}
