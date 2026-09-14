import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@filcdev/ui/components/popover';
import { useState } from 'react';
import { useKioskTranslations } from '@/hooks/use-kiosk-translations';

type SearchableDropdownProps<T> = {
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  isLoading?: boolean;
  items: T[];
  onSelect: (item: T) => void;
  placeholder?: string;
  query?: string;
  selectedKey?: string;
  setQuery?: (value: string) => void;
  /** Label on the button that opens the list. */
  triggerLabel: string;
};

/**
 * Whether a press landed on the docked on-screen keyboard. Tapping a key is
 * the kiosk's only way to type, so it must not count as "outside" the popover.
 */
const isOnScreenKeyboardPress = (event: Event | undefined): boolean =>
  event?.target instanceof Element &&
  event.target.closest('[data-kiosk-keyboard]') !== null;

/**
 * A button that opens a searchable list. The open state belongs to the popover
 * rather than a focus trick, so the trigger is a real button and the list closes
 * as soon as a row is picked.
 */
export function SearchableDropdown<T>({
  getKey,
  getLabel,
  isLoading = false,
  items,
  onSelect,
  placeholder,
  query,
  selectedKey,
  setQuery,
  triggerLabel,
}: SearchableDropdownProps<T>) {
  const { t } = useKioskTranslations();
  const [open, setOpen] = useState(false);

  return (
    <Popover
      onOpenChange={(nextOpen, eventDetails) => {
        if (
          !nextOpen &&
          eventDetails.reason === 'outside-press' &&
          isOnScreenKeyboardPress(eventDetails.event)
        ) {
          eventDetails.cancel();
          return;
        }

        setOpen(nextOpen);
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button
            aria-expanded={open}
            className="h-9 justify-between"
            size="sm"
            variant="outline"
          >
            <span className="truncate">{triggerLabel}</span>
          </Button>
        }
      />

      <PopoverContent align="start" className="w-72 gap-0 p-2">
        {setQuery !== undefined && query !== undefined && (
          <Input
            autoFocus={true}
            className="mb-2"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder ?? t('ui.common.search_placeholder')}
            type="text"
            value={query}
          />
        )}

        <ul className="max-h-64 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground text-sm">
              {isLoading ? t('ui.common.loading') : t('ui.common.no_results')}
            </li>
          ) : (
            items.map((item) => (
              <li key={getKey(item)}>
                <Button
                  className="h-auto w-full justify-start py-2 font-normal"
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  type="button"
                  variant={selectedKey === getKey(item) ? 'secondary' : 'ghost'}
                >
                  {getLabel(item)}
                </Button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
