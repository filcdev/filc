import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils';

/** 12-color rainbow palette matching ACCENT_COLORS in helpers.ts */
const COLOR_SWATCHES = [
  { bg: 'bg-blue-500', label: 'Blue' },
  { bg: 'bg-emerald-500', label: 'Emerald' },
  { bg: 'bg-amber-500', label: 'Amber' },
  { bg: 'bg-purple-500', label: 'Purple' },
  { bg: 'bg-rose-500', label: 'Rose' },
  { bg: 'bg-cyan-500', label: 'Cyan' },
  { bg: 'bg-teal-500', label: 'Teal' },
  { bg: 'bg-orange-500', label: 'Orange' },
  { bg: 'bg-indigo-500', label: 'Indigo' },
  { bg: 'bg-pink-500', label: 'Pink' },
  { bg: 'bg-lime-500', label: 'Lime' },
  { bg: 'bg-sky-500', label: 'Sky' },
] as const;

type ColorPickerProps = {
  currentIndex?: number;
  onSelect: (index: number) => void;
};

export function ColorPicker({ currentIndex, onSelect }: ColorPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            size="sm"
            variant="ghost"
          />
        }
      >
        <Palette className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
        <div className="grid grid-cols-6 gap-1 p-1">
          {COLOR_SWATCHES.map((swatch, idx) => (
            <DropdownMenuItem
              className={cn(
                'h-7 w-7 cursor-pointer rounded-md transition-all',
                swatch.bg,
                idx === currentIndex && 'ring-2 ring-foreground ring-offset-1'
              )}
              key={swatch.label}
              onClick={() => onSelect(idx)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
