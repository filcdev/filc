/**
 * The fields a Postgres driver error carries, and where its wrappers keep the
 * original. Bun's `SQL.PostgresError` is the source; Drizzle rethrows its own
 * error with the driver error on `cause`.
 *
 * `errno` is the SQLSTATE (`23505`, `23503`, `23001`, …). `code` is NOT — Bun
 * sets it to its own string (`ERR_POSTGRES_SERVER_ERROR`), so a SQLSTATE check
 * against `code` never matches. `constraint` names the violated constraint.
 */
export type PostgresErrorNode = {
  cause?: unknown;
  code?: unknown;
  constraint?: unknown;
  errno?: unknown;
};

/** SQLSTATE for a unique-constraint violation. */
export const UNIQUE_VIOLATION = '23505';

/**
 * Whether any node in an error's cause chain satisfies `match`.
 *
 * A constraint violation always arrives wrapped, so the check has to walk the
 * chain rather than inspect the thrown object.
 */
export const someErrorCause = (
  error: unknown,
  match: (node: PostgresErrorNode) => boolean
): boolean => {
  let current: unknown = error;

  while (current !== null && typeof current === 'object') {
    if (match(current as PostgresErrorNode)) {
      return true;
    }

    current = (current as PostgresErrorNode).cause;
  }

  return false;
};

/** Whether any node in the chain is a Postgres unique-constraint violation. */
export const isUniqueViolation = (error: unknown): boolean =>
  someErrorCause(error, (node) => node.errno === UNIQUE_VIOLATION);
