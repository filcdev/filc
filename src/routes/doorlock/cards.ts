import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { db } from "~/database";
import { card } from "~/database/schema/doorlock";
import { userHasPermission } from "~/utils/authorization";
import { env } from "~/utils/environment";
import type { SuccessResponse } from "~/utils/globals";
import {
  requireAuthentication,
  requireAuthorization,
} from "~/utils/middleware";
import { doorlockFactory } from "./_factory";
import { describeRoute, resolver } from "hono-openapi";
import { ensureJsonSafeDates } from "~/utils/zod";
import { createSelectSchema } from "drizzle-zod";

const createCardSchema = z.object({
  disabled: z.boolean().optional(),
  frozen: z.boolean().optional(),
  label: z.string().optional(),
  tag: z.string().min(1),
  userId: z.uuid(),
});

const updateCardSchema = z.object({
  disabled: z.boolean().optional(),
  frozen: z.boolean().optional(),
  label: z.string().optional(),
  userId: z.uuid().optional(),
});

const GetAllResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(card)).array(),
  success: z.boolean(),
});

export const listCards = doorlockFactory.createHandlers(
  describeRoute({
    description:
      "Get all cards if the user has permission to read all of them, otherwise only get the user's cards.",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(GetAllResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  async (c) => {
    const currentUserId = c.var.session.userId;
    const canReadAll = await userHasPermission(currentUserId, "card:read");
    const rows = canReadAll
      ? await db.select().from(card)
      : await db.select().from(card).where(eq(card.userId, currentUserId));
    return c.json<SuccessResponse<typeof rows>>({
      data: rows,
      success: true,
    });
  },
);

const GetResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(card)),
  success: z.boolean(),
});

export const getCard = doorlockFactory.createHandlers(
  describeRoute({
    description: "Get card via id.",
    parameters: [
      {
        in: "path",
        name: "timetableId",
        required: true,
        schema: {
          description:
            "The unique identifier for the card to get from the database.",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(GetResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Moved Lesson"],
  }),
  requireAuthentication,
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing id",
      });
    }
    const currentUserId = c.var.session.userId;
    const [row] = await db
      .select()
      .from(card)
      .where(eq(card.id, id as string))
      .limit(1);
    if (!row) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: "Not found" });
    }
    const canReadAll = await userHasPermission(currentUserId, "card:read");
    if (!canReadAll && row.userId !== currentUserId) {
      throw new HTTPException(StatusCodes.FORBIDDEN, { message: "Forbidden" });
    }
    return c.json<SuccessResponse<typeof row>>({
      data: row,
      success: true,
    });
  },
);

const CreateSchema = (
  await resolver(
    ensureJsonSafeDates(
      z.object({
        disabled: z.boolean().nullable(),
        frozen: z.boolean().nullable(),
        label: z.string().nullable(),
        tag: z.string(),
        userId: z.string(),
      }),
    ),
  ).toOpenAPISchema()
).schema;

export const createCard = doorlockFactory.createHandlers(
  describeRoute({
    description: "Create a card.",
    requestBody: {
      content: {
        "application/json": {
          schema: CreateSchema,
        },
      },
      description: "The data for the new card.",
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(GetResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  requireAuthorization("card:create"),
  zValidator("json", createCardSchema),
  async (c) => {
    const data = c.req.valid("json");
    try {
      const [inserted] = await db
        .insert(card)
        .values({
          disabled: data.disabled ?? false,
          frozen: data.frozen ?? false,
          label: data.label,
          tag: data.tag,
          userId: data.userId,
        })
        .returning();
      return c.json<SuccessResponse<typeof inserted>>({
        data: inserted,
        success: true,
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause: env.mode === "development" ? String(err) : undefined,
        message: "Failed to create card",
      });
    }
  },
);

const UpdateSchema = (
  await resolver(
    ensureJsonSafeDates(
      z.object({
        disabled: z.boolean().nullable(),
        frozen: z.boolean().nullable(),
        label: z.string().nullable(),
        userId: z.string().nullable(),
      }),
    ),
  ).toOpenAPISchema()
).schema;

export const updateCard = doorlockFactory.createHandlers(
  describeRoute({
    description: "Update a card via it's ID.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the card to update.",
          type: "string",
        },
      },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: UpdateSchema,
        },
      },
      description: "The data for the upated card.",
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(GetResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  zValidator("json", updateCardSchema),
  async (c) => {
    const id = c.req.param("id");
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing id",
      });
    }
    const data = c.req.valid("json");
    const [existing] = await db
      .select()
      .from(card)
      .where(eq(card.id, id as string))
      .limit(1);
    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: "Not found" });
    }

    const currentUserId = c.var.session.userId;
    const canUpdate = await userHasPermission(currentUserId, "card:update");
    if (!canUpdate) {
      if (existing.userId !== currentUserId) {
        throw new HTTPException(StatusCodes.FORBIDDEN, {
          message: "Forbidden",
        });
      }

      const { label } = data;
      try {
        const [updated] = await db
          .update(card)
          .set({ label })
          .where(eq(card.id, id as string))
          .returning();
        return c.json<SuccessResponse>({
          data: updated,
          success: true,
        });
      } catch (err) {
        throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
          cause: env.mode === "development" ? String(err) : undefined,
          message: "Failed to update card",
        });
      }
    }
    try {
      const [updated] = await db
        .update(card)
        .set(data)
        .where(eq(card.id, id as string))
        .returning();
      return c.json<SuccessResponse<typeof updated>>({
        data: updated,
        success: true,
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause: env.mode === "development" ? String(err) : undefined,
        message: "Failed to update card",
      });
    }
  },
);

export const deleteCard = doorlockFactory.createHandlers(
  describeRoute({
    description: "Delete a card.",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          description: "The unique identifier for the card to delete.",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(GetResponseSchema)),
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
    const [existing] = await db
      .select()
      .from(card)
      .where(eq(card.id, id as string))
      .limit(1);
    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: "Not found" });
    }
    const currentUserId = c.var.session.userId;
    const canDelete = await userHasPermission(currentUserId, "card:delete");
    if (!canDelete && existing.userId !== currentUserId) {
      throw new HTTPException(StatusCodes.FORBIDDEN, { message: "Forbidden" });
    }
    try {
      const [deleted] = await db
        .delete(card)
        .where(eq(card.id, id as string))
        .returning();
      return c.json<SuccessResponse>({
        data: deleted,
        success: true,
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause: env.mode === "development" ? String(err) : undefined,
        message: "Failed to delete card",
      });
    }
  },
);
