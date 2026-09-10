import { real, smallint, timestamp, varchar } from 'drizzle-orm/pg-core';

export const timestamps = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
};

/**
 * Shared column builders ("filc data types") for values that recur across
 * schemas. Extend these instead of declaring a raw pg type at the call site, so
 * a storage-type change is made in one place.
 */

/** 16-bit signed grid coordinate. */
export const coordinate = (name: string) => smallint(name);
/** 16-bit signed storey index (negative = basement). */
export const storey = (name: string) => smallint(name);
/** 16-bit rotation angle in degrees. */
export const rotation = (name: string) => smallint(name);
/** 16-bit non-negative count (e.g. seats), max 32,767. */
export const count = (name: string) => smallint(name);
/** 16-bit non-negative dimension (e.g. centimetres), max 32,767. */
export const dimension = (name: string) => smallint(name);
/** 4-byte float measurement (e.g. corridor width). */
export const measurement = (name: string) => real(name);
/** Short bounded string (e.g. language code or translation key). */
export const shortText = (name: string, length: number) =>
  varchar(name, { length });
