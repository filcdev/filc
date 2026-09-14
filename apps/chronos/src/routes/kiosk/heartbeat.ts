import { kioskHeartbeatRequestSchema } from '@filcdev/api/domains/kiosk/heartbeat';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { getConnInfo } from 'hono/bun';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { kiosk } from '#database/schema/kiosk';
import { ok } from '#utils/http';
import { kioskHeartbeatResponseSchema } from '#utils/kiosk/schemas';
import { filcExt } from '#utils/openapi';
import { kioskFactory } from './_factory';

const { schema: heartbeatRequestSchema } = await resolver(
  kioskHeartbeatRequestSchema
).toOpenAPISchema();

export const kioskHeartbeatRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt('Kiosk', '@unit KioskHeartbeatResponse @field(.kiosk, Kiosk)'),
    description:
      'Record a kiosk heartbeat and report whether the box is registered and enabled',
    requestBody: {
      content: {
        'application/json': {
          schema: heartbeatRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(kioskHeartbeatResponseSchema),
          },
        },
        description: 'Heartbeat recorded',
      },
    },
    tags: ['Kiosk'],
  }),
  zValidator('json', kioskHeartbeatRequestSchema),
  async (c) => {
    const { appVersion, machineId } = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(kiosk)
      .where(eq(kiosk.machineId, machineId));

    if (!existing) {
      return ok(c, { registered: false });
    }

    const forwardedFor = c.req.header('x-forwarded-for');
    const lastSeenIp =
      forwardedFor?.split(',')[0]?.trim() || getConnInfo(c).remote.address;

    await db
      .update(kiosk)
      .set({
        appVersion,
        lastSeenAt: new Date(),
        ...(lastSeenIp ? { lastSeenIp } : {}),
      })
      .where(eq(kiosk.id, existing.id));

    if (!existing.enabled) {
      return ok(c, {
        enabled: false,
        kiosk: { id: existing.id, kind: existing.kind, name: existing.name },
        registered: true,
      });
    }

    return ok(c, {
      enabled: true,
      kiosk: {
        config: existing.config,
        id: existing.id,
        kind: existing.kind,
        name: existing.name,
      },
      registered: true,
    });
  }
);
