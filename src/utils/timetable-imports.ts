import fs from "fs/promises";
import {
  teacher as teacherSchema,
  subject as subjectSchema,
  cohort as cohortSchema,
  dayDefinition as daySchema,
  period as periodSchema,
} from "../database/schema/timetable";
import { and, eq, or } from "drizzle-orm";
import { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DOMParser } from "@xmldom/xmldom";

export const importTimetableXML = async (
  path: string,
  db: BunSQLDatabase<Record<string, never>>,
) => {
  try {
    const parser = new DOMParser();
    const xmlString = await fs.readFile(path, "utf8");

    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    /*
    Maps used for remapping UUIDs for existing things and
    Creating whole new objects for others.
    */
    // let teacherMap: Map<string, string> = await loadTeachers(xmlDoc, db);
    let studentMap: Map<string, string> = new Map();
    // let subjectMap: Map<string, string> = await loadSubjects(xmlDoc, db);
    let lessonMap: Map<string, string> = new Map();
    let dayMap: Map<string, string> = new Map();
    let periodMap: Map<string, string> = new Map();

    const timetable = xmlDoc.getElementsByTagName("TimeTableSchedules");

    // for (var i = 0; i < timetable.length; i++) {
    //   const lesson = timetable.item(i);
    //   if (!lesson) {
    //     return;
    //   }

    //   const id = lesson.getAttribute("id");
    // }
  } catch (error) {
    console.log(error);
  }
};

const loadPeriod = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>,
) => {
  let result: Map<string, string> = new Map();
  let periods = xmlDoc.getElementsByTagName("period");

  for (var i = 0; i < periods.length; i++) {
    const period = periods.item(i);
    if (!period) {
      return result;
    }

    const predefinedId = period.getAttribute("period");
    const end_time = period.getAttribute("endtime");
    const start_time = period.getAttribute("starttime");

    if (!predefinedId || !start_time || !end_time) {
      throw new Error(
        "Incomplete data for cohort, unable to get all attributes",
      );
    }

    const [existingPeriod] = await db
      .select()
      .from(periodSchema)
      .where(eq(periodSchema.period, Number(predefinedId)))
      .limit(1);

    if (existingPeriod) {
      result.set(String(existingPeriod.period), existingPeriod.id);
    } else if (existingPeriod) {
      const [insertedPeriod] = await db
        .insert(periodSchema)
        .values({
          id: crypto.randomUUID(),
          period: Number(predefinedId),
          startTime: start_time,
          endTime: end_time,
        })
        .returning({ insertedId: periodSchema.id });

      if (insertedPeriod) {
        result.set(predefinedId, insertedPeriod.insertedId);
      }
    }
  }

  return result;
};

const loadDays = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>,
): Promise<Map<string, string>> => {
  let result: Map<string, string> = new Map();
  let days = xmlDoc.getElementsByTagName("day");

  for (var i = 0; i < days.length; i++) {
    const day = days.item(i);
    if (!day) {
      return result;
    }

    const predefinedId = day.getAttribute("id");
    const name = day.getAttribute("name");
    const short = day.getAttribute("short");

    if (!name || !predefinedId || !short) {
      throw new Error(
        "Incomplete data for cohort, unable to get all attributes",
      );
    }

    const [existingDay] = await db
      .select()
      .from(cohortSchema)
      .where(eq(cohortSchema.name, name))
      .limit(1);

    if (existingDay) {
      result.set(predefinedId, existingDay.id);
    } else if (existingDay) {
      const [insertedDay] = await db
        .insert(daySchema)
        .values({
          id: crypto.randomUUID(),
          name,
          short,
        })
        .returning({ insertedId: daySchema.id });

      if (insertedDay) {
        result.set(predefinedId, insertedDay.insertedId);
      }
    }
  }

  return result;
};

const loadSubjects = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>,
): Promise<Map<string, string>> => {
  let result: Map<string, string> = new Map();
  let subjects = xmlDoc.getElementsByTagName("subjects");

  for (var i = 0; i < subjects.length; i++) {
    const subject = subjects.item(i);
    if (!subject) {
      throw new Error(`Failed to get subject at index: ${i}`);
    }

    const predefinedId = subject.getAttribute("id");
    const name = subject.getAttribute("name");
    const short = subject.getAttribute("short");

    if (!name || !predefinedId || !short) {
      throw new Error(
        "Incomplete data for subject, unable to get all attributes",
      );
    }

    const [existingSubject] = await db
      .select()
      .from(subjectSchema)
      .where(eq(subjectSchema.name, name))
      .limit(1);

    if (existingSubject) {
      result.set(predefinedId, existingSubject.id);
    } else {
      const [insertedSubject] = await db
        .insert(subjectSchema)
        .values({
          id: crypto.randomUUID(),
          name,
          short,
        })
        .returning({ insertedId: subjectSchema.id });

      if (insertedSubject) {
        result.set(predefinedId, insertedSubject.insertedId);
      }
    }
  }

  return result;
};

const loadTeachers = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>,
): Promise<Map<string, string>> => {
  let result: Map<string, string> = new Map();
  let teachers = xmlDoc.getElementsByTagName("teacher");

  for (var i = 0; i < teachers.length; i++) {
    const teacher = teachers.item(i);
    if (!teacher) {
      return result;
    }

    const predefinedId = teacher.getAttribute("id");
    const name = teacher.getAttribute("name");
    const short = teacher.getAttribute("short");
    const gender = teacher.getAttribute("gender");
    const color = teacher.getAttribute("color");

    if (!name || !predefinedId || !short || !gender || !color) {
      continue;
    }

    const names = splitName(name);
    const [existingTeacher] = await db
      .select()
      .from(teacherSchema)
      .where(
        and(
          eq(teacherSchema.firstName, names.firstName),
          eq(teacherSchema.lastName, names.restOfName),
        ),
      )
      .limit(1);

    if (existingTeacher) {
      result.set(predefinedId, existingTeacher.id);
    } else {
      const [insertedTeacher] = await db
        .insert(teacherSchema)
        .values({
          id: crypto.randomUUID(),
          firstName: names.firstName,
          lastName: names.restOfName,
          short,
          gender,
        })
        .returning({ insertedId: teacherSchema.id });

      if (insertedTeacher) {
        result.set(predefinedId, insertedTeacher.insertedId);
      }
    }
  }

  return result;
};

const splitName = (
  fullName: string,
): { firstName: string; restOfName: string } => {
  if (!fullName || typeof fullName !== "string") {
    return { firstName: "", restOfName: "" };
  }

  const trimmedName = fullName.trim();
  const firstSpaceIndex = trimmedName.indexOf(" ");

  if (firstSpaceIndex === -1) {
    return { firstName: trimmedName, restOfName: "" };
  }

  const firstName = trimmedName.substring(0, firstSpaceIndex);
  const restOfName = trimmedName.substring(firstSpaceIndex + 1).trim();

  return { firstName, restOfName };
};

const loadCohort = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>,
  teacherMap: Map<string, string>,
): Promise<Map<string, string>> => {
  let result: Map<string, string> = new Map();
  const cohorts = xmlDoc.getElementsByTagName("class");

  for (var i = 0; i < cohorts.length; i++) {
    const cohort = cohorts.item(i);
    if (!cohort) {
      return result;
    }

    const predefinedId = cohort.getAttribute("id");
    const name = cohort.getAttribute("name");
    const short = cohort.getAttribute("short");
    const predefinedTeacherId = cohort.getAttribute("teacherid");

    if (!name || !predefinedId || !short || !predefinedTeacherId) {
      throw new Error(
        "Incomplete data for cohort, unable to get all attributes",
      );
    }

    const teacherId = teacherMap.get(predefinedTeacherId);

    const [existingCohort] = await db
      .select()
      .from(cohortSchema)
      .where(eq(cohortSchema.name, name))
      .limit(1);

    if (existingCohort) {
      result.set(predefinedId, existingCohort.id);
    } else if (teacherId) {
      const [insertedCohort] = await db
        .insert(cohortSchema)
        .values({
          id: crypto.randomUUID(),
          name,
          short,
          teacherId,
        })
        .returning({ insertedId: cohortSchema.id });

      if (insertedCohort) {
        result.set(predefinedId, insertedCohort.insertedId);
      }
    }
  }

  return result;
};
