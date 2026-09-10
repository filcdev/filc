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

/** 16-bit signed integer: coordinates, storeys, rotations, counts, dimensions. */
export const smallInt = (name: string) => smallint(name);
/** 4-byte float: measurements such as corridor width. */
export const measurement = (name: string) => real(name);
/** Short bounded string. */
export const shortText = (name: string, length: number) =>
  varchar(name, { length });
