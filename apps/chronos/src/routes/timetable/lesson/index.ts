import { eq, inArray, sql } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import {
  classroom,
  cohort,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  period,
  subject,
  teacher,
} from '#database/schema/timetable';
import type { SuccessResponse } from '#utils/globals';
import { ensureJsonSafeDates } from '#utils/zod';
import { timetableFactory } from '../_factory';

const getForCohortResponseSchema = z.object({
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
            schema: resolver(ensureJsonSafeDates(getForCohortResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Lesson'],
  }),
  async (c) => {
    const cohortId = c.req.param('cohortId');
    if (!cohortId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing cohortId',
      });
    }

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

    const subjectIds = Array.from(new Set(lessons.map((l) => l.subjectId)));
    const dayIds = Array.from(new Set(lessons.map((l) => l.dayDefinitionId)));
    const periodIds = Array.from(new Set(lessons.map((l) => l.periodId)));
    const teacherIds = Array.from(
      new Set(
        lessons.flatMap((l) =>
          Array.isArray(l.teacherIds) ? l.teacherIds : []
        )
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

    const enriched = lessons.map((l) => {
      const tIds = (
        Array.isArray(l.teacherIds) ? l.teacherIds : []
      ) as string[];
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

    return c.json<SuccessResponse<typeof enriched>>({
      data: enriched,
      success: true,
    });
  }
);

const getForTeacherResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(lesson)).array(),
  success: z.boolean(),
});

const getForRoomResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(lesson)).array(),
  success: z.boolean(),
});

export const getLessonsForTeacher = timetableFactory.createHandlers(
  describeRoute({
    description: 'Get lessons for a given teacher from the database.',
    parameters: [
      {
        in: 'path',
        name: 'teacher_id',
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
            schema: resolver(ensureJsonSafeDates(getForTeacherResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Lesson'],
  }),
  async (c) => {
    const teacherId = c.req.param('teacher_id');
    if (!teacherId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing teacher_id',
      });
    }

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
      .where(sql`${lesson.teacherIds} @> ${JSON.stringify([teacherId])}`);

    if (lessons.length === 0) {
      return c.json<SuccessResponse<[]>>({ data: [], success: true });
    }

    const subjectIds = Array.from(new Set(lessons.map((l) => l.subjectId)));
    const dayIds = Array.from(new Set(lessons.map((l) => l.dayDefinitionId)));
    const periodIds = Array.from(new Set(lessons.map((l) => l.periodId)));
    const teacherIds = Array.from(
      new Set(
        lessons.flatMap((l) =>
          Array.isArray(l.teacherIds) ? l.teacherIds : []
        )
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

    const enriched = lessons.map((l) => {
      const tIds = (
        Array.isArray(l.teacherIds) ? l.teacherIds : []
      ) as string[];
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
        name: 'classroom_id',
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
            schema: resolver(ensureJsonSafeDates(getForRoomResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Lesson'],
  }),
  async (c) => {
    const classroomId = c.req.param('classroom_id');
    if (!classroomId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing classroom_id',
      });
    }

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
      .where(sql`${lesson.classroomIds} @> ${JSON.stringify([classroomId])}`);

    if (lessons.length === 0) {
      return c.json<SuccessResponse<[]>>({ data: [], success: true });
    }

    const subjectIds = Array.from(new Set(lessons.map((l) => l.subjectId)));
    const dayIds = Array.from(new Set(lessons.map((l) => l.dayDefinitionId)));
    const periodIds = Array.from(new Set(lessons.map((l) => l.periodId)));
    const teacherIds = Array.from(
      new Set(
        lessons.flatMap((l) =>
          Array.isArray(l.teacherIds) ? l.teacherIds : []
        )
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

    const enriched = lessons.map((l) => {
      const tIds = (
        Array.isArray(l.teacherIds) ? l.teacherIds : []
      ) as string[];
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

    return c.json<SuccessResponse<typeof enriched>>({
      data: enriched,
      success: true,
    });
  }
);
