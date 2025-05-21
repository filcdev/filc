import { Day, WeekType } from '@/lib/editor/conflict'
import { detectConflicts } from '@/lib/editor/conflict'
import {
  mockCohorts,
  mockPeriods,
  mockRooms,
  mockSubjects,
  mockTeachers,
  mockTimetableData,
} from '@/lib/editor/mock'
import type { lesson as Lesson } from '@filc/db/schema/timetable'
import type { Insert } from '@filc/db/types'
import { Alert, AlertDescription, AlertTitle } from '@filc/ui/components/alert'
import { Badge } from '@filc/ui/components/badge'
import { Button } from '@filc/ui/components/button'
import { Card, CardContent } from '@filc/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@filc/ui/components/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@filc/ui/components/select'
import { Tabs, TabsList, TabsTrigger } from '@filc/ui/components/tabs'
import { AlertCircle, AlertTriangle, CheckCircle2, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LessonForm } from './lesson-form'
import { PrintDialog } from './print-dialog'

// Get the type of the conflict array returned by detectConflicts 
// for proper type checking
type Conflicts = ReturnType<typeof detectConflicts>
type Conflict = Conflicts extends Array<infer T> ? T : never

// Define the structure of the lesson data as used in the timetable view
interface TimetableLesson {
  id: string
  day: Day
  weekType: WeekType
  subject: string
  teacher: string
  room: string
  cohort: string
  periods: { periodId: string }[]
}

// Map TimetableLesson to Insert<typeof Lesson> for database operations
const mapToDbLesson = (lesson: TimetableLesson): Insert<typeof Lesson> => {
  // Find IDs based on display names
  const subjectId = mockSubjects.find(s => s.name === lesson.subject)?.id || ''
  const teacherId = mockTeachers.find(t => t.name === lesson.teacher)?.id || ''
  const cohortId =
    mockCohorts.find(c => `${c.year} ${c.designation}`.trim() === lesson.cohort)
      ?.id || ''
  const roomId = mockRooms.find(r => r.name === lesson.room)?.id || ''

  return {
    id: lesson.id,
    day: lesson.day,
    weekType: lesson.weekType,
    subjectId,
    teacherId,
    cohortId,
    roomId,
    // Optional fields can be null/undefined
    timetableDayId: null,
  }
}

export function SchoolTimetableView() {
  const [selectedWeekType, setSelectedWeekType] = useState<WeekType>(
    WeekType.All
  )
  const [selectedTimetable, setSelectedTimetable] =
    useState<string>('Summer 2024')
  const [editingLesson, setEditingLesson] = useState<TimetableLesson | null>(
    null
  )
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'cohort' | 'teacher' | 'room'>(
    'cohort'
  )
  const [timetableData, setTimetableData] = 
    useState<TimetableLesson[]>(mockTimetableData)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [showConflicts, setShowConflicts] = useState(false)

  // Filter out weekend days
  const days = Object.values(Day).filter(
    day => day !== Day.Saturday && day !== Day.Sunday
  )

  useEffect(() => {
    // Check for conflicts whenever timetable data changes
    const detectedConflicts = detectConflicts(timetableData)
    setConflicts(detectedConflicts)
  }, [timetableData])

  const handleCellClick = (
    day: Day,
    periodId: string,
    cohortId?: string,
    teacherId?: string,
    roomId?: string
  ) => {
    // Find if there's a lesson at this slot
    let existingLesson: TimetableLesson | undefined
    
    if (viewMode === 'cohort' && cohortId) {
      existingLesson = timetableData.find(
        (lesson) =>
          lesson.day === day &&
          lesson.periods.some(p => p.periodId === periodId) &&
          lesson.cohort === cohortId &&
          (lesson.weekType === selectedWeekType ||
            lesson.weekType === WeekType.All ||
            selectedWeekType === WeekType.All)
      )
    } else if (viewMode === 'teacher' && teacherId) {
      existingLesson = timetableData.find(
        (lesson) =>
          lesson.day === day &&
          lesson.periods.some(p => p.periodId === periodId) &&
          lesson.teacher === teacherId &&
          (lesson.weekType === selectedWeekType ||
            lesson.weekType === WeekType.All ||
            selectedWeekType === WeekType.All)
      )
    } else if (viewMode === 'room' && roomId) {
      existingLesson = timetableData.find(
        (lesson) =>
          lesson.day === day &&
          lesson.periods.some(p => p.periodId === periodId) &&
          lesson.room === roomId &&
          (lesson.weekType === selectedWeekType ||
            lesson.weekType === WeekType.All ||
            selectedWeekType === WeekType.All)
      )
    }

    if (existingLesson) {
      setEditingLesson(existingLesson)
    } else {
      // Create a new lesson template based on the view mode
      setEditingLesson({
        id: '',
        day,
        weekType: selectedWeekType,
        subject: '',
        teacher: viewMode === 'teacher' && teacherId ? teacherId : '',
        room: viewMode === 'room' && roomId ? roomId : '',
        cohort: viewMode === 'cohort' && cohortId ? cohortId : '',
        periods: [{ periodId }],
      })
    }

    setEditDialogOpen(true)
  }

  const handleSaveLesson = (lesson: TimetableLesson) => {
    // Check for conflicts before saving
    const potentialConflicts = detectConflicts([
      ...timetableData.filter(l => l.id !== lesson.id),
      lesson,
    ])

    // Filter conflicts related to this specific lesson
    const newLessonConflicts = potentialConflicts.filter(
      conflict =>
        conflict.lesson1?.id === lesson.id ||
        (conflict.lesson2 && conflict.lesson2.id === lesson.id)
    )

    if (newLessonConflicts.length > 0) {
      // Show conflicts and ask for confirmation
      setConflicts(newLessonConflicts)
      setShowConflicts(true)
      return
    }

    // No conflicts, proceed with save
    saveLesson(lesson)
  }

  const saveLesson = (lesson: TimetableLesson) => {
    const updatedLesson = {
      ...lesson,
      id: lesson.id || Math.random().toString(36).substring(2, 9),
    }

    if (lesson.id) {
      // Update existing lesson
      setTimetableData(
        timetableData.map(l => (l.id === lesson.id ? updatedLesson : l))
      )
    } else {
      // Add new lesson
      setTimetableData([...timetableData, updatedLesson])
    }

    setEditDialogOpen(false)
  }

  const formatTime = (timeString: string): string => {
    return new Date(timeString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderCohortView = () => {
    return (
      <div className='border rounded-lg overflow-auto'>
        <table className='w-full border-collapse'>
          <thead>
            <tr className='bg-muted'>
              <th className='border p-2 text-left min-w-[100px]'>Period</th>
              {days.map(day => (
                <th
                  key={day}
                  className='border p-2 text-left min-w-[180px] capitalize'
                >
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

                {days.map(day => (
                  <td
                    key={`${day}-${period.id}`}
                    className='border p-0 h-24 align-top'
                  >
                    <div className='grid grid-cols-2 gap-1 p-1'>
                      {mockCohorts.map(cohort => {
                        const cohortName = `${cohort.year} ${cohort.designation}`.trim();
                        const lessons = timetableData.filter(
                          lesson =>
                            lesson.day === day &&
                            lesson.periods.some(p => p.periodId === period.id) &&
                            lesson.cohort === cohort.designation &&
                            (lesson.weekType === selectedWeekType ||
                              lesson.weekType === WeekType.All ||
                              selectedWeekType === WeekType.All)
                        )

                        // Check if this cell has conflicts
                        const hasConflict = conflicts.some(
                          conflict =>
                            (conflict.lesson1?.day === day &&
                              conflict.lesson1?.periods?.some(p => p.periodId === period.id) &&
                              conflict.lesson1?.cohort === cohort.designation) ||
                            (conflict.lesson2 &&
                              conflict.lesson2.day === day &&
                              conflict.lesson2.periods.some(p => p.periodId === period.id) &&
                              conflict.lesson2.cohort === cohort.designation)
                        )

                        return (
                          <button
                            key={cohort.id}
                            type="button"
                            className={`h-24 w-full text-left cursor-pointer hover:bg-muted/50 transition-colors border rounded-sm ${
                              hasConflict ? 'border-red-500' : ''
                            }`}
                            onClick={() =>
                              handleCellClick(
                                day,
                                period.id,
                                cohort.designation
                              )
                            }
                            aria-label={`${cohortName} cell for ${day} period ${period.name}`}
                          >
                            <div className='p-1 h-full'>
                              <div className='text-xs font-semibold bg-muted/50 p-1 mb-1 truncate'>
                                {cohortName}
                              </div>
                              {lessons.length > 0 ? (
                                lessons.map(lesson => (
                                  <Card
                                    key={lesson.id}
                                    className='mb-1 overflow-hidden'
                                  >
                                    <CardContent className='p-1 space-y-1'>
                                      <div className='font-medium text-xs'>
                                        {lesson.subject}
                                      </div>
                                      <div className='text-xs flex justify-between'>
                                        <span>{lesson.teacher}</span>
                                        <span>{lesson.room}</span>
                                      </div>
                                      {lesson.weekType !== WeekType.All && (
                                        <Badge
                                          variant='outline'
                                          className='text-xs'
                                        >
                                          Week {lesson.weekType.toUpperCase()}
                                        </Badge>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))
                              ) : (
                                <div className='h-full w-full text-center flex items-center justify-center text-muted-foreground'>
                                  <span className='text-xs'>+</span>
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderTeacherView = () => {
    return (
      <div className='border rounded-lg overflow-auto'>
        <table className='w-full border-collapse'>
          <thead>
            <tr className='bg-muted'>
              <th className='border p-2 text-left min-w-[100px]'>Period</th>
              {days.map(day => (
                <th
                  key={day}
                  className='border p-2 text-left min-w-[180px] capitalize'
                >
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

                {days.map(day => (
                  <td
                    key={`${day}-${period.id}`}
                    className='border p-0 h-24 align-top'
                  >
                    <div className='grid grid-cols-2 gap-1 p-1'>
                      {mockTeachers.map(teacher => {
                        const lessons = timetableData.filter(
                          lesson =>
                            lesson.day === day &&
                            lesson.periods.some(p => p.periodId === period.id) &&
                            lesson.teacher === teacher.name &&
                            (lesson.weekType === selectedWeekType ||
                              lesson.weekType === WeekType.All ||
                              selectedWeekType === WeekType.All)
                        )

                        // Check if this cell has conflicts
                        const hasConflict = conflicts.some(
                          conflict =>
                            (conflict.lesson1?.day === day &&
                              conflict.lesson1?.periods?.some(p => p.periodId === period.id) &&
                              conflict.lesson1?.teacher === teacher.name) ||
                            (conflict.lesson2 &&
                              conflict.lesson2.day === day &&
                              conflict.lesson2.periods.some(p => p.periodId === period.id) &&
                              conflict.lesson2.teacher === teacher.name)
                        )

                        return (
                          <button
                            key={teacher.id}
                            type="button"
                            className={`h-24 w-full text-left cursor-pointer hover:bg-muted/50 transition-colors border rounded-sm ${
                              hasConflict ? 'border-red-500' : ''
                            }`}
                            onClick={() =>
                              handleCellClick(
                                day,
                                period.id,
                                undefined,
                                teacher.name
                              )
                            }
                            aria-label={`${teacher.name} cell for ${day} period ${period.name}`}
                          >
                            <div className='p-1 h-full'>
                              <div className='text-xs font-semibold bg-muted/50 p-1 mb-1 truncate'>
                                {teacher.shortName}
                              </div>
                              {lessons.length > 0 ? (
                                lessons.map(lesson => (
                                  <Card
                                    key={lesson.id}
                                    className='mb-1 overflow-hidden'
                                  >
                                    <CardContent className='p-1 space-y-1'>
                                      <div className='font-medium text-xs'>
                                        {lesson.subject}
                                      </div>
                                      <div className='text-xs flex justify-between'>
                                        <span>{lesson.cohort}</span>
                                        <span>{lesson.room}</span>
                                      </div>
                                      {lesson.weekType !== WeekType.All && (
                                        <Badge
                                          variant='outline'
                                          className='text-xs'
                                        >
                                          Week {lesson.weekType.toUpperCase()}
                                        </Badge>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))
                              ) : (
                                <div className='h-full w-full text-center flex items-center justify-center text-muted-foreground'>
                                  <span className='text-xs'>+</span>
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderRoomView = () => {
    return (
      <div className='border rounded-lg overflow-auto'>
        <table className='w-full border-collapse'>
          <thead>
            <tr className='bg-muted'>
              <th className='border p-2 text-left min-w-[100px]'>Period</th>
              {days.map(day => (
                <th
                  key={day}
                  className='border p-2 text-left min-w-[180px] capitalize'
                >
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

                {days.map(day => (
                  <td
                    key={`${day}-${period.id}`}
                    className='border p-0 h-24 align-top'
                  >
                    <div className='grid grid-cols-2 gap-1 p-1'>
                      {mockRooms.map(room => {
                        const lessons = timetableData.filter(
                          lesson =>
                            lesson.day === day &&
                            lesson.periods.some(p => p.periodId === period.id) &&
                            lesson.room === room.name &&
                            (lesson.weekType === selectedWeekType ||
                              lesson.weekType === WeekType.All ||
                              selectedWeekType === WeekType.All)
                        )

                        // Check if this cell has conflicts
                        const hasConflict = conflicts.some(
                          conflict =>
                            (conflict.lesson1?.day === day &&
                              conflict.lesson1?.periods?.some(p => p.periodId === period.id) &&
                              conflict.lesson1?.room === room.name) ||
                            (conflict.lesson2 &&
                              conflict.lesson2.day === day &&
                              conflict.lesson2.periods.some(p => p.periodId === period.id) &&
                              conflict.lesson2.room === room.name)
                        )

                        return (
                          <button
                            key={room.id}
                            type="button"
                            className={`h-24 w-full text-left cursor-pointer hover:bg-muted/50 transition-colors border rounded-sm ${
                              hasConflict ? 'border-red-500' : ''
                            }`}
                            onClick={() =>
                              handleCellClick(
                                day,
                                period.id,
                                undefined,
                                undefined,
                                room.name
                              )
                            }
                            aria-label={`${room.name} cell for ${day} period ${period.name}`}
                          >
                            <div className='p-1 h-full'>
                              <div className='text-xs font-semibold bg-muted/50 p-1 mb-1 truncate'>
                                {room.name}
                              </div>
                              {lessons.length > 0 ? (
                                lessons.map(lesson => (
                                  <Card
                                    key={lesson.id}
                                    className='mb-1 overflow-hidden'
                                  >
                                    <CardContent className='p-1 space-y-1'>
                                      <div className='font-medium text-xs'>
                                        {lesson.subject}
                                      </div>
                                      <div className='text-xs flex justify-between'>
                                        <span>{lesson.cohort}</span>
                                        <span>{lesson.teacher}</span>
                                      </div>
                                      {lesson.weekType !== WeekType.All && (
                                        <Badge
                                          variant='outline'
                                          className='text-xs'
                                        >
                                          Week {lesson.weekType.toUpperCase()}
                                        </Badge>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))
                              ) : (
                                <div className='h-full w-full text-center flex items-center justify-center text-muted-foreground'>
                                  <span className='text-xs'>+</span>
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-4 items-center justify-between'>
        <div className='flex flex-wrap gap-4 items-center'>
          <Select
            value={selectedTimetable}
            onValueChange={setSelectedTimetable}
          >
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Select timetable' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='Summer 2024'>Summer 2024</SelectItem>
              <SelectItem value='Winter 2024'>Winter 2024</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={selectedWeekType}
            onValueChange={(value) => setSelectedWeekType(value as WeekType)}
          >
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Select week type' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WeekType.A}>Week A</SelectItem>
              <SelectItem value={WeekType.B}>Week B</SelectItem>
              <SelectItem value={WeekType.All}>All Weeks</SelectItem>
            </SelectContent>
          </Select>

          <Tabs
            value={viewMode}
            onValueChange={(value) => setViewMode(value as 'cohort' | 'teacher' | 'room')}
            className='w-[400px]'
          >
            <TabsList className='grid grid-cols-3'>
              <TabsTrigger value='cohort'>Cohort View</TabsTrigger>
              <TabsTrigger value='teacher'>Teacher View</TabsTrigger>
              <TabsTrigger value='room'>Room View</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() => setShowConflicts(true)}
            disabled={conflicts.length === 0}
          >
            <AlertTriangle className='mr-2 h-4 w-4' />
            Conflicts ({conflicts.length})
          </Button>
          <Button variant='outline' onClick={() => setPrintDialogOpen(true)}>
            <Printer className='mr-2 h-4 w-4' />
            Print
          </Button>
          <Button>Save Changes</Button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            There are {conflicts.length} scheduling conflicts in the timetable.
            Click the Conflicts button to view details.
          </AlertDescription>
        </Alert>
      )}

      {viewMode === 'cohort' && renderCohortView()}
      {viewMode === 'teacher' && renderTeacherView()}
      {viewMode === 'room' && renderRoomView()}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editingLesson?.id ? 'Edit Lesson' : 'Add New Lesson'}
            </DialogTitle>
          </DialogHeader>
          {editingLesson && (
            <LessonForm
              lesson={mapToDbLesson(editingLesson)}
              onSave={(savedLesson) => {
                // Convert back from DB format to timetable format before saving
                const updatedLesson: TimetableLesson = {
                  ...editingLesson,
                  id: savedLesson.id || editingLesson.id,
                  subject: mockSubjects.find(s => s.id === savedLesson.subjectId)?.name || '',
                  teacher: mockTeachers.find(t => t.id === savedLesson.teacherId)?.name || '',
                  room: mockRooms.find(r => r.id === savedLesson.roomId)?.name || '',
                  cohort: mockCohorts.find(c => c.id === savedLesson.cohortId)?.designation || '',
                  day: savedLesson.day,
                  weekType: savedLesson.weekType,
                }
                handleSaveLesson(updatedLesson)
              }}
              onCancel={() => setEditDialogOpen(false)}
              viewMode={viewMode}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showConflicts} onOpenChange={setShowConflicts}>
        <DialogContent className='max-w-3xl max-h-[80vh] overflow-auto'>
          <DialogHeader>
            <DialogTitle>Timetable Conflicts</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            {conflicts.length === 0 ? (
              <Alert>
                <CheckCircle2 className='h-4 w-4' />
                <AlertTitle>No Conflicts</AlertTitle>
                <AlertDescription>
                  No scheduling conflicts found in the timetable.
                </AlertDescription>
              </Alert>
            ) : (
              conflicts.map((conflict) => (
                <Alert 
                  key={`${conflict.type}-${conflict.message?.substring(0, 20)}`} 
                  variant='destructive'
                >
                  <AlertCircle className='h-4 w-4' />
                  <AlertTitle>{conflict.type || 'Conflict'}</AlertTitle>
                  <AlertDescription>{conflict.message}</AlertDescription>
                </Alert>
              ))
            )}
            <div className='flex justify-end space-x-2 pt-4'>
              <Button 
                variant='destructive'
                onClick={() => setShowConflicts(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        currentView={viewMode}
        currentSelection=''
      />
    </div>
  )
}
