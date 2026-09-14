/**
 * Whether Postgres refused a delete because another row still references it:
 * SQLSTATE 23001 for a RESTRICT violation, 23503 for a foreign-key check on
 * the other side. Bun surfaces the SQLSTATE as `errno` and Drizzle wraps the
 * driver error in its own, so the cause chain has to be walked.
 */
export const isReferencedRowError = (error: unknown) => {
  let current: unknown = error;
  while (current instanceof Error) {
    const { code, errno } = current as { code?: string; errno?: string };
    if (
      errno === '23001' ||
      errno === '23503' ||
      code === '23001' ||
      code === '23503'
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
};
