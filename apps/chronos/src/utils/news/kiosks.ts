import { sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { db } from '#database';
import { kiosk } from '#database/schema/kiosk';

/** Throw 400 if any of the provided kiosk IDs do not exist. */
export const validateKioskIds = async (kioskIds: string[]) => {
  const existingKiosks = await db
    .select({ id: kiosk.id })
    .from(kiosk)
    .where(sql`${kiosk.id} IN ${kioskIds}`);
  const existingIds = new Set(existingKiosks.map((row) => row.id));
  const invalid = kioskIds.filter((id) => !existingIds.has(id));
  if (invalid.length > 0) {
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      message: `Invalid kiosk IDs: ${invalid.join(', ')}`,
    });
  }
};
