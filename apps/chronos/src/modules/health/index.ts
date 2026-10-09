import { sql } from 'drizzle-orm';
import { db } from '#database';
import { base } from '#orpc';
import { serviceUnavailable } from '#utils/http';

export const health = base.health.health.handler(async () => {
  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    throw serviceUnavailable('Database unavailable', error);
  }

  return { database: 'up' as const, status: 'ok' as const };
});
