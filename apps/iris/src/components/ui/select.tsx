import { Select as SelectPrimitive } from '@base-ui-components/react/select';
import {
  FaCheck as CheckIcon,
  FaChevronDown as ChevronDownIcon,
  FaChevronUp as ChevronUpIcon,
} from 'react-icons/fa6';

import { cn } from '@/utils/index';

const Select = SelectPrimitive.Root;

function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  placeholder,
  ...props
}: SelectPrimitive.Value.Props & {
  placeholder?: string;
}) {
  if (!placeholder) {
    return <SelectPrimitive.Value data-slot="select-value" {...props} />;
  }

  return (
    <SelectPrimitive.Value
      render={(_, { value }) => {
        if (value) {
          return <SelectPrimitive.Value data-slot="select-value" {...props} />;
        }

        // Placeholder
        return (
          <span className="text-muted-foreground" data-slot="select-value">
            {placeholder}
          </span>
        );
      }}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default';
}) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex w-fit items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[size=default]:h-9 data-[size=sm]:h-8 data-[placeholder]:text-muted-foreground *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:hover:bg-input/50 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-size={size}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon className="size-4 opacity-50" />}
      />
    </SelectPrimitive.Trigger>
  );
}

function SelectPositioner({
  className,
  ...props
}: SelectPrimitive.Positioner.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        alignItemWithTrigger={false}
        className={cn('z-50', className)}
        data-slot="select-positioner"
        sideOffset={5}
        {...props}
      />
    </SelectPrimitive.Portal>
  );
}

function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <>
      <SelectScrollUpButton />
      <SelectPrimitive.Popup
        className={cn(
          'data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[closed]:animate-out data-[open]:animate-in',
          className
        )}
        data-slot="select-content"
        {...props}
      >
        {children}
      </SelectPrimitive.Popup>
      <SelectScrollDownButton />
    </>
  );
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      className={cn('px-2 py-1.5 text-muted-foreground text-xs', className)}
      data-slot="select-label"
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      data-slot="select-item"
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      className={cn('-mx-1 pointer-events-none my-1 h-px bg-border', className)}
      data-slot="select-separator"
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: SelectPrimitive.ScrollUpArrow.Props) {
  return (
    <SelectPrimitive.ScrollUpArrow
      className={cn(
        'z-51 flex h-6 w-full cursor-default items-center justify-center border bg-popover text-center text-md data-[direction=up]:rounded-t-md data-[direction=down]:rounded-b-md data-[direction=down]:border-t-0 data-[direction=up]:border-b-0',
        "data-[direction=down]:before:-bottom-full before:absolute before:left-0 before:h-full before:w-full before:content-[''] data-[direction=down]:bottom-0 data-[direction=up]:before:top-full",
        className
      )}
      data-slot="select-scroll-up-button"
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}
function SelectScrollDownButton({
  className,
  ...props
}: SelectPrimitive.ScrollDownArrow.Props) {
  return (
    <SelectPrimitive.ScrollDownArrow
      className={cn(
        'z-51 flex h-6 w-full cursor-default items-center justify-center border bg-popover text-center text-md data-[direction=up]:rounded-t-md data-[direction=down]:rounded-b-md data-[direction=down]:border-t-0 data-[direction=up]:border-b-0',
        "data-[direction=down]:before:-bottom-full before:absolute before:left-0 before:h-full before:w-full before:content-[''] data-[direction=down]:bottom-0 data-[direction=up]:before:top-full",
        className
      )}
      data-slot="select-scroll-down-button"
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectPositioner,
};
