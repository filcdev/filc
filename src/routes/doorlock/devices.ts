import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { db } from "~/database";
import { cardDevice, device } from "~/database/schema/doorlock";
import { env } from "~/utils/environment";
import type { SuccessResponse } from "~/utils/globals";
import {
  requireAuthentication,
  requireAuthorization,
} from "~/utils/middleware";
import { ensureJsonSafeDates } from "~/utils/zod";
import { doorlockFactory } from "./_factory";

// Schemas
const MAX_TTL_SECONDS = 3600;
const DEFAULT_TTL_SECONDS = 30;
const SECOND_IN_MS = 1000;

const upsertDeviceSchemaJSON = z.object({
  location: z.string().optional(),
  name: z.string().min(1),
  ttlSeconds: z.number().int().positive().max(MAX_TTL_SECONDS).optional(),
});

const assignCardsSchemaJSON = z.object({
  cardIds: z.array(z.uuid()).min(1),
});

const listDevicesResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(device)).array(),
  success: z.boolean(),
});

export const listDevices = doorlockFactory.createHandlers(
  describeRoute({
    description: "Get all doorlock devices.",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(listDevicesResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  async (c) => {
    const rows = await db.select().from(device);
    return c.json<SuccessResponse<typeof rows>>({
      data: rows,
      success: true,
    });
  },
);

const getDeviceResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(device)),
  success: z.boolean(),
});

export const getDevice = doorlockFactory.createHandlers(
  describeRoute({
    description: "Get a specific device by ID.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the device.",
          format: "uuid",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(getDeviceResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing id",
      });
    }
    const [row] = await db
      .select()
      .from(device)
      .where(eq(device.id, id))
      .limit(1);
    if (!row) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: "Not found" });
    }
    return c.json<SuccessResponse<typeof row>>({
      data: row,
      success: true,
    });
  },
);

const upsertDeviceSchema = (
  await resolver(
    ensureJsonSafeDates(
      z.object({
        location: z.string().nullable(),
        name: z.string(),
        ttlSeconds: z.number().nullable(),
      }),
    ),
  ).toOpenAPISchema()
).schema;

const upsertDeviceResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(device)),
  success: z.boolean(),
});

// Create / overwrite device
export const upsertDevice = doorlockFactory.createHandlers(
  describeRoute({
    description: "Create or update a device by ID.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the device.",
          format: "uuid",
          type: "string",
        },
      },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: upsertDeviceSchema,
        },
      },
      description: "The data for the device to create or update.",
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(upsertDeviceResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  requireAuthorization("device:upsert"),
  zValidator("json", upsertDeviceSchemaJSON),
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing id",
      });
    }
    const data = c.req.valid("json");
    const now = new Date();
    try {
      const [existing] = await db
        .select({ id: device.id })
        .from(device)
        .where(eq(device.id, id));
      if (existing) {
        const [updated] = await db
          .update(device)
          .set({
            location: data.location,
            name: data.name,
            ttlSeconds: data.ttlSeconds ?? DEFAULT_TTL_SECONDS,
            updatedAt: now,
          })
          .where(eq(device.id, id))
          .returning();
        return c.json<SuccessResponse>({
          data: updated,
          success: true,
        });
      }
      const [inserted] = await db
        .insert(device)
        .values({
          createdAt: now,
          id,
          location: data.location,
          name: data.name,
          ttlSeconds: data.ttlSeconds ?? DEFAULT_TTL_SECONDS,
          updatedAt: now,
        })
        .returning();
      return c.json<SuccessResponse>(
        {
          data: inserted,
          success: true,
        },
        StatusCodes.CREATED,
      );
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause: env.mode === "development" ? String(err) : undefined,
        message: "Failed to upsert device",
      });
    }
  },
);

const deleteDeviceResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(device)),
  success: z.boolean(),
});

// Delete device
export const deleteDevice = doorlockFactory.createHandlers(
  describeRoute({
    description: "Delete a device by ID.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the device to delete.",
          format: "uuid",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(deleteDeviceResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  requireAuthorization("device:delete"),
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing id",
      });
    }
    try {
      const [deleted] = await db
        .delete(device)
        .where(eq(device.id, id))
        .returning();
      if (!deleted) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: "Not found",
        });
      }
      return c.json<SuccessResponse>({
        data: deleted,
        success: true,
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause: env.mode === "development" ? String(err) : undefined,
        message: "Failed to delete device",
      });
    }
  },
);

const listDeviceCardsResponseSchema = z.object({
  data: z.array(
    ensureJsonSafeDates(
      z.object({
        cardId: z.string().uuid(),
        deviceId: z.string().uuid(),
      }),
    ),
  ),
  success: z.boolean(),
});

// List cards restrictions for a device
export const listDeviceCards = doorlockFactory.createHandlers(
  describeRoute({
    description: "Get all cards associated with a specific device.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the device.",
          format: "uuid",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(listDeviceCardsResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing id",
      });
    }
    const rows = await db
      .select({
        cardId: cardDevice.cardId,
        deviceId: cardDevice.deviceId,
      })
      .from(cardDevice)
      .where(eq(cardDevice.deviceId, id));
    return c.json<SuccessResponse>({
      data: rows,
      success: true,
    });
  },
);

const assignCardsSchema = (
  await resolver(
    ensureJsonSafeDates(
      z.object({
        cardIds: z.array(z.string()),
      }),
    ),
  ).toOpenAPISchema()
).schema;

const replaceDeviceCardsResponseSchema = z.object({
  data: ensureJsonSafeDates(
    z.object({
      assignedCardIds: z.array(z.string().uuid()),
      deviceId: z.string().uuid(),
    }),
  ),
  success: z.boolean(),
});

// Assign card restrictions (replace set)
export const replaceDeviceCards = doorlockFactory.createHandlers(
  describeRoute({
    description:
      "Replace all cards assigned to a device with a new set of cards.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the device.",
          format: "uuid",
          type: "string",
        },
      },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: assignCardsSchema,
        },
      },
      description: "The list of card IDs to assign to the device.",
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(replaceDeviceCardsResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  requireAuthorization("device:assign_cards"),
  zValidator("json", assignCardsSchemaJSON),
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing id",
      });
    }
    const data = c.req.valid("json");
    try {
      await db.delete(cardDevice).where(eq(cardDevice.deviceId, id));
      if (data.cardIds.length) {
        await db
          .insert(cardDevice)
          .values(data.cardIds.map((cid) => ({ cardId: cid, deviceId: id })));
      }
      return c.json<SuccessResponse>({
        data: { assignedCardIds: data.cardIds, deviceId: id },
        success: true,
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause: env.mode === "development" ? String(err) : undefined,
        message: "Failed to assign cards",
      });
    }
  },
);

const getDeviceStatusResponseSchema = z.object({
  data: ensureJsonSafeDates(
    z.object({
      id: z.string().uuid(),
      lastSeenAt: z.date().nullable(),
      online: z.boolean(),
      ttlSeconds: z.number().int().nullable(),
    }),
  ),
  success: z.boolean(),
});

// Get device effective online status (computed from lastSeenAt/ttlSeconds)
export const getDeviceStatus = doorlockFactory.createHandlers(
  describeRoute({
    description:
      "Get the online status of a device based on its last seen timestamp and TTL.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the device.",
          format: "uuid",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(getDeviceStatusResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing id",
      });
    }
    const [row] = await db
      .select()
      .from(device)
      .where(eq(device.id, id))
      .limit(1);
    if (!row) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: "Not found" });
    }
    const now = Date.now();
    const last = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : 0;
    const ttl = (row.ttlSeconds ?? DEFAULT_TTL_SECONDS) * SECOND_IN_MS;
    const online = !!last && now - last <= ttl;
    return c.json<SuccessResponse>({
      data: {
        id: row.id,
        lastSeenAt: row.lastSeenAt,
        online,
        ttlSeconds: row.ttlSeconds,
      },
      success: true,
    });
  },
);
