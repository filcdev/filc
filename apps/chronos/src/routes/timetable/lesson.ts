import { zValidator } from '@hono/zod-validator';
import { arrayContains, eq, inArray, or } from 'drizzle-orm';
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
  substitutionLessonMTM,
  teacher,
} from '#database/schema/timetable';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';
import { timetableFactory } from './_factory';

const normalizeDayText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const weekdayAliases: Record<number, string[]> = {
  0: ['vasarnap', 'va', 'v', 'sunday', 'sun'],
  1: ['hetfo', 'he', 'h', 'monday', 'mon'],
  2: ['kedd', 'ke', 'k', 'tuesday', 'tue'],
  3: ['szerda', 'sze', 'sz', 'wednesday', 'wed'],
  4: ['csutortok', 'cs', 'thursday', 'thu'],
  5: ['pentek', 'pe', 'p', 'friday', 'fri'],
  6: ['szombat', 'szo', 'saturday', 'sat'],
};

const isMatchingWeekday = (
  weekdayIndex: number,
  dayName: string,
  dayShort?: string
): boolean => {
  const aliases = (weekdayAliases[weekdayIndex] ?? []).map(normalizeDayText);
  const normalizedName = normalizeDayText(dayName);
  const normalizedShort = dayShort ? normalizeDayText(dayShort) : '';

  return aliases.some(
    (alias) =>
      normalizedName === alias ||
      normalizedShort === alias ||
      normalizedName.includes(alias)
  );
};

async function enrichLessons(lessons: (typeof lesson.$inferSelect)[]) {
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

    return {
      classrooms: cIds
        .map((id) => classroomMap.get(id))
        .filter(Boolean)
        .map((cr) => ({
          id: (cr as (typeof classrooms)[number]).id,
          name: (cr as (typeof classrooms)[number]).name,
          short: (cr as (typeof classrooms)[number]).short,
        })),
      day: (() => {
        const d = dayMap.get(l.dayDefinitionId);
        return d;
      })(),
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

const enrichedLessonSchema = z.object({
  classrooms: z.array(
    z.object({ id: z.string(), name: z.string(), short: z.string() })
  ),
  day: createSelectSchema(dayDefinition).optional(),
  id: z.string(),
  period: z
    .object({
      endTime: z.string(),
      id: z.string(),
      period: z.number(),
      startTime: z.string(),
    })
    .nullable(),
  periodsPerWeek: z.number(),
  subject: z
    .object({ id: z.string(), name: z.string(), short: z.string() })
    .nullable(),
  teachers: z.array(
    z.object({ id: z.string(), name: z.string(), short: z.string() })
  ),
  termDefinitionId: z.string().nullable(),
  weeksDefinitionId: z.string(),
});

const responseSchema = z.object({
  data: enrichedLessonSchema.array(),
  success: z.boolean(),
});

const enrichedLessonType =
  '@listof EnrichedLesson @field(.classrooms, List<Classroom>) @field(.day, DayDefinition) @field(.period, Period) @field(.subject, Subject) @field(.teachers, List<TeacherSummary>)';

export const getLessonsForCohort = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Lesson', enrichedLessonType),
    description: 'Get lessons for a given cohort from the database.',
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
            schema: resolver(responseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Lesson'],
  }),
  zValidator('param', z.object({ cohortId: z.uuid() })),
  async (c) => {
    const { cohortId } = c.req.valid('param');

    const [existingCohort] = await db
      .select()
      .from(cohort)
      .where(eq(cohort.id, cohortId))
      .limit(1);

    if (!existingCohort) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Cohort not found',
      });
    }

    const lessonRows = await db
      .select({ lesson })
      .from(lesson)
      .innerJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
      .where(eq(lessonCohortMTM.cohortId, cohortId));

    const lessons = lessonRows.map((r) => r.lesson);

    if (lessons.length === 0) {
      return c.json<SuccessResponse<[]>>({ data: [], success: true });
    }

    const enriched = await enrichLessons(lessons);

    return c.json<SuccessResponse<typeof enriched>>({
      data: enriched,
      success: true,
    });
  }
);

export const getLessonsForTeacher = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Lesson', enrichedLessonType),
    description: 'Get lessons for a given teacher from the database.',
    parameters: [
      {
        in: 'path',
        name: 'teacherId',
        required: true,
        schema: {
          description: 'The unique identifier for the teacher.',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(responseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Lesson'],
  }),
  zValidator('param', z.object({ teacherId: z.uuid() })),
  async (c) => {
    const { teacherId } = c.req.valid('param');

    const [existingTeacher] = await db
      .select()
      .from(teacher)
      .where(eq(teacher.id, teacherId))
      .limit(1);

    if (!existingTeacher) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Teacher not found',
      });
    }

    const lessons = await db
      .select()
      .from(lesson)
      .where(arrayContains(lesson.teacherIds, [teacherId]));

    if (lessons.length === 0) {
      return c.json<SuccessResponse<[]>>({ data: [], success: true });
    }

    const enriched = await enrichLessons(lessons);

    return c.json<SuccessResponse<typeof enriched>>({
      data: enriched,
      success: true,
    });
  }
);

const teacherLessonsBatchRequestSchema = z.object({
  teacherIds: z.array(z.uuid()).min(1),
});

const teacherLessonsBatchResponseSchema = z.object({
  data: z.array(
    z.object({
      lessons: enrichedLessonSchema.array(),
      teacherId: z.string(),
    })
  ),
  success: z.boolean(),
});

const teacherLessonBatchType =
  '@listof TeacherLessonsBatchResult @field(.teacherId, String) @field(.lessons, List<EnrichedLesson>)';

const substitutionCandidatesRequestSchema = z.object({
  date: z.coerce.date(),
  missingTeacherId: z.string().min(1),
  selectedLessonIds: z.array(z.string().min(1)).default([]),
  teacherIds: z.array(z.string().min(1)).min(1),
});

const substitutionCandidateSchema = z.object({
  hasLessonBeforeOrAfter: z.boolean(),
  teacher: z.object({
    firstName: z.string(),
    id: z.string(),
    lastName: z.string(),
    short: z.string(),
  }),
});

const substitutionCandidatesResponseSchema = z.object({
  data: z.object({
    availableLessons: enrichedLessonSchema.array(),
    substituteCandidates: substitutionCandidateSchema.array(),
  }),
  success: z.literal(true),
});

const substitutionCandidatesType =
  '@unit SubstitutionCandidatesResult @field(.availableLessons, List<EnrichedLesson>) @field(.substituteCandidates, List<SubstitutionCandidate>)';

export const getLessonsForTeachers = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Lesson', teacherLessonBatchType),
    description: 'Get lessons for multiple teachers in a single request.',
    requestBody: {
      content: {
        'application/json': await resolver(
          teacherLessonsBatchRequestSchema
        ).toOpenAPISchema(),
      },
      required: true,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(teacherLessonsBatchResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Lesson'],
  }),
  zValidator('json', teacherLessonsBatchRequestSchema),
  async (c) => {
    const { teacherIds } = c.req.valid('json');
    const normalizedTeacherIds = Array.from(new Set(teacherIds));

    const existingTeachers = await db
      .select({ id: teacher.id })
      .from(teacher)
      .where(inArray(teacher.id, normalizedTeacherIds));

    const existingTeacherIds = existingTeachers.map((t) => t.id);

    if (existingTeacherIds.length === 0) {
      return c.json<SuccessResponse<[]>>({ data: [], success: true });
    }

    const lessons = await db
      .select()
      .from(lesson)
      .where(
        or(
          ...existingTeacherIds.map((id) =>
            arrayContains(lesson.teacherIds, [id])
          )
        )
      );

    const enrichedLessons = await enrichLessons(lessons);
    const lessonsByTeacherId = new Map<
      string,
      (typeof enrichedLessons)[number][]
    >(existingTeacherIds.map((id) => [id, []]));

    for (const enrichedLesson of enrichedLessons) {
      for (const lessonTeacher of enrichedLesson.teachers) {
        if (!lessonsByTeacherId.has(lessonTeacher.id)) {
          continue;
        }

        lessonsByTeacherId.get(lessonTeacher.id)?.push(enrichedLesson);
      }
    }

    const data = existingTeacherIds.map((teacherId) => ({
      lessons: lessonsByTeacherId.get(teacherId) ?? [],
      teacherId,
    }));

    return c.json<SuccessResponse<typeof data>>({
      data,
      success: true,
    });
  }
);

export const getSubstitutionCandidates = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Lesson', substitutionCandidatesType),
    description:
      'Get available lessons and substitute teacher candidates for substitution editing in one request.',
    requestBody: {
      content: {
        'application/json': await resolver(
          substitutionCandidatesRequestSchema
        ).toOpenAPISchema(),
      },
      required: true,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(substitutionCandidatesResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Lesson'],
  }),
  zValidator('json', substitutionCandidatesRequestSchema),
  async (c) => {
    const { date, missingTeacherId, selectedLessonIds, teacherIds } =
      c.req.valid('json');
    const normalizedTeacherIds = Array.from(new Set(teacherIds));

    const [missingTeacher] = await db
      .select({ id: teacher.id })
      .from(teacher)
      .where(eq(teacher.id, missingTeacherId))
      .limit(1);

    if (!missingTeacher) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Teacher not found',
      });
    }

    const weekday = date.getDay();

    const missingTeacherLessons = await db
      .select()
      .from(lesson)
      .where(arrayContains(lesson.teacherIds, [missingTeacherId]));

    const enrichedMissingTeacherLessons = await enrichLessons(
      missingTeacherLessons
    );
    const availableLessons = enrichedMissingTeacherLessons.filter(
      (currentLesson) =>
        currentLesson.day
          ? isMatchingWeekday(
              weekday,
              currentLesson.day.name,
              currentLesson.day.short
            )
          : false
    );

    const selectedLessonIdsSet = new Set(selectedLessonIds);
    const selectedLessons = availableLessons.filter((currentLesson) =>
      selectedLessonIdsSet.has(currentLesson.id)
    );

    const selectedPeriods = selectedLessons
      .map((currentLesson) => currentLesson.period?.period)
      .filter(
        (currentPeriod): currentPeriod is number =>
          typeof currentPeriod === 'number'
      );

    if (selectedPeriods.length === 0) {
      return c.json<
        SuccessResponse<{
          availableLessons: typeof availableLessons;
          substituteCandidates: [];
        }>
      >({
        data: {
          availableLessons,
          substituteCandidates: [],
        },
        success: true,
      });
    }

    const minPeriod = Math.min(...selectedPeriods);
    const maxPeriod = Math.max(...selectedPeriods);

    const candidateTeacherIds = normalizedTeacherIds.filter(
      (teacherId) => teacherId !== missingTeacherId
    );

    if (candidateTeacherIds.length === 0) {
      return c.json<
        SuccessResponse<{
          availableLessons: typeof availableLessons;
          substituteCandidates: [];
        }>
      >({
        data: {
          availableLessons,
          substituteCandidates: [],
        },
        success: true,
      });
    }

    const candidateTeachers = await db
      .select({
        firstName: teacher.firstName,
        id: teacher.id,
        lastName: teacher.lastName,
        short: teacher.short,
      })
      .from(teacher)
      .where(inArray(teacher.id, candidateTeacherIds));

    const candidateLessons = await db
      .select()
      .from(lesson)
      .where(
        or(
          ...candidateTeacherIds.map((teacherId) =>
            arrayContains(lesson.teacherIds, [teacherId])
          )
        )
      );

    const enrichedCandidateLessons = await enrichLessons(candidateLessons);
    const candidateLessonsByTeacherId = new Map<string, number[]>();

    for (const candidateLesson of enrichedCandidateLessons) {
      if (
        !(
          candidateLesson.day &&
          isMatchingWeekday(
            weekday,
            candidateLesson.day.name,
            candidateLesson.day.short
          )
        )
      ) {
        continue;
      }

      const currentPeriod = candidateLesson.period?.period;
      if (typeof currentPeriod !== 'number') {
        continue;
      }

      for (const lessonTeacher of candidateLesson.teachers) {
        if (!candidateTeacherIds.includes(lessonTeacher.id)) {
          continue;
        }

        const periods = candidateLessonsByTeacherId.get(lessonTeacher.id) ?? [];
        periods.push(currentPeriod);
        candidateLessonsByTeacherId.set(lessonTeacher.id, periods);
      }
    }

    const substituteCandidates = candidateTeachers
      .map((currentTeacher) => {
        const occupiedPeriods = new Set(
          candidateLessonsByTeacherId.get(currentTeacher.id) ?? []
        );

        const hasPeriodConflict = selectedPeriods.some((selectedPeriod) =>
          occupiedPeriods.has(selectedPeriod)
        );

        if (hasPeriodConflict) {
          return null;
        }

        const hasLessonBeforeOrAfter =
          occupiedPeriods.has(minPeriod - 1) ||
          occupiedPeriods.has(maxPeriod + 1);

        return {
          hasLessonBeforeOrAfter,
          teacher: currentTeacher,
        };
      })
      .filter(
        (candidate): candidate is NonNullable<typeof candidate> =>
          candidate !== null
      )
      .sort((a, b) => {
        if (a.hasLessonBeforeOrAfter !== b.hasLessonBeforeOrAfter) {
          return a.hasLessonBeforeOrAfter ? -1 : 1;
        }

        const aName = `${a.teacher.lastName} ${a.teacher.firstName}`;
        const bName = `${b.teacher.lastName} ${b.teacher.firstName}`;
        return aName.localeCompare(bName);
      });

    return c.json<
      SuccessResponse<{
        availableLessons: typeof availableLessons;
        substituteCandidates: typeof substituteCandidates;
      }>
    >({
      data: {
        availableLessons,
        substituteCandidates,
      },
      success: true,
    });
  }
);

export const getLessonsForRoom = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Lesson', enrichedLessonType),
    description: 'Get lessons for a given classroom from the database.',
    parameters: [
      {
        in: 'path',
        name: 'classroomId',
        required: true,
        schema: {
          description: 'The unique identifier for the classroom.',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(responseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Lesson'],
  }),
  zValidator('param', z.object({ classroomId: z.uuid() })),
  async (c) => {
    const { classroomId } = c.req.valid('param');

    const [existingClassroom] = await db
      .select()
      .from(classroom)
      .where(eq(classroom.id, classroomId))
      .limit(1);

    if (!existingClassroom) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Classroom not found',
      });
    }

    const lessons = await db
      .select()
      .from(lesson)
      .where(arrayContains(lesson.classroomIds, [classroomId]));

    if (lessons.length === 0) {
      return c.json<SuccessResponse<[]>>({ data: [], success: true });
    }

    const enriched = await enrichLessons(lessons);

    return c.json<SuccessResponse<typeof enriched>>({
      data: enriched,
      success: true,
    });
  }
);

export const getLessonForId = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Lesson',
      '@unit EnrichedLesson @field(.classrooms, List<Classroom>) @field(.day, DayDefinition) @field(.period, Period) @field(.subject, Subject) @field(.teachers, List<TeacherSummary>)'
    ),
    description: 'Get a lesson by its ID from the database.',
    parameters: [
      {
        in: 'path',
        name: 'lessonId',
        required: true,
        schema: {
          description: 'The unique identifier for the lesson.',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                data: enrichedLessonSchema
                  .extend({
                    substitutionCohortName: z.string().nullable(),
                  })
                  .nullable(),
                success: z.boolean(),
              })
            ),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Lesson'],
  }),
  zValidator('param', z.object({ lessonId: z.uuid() })),
  async (c) => {
    const { lessonId } = c.req.valid('param');

    const lessonRow = await db
      .select()
      .from(lesson)
      .where(eq(lesson.id, lessonId))
      .limit(1);

    if (!lessonRow) {
      return c.json({
        data: null,
        success: true,
      });
    }

    const substitutionCohortRow = await db
      .select({ name: cohort.name })
      .from(substitutionLessonMTM)
      .innerJoin(
        lessonCohortMTM,
        eq(substitutionLessonMTM.lessonId, lessonCohortMTM.lessonId)
      )
      .innerJoin(cohort, eq(lessonCohortMTM.cohortId, cohort.id))
      .where(eq(substitutionLessonMTM.lessonId, lessonId))
      .limit(1);

    const [enriched] = await enrichLessons(lessonRow);

    return c.json({
      data: {
        ...enriched,
        substitutionCohortName:
          substitutionCohortRow.length > 0
            ? (substitutionCohortRow[0]?.name ?? null)
            : null,
      },
      success: true,
    });
  }
);
