import { zValidator } from '@hono/zod-validator';
import { arrayContains, eq, inArray } from 'drizzle-orm';
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
import { createSelectSchema, ensureJsonSafeDates } from '#utils/zod';
import { timetableFactory } from './_factory';

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

const responseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(lesson)).array(),
  success: z.boolean(),
});

export const getLessonsForCohort = timetableFactory.createHandlers(
  describeRoute({
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
            schema: resolver(ensureJsonSafeDates(responseSchema)),
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
            schema: resolver(ensureJsonSafeDates(responseSchema)),
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

export const getLessonsForRoom = timetableFactory.createHandlers(
  describeRoute({
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
            schema: resolver(ensureJsonSafeDates(responseSchema)),
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
              ensureJsonSafeDates(
                z.object({
                  data: createSelectSchema(lesson).nullable(),
                  success: z.boolean(),
                })
              )
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
