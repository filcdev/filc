import type {
  Day as DayType,
  WeekType as WeekTypeValue,
} from '@filc/db/schema/timetable'
import { mockPeriods } from './mock'

export enum WeekType {
  A = 'a',
  B = 'b',
  All = 'all',
  None = 'none',
}

export enum Day {
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Saturday = 'saturday',
  Sunday = 'sunday',
}

interface Period {
  periodId: string
}

interface Lesson {
  id: string
  day: DayType
  weekType: WeekTypeValue
  subject: string
  teacher: string
  room: string
  cohort: string
  periods: Period[]
}

interface Conflict {
  type?: 'Teacher' | 'Room' | 'Cohort'
  day?: DayType
  periodName?: string
  weekType?: WeekTypeValue
  lesson1?: Lesson
  lesson2?: Lesson
  message: string
}

// Function to detect conflicts in the timetable
export function detectConflicts(timetableData: Lesson[]): Conflict[] {
  const conflicts: Conflict[] = []

  // Helper function to check if two lessons overlap in time
  const doPeriodsOverlap = (periods1: Period[], periods2: Period[]) => {
    return periods1.some(p1 => periods2.some(p2 => p1.periodId === p2.periodId))
  }

  // Helper function to check if week types overlap
  const doWeekTypesOverlap = (
    weekType1: WeekTypeValue,
    weekType2: WeekTypeValue
  ) => {
    if (weekType1 === WeekType.All || weekType2 === WeekType.All) {
      return true
    }
    return weekType1 === weekType2
  }

  // Check each lesson against every other lesson
  for (let i = 0; i < timetableData.length; i++) {
    const lesson1 = timetableData[i]

    if (!lesson1) continue

    for (let j = i + 1; j < timetableData.length; j++) {
      const lesson2 = timetableData[j]

      if (!lesson2) continue

      // Skip if lessons are on different days
      if (lesson1.day !== lesson2.day) {
        continue
      }

      // Skip if lessons don't overlap in time
      if (!doPeriodsOverlap(lesson1.periods, lesson2.periods)) {
        continue
      }

      // Skip if lessons don't overlap in week type
      if (!doWeekTypesOverlap(lesson1.weekType, lesson2.weekType)) {
        continue
      }

      // Check for teacher conflicts
      if (lesson1.teacher === lesson2.teacher) {
        const periodName = lesson1.periods[0]
          ? getPeriodName(lesson1.periods[0].periodId)
          : 'Unknown'
        conflicts.push({
          type: 'Teacher',
          day: lesson1.day,
          periodName,
          weekType: getOverlappingWeekType(lesson1.weekType, lesson2.weekType),
          lesson1,
          lesson2,
          message: `Teacher ${lesson1.teacher} is scheduled for two different classes at the same time`,
        })
      }

      // Check for room conflicts
      if (lesson1.room === lesson2.room) {
        const periodName = lesson1.periods[0]
          ? getPeriodName(lesson1.periods[0].periodId)
          : 'Unknown'
        conflicts.push({
          type: 'Room',
          day: lesson1.day,
          periodName,
          weekType: getOverlappingWeekType(lesson1.weekType, lesson2.weekType),
          lesson1,
          lesson2,
          message: `Room ${lesson1.room} is scheduled for two different classes at the same time`,
        })
      }

      // Check for cohort conflicts
      if (lesson1.cohort === lesson2.cohort) {
        const periodName = lesson1.periods[0]
          ? getPeriodName(lesson1.periods[0].periodId)
          : 'Unknown'
        conflicts.push({
          type: 'Cohort',
          day: lesson1.day,
          periodName,
          weekType: getOverlappingWeekType(lesson1.weekType, lesson2.weekType),
          lesson1,
          lesson2,
          message: `Cohort ${lesson1.cohort} is scheduled for two different classes at the same time`,
        })
      }
    }
  }

  return conflicts
}

// Function to detect conflicts for a specific lesson
export function detectLessonConflicts(lesson: Partial<Lesson>): Conflict[] {
  const conflicts: Conflict[] = []

  // Validate periods
  if (!lesson.periods || lesson.periods.length === 0) {
    conflicts.push({
      message: 'You must select at least one period',
    })
  }

  // Validate required fields
  if (!lesson.subject) {
    conflicts.push({
      message: 'Subject is required',
    })
  }

  if (!lesson.teacher) {
    conflicts.push({
      message: 'Teacher is required',
    })
  }

  if (!lesson.room) {
    conflicts.push({
      message: 'Room is required',
    })
  }

  if (!lesson.cohort) {
    conflicts.push({
      message: 'Cohort is required',
    })
  }

  return conflicts
}

// Helper function to get period name from period ID
function getPeriodName(periodId: string): string {
  const period = mockPeriods.find(p => p.id === periodId)
  return period ? period.name : 'Unknown Period'
}

// Helper function to get the overlapping week type
function getOverlappingWeekType(
  weekType1: WeekTypeValue,
  weekType2: WeekTypeValue
): WeekTypeValue {
  if (weekType1 === WeekType.All) {
    return weekType2
  }
  if (weekType2 === WeekType.All) {
    return weekType1
  }
  return weekType1 // They're the same if we got here
}
