import {
  type ComponentType,
  lazy,
  type ReactNode,
  Suspense,
  useMemo,
} from 'react';

/**
 * A heavy island behind its own chunk: the module is fetched the first time the
 * island renders, not with the page that mounts it. That is what keeps three.js
 * and recharts out of a page's initial chunk when they only appear behind a
 * dialog.
 *
 * `load` has to be a stable reference (a module-level arrow), because the
 * `lazy` wrapper is only rebuilt when it changes.
 */
export const Lazy = <P extends object>({
  fallback = null,
  load,
  ...props
}: {
  fallback?: ReactNode;
  load: () => Promise<{ default: ComponentType<P> }>;
} & P) => {
  const Loaded = useMemo(() => lazy(load) as ComponentType<P>, [load]);
  return (
    <Suspense fallback={fallback}>
      {/* The rest-destructure widens `P`; the call site still passes exactly P. */}
      <Loaded {...(props as P)} />
    </Suspense>
  );
};
