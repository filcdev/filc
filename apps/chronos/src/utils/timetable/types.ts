export type TimetableExportRoot = {
  timetable: Timetable;
};

export type Timetable = {
  days: Days;
  periods: Periods;
  grades: Grades;
  subjects: Subjects;
  teachers: Teachers;
  classrooms: Classrooms;
  studentsubjects: Studentsubjects;
  classes: Classes;
  students: Students;
  cards: Cards;
  lessons: Lessons;
  OptionalClasses: string;
  StudentOptionalClasses: string;
  TeacherSubjectClasses: TeacherSubjectClasses;
  StudentEssentialClasses: string;
  TimeTableSchedules: TimeTableSchedules;
  _ascttversion: string;
  _importtype: string;
  _options: string;
  _displayname: string;
  _displaycountries: string;
  _displayinmenu: string;
};

export type Days = {
  day: Day[];
  _options: string;
  _columns: string;
};

export type Day = {
  _name: string;
  _short: string;
  _day: string;
};

export type Periods = {
  period: Period[];
  _options: string;
  _columns: string;
};

export type Period = {
  _period: string;
  _starttime: string;
  _endtime: string;
};

export type Grades = {
  grade: Grade[];
  _options: string;
  _columns: string;
};

export type Grade = {
  _id: string;
  _name: string;
};

export type Subjects = {
  subject: Subject[];
  _options: string;
  _columns: string;
};

export type Subject = {
  _id: string;
  _name: string;
  _short: string;
};

export type Teachers = {
  teacher: Teacher[];
  _options: string;
  _columns: string;
};

export type Teacher = {
  _id: string;
  _name: string;
  _short: string;
  _gender: string;
  _color: string;
};

export type Classrooms = {
  classroom: Classroom[];
  _options: string;
  _columns: string;
};

export type Classroom = {
  _id: string;
  _name: string;
  _short: string;
  _capacity: string;
};

export type Studentsubjects = {
  _options: string;
  _columns: string;
};

export type Classes = {
  class: Class[];
  _options: string;
  _columns: string;
};

export type Class = {
  _id: string;
  _name: string;
  _short: string;
  _teacherid: string;
  _gradeid: string;
};

export type Students = {
  _options: string;
  _columns: string;
};

export type Cards = {
  card: Card[];
  _options: string;
  _columns: string;
};

export type Card = {
  _classids: string;
  _subjectid: string;
  _lessonid: string;
  _teacherid: string;
  _classroomid: string;
  _studentids: string;
  _day: string;
  _period: string;
};

export type Lessons = {
  lesson: Lesson[];
  _options: string;
  _columns: string;
};

export type Lesson = {
  _id: string;
  _classids: string;
  _subjectid: string;
  _periodsperweek: string;
  _teacherid: string;
  _studentids: string;
  _capacity: string;
  _seminargroup: string;
};

export type TeacherSubjectClasses = {
  TeacherSubjectClass: TeacherSubjectClass[];
};

export type TeacherSubjectClass = {
  _OptionalClassID: string;
  _SubjectGradeID: string;
  _ClassID: string;
  _TeacherID: string;
};

export type TimeTableSchedules = {
  TimeTableSchedule: TimeTableSchedule[];
};

export type TimeTableSchedule = {
  _DayID: string;
  _Period: string;
  _LengthID?: string;
  _SchoolRoomID: string;
  _SubjectGradeID: string;
  _ClassID: string;
  _OptionalClassID: string;
  _TeacherID: string;
};
