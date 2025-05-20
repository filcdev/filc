'use client'

import { Day, WeekType } from '@/lib/editor/conflict'
import { mockCohorts, mockPeriods, mockTimetableData } from '@/lib/editor/mock'

interface PrintableTimetableProps {
  view: 'school' | 'cohort' | 'teacher' | 'room'
  selectedItems: string[]
  weekType: WeekType
  showHeader: boolean
  headerText: string
  showFooter: boolean
  footerText: string
  paperSize: string
  orientation: string
}

export function PrintableTimetable({
  view,
  selectedItems,
  weekType,
  showHeader,
  headerText,
  showFooter,
  footerText,
  paperSize,
  orientation,
}: PrintableTimetableProps) {
  const days = Object.values(Day).filter(
    day => day !== Day.Saturday && day !== Day.Sunday
  )

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPageStyle = () => {
    const size =
      paperSize === 'a4'
        ? '210mm 297mm'
        : paperSize === 'letter'
          ? '215.9mm 279.4mm'
          : '215.9mm 355.6mm'

    return {
      width:
        orientation === 'portrait' ? size.split(' ')[0] : size.split(' ')[1],
      height:
        orientation === 'portrait' ? size.split(' ')[1] : size.split(' ')[0],
    }
  }

  const renderSchoolView = () => {
    return (
      <div className='space-y-8'>
        <h2 className='text-xl font-bold'>School-wide Timetable</h2>
        {days.map(day => (
          <div key={day} className='space-y-2'>
            <h3 className='text-lg font-semibold capitalize'>{day}</h3>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='bg-muted'>
                  <th className='border p-2 text-left'>Period</th>
                  {mockCohorts.map(cohort => (
                    <th key={cohort.id} className='border p-2 text-left'>
                      {cohort.designation}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockPeriods.map(period => (
                  <tr key={period.id}>
                    <td className='border p-2 bg-muted'>
                      <div className='font-medium'>{period.name}</div>
                      <div className='text-xs text-muted-foreground'>
                        {formatTime(period.startTime)} -{' '}
                        {formatTime(period.endTime)}
                      </div>
                    </td>
                    {mockCohorts.map(cohort => {
                      const lessons = mockTimetableData.filter(
                        lesson =>
                          lesson.day === day &&
                          lesson.periods.some(p => p.periodId === period.id) &&
                          lesson.cohort === cohort.designation &&
                          (lesson.weekType === weekType ||
                            lesson.weekType === WeekType.All ||
                            weekType === WeekType.All)
                      )
                      return (
                        <td key={cohort.id} className='border p-2'>
                          {lessons.map(lesson => (
                            <div key={lesson.id} className='text-xs'>
                              <div className='font-medium'>
                                {lesson.subject}
                              </div>
                              <div className='flex justify-between'>
                                <span>{lesson.teacher}</span>
                                <span>{lesson.room}</span>
                              </div>
                              {lesson.weekType !== WeekType.All && (
                                <div className='text-xs'>
                                  Week {lesson.weekType.toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    )
  }

  const renderCohortView = () => {
    return (
      <div className='space-y-8'>
        {selectedItems.map(cohortName => (
          <div key={cohortName} className='page-break-after'>
            <h2 className='text-xl font-bold mb-4'>Cohort: {cohortName}</h2>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='bg-muted'>
                  <th className='border p-2 text-left'>Period</th>
                  {days.map(day => (
                    <th key={day} className='border p-2 text-left capitalize'>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockPeriods.map(period => (
                  <tr key={period.id}>
                    <td className='border p-2 bg-muted'>
                      <div className='font-medium'>{period.name}</div>
                      <div className='text-xs text-muted-foreground'>
                        {formatTime(period.startTime)} -{' '}
                        {formatTime(period.endTime)}
                      </div>
                    </td>
                    {days.map(day => {
                      const lessons = mockTimetableData.filter(
                        lesson =>
                          lesson.day === day &&
                          lesson.periods.some(p => p.periodId === period.id) &&
                          lesson.cohort === cohortName &&
                          (lesson.weekType === weekType ||
                            lesson.weekType === WeekType.All ||
                            weekType === WeekType.All)
                      )
                      return (
                        <td key={day} className='border p-2'>
                          {lessons.map(lesson => (
                            <div key={lesson.id} className='text-xs'>
                              <div className='font-medium'>
                                {lesson.subject}
                              </div>
                              <div className='flex justify-between'>
                                <span>{lesson.teacher}</span>
                                <span>{lesson.room}</span>
                              </div>
                              {lesson.weekType !== WeekType.All && (
                                <div className='text-xs'>
                                  Week {lesson.weekType.toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    )
  }

  const renderTeacherView = () => {
    return (
      <div className='space-y-8'>
        {selectedItems.map(teacherName => (
          <div key={teacherName} className='page-break-after'>
            <h2 className='text-xl font-bold mb-4'>Teacher: {teacherName}</h2>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='bg-muted'>
                  <th className='border p-2 text-left'>Period</th>
                  {days.map(day => (
                    <th key={day} className='border p-2 text-left capitalize'>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockPeriods.map(period => (
                  <tr key={period.id}>
                    <td className='border p-2 bg-muted'>
                      <div className='font-medium'>{period.name}</div>
                      <div className='text-xs text-muted-foreground'>
                        {formatTime(period.startTime)} -{' '}
                        {formatTime(period.endTime)}
                      </div>
                    </td>
                    {days.map(day => {
                      const lessons = mockTimetableData.filter(
                        lesson =>
                          lesson.day === day &&
                          lesson.periods.some(p => p.periodId === period.id) &&
                          lesson.teacher === teacherName &&
                          (lesson.weekType === weekType ||
                            lesson.weekType === WeekType.All ||
                            weekType === WeekType.All)
                      )
                      return (
                        <td key={day} className='border p-2'>
                          {lessons.map(lesson => (
                            <div key={lesson.id} className='text-xs'>
                              <div className='font-medium'>
                                {lesson.subject}
                              </div>
                              <div className='flex justify-between'>
                                <span>{lesson.cohort}</span>
                                <span>{lesson.room}</span>
                              </div>
                              {lesson.weekType !== WeekType.All && (
                                <div className='text-xs'>
                                  Week {lesson.weekType.toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    )
  }

  const renderRoomView = () => {
    return (
      <div className='space-y-8'>
        {selectedItems.map(roomName => (
          <div key={roomName} className='page-break-after'>
            <h2 className='text-xl font-bold mb-4'>Room: {roomName}</h2>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='bg-muted'>
                  <th className='border p-2 text-left'>Period</th>
                  {days.map(day => (
                    <th key={day} className='border p-2 text-left capitalize'>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockPeriods.map(period => (
                  <tr key={period.id}>
                    <td className='border p-2 bg-muted'>
                      <div className='font-medium'>{period.name}</div>
                      <div className='text-xs text-muted-foreground'>
                        {formatTime(period.startTime)} -{' '}
                        {formatTime(period.endTime)}
                      </div>
                    </td>
                    {days.map(day => {
                      const lessons = mockTimetableData.filter(
                        lesson =>
                          lesson.day === day &&
                          lesson.periods.some(p => p.periodId === period.id) &&
                          lesson.room === roomName &&
                          (lesson.weekType === weekType ||
                            lesson.weekType === WeekType.All ||
                            weekType === WeekType.All)
                      )
                      return (
                        <td key={day} className='border p-2'>
                          {lessons.map(lesson => (
                            <div key={lesson.id} className='text-xs'>
                              <div className='font-medium'>
                                {lesson.subject}
                              </div>
                              <div className='flex justify-between'>
                                <span>{lesson.cohort}</span>
                                <span>{lesson.teacher}</span>
                              </div>
                              {lesson.weekType !== WeekType.All && (
                                <div className='text-xs'>
                                  Week {lesson.weekType.toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className='print-container' style={getPageStyle()}>
      <style jsx={true} global={true}>{`
        @media print {
          @page {
            size: ${paperSize} ${orientation};
            margin: 1cm;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .page-break-after {
            page-break-after: always;
          }
          
          .print-container {
            width: 100% !important;
            height: auto !important;
          }
        }
      `}</style>

      {showHeader && (
        <header className='text-center py-4 border-b mb-4'>
          <h1 className='text-2xl font-bold'>{headerText}</h1>
        </header>
      )}

      <main>
        {view === 'school' && renderSchoolView()}
        {view === 'cohort' && renderCohortView()}
        {view === 'teacher' && renderTeacherView()}
        {view === 'room' && renderRoomView()}
      </main>

      {showFooter && (
        <footer className='text-center py-4 border-t mt-4 text-sm text-muted-foreground'>
          {footerText}
        </footer>
      )}
    </div>
  )
}
