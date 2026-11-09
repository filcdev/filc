import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div
      className="relative w-full overflow-x-auto"
      data-slot="table-container"
    >
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        data-slot="table"
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return (
    <thead
      className={cn('[&_tr]:border-b', className)}
      data-slot="table-header"
      {...props}
    />
  );
}

function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0', className)}
      data-slot="table-body"
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className
      )}
      data-slot="table-footer"
      {...props}
    />
  );
}

function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className
      )}
      data-slot="table-row"
      {...props}
    />
  );
}

function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'text-foreground h-12 px-3 text-left align-middle font-medium whitespace-nowrap has-[[role=checkbox]]:pr-0',
        className
      )}
      data-slot="table-head"
      {...props}
    />
  );
}

function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      className={cn(
        'p-3 align-middle whitespace-nowrap has-[[role=checkbox]]:pr-0',
        className
      )}
      data-slot="table-cell"
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      data-slot="table-caption"
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
