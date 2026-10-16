import { and, type SQL } from 'drizzle-orm';

/**
 * Combines a list of conditions with `AND`, returning `undefined` for an empty
 * list so it can be handed straight to `.where()` (which then applies no
 * filter). Drizzle's `and()` needs at least the accumulator plus a clause, so
 * folding a variable-length list otherwise has to special-case the first one.
 */
export const andAll = (
  clauses: readonly SQL<unknown>[]
): SQL<unknown> | undefined =>
  clauses.reduce<SQL<unknown> | undefined>(
    (combined, clause) => (combined ? and(combined, clause) : clause),
    undefined
  );
