import { Button } from '@filcdev/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@filcdev/ui/components/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@filcdev/ui/components/popover';
import { cn } from '@filcdev/ui/lib/utils';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';

type FilterComboboxOption = { label: string; value: string };

type FilterComboboxProps = {
  /** Extra classes for the trigger, e.g. the width of the control. */
  className?: string;
  emptyMessage: string;
  /** Base id of the control; the popover content uses `${id}-content`. */
  id: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (value: string) => void;
  open: boolean;
  options: FilterComboboxOption[];
  /** Shown while nothing is selected, in place of the selected label. */
  placeholder: string;
  searchPlaceholder: string;
  selectedValue: string;
  size?: 'default' | 'sm';
};

/**
 * The class/teacher/room picker of the timetable filter bars: a trigger
 * showing the selection and a searchable list below it.
 */
export function FilterCombobox({
  className,
  emptyMessage,
  id,
  onOpenChange,
  onSelect,
  open,
  options,
  placeholder,
  searchPlaceholder,
  selectedValue,
  size = 'default',
}: FilterComboboxProps) {
  const contentId = `${id}-content`;
  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ??
    placeholder;

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-controls={contentId}
            aria-expanded={open}
            className={cn('h-9 justify-between', className)}
            id={id}
            role="combobox"
            size={size}
            variant="outline"
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent
        className="w-(--radix-popper-anchor-width) p-0"
        id={contentId}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => onSelect(option.value)}
                  value={option.label}
                >
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedValue === option.value
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
