import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/utils';

type ComboboxOption = {
  label: string;
  value: string;
};

type ComboboxProps = {
  className?: string;
  emptyMessage?: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
};

export function Combobox({
  className,
  emptyMessage = 'No results found.',
  onValueChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  value,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-muted-foreground',
              className
            )}
            variant="outline"
          >
            <span className="truncate">{selectedLabel ?? placeholder}</span>
            <ChevronsUpDown className="ml-1 size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-(--anchor-width) p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => {
                    onValueChange(option.value === value ? '' : option.value);
                    setOpen(false);
                  }}
                  value={option.label}
                >
                  {option.label}
                  <Check
                    className={cn(
                      'ml-auto size-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
