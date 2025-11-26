import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { db } from "~/database";
import { user } from "~/database/schema/authentication";
import { accessLog, card, device } from "~/database/schema/doorlock";
import type { SuccessResponse } from "~/utils/globals";
import {
  requireAuthentication,
  requireAuthorization,
} from "~/utils/middleware";
import { ensureJsonSafeDates } from "~/utils/zod";
import { doorlockFactory } from "./_factory";

const listLogsSchema = z.object({
  deviceId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional().default(100),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  result: z.enum(["granted", "denied"]).optional(),
});

const addUnknownCardSchema = z.object({
  label: z.string().optional(),
  tag: z.string().min(1),
  userId: z.uuid(),
});

const listLogsResponseSchema = z.object({
  data: z.array(
    ensureJsonSafeDates(
      z.object({
        cardId: z.string().uuid().nullable(),
        cardLabel: z.string().nullable(),
        deviceId: z.string().uuid(),
        deviceName: z.string().nullable(),
        id: z.string().uuid(),
        reason: z.string().nullable(),
        result: z.string(),
        tag: z.string(),
        timestamp: z.date(),
        userId: z.string().uuid().nullable(),
        userName: z.string().nullable(),
      }),
    ),
  ),
  success: z.boolean(),
});

// List access logs with filters
export const listLogs = doorlockFactory.createHandlers(
  describeRoute({
    description:
      "Get access logs with optional filtering by device and result.",
    parameters: [
      {
        in: "query",
        name: "deviceId",
        required: false,
        schema: {
          description: "Filter logs by device ID.",
          format: "uuid",
          type: "string",
        },
      },
      {
        in: "query",
        name: "result",
        required: false,
        schema: {
          description: "Filter logs by access result.",
          type: "string",
        },
      },
      {
        in: "query",
        name: "limit",
        required: false,
        schema: {
          default: 50,
          description: "Maximum number of logs to return.",
          type: "integer",
        },
      },
      {
        in: "query",
        name: "offset",
        required: false,
        schema: {
          default: 0,
          description: "Number of logs to skip.",
          type: "integer",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(listLogsResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  requireAuthorization("doorlock:logs:read"),
  zValidator("query", listLogsSchema),
  async (c) => {
    const { deviceId, result, limit, offset } = c.req.valid("query");

    const conditions: ReturnType<typeof eq>[] = [];
    if (deviceId) {
      conditions.push(eq(accessLog.deviceId, deviceId));
    }
    if (result) {
      conditions.push(eq(accessLog.result, result));
    }

    const logs = await db
      .select({
        cardId: accessLog.cardId,
        cardLabel: card.label,
        deviceId: accessLog.deviceId,
        deviceName: device.name,
        id: accessLog.id,
        reason: accessLog.reason,
        result: accessLog.result,
        tag: accessLog.tag,
        timestamp: accessLog.timestamp,
        userId: accessLog.userId,
        userName: user.name,
      })
      .from(accessLog)
      .leftJoin(device, eq(accessLog.deviceId, device.id))
      .leftJoin(card, eq(accessLog.cardId, card.id))
      .leftJoin(user, eq(accessLog.userId, user.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(accessLog.timestamp))
      .limit(limit)
      .offset(offset);

    return c.json<SuccessResponse<typeof logs>>({
      data: logs,
      success: true,
    });
  },
);

const getLogResponseSchema = z.object({
  data: ensureJsonSafeDates(
    z.object({
      cardId: z.string().uuid().nullable(),
      cardLabel: z.string().nullable(),
      deviceId: z.string().uuid(),
      deviceName: z.string().nullable(),
      id: z.string().uuid(),
      reason: z.string().nullable(),
      result: z.string(),
      tag: z.string(),
      timestamp: z.date(),
      userId: z.string().uuid().nullable(),
      userName: z.string().nullable(),
    }),
  ),
  success: z.boolean(),
});

// Get a single log entry
export const getLog = doorlockFactory.createHandlers(
  describeRoute({
    description: "Get a specific access log entry by ID.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the log entry.",
          format: "uuid",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(getLogResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  requireAuthorization("doorlock:logs:read"),
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing id",
      });
    }

    const [log] = await db
      .select({
        cardId: accessLog.cardId,
        cardLabel: card.label,
        deviceId: accessLog.deviceId,
        deviceName: device.name,
        id: accessLog.id,
        reason: accessLog.reason,
        result: accessLog.result,
        tag: accessLog.tag,
        timestamp: accessLog.timestamp,
        userId: accessLog.userId,
        userName: user.name,
      })
      .from(accessLog)
      .leftJoin(device, eq(accessLog.deviceId, device.id))
      .leftJoin(card, eq(accessLog.cardId, card.id))
      .leftJoin(user, eq(accessLog.userId, user.id))
      .where(eq(accessLog.id, id))
      .limit(1);

    if (!log) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: "Log entry not found",
      });
    }

    return c.json<SuccessResponse<typeof log>>({
      data: log,
      success: true,
    });
  },
);

const listUnknownTagsResponseSchema = z.object({
  data: z.array(
    ensureJsonSafeDates(
      z.object({
        accessCount: z.number(),
        deviceId: z.string().uuid(),
        deviceName: z.string().nullable(),
        lastSeen: z.date(),
        tag: z.string(),
      }),
    ),
  ),
  success: z.boolean(),
});

// List unknown tags (logs where cardId is null)
export const listUnknownTags = doorlockFactory.createHandlers(
  describeRoute({
    description:
      "Get a list of unknown tags that have attempted access but are not associated with any card.",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(listUnknownTagsResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  requireAuthorization("doorlock:logs:read"),
  async (c) => {
    // Get unique unknown tags from logs
    const unknownTags = await db
      .selectDistinct({
        accessCount: sql<number>`COUNT(*)`,
        deviceId: accessLog.deviceId,
        deviceName: device.name,
        lastSeen: sql<Date>`MAX(${accessLog.timestamp})`,
        tag: accessLog.tag,
      })
      .from(accessLog)
      .leftJoin(device, eq(accessLog.deviceId, device.id))
      .where(isNull(accessLog.cardId))
      .groupBy(accessLog.tag, accessLog.deviceId, device.name)
      .orderBy(desc(sql`MAX(${accessLog.timestamp})`));

    return c.json<SuccessResponse<typeof unknownTags>>({
      data: unknownTags,
      success: true,
    });
  },
);

const addUnknownCardSchema = (
  await resolver(
    ensureJsonSafeDates(
      z.object({
        label: z.string().nullable(),
        tag: z.string(),
        userId: z.string(),
      }),
    ),
  ).toOpenAPISchema()
).schema;

const addUnknownCardResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(card)),
  success: z.boolean(),
});

// Add an unknown tag as a new card
export const addUnknownCard = doorlockFactory.createHandlers(
  describeRoute({
    description:
      "Create a new card from an unknown tag that has attempted access.",
    requestBody: {
      content: {
        "application/json": {
          schema: addUnknownCardSchema,
        },
      },
      description: "The data for the new card to create from an unknown tag.",
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: resolver(addUnknownCardResponseSchema),
          },
        },
        description: "Card successfully created",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  requireAuthorization("card:create"),
  zValidator("json", addUnknownCardSchema),
  async (c) => {
    const { tag, userId, label } = c.req.valid("json");

    // Check if card already exists with this tag
    const existing = await db
      .select({ id: card.id })
      .from(card)
      .where(eq(card.tag, tag))
      .limit(1);

    if (existing.length > 0) {
      throw new HTTPException(StatusCodes.CONFLICT, {
        message: "Card with this tag already exists",
      });
    }

    const [newCard] = await db
      .insert(card)
      .values({
        disabled: false,
        frozen: false,
        label,
        tag,
        userId,
      })
      .returning();

    if (!newCard) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to create card",
      });
    }

    return c.json<SuccessResponse<typeof newCard>>(
      {
        data: newCard,
        success: true,
      },
      StatusCodes.CREATED,
    );
  },
);

const getDeviceLogsResponseSchema = z.object({
  data: z.array(
    ensureJsonSafeDates(
      z.object({
        cardId: z.string().uuid().nullable(),
        cardLabel: z.string().nullable(),
        deviceId: z.string().uuid(),
        deviceName: z.string().nullable(),
        id: z.string().uuid(),
        reason: z.string().nullable(),
        result: z.string(),
        tag: z.string(),
        timestamp: z.date(),
        userId: z.string().uuid().nullable(),
        userName: z.string().nullable(),
      }),
    ),
  ),
  success: z.boolean(),
});

// Get logs for a specific device
export const getDeviceLogs = doorlockFactory.createHandlers(
  describeRoute({
    description:
      "Get access logs for a specific device with optional filtering by result.",
    parameters: [
      {
        in: "path",
        name: "deviceId",
        required: true,
        schema: {
          description: "The unique identifier for the device.",
          format: "uuid",
          type: "string",
        },
      },
      {
        in: "query",
        name: "result",
        required: false,
        schema: {
          description: "Filter logs by access result.",
          type: "string",
        },
      },
      {
        in: "query",
        name: "limit",
        required: false,
        schema: {
          default: 50,
          description: "Maximum number of logs to return.",
          type: "integer",
        },
      },
      {
        in: "query",
        name: "offset",
        required: false,
        schema: {
          default: 0,
          description: "Number of logs to skip.",
          type: "integer",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(getDeviceLogsResponseSchema),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  requireAuthorization("doorlock:logs:read"),
  zValidator("query", listLogsSchema.omit({ deviceId: true })),
  async (c) => {
    const deviceId = c.req.param("deviceId");
    if (!deviceId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing deviceId",
      });
    }

    const { result, limit, offset } = c.req.valid("query");

    const conditions = [eq(accessLog.deviceId, deviceId)];
    if (result) {
      conditions.push(eq(accessLog.result, result));
    }

    const logs = await db
      .select({
        cardId: accessLog.cardId,
        cardLabel: card.label,
        deviceId: accessLog.deviceId,
        deviceName: device.name,
        id: accessLog.id,
        reason: accessLog.reason,
        result: accessLog.result,
        tag: accessLog.tag,
        timestamp: accessLog.timestamp,
        userId: accessLog.userId,
        userName: user.name,
      })
      .from(accessLog)
      .leftJoin(device, eq(accessLog.deviceId, device.id))
      .leftJoin(card, eq(accessLog.cardId, card.id))
      .leftJoin(user, eq(accessLog.userId, user.id))
      .where(and(...conditions))
      .orderBy(desc(accessLog.timestamp))
      .limit(limit)
      .offset(offset);

    return c.json<SuccessResponse<typeof logs>>({
      data: logs,
      success: true,
    });
  },
);
