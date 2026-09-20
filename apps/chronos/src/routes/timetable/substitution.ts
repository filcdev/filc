import {
  cohortIdParamsSchema,
  manualCreateSchema,
  substitutionIdParamsSchema,
} from '@filcdev/api/domains/timetable/substitution';
import { zValidator } from '@hono/zod-validator';
import { and, asc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import {
  cohort,
  lesson,
  lessonCohortMTM,
  period,
  subject,
  substitution,
  substitutionLessonMTM,
  teacher,
  termDefinition,
  weekDefinition,
} from '#database/schema/timetable';
import { authRouter } from '#middleware/auth';
import { env } from '#utils/environment';
import { ok } from '#utils/http';
import {
  cancelPendingNotification,
  dispatchPendingNotification,
} from '#utils/notifications/engine';
import { loadSubstitutionTeacherPayload } from '#utils/notifications/substitution-teacher';
import { filcExt } from '#utils/openapi';
import { getActiveTimetableId } from '#utils/timetable/active';
import {
  enrichedLessonSchema,
  enrichLessons,
} from '#utils/timetable/enrich-lessons';
import {
  findOrCreateManualLesson,
  getDayDefinitionIdsForDate,
  type TxOrDb,
} from '#utils/timetable/manual-lesson';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from '#utils/zod';
import { timetableFactory } from './_factory';

const substitutionSchema = createSelectSchema(substitution);

const allSubstitutionsResponseSchema = z.object({
  data: z.array(
    z.object({
      lessons: z.array(enrichedLessonSchema),
      substitution: substitutionSchema,
      teacher: createSelectSchema(teacher).nullable(),
    })
  ),
  success: z.boolean(),
});

const relevantSubstitutionItemSchema = z.object({
  lessons: z.array(z.string()),
  substitution: substitutionSchema,
  teacher: createSelectSchema(teacher).nullable(),
});

const relevantSubstitutionsResponseSchema = z.object({
  data: z.array(relevantSubstitutionItemSchema),
  success: z.boolean(),
});

const cohortSubstitutionsResponseSchema = z.object({
  data: z.object({
    cohortId: z.string(),
    substitutions: z.array(relevantSubstitutionItemSchema),
  }),
  success: z.boolean(),
});

function areLessonsCompatible(
  aId: string,
  bId: string,
  lessonCohorts: Map<string, Set<string>>
): boolean {
  if (aId === bId) {
    return true;
  }
  const aCohorts = lessonCohorts.get(aId);
  const bCohorts = lessonCohorts.get(bId);
  if (!(aCohorts && bCohorts)) {
    return false;
  }
  for (const cohortId of aCohorts) {
    if (bCohorts.has(cohortId)) {
      return true;
    }
  }
  return false;
}

// A substituter may cover multiple lessons in the same period only when those
// lessons are the same lesson or share a cohort. Check the incoming lessons
// against each other before any of the existing-substitution early returns.
async function assertIncomingLessonsCompatible(
  dbOrTx: TxOrDb,
  incomingLessons: { id: string; periodId: string | null }[]
): Promise<void> {
  if (incomingLessons.length < 2) {
    return;
  }

  const cohortLinks = await dbOrTx
    .select({
      cohortId: lessonCohortMTM.cohortId,
      lessonId: lessonCohortMTM.lessonId,
    })
    .from(lessonCohortMTM)
    .where(
      inArray(
        lessonCohortMTM.lessonId,
        incomingLessons.map((l) => l.id)
      )
    );

  const lessonCohorts = new Map<string, Set<string>>();
  for (const link of cohortLinks) {
    const cohorts = lessonCohorts.get(link.lessonId) ?? new Set<string>();
    cohorts.add(link.cohortId);
    lessonCohorts.set(link.lessonId, cohorts);
  }

  const lessonsByPeriod = new Map<string, string[]>();
  for (const current of incomingLessons) {
    if (current.periodId == null) {
      continue;
    }
    const ids = lessonsByPeriod.get(current.periodId) ?? [];
    ids.push(current.id);
    lessonsByPeriod.set(current.periodId, ids);
  }

  assertPeriodsCompatible(lessonsByPeriod, lessonCohorts);
}

// Throw 409 CONFLICT when any two lessons sharing a period are unrelated.
function assertPeriodsCompatible(
  lessonsByPeriod: Map<string, string[]>,
  lessonCohorts: Map<string, Set<string>>
): void {
  for (const ids of lessonsByPeriod.values()) {
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i];
        const b = ids[j];
        if (a === undefined || b === undefined) {
          continue;
        }
        if (!areLessonsCompatible(a, b, lessonCohorts)) {
          throw new HTTPException(StatusCodes.CONFLICT, {
            message:
              'Teacher already has a substitution in the same period on this date',
          });
        }
      }
    }
  }
}

// Check if a teacher already has a substitution in any of the same periods
// on the same date. Throws 409 CONFLICT if an overlap is detected.
async function checkTeacherSubstitutionConflict(
  dbOrTx: TxOrDb,
  date: Date,
  substituter: string | null | undefined,
  lessonIds: string[],
  excludeSubstitutionId?: string
): Promise<void> {
  // Early return if substituter is null or undefined (no conflict possible)
  if (substituter == null) {
    return;
  }

  // Early return if no lessons to check (empty array would produce invalid SQL)
  if (lessonIds.length === 0) {
    return;
  }

  // Get IDs and period IDs for the incoming lessons
  const incomingLessons = await dbOrTx
    .select({ id: lesson.id, periodId: lesson.periodId })
    .from(lesson)
    .where(inArray(lesson.id, lessonIds));

  const incomingPeriodIds = new Set(
    incomingLessons
      .map((l) => l.periodId)
      .filter((id): id is string => id != null)
  );

  // Reject assigning the substituter to unrelated incoming lessons in the same
  // period, even when there is no existing substitution to compare against.
  await assertIncomingLessonsCompatible(dbOrTx, incomingLessons);

  // Find existing substitutions for the same date and substituter
  const conditions = [
    eq(substitution.date, date),
    eq(substitution.substituter, substituter),
  ];
  if (excludeSubstitutionId) {
    conditions.push(ne(substitution.id, excludeSubstitutionId));
  }

  const existingSubstitutions = await dbOrTx
    .select({ id: substitution.id })
    .from(substitution)
    .where(and(...conditions));

  if (existingSubstitutions.length === 0) {
    return;
  }

  const existingSubIds = existingSubstitutions.map((s) => s.id);

  // Get lesson IDs linked to those existing substitutions
  const existingLessons = await dbOrTx
    .select({ lessonId: substitutionLessonMTM.lessonId })
    .from(substitutionLessonMTM)
    .where(inArray(substitutionLessonMTM.substitutionId, existingSubIds));

  const existingLessonIds = existingLessons.map((l) => l.lessonId);

  if (existingLessonIds.length === 0) {
    return;
  }

  // Get IDs and period IDs for those linked lessons
  const existingLessonPeriods = await dbOrTx
    .select({ id: lesson.id, periodId: lesson.periodId })
    .from(lesson)
    .where(inArray(lesson.id, existingLessonIds));

  const existingPeriodIds = new Set(
    existingLessonPeriods
      .map((l) => l.periodId)
      .filter((id): id is string => id != null)
  );

  // Compute the periods shared by incoming and existing lessons
  const overlappingPeriodIds = [...incomingPeriodIds].filter((periodId) =>
    existingPeriodIds.has(periodId)
  );

  if (overlappingPeriodIds.length === 0) {
    return;
  }

  // Fetch cohort links for every involved lesson in a single query so we can
  // allow overlaps where the lessons are the same or share a cohort.
  const allLessonIds = Array.from(
    new Set([
      ...incomingLessons.map((l) => l.id),
      ...existingLessonPeriods.map((l) => l.id),
    ])
  );

  const cohortLinks = await dbOrTx
    .select({
      cohortId: lessonCohortMTM.cohortId,
      lessonId: lessonCohortMTM.lessonId,
    })
    .from(lessonCohortMTM)
    .where(inArray(lessonCohortMTM.lessonId, allLessonIds));

  const lessonCohorts = new Map<string, Set<string>>();
  for (const link of cohortLinks) {
    if (!lessonCohorts.has(link.lessonId)) {
      lessonCohorts.set(link.lessonId, new Set());
    }
    lessonCohorts.get(link.lessonId)?.add(link.cohortId);
  }

  for (const periodId of overlappingPeriodIds) {
    const incomingInPeriod = incomingLessons.filter(
      (l) => l.periodId === periodId
    );
    const existingInPeriod = existingLessonPeriods.filter(
      (l) => l.periodId === periodId
    );

    // Only allow the overlap when every incoming/existing lesson pair in this
    // period is the same lesson or shares a cohort. A single unrelated pair
    // means the substituter would cover two different classes at once, which
    // is a real conflict.
    const allPairsCompatible = incomingInPeriod.every((incoming) =>
      existingInPeriod.every((existing) =>
        areLessonsCompatible(incoming.id, existing.id, lessonCohorts)
      )
    );

    if (allPairsCompatible) {
      continue;
    }

    throw new HTTPException(StatusCodes.CONFLICT, {
      message:
        'Teacher already has a substitution in the same period on this date',
    });
  }
}

// Resolve effective update values and delegate to checkTeacherSubstitutionConflict.
async function validateUpdateTeacherConflict(
  dbOrTx: TxOrDb,
  id: string,
  body: {
    date?: Date | undefined;
    substituter?: string | null | undefined;
    lessonIds?: string[] | null | undefined;
  },
  existing: { date: Date; substituter: string | null }
): Promise<void> {
  const effectiveSubstituter =
    'substituter' in body ? body.substituter : existing.substituter;
  if (effectiveSubstituter == null) {
    return;
  }

  const existingLessonRecords = await dbOrTx
    .select({ lessonId: substitutionLessonMTM.lessonId })
    .from(substitutionLessonMTM)
    .where(eq(substitutionLessonMTM.substitutionId, id));
  const existingLessonIds = existingLessonRecords.map((r) => r.lessonId);

  const effectiveLessonIds =
    body.lessonIds == null ? existingLessonIds : body.lessonIds;

  await checkTeacherSubstitutionConflict(
    dbOrTx,
    body.date ?? existing.date,
    effectiveSubstituter,
    effectiveLessonIds,
    id
  );
}

const substitutionWithRelationsType =
  '@listof SubstitutionWithRelations @field(.substitution, Substitution) @field(.teacher, Teacher) @field(.lessons, List<String>)';

export const getAllSubstitutions = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Substitution', substitutionWithRelationsType, true),
    description: 'Get all substitutions from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(allSubstitutionsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  async (c) => {
    // First get all substitutions with their lesson IDs
    const substitutions = await db
      .select({
        lessonIds: sql<string[]>`COALESCE(
          ARRAY_AGG(DISTINCT ${substitutionLessonMTM.lessonId}) FILTER (WHERE ${substitutionLessonMTM.lessonId} IS NOT NULL),
          ARRAY[]::text[]
        )`.as('lessonIds'),
        substitution,
        // teacher: sql`
        //   CASE
        //     WHEN ${teacher.id} IS NOT NULL THEN
        //       jsonb_build_object(
        //         'id', ${teacher.id},
        //         'firstName', ${teacher.firstName},
        //         'lastName', ${teacher.lastName},
        //         'short', ${teacher.short},
        //         'gender', ${teacher.gender},
        //         'userId', ${teacher.userId}
        //       )
        //     ELSE NULL
        //   END
        // `.as('teacher'),
        teacher: {
          firstName: teacher.firstName,
          id: teacher.id,
          lastName: teacher.lastName,
          short: teacher.short,
        },
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

    // Enrich every linked lesson. A substitution keeps pointing at the lesson
    // it was created for, even after that lesson's timetable is retired, so
    // this must not be scoped to the active timetable.
    const enrichedLessons = await enrichLessons(allLessonIds);
    const lessonMap = new Map(enrichedLessons.map((l) => [l.id, l]));

    // Map lessons back to substitutions
    const result = substitutions.map((s) => ({
      lessons: s.lessonIds.map((id) => lessonMap.get(id)).filter(Boolean),
      substitution: s.substitution,
      teacher: s.teacher,
    }));

    // Sort by date ascending, then by lowest lesson period number ascending
    // so that e.g. 1st Period appears before 4th Period on the same day.
    result.sort((a, b) => {
      const dateDiff =
        new Date(a.substitution.date).getTime() -
        new Date(b.substitution.date).getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }

      const minPeriod = (entry: (typeof result)[number]) =>
        Math.min(
          ...entry.lessons.map(
            (l) => l?.period?.period ?? Number.MAX_SAFE_INTEGER
          )
        );
      return minPeriod(a) - minPeriod(b);
    });

    return ok(c, result);
  }
);

export const getRelevantSubstitutions = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Substitution', substitutionWithRelationsType, true),
    description: 'Get relevant substitutions from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(relevantSubstitutionsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  async (c) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
      .leftJoin(period, eq(lesson.periodId, period.id))
      .where(gte(substitution.date, today))
      .groupBy(substitution.id, teacher.id)
      .orderBy(asc(substitution.date), asc(sql`MIN(${period.period})`));

    return ok(c, substitutions);
  }
);

export const getRelevantSubstitutionsForCohort =
  timetableFactory.createHandlers(
    describeRoute({
      ...filcExt(
        'Substitution',
        '@unit SubstitutionsByCohort @field(.substitutions, List<SubstitutionWithRelations>)',
        true
      ),
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
              schema: resolver(cohortSubstitutionsResponseSchema),
            },
          },
          description: 'Successful Response',
        },
      },
      tags: ['Substitution'],
    }),
    zValidator('param', cohortIdParamsSchema),
    async (c) => {
      const { cohortId } = c.req.valid('param');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

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
        .leftJoin(period, eq(lesson.periodId, period.id))
        .leftJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
        .leftJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
        .where(and(gte(substitution.date, today), eq(cohort.id, cohortId)))
        .groupBy(substitution.id, teacher.id)
        .orderBy(asc(substitution.date), asc(sql`MIN(${period.period})`));

      return ok(c, {
        cohortId,
        substitutions,
      });
    }
  );

const createSchema = createInsertSchema(substitution)
  .omit({ id: true })
  .extend({
    date: z.coerce.date<Date>(),
    lessonIds: z.string().array().min(1),
  });

const createResponseSchema = z.object({
  data: substitutionSchema,
  success: z.boolean(),
});

export const createSubstitution = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Substitution', '@unit Substitution', true),
    description: 'Create a new substitution',
    requestBody: {
      content: {
        'application/json': await resolver(createSchema).toOpenAPISchema(),
      },
      description: 'The data for the new substitution.',
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(createResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  ...authRouter('substitution:create'),
  zValidator('json', createSchema),
  async (c) => {
    const { lessonIds, date, substituter, comment } = c.req.valid('json');

    const lessonCount = await db.$count(lesson, inArray(lesson.id, lessonIds));

    if (lessonCount !== lessonIds.length) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: `attempted to substitute non-existent lesson(s), wanted: ${lessonIds.length}, got: ${lessonCount}`,
      });
    }

    const result = await db.transaction(
      async (tx) => {
        await checkTeacherSubstitutionConflict(
          tx,
          date,
          substituter,
          lessonIds
        );

        const [insertedSubstitution] = await tx
          .insert(substitution)
          .values({
            comment,
            date,
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
      },
      { isolationLevel: 'serializable' }
    );

    dispatchPendingNotification(result.id, 'substitution', {
      date: result.date,
      lessonIds,
      substituter,
    });

    dispatchPendingNotification(
      result.id,
      'substitution_teacher',
      await loadSubstitutionTeacherPayload({
        date: result.date,
        lessonIds,
        substituter,
      })
    );

    return ok(c, result);
  }
);

// Manual substitution creation.
//
// Unlike the regular create endpoint, this does not require the caller to know
// the IDs of existing lessons. Instead the caller supplies the teacher being
// replaced together with a manual lesson time (day + period), a subject and a
// cohort. We then find-or-create a lesson that matches that combination inside
// the active timetable and link the substitution to it.

const manualCreateResponseSchema = z.object({
  data: substitutionSchema,
  success: z.boolean(),
});

async function lockAndValidateTeachers(
  tx: TxOrDb,
  teacherId: string,
  substituter: string | null | undefined
): Promise<void> {
  // Lock the teacher and substituter rows (when set) in a deterministic
  // sorted order, so concurrent requests with reversed teacherId/substituter
  // values can't deadlock on the second FOR UPDATE. Locking before validating
  // either row also keeps a concurrent cleanup from deleting a referenced
  // teacher mid-flight.
  const teacherIdsToLock = Array.from(
    new Set([teacherId, ...(substituter ? [substituter] : [])])
  ).sort();

  for (const id of teacherIdsToLock) {
    const [lockedTeacher] = await tx
      .select({ id: teacher.id })
      .from(teacher)
      .where(eq(teacher.id, id))
      .for('update');

    if (!lockedTeacher) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message:
          id === teacherId
            ? 'Invalid teacher provided'
            : 'Invalid substituter provided',
      });
    }
  }
}

export const createManualSubstitution = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Substitution', '@unit Substitution', true),
    description:
      'Create a substitution manually by specifying the teacher, lesson time, subject and cohort directly.',
    requestBody: {
      content: {
        'application/json':
          await resolver(manualCreateSchema).toOpenAPISchema(),
      },
      description: 'The data for the manually created substitution.',
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(manualCreateResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  ...authRouter('substitution:create'),
  zValidator('json', manualCreateSchema),
  async (c) => {
    const {
      cohortId,
      comment,
      date,
      periodId,
      subjectId,
      substituter,
      teacherId,
    } = c.req.valid('json');

    // Validate that all referenced entities exist.
    const [[refTeacher], [refPeriod], [refCohort]] = await Promise.all([
      db
        .select({ id: teacher.id })
        .from(teacher)
        .where(eq(teacher.id, teacherId))
        .limit(1),
      db
        .select({ id: period.id })
        .from(period)
        .where(eq(period.id, periodId))
        .limit(1),
      db
        .select({ id: cohort.id })
        .from(cohort)
        .where(eq(cohort.id, cohortId))
        .limit(1),
    ]);

    if (!refTeacher) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Invalid teacher provided',
      });
    }
    if (!refPeriod) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Invalid period provided',
      });
    }
    if (!refCohort) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Invalid cohort provided',
      });
    }
    if (subjectId !== null) {
      const [refSubject] = await db
        .select({ id: subject.id })
        .from(subject)
        .where(eq(subject.id, subjectId))
        .limit(1);
      if (!refSubject) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: 'Invalid subject provided',
        });
      }
    }

    if (substituter) {
      const [refSubstituter] = await db
        .select({ id: teacher.id })
        .from(teacher)
        .where(eq(teacher.id, substituter))
        .limit(1);
      if (!refSubstituter) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: 'Invalid substituter provided',
        });
      }
    }

    const timetableId = await getActiveTimetableId();
    if (!timetableId) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'No active timetable found',
      });
    }

    const dayDefinitionIds = await getDayDefinitionIdsForDate(date);
    const dayDefinitionId = dayDefinitionIds[0];
    if (dayDefinitionIds.length !== 1 || !dayDefinitionId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'No unambiguous day definition found for the given date',
      });
    }

    const [[weekDef], [termDef]] = await Promise.all([
      db.select({ id: weekDefinition.id }).from(weekDefinition).limit(1),
      db.select({ id: termDefinition.id }).from(termDefinition).limit(1),
    ]);

    if (!weekDef) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'No week definition found',
      });
    }

    let manualLessonId = '';
    const result = await db.transaction(
      async (tx) => {
        await lockAndValidateTeachers(tx, teacherId, substituter);

        const lessonId = await findOrCreateManualLesson(tx, {
          classroomIds: undefined,
          cohortId,
          dayDefinitionId,
          periodId,
          subjectId,
          teacherIds: [teacherId],
          termDefinitionId: termDef?.id ?? null,
          timetableId,
          weeksDefinitionId: weekDef.id,
        });

        manualLessonId = lessonId;

        await checkTeacherSubstitutionConflict(tx, date, substituter, [
          lessonId,
        ]);

        const [insertedSubstitution] = await tx
          .insert(substitution)
          .values({
            comment,
            date,
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

        await tx.insert(substitutionLessonMTM).values({
          lessonId,
          substitutionId: insertedSubstitution.id,
        });

        return insertedSubstitution;
      },
      { isolationLevel: 'serializable' }
    );

    dispatchPendingNotification(result.id, 'substitution', {
      date: result.date,
      lessonIds: [manualLessonId],
      substituter,
    });

    dispatchPendingNotification(
      result.id,
      'substitution_teacher',
      await loadSubstitutionTeacherPayload({
        date: result.date,
        lessonIds: [manualLessonId],
        substituter,
      })
    );

    return c.json<SuccessResponse<typeof result>>({
      data: result,
      success: true,
    });
  }
);

const updateSchema = createUpdateSchema(substitution)
  .omit({ id: true })
  .extend({
    date: z.coerce.date<Date>().optional(),
    lessonIds: z.string().array().nullable(),
  });

export const updateSubstitution = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Substitution', '@unit Substitution', true),
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
        'application/json': await resolver(updateSchema).toOpenAPISchema(),
      },
      description: 'The data for updating the substitution.',
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(createResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  ...authRouter('substitution:update'),
  zValidator('param', substitutionIdParamsSchema),
  zValidator('json', updateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(substitution)
      .where(eq(substitution.id, id))
      .limit(1);

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Substitution not found',
      });
    }

    if (body.lessonIds?.length) {
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

    const updatedSubstitution = await db.transaction(
      async (tx) => {
        await validateUpdateTeacherConflict(tx, id, body, existing);

        const [updated] = await tx
          .update(substitution)
          .set({
            comment: body.comment,
            date: body.date ?? undefined,
            substituter: body.substituter,
          })
          .where(eq(substitution.id, id))
          .returning();

        // If lessonIds were explicitly provided, replace MTM relationships
        if (body.lessonIds != null) {
          // Delete existing relationships
          await tx
            .delete(substitutionLessonMTM)
            .where(eq(substitutionLessonMTM.substitutionId, id));

          // Insert new relationships (if any — empty array clears all)
          if (body.lessonIds.length > 0) {
            const mtmValues = body.lessonIds.map((lessonId) => ({
              lessonId,
              substitutionId: id,
            }));

            await tx.insert(substitutionLessonMTM).values(mtmValues);
          }
        }

        return updated;
      },
      { isolationLevel: 'serializable' }
    );

    if (!updatedSubstitution) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Substitution not found',
      });
    }

    cancelPendingNotification(id, 'substitution');
    cancelPendingNotification(id, 'substitution_teacher');

    // Fetch existing lesson IDs for notification fallback
    const existingLessonRecords = await db
      .select({ lessonId: substitutionLessonMTM.lessonId })
      .from(substitutionLessonMTM)
      .where(eq(substitutionLessonMTM.substitutionId, id));
    const existingLessonIds = existingLessonRecords.map((r) => r.lessonId);

    const updatedLessonIds =
      body.lessonIds == null ? existingLessonIds : body.lessonIds;
    const updatedSubstituter =
      'substituter' in body ? body.substituter : existing.substituter;
    const updatedDate = body.date ?? existing.date;

    dispatchPendingNotification(id, 'substitution', {
      date: updatedDate,
      lessonIds: updatedLessonIds,
      substituter: updatedSubstituter,
    });

    dispatchPendingNotification(
      id,
      'substitution_teacher',
      await loadSubstitutionTeacherPayload({
        date: updatedDate,
        lessonIds: updatedLessonIds,
        substituter: updatedSubstituter,
      })
    );

    return ok(c, updatedSubstitution);
  }
);

export const deleteSubstitution = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Substitution', '@nodata', true),
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
            schema: resolver(createResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Substitution'],
  }),
  ...authRouter('substitution:delete'),
  zValidator('param', substitutionIdParamsSchema),
  async (c) => {
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

    cancelPendingNotification(id, 'substitution');
    cancelPendingNotification(id, 'substitution_teacher');

    return ok(c, deletedSubstitution);
  }
);
