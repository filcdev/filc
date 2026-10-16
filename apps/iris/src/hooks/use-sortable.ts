import { useCallback, useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export type AriaSortState = 'ascending' | 'descending' | 'none';

type SortValue = string | number | null | undefined;

export type UseSortableOptions<T, Column extends string> = {
  /** The value a row sorts by for a given column. */
  getValue: (row: T, column: Column) => SortValue;
  /**
   * Fully handles a column whose order is not the default — numbers compare
   * numerically, everything else lexically. Return `undefined` to fall back to
   * that default.
   */
  compare?: (
    a: T,
    b: T,
    column: Column,
    direction: SortDirection
  ) => number | undefined;
};

export type UseSortableResult<T, Column extends string> = {
  /** For the header cell's `aria-sort`. */
  ariaSort: (column: Column) => AriaSortState;
  /** The active column, or null when unsorted. */
  column: Column | null;
  direction: SortDirection | null;
  /** The rows, sorted. Identity changes only when the input or the sort does. */
  rows: T[];
  /** Cycles a column: ascending, descending, unsorted. */
  toggle: (column: Column) => void;
};

/**
 * The default order: numbers numerically, everything else lexically. Applied to
 * whatever `getValue` produced, so a column that yields a `Date` should yield
 * `date.getTime()` instead.
 */
const compareValues = (
  a: SortValue,
  b: SortValue,
  direction: SortDirection
): number => {
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }

  const comparison = String(a ?? '').localeCompare(String(b ?? ''));
  return direction === 'asc' ? comparison : -comparison;
};

/**
 * Client-side sorting for a table.
 *
 * Owns the three-state sort (ascending → descending → unsorted), the comparator
 * and the `aria-sort` mapping — the parts every admin table repeated verbatim.
 * Filtering, searching and pagination stay with the caller, because those are
 * per-table domain rules rather than one pattern.
 *
 * `getValue` and `compare` are memoisation dependencies: pass module-level
 * functions, or `useCallback`-wrapped ones, so the sort does not re-run on every
 * render.
 */
export function useSortable<T, Column extends string>(
  rows: readonly T[],
  options: UseSortableOptions<T, Column>
): UseSortableResult<T, Column> {
  const { compare, getValue } = options;
  const [column, setColumn] = useState<Column | null>(null);
  const [direction, setDirection] = useState<SortDirection | null>(null);

  const toggle = useCallback(
    (next: Column) => {
      if (column !== next) {
        setColumn(next);
        setDirection('asc');
        return;
      }

      if (direction === 'asc') {
        setDirection('desc');
        return;
      }

      setColumn(null);
      setDirection(null);
    },
    [column, direction]
  );

  const sorted = useMemo(() => {
    if (column === null || direction === null) {
      return [...rows];
    }

    return [...rows].sort((a, b) => {
      const override = compare?.(a, b, column, direction);
      if (override !== undefined) {
        return override;
      }

      return compareValues(getValue(a, column), getValue(b, column), direction);
    });
  }, [rows, column, direction, compare, getValue]);

  const ariaSort = useCallback(
    (target: Column): AriaSortState => {
      if (column !== target) {
        return 'none';
      }

      return direction === 'asc' ? 'ascending' : 'descending';
    },
    [column, direction]
  );

  return { ariaSort, column, direction, rows: sorted, toggle };
}
