import { Day, WeekType } from '@/lib/editor/conflict'
import { detectConflicts } from '@/lib/editor/conflict'
import { mockPeriods, mockTimetableData } from '@/lib/editor/mock'
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
import { AlertCircle, AlertTriangle, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LessonForm } from './lesson-form'
import { PrintDialog } from './print-dialog'

export function TimetableView() {
  const [selectedCohort, setSelectedCohort] = useState<string>('1A')
  const [selectedWeekType, setSelectedWeekType] = useState<WeekType>(
    WeekType.All
  )
  const [selectedTimetable, setSelectedTimetable] =
    useState<string>('Summer 2024')
  const [editingLesson, setEditingLesson] = useState<any | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [timetableData, setTimetableData] = useState(mockTimetableData)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [showConflicts, setShowConflicts] = useState(false)

  const days = Object.values(Day).filter(
    day => day !== Day.Saturday && day !== Day.Sunday
  )

  useEffect(() => {
    // Check for conflicts whenever timetable data changes
    const detectedConflicts = detectConflicts(timetableData)
    setConflicts(
      detectedConflicts.filter(
        conflict =>
          conflict.lesson1.cohort === selectedCohort ||
          (conflict.lesson2 && conflict.lesson2.cohort === selectedCohort)
      )
    )
  }, [timetableData, selectedCohort])

  const handleCellClick = (day: Day, periodId: string) => {
    // Find if there's a lesson at this slot
    const existingLesson = timetableData.find(
      lesson =>
        lesson.day === day &&
        lesson.periods.some(p => p.periodId === periodId) &&
        lesson.cohort === selectedCohort &&
        (lesson.weekType === selectedWeekType ||
          lesson.weekType === WeekType.All ||
          selectedWeekType === WeekType.All)
    )

    if (existingLesson) {
      setEditingLesson(existingLesson)
    } else {
      // Create a new lesson template
      setEditingLesson({
        id: '',
        day,
        weekType: selectedWeekType,
        subject: '',
        teacher: '',
        room: '',
        cohort: selectedCohort,
        periods: [{ periodId }],
      })
    }

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

          <Select value={selectedCohort} onValueChange={setSelectedCohort}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Select cohort' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='1A'>1A</SelectItem>
              <SelectItem value='1B'>1B</SelectItem>
              <SelectItem value='2A'>2A</SelectItem>
              <SelectItem value='2B'>2B</SelectItem>
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
            There are {conflicts.length} scheduling conflicts for this cohort.
            Click the Conflicts button to view details.
          </AlertDescription>
        </Alert>
      )}

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

                {days.map(day => {
                  const lessons = timetableData.filter(
                    lesson =>
                      lesson.day === day &&
                      lesson.periods.some(p => p.periodId === period.id) &&
                      lesson.cohort === selectedCohort &&
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
                        conflict.lesson1.cohort === selectedCohort) ||
                      (conflict.lesson2 &&
                        conflict.lesson2.day === day &&
                        conflict.lesson2.periods.some(
                          p => p.periodId === period.id
                        ) &&
                        conflict.lesson2.cohort === selectedCohort)
                  )

                  return (
                    <td
                      key={`${day}-${period.id}`}
                      className={`border p-0 h-24 align-top cursor-pointer hover:bg-muted/50 transition-colors ${
                        hasConflict ? 'border-red-500 border-2' : ''
                      }`}
                      onClick={() => handleCellClick(day, period.id)}
                    >
                      {lessons.length > 0 ? (
                        <div className='p-2 h-full'>
                          {lessons.map(lesson => (
                            <Card
                              key={lesson.id}
                              className='mb-1 overflow-hidden h-full'
                            >
                              <CardContent className='p-2 space-y-1'>
                                <div className='font-medium'>
                                  {lesson.subject}
                                </div>
                                <div className='text-xs flex justify-between'>
                                  <span>{lesson.teacher}</span>
                                  <span>{lesson.room}</span>
                                </div>
                                {lesson.weekType !== WeekType.All && (
                                  <Badge variant='outline' className='text-xs'>
                                    Week {lesson.weekType.toUpperCase()}
                                  </Badge>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className='h-full w-full p-2 text-center flex items-center justify-center text-muted-foreground'>
                          <span className='text-xs'>Click to add</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
              viewMode='cohort'
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
                <AlertTitle>No conflicts</AlertTitle>
                <AlertDescription>
                  The timetable has no scheduling conflicts for this cohort.
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
        currentView='cohort'
        currentSelection={selectedCohort}
      />
    </div>
  )
}
