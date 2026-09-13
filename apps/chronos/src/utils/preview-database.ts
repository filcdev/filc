/** Prefix used for per-preview databases created by the database bootstrap. */
export const PREVIEW_DATABASE_PREFIX = 'filc_';

/** Sanitize an arbitrary per-preview value (e.g. a hostname) into a safe database name. */
export const sanitizeDatabaseName = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${PREVIEW_DATABASE_PREFIX}${cleaned}`.slice(0, 63);
};

const PREVIEW_DATABASE_NAME_PATTERN = /^filc_[a-z0-9_]+$/;

/** Whether a database name looks like one this app created for a preview. */
export const isPreviewDatabaseName = (name: string): boolean =>
  PREVIEW_DATABASE_NAME_PATTERN.test(name);
