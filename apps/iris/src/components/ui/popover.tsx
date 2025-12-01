import { Popover as PopoverPrimitive } from '@base-ui-components/react/popover';

import { cn } from '@/utils/index';

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverPositioner({
  sideOffset = 4,
  portal,
  className,
  ...props
}: PopoverPrimitive.Positioner.Props & {
  portal?: PopoverPrimitive.Portal.Props;
}) {
  return (
    <PopoverPrimitive.Portal {...portal}>
      <PopoverPrimitive.Positioner
        className={cn('z-50', className)}
        data-slot="popover-positioner"
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverContent({ className, ...props }: PopoverPrimitive.Popup.Props) {
  return (
    <PopoverPrimitive.Popup
      className={cn(
        'data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[closed]:animate-out data-[open]:animate-in',
        className
      )}
      data-slot="popover-content"
      {...props}
    />
  );
}

function PopoverAnchor({ ...props }: PopoverPrimitive.Arrow.Props) {
  return <PopoverPrimitive.Arrow data-slot="popover-anchor" {...props} />;
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverPositioner,
};
