'use client'

import { Day, WeekType } from '@/lib/editor/conflict'
import { detectConflicts } from '@/lib/editor/conflict'
import {
  mockCohorts,
  mockPeriods,
  mockRooms,
  mockTeachers,
  mockTimetableData,
} from '@/lib/editor/mock'
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

export function SchoolTimetableView() {
  const [selectedWeekType, setSelectedWeekType] = useState<WeekType>(
    WeekType.All
  )
  const [selectedTimetable, setSelectedTimetable] =
    useState<string>('Summer 2024')
  const [editingLesson, setEditingLesson] = useState<any | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'cohort' | 'teacher' | 'room'>(
    'cohort'
  )
  const [timetableData, setTimetableData] = useState(mockTimetableData)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [showConflicts, setShowConflicts] = useState(false)

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
    // Create a new lesson template based on the view mode
    const newLesson = {
      id: '',
      day,
      weekType: selectedWeekType,
      subject: '',
      teacher: viewMode === 'teacher' ? teacherId : '',
      room: viewMode === 'room' ? roomId : '',
      cohort: viewMode === 'cohort' ? cohortId : '',
      periods: [{ periodId }],
    }

    setEditingLesson(newLesson)
    setEditDialogOpen(true)
  }

  const handleSaveLesson = (lesson: any) => {
    // Check for conflicts before saving
    const potentialConflicts = detectConflicts([
      ...timetableData.filter(l => l.id !== lesson.id),
      lesson,
    ])

    // Filter conflicts related to this specific lesson
    const newLessonConflicts = potentialConflicts.filter(
      conflict =>
        conflict.lesson1.id === lesson.id ||
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

  const saveLesson = (lesson: any) => {
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

  const formatTime = (timeString: string) => {
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
                    className='border p-0 align-top'
                  >
                    <div className='grid grid-cols-2 gap-1 p-1'>
                      {mockCohorts.map(cohort => {
                        const lessons = timetableData.filter(
                          lesson =>
                            lesson.day === day &&
                            lesson.periods.some(
                              p => p.periodId === period.id
                            ) &&
                            lesson.cohort === cohort.designation &&
                            (lesson.weekType === selectedWeekType ||
                              lesson.weekType === WeekType.All ||
                              selectedWeekType === WeekType.All)
                        )

                        // Check if this cell has conflicts
                        const hasConflict = conflicts.some(
                          conflict =>
                            (conflict.lesson1.day === day &&
                              conflict.lesson1.periods.some(
                                p => p.periodId === period.id
                              ) &&
                              conflict.lesson1.cohort === cohort.designation) ||
                            (conflict.lesson2 &&
                              conflict.lesson2.day === day &&
                              conflict.lesson2.periods.some(
                                p => p.periodId === period.id
                              ) &&
                              conflict.lesson2.cohort === cohort.designation)
                        )

                        return (
                          <div
                            key={cohort.id}
                            className={`h-24 cursor-pointer hover:bg-muted/50 transition-colors border rounded-sm ${
                              hasConflict ? 'border-red-500' : ''
                            }`}
                            onClick={() =>
                              handleCellClick(
                                day,
                                period.id,
                                cohort.designation
                              )
                            }
                          >
                            <div className='p-1 h-full'>
                              <div className='text-xs font-semibold bg-muted/50 p-1 mb-1 truncate'>
                                {cohort.designation}
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
                          </div>
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
                    className='border p-0 align-top'
                  >
                    <div className='grid grid-cols-2 gap-1 p-1'>
                      {mockTeachers.map(teacher => {
                        const lessons = timetableData.filter(
                          lesson =>
                            lesson.day === day &&
                            lesson.periods.some(
                              p => p.periodId === period.id
                            ) &&
                            lesson.teacher === teacher.name &&
                            (lesson.weekType === selectedWeekType ||
                              lesson.weekType === WeekType.All ||
                              selectedWeekType === WeekType.All)
                        )

                        // Check if this cell has conflicts
                        const hasConflict = conflicts.some(
                          conflict =>
                            (conflict.lesson1.day === day &&
                              conflict.lesson1.periods.some(
                                p => p.periodId === period.id
                              ) &&
                              conflict.lesson1.teacher === teacher.name) ||
                            (conflict.lesson2 &&
                              conflict.lesson2.day === day &&
                              conflict.lesson2.periods.some(
                                p => p.periodId === period.id
                              ) &&
                              conflict.lesson2.teacher === teacher.name)
                        )

                        return (
                          <div
                            key={teacher.id}
                            className={`h-24 cursor-pointer hover:bg-muted/50 transition-colors border rounded-sm ${
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
                                    </CardContent>
                                  </Card>
                                ))
                              ) : (
                                <div className='h-full w-full text-center flex items-center justify-center text-muted-foreground'>
                                  <span className='text-xs'>+</span>
                                </div>
                              )}
                            </div>
                          </div>
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
                    className='border p-0 align-top'
                  >
                    <div className='grid grid-cols-2 gap-1 p-1'>
                      {mockRooms.map(room => {
                        const lessons = timetableData.filter(
                          lesson =>
                            lesson.day === day &&
                            lesson.periods.some(
                              p => p.periodId === period.id
                            ) &&
                            lesson.room === room.name &&
                            (lesson.weekType === selectedWeekType ||
                              lesson.weekType === WeekType.All ||
                              selectedWeekType === WeekType.All)
                        )

                        // Check if this cell has conflicts
                        const hasConflict = conflicts.some(
                          conflict =>
                            (conflict.lesson1.day === day &&
                              conflict.lesson1.periods.some(
                                p => p.periodId === period.id
                              ) &&
                              conflict.lesson1.room === room.name) ||
                            (conflict.lesson2 &&
                              conflict.lesson2.day === day &&
                              conflict.lesson2.periods.some(
                                p => p.periodId === period.id
                              ) &&
                              conflict.lesson2.room === room.name)
                        )

                        return (
                          <div
                            key={room.id}
                            className={`h-24 cursor-pointer hover:bg-muted/50 transition-colors border rounded-sm ${
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
                          >
                            <div className='p-1 h-full'>
                              <div className='text-xs font-semibold bg-muted/50 p-1 mb-1 truncate'>
                                {room.shortName}
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
                                    </CardContent>
                                  </Card>
                                ))
                              ) : (
                                <div className='h-full w-full text-center flex items-center justify-center text-muted-foreground'>
                                  <span className='text-xs'>+</span>
                                </div>
                              )}
                            </div>
                          </div>
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
            onValueChange={setSelectedWeekType as any}
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
            onValueChange={value => setViewMode(value as any)}
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
              lesson={editingLesson}
              onSave={handleSaveLesson}
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
                <AlertTitle>No conflicts</AlertTitle>
                <AlertDescription>
                  The timetable has no scheduling conflicts.
                </AlertDescription>
              </Alert>
            ) : (
              conflicts.map((conflict, index) => (
                <Alert key={index} variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertTitle>{conflict.type} Conflict</AlertTitle>
                  <AlertDescription className='space-y-2'>
                    <p>
                      <strong>Day:</strong>{' '}
                      {conflict.day.charAt(0).toUpperCase() +
                        conflict.day.slice(1)}
                    </p>
                    <p>
                      <strong>Period:</strong> {conflict.periodName}
                    </p>
                    <p>
                      <strong>Week:</strong> {conflict.weekType.toUpperCase()}
                    </p>
                    <div className='grid grid-cols-2 gap-4 mt-2'>
                      <div>
                        <p className='font-semibold'>Lesson 1:</p>
                        <p>Subject: {conflict.lesson1.subject}</p>
                        <p>Teacher: {conflict.lesson1.teacher}</p>
                        <p>Room: {conflict.lesson1.room}</p>
                        <p>Cohort: {conflict.lesson1.cohort}</p>
                      </div>
                      {conflict.lesson2 && (
                        <div>
                          <p className='font-semibold'>Lesson 2:</p>
                          <p>Subject: {conflict.lesson2.subject}</p>
                          <p>Teacher: {conflict.lesson2.teacher}</p>
                          <p>Room: {conflict.lesson2.room}</p>
                          <p>Cohort: {conflict.lesson2.cohort}</p>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))
            )}
            {conflicts.length > 0 && (
              <div className='flex justify-end space-x-2'>
                <Button
                  variant='outline'
                  onClick={() => setShowConflicts(false)}
                >
                  Close
                </Button>
                <Button
                  variant='destructive'
                  onClick={() => setShowConflicts(false)}
                >
                  Fix Later
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        currentView='school'
        currentSelection=''
      />
    </div>
  )
}
