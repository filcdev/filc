import { someErrorCause } from '#utils/postgres';

/**
 * Whether Postgres refused a delete because another row still references it:
 * SQLSTATE 23001 for a RESTRICT violation, 23503 for a foreign-key check on
 * the other side.
 */
export const isReferencedRowError = (error: unknown): boolean =>
  someErrorCause(
    error,
    (node) => node.errno === '23001' || node.errno === '23503'
  );

/**
 * Whether the error (or any wrapped cause) is a Postgres integrity-constraint
 * violation: SQLSTATE class 23 (unique, foreign-key, not-null, check, ...).
 */
export const isIntegrityViolation = (error: unknown): boolean =>
  someErrorCause(
    error,
    (node) => typeof node.errno === 'string' && node.errno.startsWith('23')
  );
