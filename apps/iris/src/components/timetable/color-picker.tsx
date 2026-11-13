import { Button } from '@filcdev/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@filcdev/ui/components/dropdown-menu';
import { cn } from '@filcdev/ui/lib/utils';
import { Palette } from 'lucide-react';

import { CLASS_COLORS } from './helpers';

type ColorPickerProps = {
  currentIndex?: number;
  onSelect: (index: number) => void;
};

/**
 * The subject-colour picker. The swatches are the same twelve slots the grid
 * uses (`CLASS_COLORS`), so a swatch always previews the chip it will paint —
 * including its tint under the current colour scheme or seasonal skin.
 */
export function ColorPicker({ currentIndex, onSelect }: ColorPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            size="sm"
            variant="ghost"
          />
        }
      >
        <Palette className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
        <div className="grid grid-cols-6 gap-1 p-1">
          {CLASS_COLORS.map((swatch, idx) => (
            <DropdownMenuItem
              aria-label={`${idx + 1}`}
              className={cn(
                'h-7 w-7 cursor-pointer rounded-md border-2 transition-all',
                swatch.bg,
                swatch.border,
                idx === currentIndex && 'ring-foreground ring-2 ring-offset-1'
              )}
              key={swatch.bg}
              onClick={() => onSelect(idx)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
