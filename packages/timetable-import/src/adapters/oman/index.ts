import { XMLParser } from 'fast-xml-parser';
import { decode } from 'iconv-lite';
import { z } from 'zod';
import type {
  ClassroomInput,
  CohortInput,
  LessonInput,
  TimetableImportModel,
} from '../../types';
import { normalizeName, type TimetableImportLogger } from '../../types';
import type { TimetableImportAdapter } from '../registry';
import { timetableExportRootSchema } from './schema';
import type { TimetableExportRoot } from './types';

// Leading honorifics must not be treated as a first name; stripping them keeps
// a titled teacher and the same teacher without a title on one row.
const TITLE_RE = /^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|miss\.?|doc\.?)\s+/i;

const splitName = (
  fullName: string
): { firstName: string; restOfName: string } => {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', restOfName: '' };
  }

  const name = fullName.trim().replace(TITLE_RE, '').trim();
  const firstSpaceIndex = name.indexOf(' ');

  if (firstSpaceIndex === -1) {
    return { firstName: name, restOfName: '' };
  }

  const firstName = name.slice(0, firstSpaceIndex);
  const restOfName = name.slice(firstSpaceIndex + 1).trim();

  return { firstName, restOfName };
};

const toModel = (root: TimetableExportRoot): TimetableImportModel => {
  const tt = root.timetable;

  const periods = tt.periods.period.map((p) => {
    const predefinedId = p._period;
    const endTime = p._endtime;
    const startTime = p._starttime;
    if (!(predefinedId !== undefined && startTime && endTime)) {
      throw new Error(
        'Incomplete data for period, unable to get all attributes'
      );
    }
    return {
      endTime,
      id: predefinedId,
      period: Number(predefinedId),
      startTime,
    };
  });

  const days = tt.days.day.map((d) => {
    const predefinedId = d._day;
    const name = d._name;
    const short = d._short;
    if (!(name && predefinedId !== undefined && short)) {
      throw new Error('Incomplete data for day, unable to get all attributes');
    }
    return { id: predefinedId, name, short };
  });

  const subjects = tt.subjects.subject.map((s) => {
    const predefinedId = s._id;
    const name = s._name;
    const short = s._short;
    if (!(name && predefinedId && short)) {
      throw new Error(
        `incomplete data for subject, unable to get all attributes: id=${predefinedId}, name=${name}, short=${short}`
      );
    }
    return { id: predefinedId, name: normalizeName(name), short };
  });

  const teachers = tt.teachers.teacher.map((t) => {
    const predefinedId = t._id;
    const name = t._name;
    const gender = t._gender;
    let short = t._short;
    if (!short) {
      short = '-';
    }
    if (!(name && predefinedId && gender)) {
      throw new Error(
        `incomplete data for teacher, unable to get all attributes: id=${predefinedId}, name=${name}, short=${short}, gender=${gender}`
      );
    }
    const names = splitName(name);
    return {
      firstName: names.firstName,
      id: predefinedId,
      lastName: names.restOfName,
      short,
    };
  });

  const classrooms = tt.classrooms.classroom.map((c): ClassroomInput => {
    const predefinedId = c._id;
    const name = c._name;
    const short = c._short;
    const capacityStr = c._capacity;
    if (!(predefinedId && name && short && capacityStr)) {
      throw new Error(
        'Incomplete data for classroom, unable to get all attributes'
      );
    }
    return {
      capacity: capacityStr === '*' ? null : Number.parseInt(capacityStr, 10),
      id: predefinedId,
      name: normalizeName(name),
      short,
    };
  });

  const cohorts = tt.classes.class
    .map((c): CohortInput | null => {
      const predefinedId = c._id;
      const name = c._name;
      const short = c._short;
      if (!(predefinedId && name && short)) {
        return null;
      }
      return {
        id: predefinedId,
        name: normalizeName(name),
        short,
        teacherId: c._teacherid || null,
      };
    })
    .filter((c): c is CohortInput => c !== null);

  const lessons = tt.TimeTableSchedules.TimeTableSchedule.map(
    (schedule, index): LessonInput => ({
      classroomIds: [schedule._SchoolRoomID].filter((v): v is string =>
        Boolean(v)
      ),
      cohortIds: [schedule._ClassID, schedule._OptionalClassID].filter(
        (v): v is string => Boolean(v)
      ),
      dayId: schedule._DayID,
      groupIds: [],
      id: String(index),
      periodId: schedule._Period,
      subjectId: schedule._SubjectGradeID,
      teacherIds: [schedule._TeacherID].filter((v): v is string => Boolean(v)),
      termId: null,
      weekId: 'A',
    })
  );

  return {
    classrooms,
    cohorts,
    days,
    groups: [],
    lessons,
    periods,
    subjects,
    teachers,
    terms: [],
    weeks: [],
  };
};

/**
 * Parse raw Oman timetable XML bytes into the normalized import model.
 *
 * The bytes are decoded as `win1250` (the encoding used by the Oman school
 * export), a stray `Period=""` attribute is stripped, and the document is
 * validated against the Oman XML schema before normalization.
 */
export const parseOmanTimetable = (
  input: Uint8Array,
  _logger?: TimetableImportLogger
): TimetableImportModel => {
  const decoded = decode(input, 'win1250');
  const cleaned = decoded.replaceAll('Period=""', '');

  const parser = new XMLParser({
    attributeNamePrefix: '_',
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseTagValue: true,
    textNodeName: 'text',
    trimValues: true,
  });

  const parsed = parser.parse(cleaned);
  const root = z.parse(timetableExportRootSchema, parsed);
  return toModel(root);
};

export const omanTimetableImportAdapter: TimetableImportAdapter = {
  detect(input: Uint8Array): boolean {
    const text = decode(input.slice(0, 4096), 'win1250');
    return text.includes('TimeTableSchedule');
  },
  format: 'oman',
  mimeTypes: ['text/xml', 'application/xml'],
  parse: parseOmanTimetable,
};
