import type { Insert } from '@filc/db/types'
import { Day, WeekType } from './conflict'
import type { cohort } from '@filc/db/schema/timetable'

// Mock data for rooms
export const mockRooms = [
  {
    id: 'room1',
    name: 'Science Lab',
    shortName: 'SL',
    capacity: 30,
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'room2',
    name: 'Math Classroom',
    shortName: 'MC',
    capacity: 25,
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'room3',
    name: 'Computer Lab',
    shortName: 'CL',
    capacity: 20,
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'room4',
    name: 'Art Studio',
    shortName: 'AS',
    capacity: 15,
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
]

// Mock data for subjects
export const mockSubjects = [
  {
    id: 'subject1',
    name: 'Mathematics',
    shortName: 'MATH',
    icon: '🧮',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'subject2',
    name: 'Physics',
    shortName: 'PHYS',
    icon: '⚛️',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'subject3',
    name: 'Computer Science',
    shortName: 'CS',
    icon: '💻',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'subject4',
    name: 'Art',
    shortName: 'ART',
    icon: '🎨',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'subject5',
    name: 'English',
    shortName: 'ENG',
    icon: '📚',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
]

// Mock data for teachers
export const mockTeachers = [
  {
    id: 'teacher1',
    name: 'John Smith',
    shortName: 'JS',
    email: 'john.smith@school.edu',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'teacher2',
    name: 'Jane Doe',
    shortName: 'JD',
    email: 'jane.doe@school.edu',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'teacher3',
    name: 'Robert Johnson',
    shortName: 'RJ',
    email: 'robert.johnson@school.edu',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'teacher4',
    name: 'Emily Davis',
    shortName: 'ED',
    email: 'emily.davis@school.edu',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
]

// Mock data for cohorts
export const mockCohorts: Insert<typeof cohort>[] = [
  {
    id: 'cohort1',
    year: 2024,
    designation: '1A',
    classMasterId: 'teacher1',
    secondaryClassMasterId: 'teacher2',
    headquartersRoomId: 'room1',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'cohort2',
    year: 2024,
    designation: '1B',
    classMasterId: 'teacher3',
    secondaryClassMasterId: 'teacher4',
    headquartersRoomId: 'room2',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'cohort3',
    year: 2024,
    designation: '2A',
    classMasterId: 'teacher2',
    secondaryClassMasterId: 'teacher1',
    headquartersRoomId: 'room3',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'cohort4',
    year: 2024,
    designation: '2B',
    classMasterId: 'teacher4',
    secondaryClassMasterId: 'teacher3',
    headquartersRoomId: 'room4',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
]

// Mock data for periods
export const mockPeriods = [
  {
    id: 'period1',
    name: 'Period 1',
    startTime: '2023-01-01T08:00:00.000Z',
    endTime: '2023-01-01T08:45:00.000Z',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'period2',
    name: 'Period 2',
    startTime: '2023-01-01T08:50:00.000Z',
    endTime: '2023-01-01T09:35:00.000Z',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'period3',
    name: 'Period 3',
    startTime: '2023-01-01T09:40:00.000Z',
    endTime: '2023-01-01T10:25:00.000Z',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'period4',
    name: 'Period 4',
    startTime: '2023-01-01T10:30:00.000Z',
    endTime: '2023-01-01T11:15:00.000Z',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'period5',
    name: 'Period 5',
    startTime: '2023-01-01T11:20:00.000Z',
    endTime: '2023-01-01T12:05:00.000Z',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'period6',
    name: 'Period 6',
    startTime: '2023-01-01T12:10:00.000Z',
    endTime: '2023-01-01T12:55:00.000Z',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
]

// Mock data for timetables
export const mockTimetables = [
  {
    id: 'timetable1',
    name: 'Summer 2024',
    validFrom: '2024-05-01T00:00:00.000Z',
    validTo: '2024-08-31T00:00:00.000Z',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
  {
    id: 'timetable2',
    name: 'Winter 2024',
    validFrom: '2024-09-01T00:00:00.000Z',
    validTo: '2024-12-31T00:00:00.000Z',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  },
]

// Mock data for timetable view
export const mockTimetableData = [
  {
    id: 'lesson1',
    day: Day.Monday,
    weekType: WeekType.All,
    subject: 'Mathematics',
    teacher: 'John Smith',
    room: 'Math Classroom',
    cohort: '1A',
    periods: [{ periodId: 'period1' }],
  },
  {
    id: 'lesson2',
    day: Day.Monday,
    weekType: WeekType.All,
    subject: 'Physics',
    teacher: 'Jane Doe',
    room: 'Science Lab',
    cohort: '1A',
    periods: [{ periodId: 'period2' }],
  },
  {
    id: 'lesson3',
    day: Day.Tuesday,
    weekType: WeekType.A,
    subject: 'Computer Science',
    teacher: 'Robert Johnson',
    room: 'Computer Lab',
    cohort: '1A',
    periods: [{ periodId: 'period1' }, { periodId: 'period2' }],
  },
  {
    id: 'lesson4',
    day: Day.Tuesday,
    weekType: WeekType.B,
    subject: 'Art',
    teacher: 'Emily Davis',
    room: 'Art Studio',
    cohort: '1A',
    periods: [{ periodId: 'period1' }, { periodId: 'period2' }],
  },
  {
    id: 'lesson5',
    day: Day.Wednesday,
    weekType: WeekType.All,
    subject: 'English',
    teacher: 'Jane Doe',
    room: 'Math Classroom',
    cohort: '1A',
    periods: [{ periodId: 'period3' }],
  },
  {
    id: 'lesson6',
    day: Day.Thursday,
    weekType: WeekType.All,
    subject: 'Mathematics',
    teacher: 'John Smith',
    room: 'Math Classroom',
    cohort: '1A',
    periods: [{ periodId: 'period4' }],
  },
  {
    id: 'lesson7',
    day: Day.Friday,
    weekType: WeekType.All,
    subject: 'Physics',
    teacher: 'Jane Doe',
    room: 'Science Lab',
    cohort: '1A',
    periods: [{ periodId: 'period5' }, { periodId: 'period6' }],
  },
]
