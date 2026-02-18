import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import {
  classroom,
  cohort,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  period,
  subject,
  substitution,
  substitutionLessonMTM,
  teacher,
} from '#database/schema/timetable';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { env } from '#utils/environment';
import { ensureJsonSafeDates } from '#utils/zod';
import { timetableFactory } from './_factory';

const logger = getLogger(['chronos', 'substitutions']);

const substitutionSchema = createSelectSchema(substitution);

const allResponseSchema = z.object({
  data: z.array(substitutionSchema),
  success: z.boolean(),
});

// Helper to enrich lessons with their related data
async function enrichLessons(lessonIds: string[]) {
  if (lessonIds.length === 0) {
    return [];
  }

  const lessons = await db
    .select()
    .from(lesson)
    .where(inArray(lesson.id, lessonIds));

  if (lessons.length === 0) {
    return [];
  }

  const subjectIds = Array.from(new Set(lessons.map((l) => l.subjectId)));
  const dayIds = Array.from(new Set(lessons.map((l) => l.dayDefinitionId)));
  const periodIds = Array.from(new Set(lessons.map((l) => l.periodId)));
  const teacherIds = Array.from(
    new Set(
      lessons.flatMap((l) => (Array.isArray(l.teacherIds) ? l.teacherIds : []))
    )
  );
  const classroomIds = Array.from(
    new Set(
      lessons.flatMap((l) =>
        Array.isArray(l.classroomIds) ? l.classroomIds : []
      )
    )
  );

  // Get lesson-cohort relationships
  const lessonCohorts = await db
    .select({
      cohortId: lessonCohortMTM.cohortId,
      cohortName: cohort.name,
      lessonId: lessonCohortMTM.lessonId,
    })
    .from(lessonCohortMTM)
    .innerJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
    .where(inArray(lessonCohortMTM.lessonId, lessonIds));

  // Create a map of lesson ID to cohort names
  const lessonCohortMap = new Map<string, string[]>();
  for (const lc of lessonCohorts) {
    if (!lessonCohortMap.has(lc.lessonId)) {
      lessonCohortMap.set(lc.lessonId, []);
    }
    lessonCohortMap.get(lc.lessonId)?.push(lc.cohortName);
  }

  const [subjects, days, periods, teachers, classrooms] = await Promise.all([
    db.select().from(subject).where(inArray(subject.id, subjectIds)),
    db.select().from(dayDefinition).where(inArray(dayDefinition.id, dayIds)),
    db.select().from(period).where(inArray(period.id, periodIds)),
    teacherIds.length
      ? db.select().from(teacher).where(inArray(teacher.id, teacherIds))
      : Promise.resolve([] as (typeof teacher.$inferSelect)[]),
    classroomIds.length
      ? db.select().from(classroom).where(inArray(classroom.id, classroomIds))
      : Promise.resolve([] as (typeof classroom.$inferSelect)[]),
  ]);

  const subjMap = new Map(subjects.map((s) => [s.id, s] as const));
  const dayMap = new Map(days.map((d) => [d.id, d] as const));
  const periodMap = new Map(periods.map((p) => [p.id, p] as const));
  const teacherMap = new Map(teachers.map((t) => [t.id, t] as const));
  const classroomMap = new Map(classrooms.map((cr) => [cr.id, cr] as const));

  return lessons.map((l) => {
    const tIds = (Array.isArray(l.teacherIds) ? l.teacherIds : []) as string[];
    const cIds = (
      Array.isArray(l.classroomIds) ? l.classroomIds : []
    ) as string[];
    const cohortNames = lessonCohortMap.get(l.id) || [];

    return {
      classrooms: cIds
        .map((id) => classroomMap.get(id))
        .filter(Boolean)
        .map((cr) => ({
          id: (cr as (typeof classrooms)[number]).id,
          name: (cr as (typeof classrooms)[number]).name,
          short: (cr as (typeof classrooms)[number]).short,
        })),
      cohorts: cohortNames,
      day: dayMap.get(l.dayDefinitionId),
      id: l.id,
      period: (() => {
        const p = periodMap.get(l.periodId);
        return p
          ? {
              endTime: String(p.endTime),
              id: p.id,
              period: p.period,
              startTime: String(p.startTime),
            }
          : null;
      })(),
      periodsPerWeek: l.periodsPerWeek,
      subject: (() => {
        const s = subjMap.get(l.subjectId);
        return s ? { id: s.id, name: s.name, short: s.short } : null;
      })(),
      teachers: tIds
        .map((id) => teacherMap.get(id))
        .filter(Boolean)
        .map((t) => ({
          id: (t as (typeof teachers)[number]).id,
          name: `${(t as (typeof teachers)[number]).firstName} ${(t as (typeof teachers)[number]).lastName}`,
          short: (t as (typeof teachers)[number]).short,
        })),
      termDefinitionId: l.termDefinitionId,
      weeksDefinitionId: l.weeksDefinitionId,
    };
  });
}

export const getAllSubstitutions = timetableFactory.createHandlers(
  describeRoute({
    description: 'Get all substitutions from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(allResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  requireAuthentication,
  async (c) => {
    try {
      // First get all substitutions with their lesson IDs
      const substitutions = await db
        .select({
          lessonIds: sql<string[]>`COALESCE(
            ARRAY_AGG(DISTINCT ${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as('lessonIds'),
          substitution,
          teacher: sql`
            CASE 
              WHEN ${teacher.id} IS NOT NULL THEN
                jsonb_build_object(
                  'id', ${teacher.id},
                  'firstName', ${teacher.firstName},
                  'lastName', ${teacher.lastName},
                  'short', ${teacher.short},
                  'gender', ${teacher.gender},
                  'userId', ${teacher.userId}
                )
              ELSE NULL
            END
          `.as('teacher'),
        })
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id))
        .leftJoin(
          substitutionLessonMTM,
          eq(substitution.id, substitutionLessonMTM.substitutionId)
        )
        .groupBy(
          substitution.id,
          teacher.id,
          teacher.firstName,
          teacher.lastName,
          teacher.short,
          teacher.gender,
          teacher.userId
        );

      // Collect all unique lesson IDs
      const allLessonIds = Array.from(
        new Set(substitutions.flatMap((s) => s.lessonIds))
      );

      // Enrich lessons in one batch
      const enrichedLessons = await enrichLessons(allLessonIds);
      const lessonMap = new Map(enrichedLessons.map((l) => [l.id, l]));

      // Map lessons back to substitutions
      const result = substitutions.map((s) => ({
        lessons: s.lessonIds.map((id) => lessonMap.get(id)).filter(Boolean),
        substitution: s.substitution,
        teacher: s.teacher,
      }));

      return c.json<SuccessResponse<typeof result>>({
        data: result,
        success: true,
      });
    } catch (error) {
      logger.error('Error while fetching all substitutions', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch all substitutions',
      });
    }
  }
);

export const getRelevantSubstitutions = timetableFactory.createHandlers(
  describeRoute({
    description: 'Get relevant substitutions from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(allResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  requireAuthentication,
  async (c) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const substitutions = await db
        .select({
          lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as('lessons'),
          substitution,
          teacher,
        })
        .from(substitution)
        .leftJoin(teacher, eq(substitution.substituter, teacher.id))
        .leftJoin(
          substitutionLessonMTM,
          eq(substitution.id, substitutionLessonMTM.substitutionId)
        )
        .where(gte(substitution.date, today as string))
        .groupBy(substitution.id, teacher.id);

      return c.json<SuccessResponse<typeof substitutions>>({
        data: substitutions,
        success: true,
      });
    } catch (error) {
      logger.error('Error while fetching substitutions', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch substitutions',
      });
    }
  }
);

export const getRelevantSubstitutionsForCohort =
  timetableFactory.createHandlers(
    describeRoute({
      description:
        'Get relevant substitutions for a given cohort from the database.',
      parameters: [
        {
          in: 'path',
          name: 'cohortId',
          required: true,
          schema: {
            description: 'The unique identifier for the cohort.',
            type: 'string',
          },
        },
      ],
      responses: {
        200: {
          content: {
            'application/json': {
              schema: resolver(ensureJsonSafeDates(allResponseSchema)),
            },
          },
          description: 'Successful Response',
        },
      },
      tags: ['Substitution'],
    }),
    requireAuthentication,
    zValidator('param', z.object({ cohortId: z.uuid() })),
    async (c) => {
      const { cohortId } = c.req.valid('param');

      const today = new Date().toISOString().split('T')[0];

      try {
        const substitutions = await db
          .select({
            lessons: sql<string[]>`COALESCE(
            ARRAY_AGG(${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
            ARRAY[]::text[]
          )`.as('lessons'),
            substitution,
            teacher,
          })
          .from(substitution)
          .leftJoin(teacher, eq(substitution.substituter, teacher.id))
          .leftJoin(
            substitutionLessonMTM,
            eq(substitution.id, substitutionLessonMTM.substitutionId)
          )
          .leftJoin(lesson, eq(substitutionLessonMTM.lessonId, lesson.id))
          .leftJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
          .leftJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
          .where(
            and(
              gte(substitution.date, today as string),
              eq(cohort.id, cohortId)
            )
          )
          .groupBy(substitution.id, teacher.id);

        return c.json<
          SuccessResponse<{
            cohortId: string;
            substitutions: typeof substitutions;
          }>
        >({
          data: {
            cohortId,
            substitutions,
          },
          success: true,
        });
      } catch (error) {
        logger.error('Error while fetching substitutions for cohort', {
          error,
        });
        throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
          message: 'Failed to fetch substitutions for cohort',
        });
      }
    }
  );

const createSchema = z.object({
  date: z.date(),
  lessonIds: z.string().array(),
  substituter: z.string().nullable(),
});

const createResponseSchema = z.object({
  data: substitutionSchema,
  success: z.boolean(),
});

export const createSubstitution = timetableFactory.createHandlers(
  describeRoute({
    description: 'Create a new substitution',
    requestBody: {
      content: {
        'multipart/form-data': await resolver(
          ensureJsonSafeDates(createSchema)
        ).toOpenAPISchema(),
      },
      description: 'The data for the new substitution.',
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(createResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  requireAuthentication,
  requireAuthorization('substitution:create'),
  zValidator('json', createSchema),
  async (c) => {
    const { lessonIds, date, substituter } = c.req.valid('json');

    const lessonCount = await db.$count(lesson, inArray(lesson.id, lessonIds));

    if (lessonCount !== lessonIds.length) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: `attempted to substitute non-existent lesson(s), wanted: ${lessonIds.length}, got: ${lessonCount}`,
      });
    }

    const result = await db.transaction(async (tx) => {
      const [insertedSubstitution] = await tx
        .insert(substitution)
        .values({
          date: date.toDateString(),
          id: crypto.randomUUID(),
          substituter,
        })
        .returning();

      if (!insertedSubstitution) {
        throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
          cause:
            env.mode === 'development'
              ? 'No substitution returned from insert query'
              : undefined,
          message: 'Failed to create substitution.',
        });
      }

      // Insert the many-to-many relationships
      const mtmValues = lessonIds.map((lessonId) => ({
        lessonId,
        substitutionId: insertedSubstitution.id,
      }));

      await tx.insert(substitutionLessonMTM).values(mtmValues);

      return insertedSubstitution;
    });

    return c.json<SuccessResponse<typeof result>>({
      data: result,
      success: true,
    });
  }
);

const updateSchema = z.object({
  date: z.date().nullable(),
  lessonIds: z.string().array().nullable(),
  substituter: z.string().nullable(),
});

export const updateSubstitution = timetableFactory.createHandlers(
  describeRoute({
    description: 'Update a substitution',
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {
          description: 'The unique identifier for the substitution to update.',
          type: 'string',
        },
      },
    ],
    requestBody: {
      content: {
        'application/json': await resolver(
          ensureJsonSafeDates(updateSchema)
        ).toOpenAPISchema(),
      },
      description: 'The data for updating the substitution.',
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(createResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  requireAuthentication,
  requireAuthorization('substitution:update'),
  zValidator('param', z.object({ id: z.uuid() })),
  zValidator('json', updateSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');

      const existingSubstitution = await db
        .select()
        .from(substitution)
        .where(eq(substitution.id, id))
        .limit(1);

      if (existingSubstitution.length === 0) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: 'Substitution not found',
        });
      }

      if (body.lessonIds) {
        const lessonCount = await db.$count(
          lesson,
          inArray(lesson.id, body.lessonIds)
        );
        if (lessonCount !== body.lessonIds.length) {
          throw new HTTPException(StatusCodes.BAD_REQUEST, {
            message: `Some lessons don't exist, wanted: ${body.lessonIds.length}, found: ${lessonCount}`,
          });
        }
      }

      // Use a transaction to update the substitution and the many-to-many relationships
      const updatedSubstitution = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(substitution)
          .set({
            date: body.date ? body.date.toDateString() : undefined,
            substituter: body.substituter,
          })
          .where(eq(substitution.id, id))
          .returning();

        // If lessonIds were provided, update the many-to-many relationships
        if (body.lessonIds) {
          // Delete existing relationships
          await tx
            .delete(substitutionLessonMTM)
            .where(eq(substitutionLessonMTM.substitutionId, id));

          // Insert new relationships
          const mtmValues = body.lessonIds.map((lessonId) => ({
            lessonId,
            substitutionId: id,
          }));

          await tx.insert(substitutionLessonMTM).values(mtmValues);
        }

        return updated;
      });

      return c.json<SuccessResponse<typeof updatedSubstitution>>({
        data: updatedSubstitution,
        success: true,
      });
    } catch (error) {
      logger.error('Error while updating substitution', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause:
          env.mode === 'development' ? (error as Error).message : undefined,
        message: 'Failed to update substitution',
      });
    }
  }
);

export const deleteSubstitution = timetableFactory.createHandlers(
  describeRoute({
    description: 'Delete a substitution',
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {
          description: 'The unique identifier for the substitution to delete.',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(createResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  requireAuthentication,
  requireAuthorization('substitution:delete'),
  zValidator('param', z.object({ id: z.uuid() })),
  async (c) => {
    try {
      const { id } = c.req.valid('param');

      const [existingSubstitution] = await db
        .select()
        .from(substitution)
        .where(eq(substitution.id, id))
        .limit(1);

      if (!existingSubstitution) {
        throw new HTTPException(StatusCodes.NOT_FOUND, {
          message: 'Substitution not found',
        });
      }

      // The many-to-many relationships will be automatically deleted due to the CASCADE constraint
      const [deletedSubstitution] = await db
        .delete(substitution)
        .where(eq(substitution.id, id))
        .returning();

      return c.json<SuccessResponse<typeof deletedSubstitution>>({
        data: deletedSubstitution,
        success: true,
      });
    } catch (error) {
      logger.error('Error while deleting substitution', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        cause:
          env.mode === 'development' ? (error as Error).message : undefined,
        message: 'Failed to delete substitution',
      });
    }
  }
);
