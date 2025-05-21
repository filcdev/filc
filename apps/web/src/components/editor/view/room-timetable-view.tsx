import { Day, WeekType } from '@/lib/editor/conflict'
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
import { Printer } from 'lucide-react'
import { useState } from 'react'
import { LessonForm } from '../lesson-form'
import { PrintDialog } from '../print-dialog'

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

// Define the structure of the period data as shown in the UI
interface UIPeriod {
  id: string
  name: string
  startTime: string
  endTime: string
}

// Map TimetableLesson to Insert<typeof Lesson>
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

// Define the room type from the mock data
type RoomType = {
  id: string
  name: string
  shortName: string
  capacity: number
  createdAt: Date
  updatedAt: Date
}

export function RoomTimetableView() {
  // Make sure we have a default value even if the array is empty
  // TypeScript non-null assertion is safe here as we know the mockRooms array is initialized with values
  const defaultRoom = mockRooms[0]?.name ?? 'No Room'
  const [selectedRoom, setSelectedRoom] = useState<string>(defaultRoom)
  const [selectedWeekType, setSelectedWeekType] = useState<WeekType>(
    WeekType.All
  )
  const [selectedTimetable, setSelectedTimetable] =
    useState<string>('Summer 2024')
  const [editingLesson, setEditingLesson] = useState<TimetableLesson | null>(
    null
  )
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false)
  const [printDialogOpen, setPrintDialogOpen] = useState<boolean>(false)

  // Filter out weekend days
  const days = Object.values(Day).filter(
    day => day !== Day.Saturday && day !== Day.Sunday
  )

  const handleCellClick = (day: Day, periodId: string) => {
    // Find if there's a lesson at this slot
    const existingLesson = mockTimetableData.find(
      (lesson: TimetableLesson) =>
        lesson.day === day &&
        lesson.periods.some(p => p.periodId === periodId) &&
        lesson.room === selectedRoom &&
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
        room: selectedRoom,
        cohort: '',
        periods: [{ periodId }],
      })
    }

    setEditDialogOpen(true)
  }

  const formatTime = (timeString: string): string => {
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

          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Select room' />
            </SelectTrigger>
            <SelectContent>
              {mockRooms.map(room => (
                <SelectItem key={room.id} value={room.name}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedWeekType}
            onValueChange={value => setSelectedWeekType(value as WeekType)}
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
          <Button variant='outline' onClick={() => setPrintDialogOpen(true)}>
            <Printer className='mr-2 h-4 w-4' />
            Print
          </Button>
          <Button>Save Changes</Button>
        </div>
      </div>

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
                  const lessons = mockTimetableData.filter(
                    lesson =>
                      lesson.day === day &&
                      lesson.periods.some(p => p.periodId === period.id) &&
                      lesson.room === selectedRoom &&
                      (lesson.weekType === selectedWeekType ||
                        lesson.weekType === WeekType.All ||
                        selectedWeekType === WeekType.All)
                  )

                  return (
                    <td
                      key={`${day}-${period.id}`}
                      className='border p-0 h-24 align-top'
                    >
                      <button
                        type='button'
                        className='w-full h-full text-left block cursor-pointer hover:bg-muted/50 transition-colors bg-transparent border-0'
                        onClick={() => handleCellClick(day, period.id)}
                        aria-label={`Add or edit lesson for ${day} at period ${period.name}`}
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
                            ))}
                          </div>
                        ) : (
                          <div className='h-full w-full p-2 text-center flex items-center justify-center text-muted-foreground'>
                            <span className='text-xs'>Click to add</span>
                          </div>
                        )}
                      </button>
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
              lesson={mapToDbLesson(editingLesson)}
              onSave={() => setEditDialogOpen(false)}
              onCancel={() => setEditDialogOpen(false)}
              viewMode='room'
            />
          )}
        </DialogContent>
      </Dialog>

      <PrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        currentView='room'
        currentSelection={selectedRoom}
      />
    </div>
  )
}
