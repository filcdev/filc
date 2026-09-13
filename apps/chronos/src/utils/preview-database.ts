import { createHash } from 'node:crypto';

/** Prefix used for per-preview databases created by the database bootstrap. */
export const PREVIEW_DATABASE_PREFIX = 'filc_';
const PREVIEW_DATABASE_DIGEST_LENGTH = 8;

/** Sanitize an arbitrary per-preview value (e.g. a hostname) into a safe database name. */
export const sanitizeDatabaseName = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const readable = normalized || 'preview';
  const digest = createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, PREVIEW_DATABASE_DIGEST_LENGTH);
  // Reserve room for the prefix, separator and digest so truncation can never
  // collide two different preview values on the same database.
  const maxReadable =
    63 - PREVIEW_DATABASE_PREFIX.length - 1 - PREVIEW_DATABASE_DIGEST_LENGTH;
  return `${PREVIEW_DATABASE_PREFIX}${readable.slice(0, maxReadable)}_${digest}`;
};

const PREVIEW_DATABASE_NAME_PATTERN = /^filc_[a-z0-9_]+$/;

/** Whether a database name looks like one this app created for a preview. */
export const isPreviewDatabaseName = (name: string): boolean =>
  PREVIEW_DATABASE_NAME_PATTERN.test(name);
