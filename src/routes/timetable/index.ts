import { getLogger } from "@logtape/logtape";
import { timetableFactory } from "./_factory";
import { requireAuthentication } from "~/utils/middleware";
import { db } from "~/database";
import { timetable } from "~/database/schema/timetable";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "http-status-codes";
import type { SuccessResponse } from "~/utils/globals";
import { desc, gte } from "drizzle-orm";

const logger = getLogger(["chronos", "timetable"]);

export const getAllTimetables = timetableFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    try {
      const timetables = await db.select().from(timetable);

      return c.json<SuccessResponse>({
        success: true,
        data: timetables,
      });
    } catch (error) {
      logger.error("Error while getting all timetables: ", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to fetch all timetables",
      });
    }
  },
);

const dateToYYYYMMDD = (date: Date): string =>
  date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

export const getLatestValidTimetable = timetableFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const today = dateToYYYYMMDD(new Date());
    try {
      const [latestValidTimetable] = await db
        .select()
        .from(timetable)
        .where(gte(timetable.validFrom, today))
        .orderBy(desc(timetable.validFrom))
        .limit(1);

      if (!latestValidTimetable) {
        return c.json<SuccessResponse>({
          success: true,
          data: "No valid timetable found.",
        });
      }

      return c.json<SuccessResponse>({
        success: true,
        data: latestValidTimetable,
      });
    } catch (error) {
      logger.error("Failed to get latest valid timetable: ", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to get latest valid template.",
      });
    }
  },
);

export const getAllValidTimetables = timetableFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    try {
      const today = dateToYYYYMMDD(new Date());

      const timetables = await db
        .select()
        .from(timetable)
        .where(gte(timetable.validFrom, today.toString()));

      return c.json<SuccessResponse>({
        success: true,
        data: timetables,
      });
    } catch (error) {
      logger.error("Error while getting all timetables: ", { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Failed to fetch all timetables",
      });
    }
  },
);
