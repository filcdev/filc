/**
 * The distinct ids of one column across a batch of rows, in first-seen order.
 *
 * A column that holds an array (a lesson's teacher/classroom ids) contributes
 * its members; a null/undefined column contributes nothing. Used to turn a page
 * of rows into the id list one batched query needs.
 */
export const distinctIds = <T>(
  rows: readonly T[],
  pick: (row: T) => string | readonly string[] | null | undefined
): string[] => {
  const ids = new Set<string>();

  for (const row of rows) {
    const value = pick(row);

    if (value == null) {
      continue;
    }

    if (typeof value === 'string') {
      ids.add(value);
    } else {
      for (const id of value) {
        ids.add(id);
      }
    }
  }

  return [...ids];
};
