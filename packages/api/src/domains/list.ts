import z from 'zod';

/**
 * The one shape every list endpoint answers with: the page of rows plus the
 * total number of rows. `total` is the unpaged count, so a caller can page
 * without a second request; it equals `items.length` for the endpoints that
 * return every row at once.
 */
export const listResponse = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number() });
