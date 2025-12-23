import type { ComponentProps } from 'react';
import { cn } from '@/utils';

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-muted', className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
