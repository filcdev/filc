import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

/**
 * A segmented control: one track, one active segment. Built on Base UI's
 * toggle group so a single-selection group is a real radio group for keyboard
 * and screen-reader users (`aria-pressed`, arrow-key roving focus) instead of a
 * row of buttons that merely look selected.
 *
 * `ToggleGroup` is the track; put `ToggleGroupItem`s inside it.
 */
function ToggleGroup({
  className,
  orientation = 'horizontal',
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive>) {
  return (
    <ToggleGroupPrimitive
      className={cn(
        'inline-flex items-center gap-0.5 rounded-4xl border border-border bg-input/30 p-0.5',
        'data-[orientation=vertical]:flex-col data-[orientation=vertical]:rounded-2xl',
        className
      )}
      data-slot="toggle-group"
      orientation={orientation}
      {...props}
    />
  );
}

const toggleGroupItemVariants = cva(
  "inline-flex h-8 min-w-0 flex-1 cursor-pointer select-none items-center justify-center gap-1.5 truncate rounded-4xl px-3 font-medium text-sm outline-hidden transition-colors sm:flex-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      tone: 'default',
    },
    variants: {
      tone: {
        default:
          'text-muted-foreground hover:bg-muted hover:text-foreground data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-sm',
        // A/B keep a colour cue so the two week types stay recognisable, but as
        // a tinted segment rather than a saturated fill — the control sits in a
        // toolbar, not in the timetable it labels. The tints match the week
        // badges the grid uses.
        weekA:
          'text-muted-foreground hover:bg-muted hover:text-foreground data-pressed:bg-blue-500/15 data-pressed:text-blue-700 data-pressed:shadow-sm dark:data-pressed:text-blue-300',
        weekB:
          'text-muted-foreground hover:bg-muted hover:text-foreground data-pressed:bg-violet-500/15 data-pressed:text-violet-700 data-pressed:shadow-sm dark:data-pressed:text-violet-300',
      },
    },
  }
);

function ToggleGroupItem({
  className,
  tone,
  ...props
}: ComponentProps<typeof TogglePrimitive> &
  VariantProps<typeof toggleGroupItemVariants>) {
  return (
    <TogglePrimitive
      className={cn(toggleGroupItemVariants({ tone }), className)}
      data-slot="toggle-group-item"
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem, toggleGroupItemVariants };
