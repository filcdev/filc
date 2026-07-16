import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

type QueryBoundaryProps<T> = {
  /** The React Query result (or any object with isLoading/isError/error). */
  query: { error?: unknown; isError: boolean; isLoading: boolean };
  /** Rendered while loading. Defaults to a full-width skeleton. */
  loading?: ReactNode;
  /** Rendered on error. Receives the error message. */
  error?: (message: string) => ReactNode;
  /** Rendered with the successfully loaded data. */
  children: (data: T) => ReactNode;
  /** When provided, only renders children if data is truthy. */
  data?: T;
};

/**
 * Removes the repeated loading/error/data `if` triplet from pages and
 * components. Usage:
 *
 *   <QueryBoundary query={q} data={q.data}>
 *     {(data) => <Table rows={data} />}
 *   </QueryBoundary>
 */
export function QueryBoundary<T>({
  data,
  error,
  loading,
  query,
  children,
}: QueryBoundaryProps<T>) {
  if (query.isLoading) {
    return <>{loading ?? <Skeleton className="h-64 w-full" />}</>;
  }

  if (query.isError) {
    const message =
      query.error instanceof Error ? query.error.message : 'An error occurred';
    return (
      <>
        {error?.(message) ?? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </>
    );
  }

  if (data === undefined) {
    return <>{loading ?? <Skeleton className="h-64 w-full" />}</>;
  }

  return <>{children(data)}</>;
}
