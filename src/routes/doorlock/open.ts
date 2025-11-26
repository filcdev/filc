import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver } from "hono-openapi";
import { StatusCodes } from "http-status-codes";
import z from "zod";
import { openDoorLock } from "~/mqtt/client";
import { userHasPermission } from "~/utils/authorization";
import type { SuccessResponse } from "~/utils/globals";
import { requireAuthentication } from "~/utils/middleware";
import { ensureJsonSafeDates } from "~/utils/zod";
import { doorlockFactory } from "./_factory";

const openDoorResponseSchema = z.object({
  data: z.object({
    deviceId: z.string(),
    status: z.string(),
  }),
  success: z.boolean(),
});

export const openDoor = doorlockFactory.createHandlers(
  describeRoute({
    description: "Open door via device ID.",
    parameters: [
      {
        in: "path",
        name: "deviceId",
        required: true,
        schema: {
          description: "The device ID.",
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: resolver(ensureJsonSafeDates(openDoorResponseSchema)),
          },
        },
        description: "Successful Response",
      },
    },
    tags: ["Doorlock"],
  }),
  requireAuthentication,
  async (c) => {
    const deviceId = c.req.param("deviceId");

    if (!(await userHasPermission(c.var.user.id, `door:${deviceId}:open`))) {
      throw new HTTPException(StatusCodes.FORBIDDEN, { message: "Forbidden" });
    }

    if (!deviceId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: "Missing deviceId",
      });
    }

    openDoorLock(deviceId, "Opened via API");

    return c.json<SuccessResponse>({
      data: { deviceId, status: "queued" },
      success: true,
    });
  },
);
