import type { ReactNode } from 'react';
import { cn } from '@/utils';

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
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-border border-dashed bg-card p-10 text-center',
        className
      )}
      data-slot="empty"
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      {title ? (
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      ) : null}
      {description ? (
        <p className="max-w-sm text-muted-foreground text-sm">{description}</p>
      ) : null}
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
