import { kioskKindSchema } from '@filcdev/api/domains/kiosk/config';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { kiosk } from '#database/schema/kiosk';
import { base } from '#orpc';

export const heartbeat = base.kiosk.heartbeat.handler(
  async ({ context, input }) => {
    const { appVersion, machineId } = input;

    const [existing] = await db
      .select()
      .from(kiosk)
      .where(eq(kiosk.machineId, machineId));

    if (!existing) {
      return { registered: false };
    }

    const forwardedFor = context.reqHeaders.get('x-forwarded-for');
    const lastSeenIp = forwardedFor?.split(',')[0]?.trim() || context.clientIp;

    await db
      .update(kiosk)
      .set({
        appVersion,
        lastSeenAt: new Date(),
        ...(lastSeenIp ? { lastSeenIp } : {}),
      })
      .where(eq(kiosk.id, existing.id));

    // Every write validates `kind` against this enum, but the column is plain
    // text, so the contract's enum type comes from re-validating it here.
    const kind = kioskKindSchema.parse(existing.kind);

    if (!existing.enabled) {
      return {
        enabled: false as const,
        kiosk: { id: existing.id, kind, name: existing.name },
        registered: true as const,
      };
    }

    return {
      enabled: true as const,
      kiosk: {
        config: existing.config,
        id: existing.id,
        kind,
        name: existing.name,
      },
      registered: true as const,
    };
  }
);
