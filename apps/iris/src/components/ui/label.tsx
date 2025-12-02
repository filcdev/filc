import type { ComponentProps } from 'react';
import { cn } from '@/utils/index';

function Label({ className, htmlFor, ...props }: ComponentProps<'label'>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: this is a wrapper component
    <label
      className={cn(
        'flex select-none items-center gap-2 font-medium text-muted-foreground text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-[[data-disabled]]:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        className
      )}
      data-slot="label"
      htmlFor={htmlFor}
      {...props}
    />
  );
}

export { Label };
