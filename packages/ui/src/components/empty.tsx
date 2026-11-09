import type { ReactNode } from 'react';

import { cn } from '../lib/utils';

type EmptyProps = {
  className?: string;
  /** An icon (e.g. `lucide-react`) shown at the top. */
  icon?: ReactNode;
  /** Primary heading. */
  title?: ReactNode;
  /** Supporting copy. */
  description?: ReactNode;
  /** Optional action (buttons, links). */
  children?: ReactNode;
};

/**
 * A centred empty-state placeholder, used when a list/grid has no data at all
 * (e.g. a timetable selection with no lessons for the week).
 */
export function Empty({
  className,
  description,
  icon,
  title,
  children,
}: EmptyProps) {
  return (
    <div
      className={cn(
        'border-border bg-card flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center',
        className
      )}
      data-slot="empty"
    >
      {icon ? (
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          {icon}
        </div>
      ) : null}
      {title ? (
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
      ) : null}
      {description ? (
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      ) : null}
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
