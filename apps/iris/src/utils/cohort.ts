/**
 * Class-name ordering: main grades (9–13) first, then 1/13, 2/14-style
 * (slash) classes, natural-numeric within each group.
 */
export function compareClassNames(a: string, b: string): number {
  const aSlash = a.includes('/');
  const bSlash = b.includes('/');
  if (aSlash !== bSlash) {
    return aSlash ? 1 : -1;
  }
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Sorted copy — the API returns cohorts in raw DB order. */
export function sortCohorts<T extends { name: string }>(
  cohorts: readonly T[] | null | undefined
): T[] {
  return [...(cohorts ?? [])].sort((a, b) => compareClassNames(a.name, b.name));
}
