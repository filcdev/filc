import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { and, count, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import {
  cohort,
  cohortTimetableMtm,
  lesson,
  movedLesson,
  movedLessonLessonMTM,
  substitution,
  substitutionLessonMTM,
  timetable,
} from '#database/schema/timetable';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { dispatchImmediateNotification } from '#utils/notifications/engine';
import { filcExt } from '#utils/openapi';
import { getActiveTimetableId } from '#utils/timetable/active';
import { cleanupOrphanedCohorts } from '#utils/timetable/cleanup';
import { dateToYYYYMMDD } from '#utils/timetable/date';
import { createSelectSchema } from '#utils/zod';
import { timetableFactory } from './_factory';

const logger = getLogger(['chronos', 'timetable']);

const timetableSelectSchema = createSelectSchema(timetable);

const getAllResponseSchema = z.object({
  data: z.array(timetableSelectSchema),
  success: z.literal(true),
});

const getLatestValidReponseSchema = z.object({
  data: timetableSelectSchema,
  success: z.literal(true),
});

export const getAllTimetables = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Timetable', '@listof Timetable', true),
    description: 'Get all timetables from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getAllResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  async (c) => {
    try {
      const timetables = await db.select().from(timetable);

      return c.json<SuccessResponse<typeof timetables>>({
        data: timetables,
        success: true,
      });
    } catch (error) {
      logger.error('Error while getting all timetables: ', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch all timetables',
      });
    }
  }
);

export const getLatestValidTimetable = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Timetable', '@unit Timetable', true),
    description: 'Get the latest valid timetable.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getLatestValidReponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  async (c) => {
    try {
      const activeId = await getActiveTimetableId();
      if (!activeId) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: 'No valid timetable found.',
        });
      }

      const [latestValidTimetable] = await db
        .select()
        .from(timetable)
        .where(eq(timetable.id, activeId))
        .limit(1);

      if (!latestValidTimetable) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: 'No valid timetable found.',
        });
      }

      return c.json<SuccessResponse<typeof latestValidTimetable>>({
        data: latestValidTimetable,
        success: true,
      });
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      logger.error('Failed to get latest valid timetable: ', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to get latest valid template.',
      });
    }
  }
);

export const getAllValidTimetables = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Timetable', '@listof Timetable', true),
    description: 'Get all the latest valid timetables.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getAllResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  async (c) => {
    try {
      const today = dateToYYYYMMDD(new Date());

      const timetables = await db
        .select()
        .from(timetable)
        .where(
          and(
            lte(timetable.validFrom, today),
            or(isNull(timetable.validTo), gte(timetable.validTo, today))
          )
        );

      return c.json<SuccessResponse<typeof timetables>>({
        data: timetables,
        success: true,
      });
    } catch (error) {
      logger.error('Error while getting all timetables: ', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch all timetables',
      });
    }
  }
);

const updateTimetableSchema = z.object({
  name: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
});

const updateTimetableResponseSchema = z.object({
  data: timetableSelectSchema,
  success: z.literal(true),
});

export const updateTimetable = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Timetable', '@unit Timetable', true),
    description: 'Update a timetable validity dates.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(updateTimetableResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable'],
  }),
  zValidator('param', z.object({ id: z.uuid() })),
  zValidator('json', updateTimetableSchema),
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(timetable)
      .where(eq(timetable.id, id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Timetable not found',
      });
    }

    const [updated] = await db
      .update(timetable)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.validFrom !== undefined && { validFrom: body.validFrom }),
        ...(body.validTo !== undefined && { validTo: body.validTo }),
      })
      .where(eq(timetable.id, id))
      .returning();

    if (!updated) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to update timetable',
      });
    }

    return c.json<SuccessResponse<typeof updated>>({
      data: updated,
      success: true,
    });
  }
);

const deleteTimetableResponseSchema = z.object({
  success: z.literal(true),
});

export const deleteTimetable = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Timetable', '@unit Timetable', true),
    description:
      'Delete a timetable and all its related data, including orphaned cohorts.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(deleteTimetableResponseSchema),
          },
        },
        description: 'Successful Response',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                error: z.string(),
                success: z.literal(false),
              })
            ),
          },
        },
        description: 'Cannot delete active timetable',
      },
    },
    tags: ['Timetable'],
  }),
  zValidator('param', z.object({ id: z.uuid() })),
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    const { id } = c.req.valid('param');

    const [existing] = await db
      .select()
      .from(timetable)
      .where(eq(timetable.id, id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Timetable not found',
      });
    }

    const activeId = await getActiveTimetableId();
    if (activeId === id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Cannot delete the currently active timetable.',
      });
    }

    const notifiedUserIds: string[] = [];

    await db.transaction(async (tx) => {
      // Find cohorts in other timetables (will survive deletion)
      const survivingRows = await tx
        .selectDistinct({ cohortId: cohortTimetableMtm.cohortId })
        .from(cohortTimetableMtm)
        .where(ne(cohortTimetableMtm.timetableId, id));
      const survivingSet = new Set(survivingRows.map((r) => r.cohortId));

      // Cohorts linked only to this timetable become orphaned after deletion
      const timetableCohortRows = await tx
        .select({ cohortId: cohortTimetableMtm.cohortId })
        .from(cohortTimetableMtm)
        .where(eq(cohortTimetableMtm.timetableId, id));
      const orphanedCohortIds = timetableCohortRows
        .map((r) => r.cohortId)
        .filter((cohortId) => !survivingSet.has(cohortId));

      if (orphanedCohortIds.length > 0) {
        const affectedUsers = await tx
          .select({ id: user.id })
          .from(user)
          .where(inArray(user.cohortId, orphanedCohortIds));
        if (affectedUsers.length > 0) {
          const userIds = affectedUsers.map((u) => u.id);
          await tx
            .update(user)
            .set({ cohortId: null })
            .where(inArray(user.id, userIds));
          notifiedUserIds.push(...userIds);
        }

        // Delete orphaned cohorts that are no longer linked to any timetable
        await tx.delete(cohort).where(inArray(cohort.id, orphanedCohortIds));
      }

      await tx.delete(timetable).where(eq(timetable.id, id));
    });

    for (const userId of notifiedUserIds) {
      dispatchImmediateNotification('cohort_reselection_required', { userId });
    }

    return c.json<SuccessResponse>({ success: true });
  }
);

const previewDeleteResponseSchema = z.object({
  data: z.object({
    cohorts: z.array(
      z.object({
        becomesOrphaned: z.boolean(),
        id: z.string(),
        name: z.string(),
      })
    ),
    isCurrentTimetable: z.boolean(),
    targetTimetable: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .nullable(),
    totals: z.object({
      danglingUsersCleaned: z.number(),
      lessonsDeleted: z.number(),
      movedLessonsDeleted: z.number(),
      orphanedCohorts: z.number(),
      substitutionsDeleted: z.number(),
      survivingCohorts: z.number(),
    }),
  }),
  success: z.literal(true),
});

export const previewDeleteTimetable = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Timetable', '@unit Timetable', true),
    description:
      'Preview the impact of deleting a timetable. Orphaned cohorts will be deleted along with the timetable.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(previewDeleteResponseSchema),
          },
        },
        description: 'Preview data',
      },
    },
    tags: ['Timetable'],
  }),
  zValidator('param', z.object({ id: z.uuid() })),
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    const { id } = c.req.valid('param');

    const [existing] = await db
      .select()
      .from(timetable)
      .where(eq(timetable.id, id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Timetable not found',
      });
    }

    const activeId = await getActiveTimetableId();
    const isCurrentTimetable = activeId === id;

    // Fetch the active timetable's name in one query (it's the fallback target)
    let targetTimetable: { id: string; name: string } | null = null;
    if (activeId && activeId !== id) {
      const [activeTimetable] = await db
        .select({ id: timetable.id, name: timetable.name })
        .from(timetable)
        .where(eq(timetable.id, activeId))
        .limit(1);
      targetTimetable = activeTimetable ?? null;
    }

    // Cohorts linked to this timetable
    const timetableCohorts = await db
      .select({ id: cohort.id, name: cohort.name })
      .from(cohort)
      .innerJoin(cohortTimetableMtm, eq(cohort.id, cohortTimetableMtm.cohortId))
      .where(eq(cohortTimetableMtm.timetableId, id));

    // Single query: which of those cohorts also exist in other timetables
    let cohortResults: Array<{
      becomesOrphaned: boolean;
      id: string;
      name: string;
    }> = [];
    if (timetableCohorts.length > 0) {
      const cohortIds = timetableCohorts.map((row) => row.id);
      const survivingRows = await db
        .selectDistinct({ cohortId: cohortTimetableMtm.cohortId })
        .from(cohortTimetableMtm)
        .where(
          and(
            inArray(cohortTimetableMtm.cohortId, cohortIds),
            ne(cohortTimetableMtm.timetableId, id)
          )
        );
      const survivingSet = new Set(survivingRows.map((r) => r.cohortId));
      cohortResults = timetableCohorts.map((row) => ({
        becomesOrphaned: !survivingSet.has(row.id),
        id: row.id,
        name: row.name,
      }));
    }

    const orphanedCount = cohortResults.filter(
      (item) => item.becomesOrphaned
    ).length;

    // Count users whose cohort will be orphaned by this deletion
    const orphanedCohortIds = cohortResults
      .filter((item) => item.becomesOrphaned)
      .map((item) => item.id);
    let affectedUserCount = 0;
    if (orphanedCohortIds.length > 0) {
      const [affectedCount] = await db
        .select({ count: count() })
        .from(user)
        .where(inArray(user.cohortId, orphanedCohortIds));
      affectedUserCount = affectedCount?.count ?? 0;
    }

    const [lessonCount] = await db
      .select({ count: count() })
      .from(lesson)
      .where(eq(lesson.timetableId, id));

    const movedLessonRows = await db
      .select({ id: movedLesson.id })
      .from(movedLesson)
      .innerJoin(
        movedLessonLessonMTM,
        eq(movedLesson.id, movedLessonLessonMTM.movedLessonId)
      )
      .innerJoin(lesson, eq(movedLessonLessonMTM.lessonId, lesson.id))
      .where(eq(lesson.timetableId, id));
    const movedLessonIds = [...new Set(movedLessonRows.map((r) => r.id))];

    const substitutionRows = await db
      .select({ id: substitution.id })
      .from(substitution)
      .innerJoin(
        substitutionLessonMTM,
        eq(substitution.id, substitutionLessonMTM.substitutionId)
      )
      .innerJoin(lesson, eq(substitutionLessonMTM.lessonId, lesson.id))
      .where(eq(lesson.timetableId, id));
    const substitutionIds = [...new Set(substitutionRows.map((r) => r.id))];

    return c.json({
      data: {
        cohorts: cohortResults,
        isCurrentTimetable,
        targetTimetable,
        totals: {
          danglingUsersCleaned: affectedUserCount,
          lessonsDeleted: lessonCount?.count ?? 0,
          movedLessonsDeleted: movedLessonIds.length,
          orphanedCohorts: orphanedCount,
          substitutionsDeleted: substitutionIds.length,
          survivingCohorts: cohortResults.length - orphanedCount,
        },
      },
      success: true,
    });
  }
);

const cleanupOrphanedCohortsResponseSchema = z.object({
  data: z.object({
    affectedUserCount: z.number().int(),
    deletedCohortIds: z.array(z.string()),
  }),
  success: z.literal(true),
});

export const cleanupOrphanedCohortsHandler = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Timetable', '@unit Timetable', true),
    description:
      'Delete all cohorts that are no longer linked to any timetable (orphaned). Users referencing those cohorts will have their cohortId nullified.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(cleanupOrphanedCohortsResponseSchema),
          },
        },
        description: 'Cleanup summary',
      },
    },
    tags: ['Timetable'],
  }),
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    try {
      const summary = await cleanupOrphanedCohorts();

      return c.json<SuccessResponse<typeof summary>>({
        data: summary,
        success: true,
      });
    } catch (error) {
      logger.error('Failed to cleanup orphaned cohorts: ', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to cleanup orphaned cohorts',
      });
    }
  }
);
