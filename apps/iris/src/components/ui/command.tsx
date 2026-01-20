import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { cn } from '@/utils';

function Command({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        'flex size-full flex-col overflow-hidden rounded-4xl bg-popover p-1 text-popover-foreground',
        className
      )}
      data-slot="command"
      {...props}
    />
  );
}

function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<ComponentProps<typeof Dialog>, 'children'> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn('overflow-hidden rounded-4xl! p-0', className)}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="p-1 pb-0" data-slot="command-input-wrapper">
      <InputGroup className="h-9 bg-input/30">
        <CommandPrimitive.Input
          className={cn(
            'w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          data-slot="command-input"
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function CommandList({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn(
        'no-scrollbar max-h-72 scroll-py-1 overflow-y-auto overflow-x-hidden outline-none',
        className
      )}
      data-slot="command-list"
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn('py-6 text-center text-sm', className)}
      data-slot="command-empty"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        'overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:text-xs',
        className
      )}
      data-slot="command-group"
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn('my-1 h-px bg-border/50', className)}
      data-slot="command-separator"
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "group/command-item relative flex cursor-default select-none items-center gap-2 in-data-[slot=dialog-content]:rounded-2xl rounded-lg px-3 py-2 text-sm outline-hidden data-[disabled=true]:pointer-events-none data-selected:bg-muted data-selected:text-foreground data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-selected:*:[svg]:text-foreground",
        className
      )}
      data-slot="command-item"
      {...props}
    >
      {children}
    </CommandPrimitive.Item>
  );
}

function CommandShortcut({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'ml-auto text-muted-foreground text-xs tracking-widest group-data-selected/command-item:text-foreground',
        className
      )}
      data-slot="command-shortcut"
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
