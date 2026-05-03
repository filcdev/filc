export const queryKeys = {
  classrooms: () => ['classrooms'] as const,
  cohorts: () => ['cohorts'] as const,

  doorlock: {
    cards: () => ['doorlock', 'cards'] as const,
    cardUsers: () => ['doorlock', 'card-users'] as const,
    deviceStats: (deviceId: string) =>
      ['doorlock', 'devices', deviceId, 'stats'] as const,
    devices: () => ['doorlock', 'devices'] as const,
    logs: (
      deviceFilter: string,
      cardFilter: string,
      userFilter: string,
      accessFilter: string,
      dateFrom: string,
      dateTo: string,
      search: string
    ) =>
      [
        'doorlock',
        'logs',
        deviceFilter,
        cardFilter,
        userFilter,
        accessFilter,
        dateFrom,
        dateTo,
        search,
      ] as const,
    selfCards: () => ['doorlock', 'self-cards'] as const,
    stats: () => ['doorlock', 'stats'] as const,
  },
  lessons: () => ['lessons'] as const,
  movedLessons: () => ['movedLessons'] as const,

  news: {
    adminSystemMessages: () => ['admin-system-messages'] as const,
    announcements: () => ['announcements'] as const,
    announcementsPanel: () => ['announcements-panel'] as const,
    systemMessagesBanner: () => ['system-messages-banner'] as const,
    systemMessagesPanel: () => ['system-messages-panel'] as const,
  },
  permissions: () => ['permissions'] as const,
  roles: () => ['roles'] as const,
  substitutions: () => ['substitutions'] as const,
  teachers: () => ['teachers'] as const,

  timetable: {
    availableClassrooms: (
      date: unknown,
      startingDay: unknown,
      startingPeriod: unknown
    ) =>
      ['classrooms', 'available', date, startingDay, startingPeriod] as const,
    cohortLessons: (data: unknown) => ['cohort-lessons', data] as const,
    cohorts: (timetableId: string | null | undefined) =>
      ['cohorts', timetableId] as const,
    lessons: (
      filter: string | null,
      selectionId: string | null,
      timetableId: string | null
    ) => ['lessons', filter, selectionId, timetableId] as const,
    lessonsByCohort: (cohortId: string | null | undefined) =>
      ['lessons', 'cohort', cohortId] as const,
    /** Used to broadly invalidate all timetable-related data after import */
    root: () => ['timetable'] as const,
    substituteCandidates: (
      missingTeacher: string | null,
      date: string | undefined,
      lessonIds: string,
      teacherIds: string
    ) =>
      [
        'substitute-candidates',
        missingTeacher,
        date,
        lessonIds,
        teacherIds,
      ] as const,
  },
  timetables: () => ['timetables'] as const,
  users: (page: number, search: string) => ['users', page, search] as const,
  usersAll: () => ['users'] as const,
};
