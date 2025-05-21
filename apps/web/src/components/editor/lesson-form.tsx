import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Day, WeekType } from '@/lib/editor/conflict'
import { detectLessonConflicts } from '@/lib/editor/conflict'
import {
  mockCohorts,
  mockPeriods,
  mockRooms,
  mockSubjects,
  mockTeachers,
} from '@/lib/editor/mock'
import type { lesson as Lesson } from '@filc/db/schema/timetable'
import type { Insert } from '@filc/db/types'
import { Alert, AlertDescription, AlertTitle } from '@filc/ui/components/alert'
import { Button } from '@filc/ui/components/button'
import { Checkbox } from '@filc/ui/components/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@filc/ui/components/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@filc/ui/components/select'
import { AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

interface LessonFormData {
  id?: string
  subject: string
  teacher: string
  room: string
  cohort: string
  weekType: WeekType
  day: Day
  periods: { periodId: string }[]
}

interface Conflict {
  message: string
}

const formSchema = z.object({
  id: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  teacher: z.string().min(1, 'Teacher is required'),
  room: z.string().min(1, 'Room is required'),
  cohort: z.string().min(1, 'Cohort is required'),
  weekType: z.nativeEnum(WeekType),
  day: z.nativeEnum(Day),
  periods: z
    .array(z.object({ periodId: z.string() }))
    .min(1, 'You must select at least one period'),
})

// Define the type for our form
type FormValues = z.infer<typeof formSchema>

interface LessonFormProps {
  lesson: Insert<typeof Lesson>
  onSave: (lesson: Insert<typeof Lesson>) => void
  onCancel: () => void
  viewMode?: 'cohort' | 'teacher' | 'room'
  currentCohortId?: string
  currentTeacherId?: string
  currentRoomId?: string
}

const mapLessonToFormData = (lesson: Insert<typeof Lesson>): LessonFormData => {
  const subjectName =
    mockSubjects.find(s => s.id === lesson.subjectId)?.name || ''
  const teacherName =
    mockTeachers.find(t => t.id === lesson.teacherId)?.name || ''
  const roomName = mockRooms.find(r => r.id === lesson.roomId)?.name || ''
  const cohortDesignation =
    mockCohorts.find(c => c.id === lesson.cohortId)?.designation || ''

  // Get periods from mock data or empty array
  const periods = lesson.id
    ? mockPeriods
        .filter(p => p.id.startsWith(lesson.id || ''))
        .map(p => ({ periodId: p.id }))
    : []

  return {
    id: lesson.id,
    subject: subjectName,
    teacher: teacherName,
    room: roomName,
    cohort: cohortDesignation,
    weekType: lesson.weekType,
    day: lesson.day,
    periods: periods,
  }
}

const mapFormDataToLesson = (formData: FormValues): Insert<typeof Lesson> => {
  const subjectId =
    mockSubjects.find(s => s.name === formData.subject)?.id || ''
  const teacherId =
    mockTeachers.find(t => t.name === formData.teacher)?.id || ''
  const roomId = mockRooms.find(r => r.name === formData.room)?.id || ''
  const cohortId =
    mockCohorts.find(c => c.designation === formData.cohort)?.id || ''

  return {
    id: formData.id,
    subjectId,
    teacherId,
    roomId,
    cohortId,
    weekType: formData.weekType,
    day: formData.day,
  }
}

// Get default value based on viewMode
const getDefaultValueForViewMode = (
  viewMode: 'cohort' | 'teacher' | 'room',
  lesson: Insert<typeof Lesson>,
  currentCohortId?: string,
  currentTeacherId?: string,
  currentRoomId?: string
): Partial<LessonFormData> => {
  // For existing lessons, don't apply defaults
  if (lesson.id) return {}

  switch (viewMode) {
    case 'cohort': {
      // Use the currentCohortId if provided, otherwise use the first cohort
      let cohortDesignation = ''
      if (currentCohortId) {
        cohortDesignation =
          mockCohorts.find(c => c.id === currentCohortId)?.designation || ''
      } else {
        cohortDesignation = mockCohorts[0]?.designation || ''
      }
      return { cohort: cohortDesignation }
    }
    case 'teacher': {
      // Use the currentTeacherId if provided, otherwise use the first teacher
      let teacherName = ''
      if (currentTeacherId) {
        teacherName =
          mockTeachers.find(t => t.id === currentTeacherId)?.name || ''
      } else {
        teacherName = mockTeachers[0]?.name || ''
      }
      return { teacher: teacherName }
    }
    case 'room': {
      // Use the currentRoomId if provided, otherwise use the first room
      let roomName = ''
      if (currentRoomId) {
        roomName = mockRooms.find(r => r.id === currentRoomId)?.name || ''
      } else {
        roomName = mockRooms[0]?.name || ''
      }
      return { room: roomName }
    }
    default:
      return {}
  }
}

export function LessonForm({
  lesson,
  onSave,
  onCancel,
  viewMode = 'cohort',
  currentCohortId,
  currentTeacherId,
  currentRoomId,
}: LessonFormProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [isValidating, setIsValidating] = useState(false)

  // Map the DB model to our form data model
  let initialFormData = mapLessonToFormData(lesson)

  // If we're in viewMode and creating a new lesson (no id),
  // we should lock the corresponding field to the current view
  if (!lesson.id) {
    const defaultValues = getDefaultValueForViewMode(
      viewMode,
      lesson,
      currentCohortId,
      currentTeacherId,
      currentRoomId
    )
    initialFormData = { ...initialFormData, ...defaultValues }
  }

  // Initialize form with react-hook-form and zod validation
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialFormData,
  })

  // Get form values to use for conflict detection
  const formValues = form.watch()

  // Handle period checkbox toggle
  const handlePeriodToggle = (periodId: string) => {
    const currentPeriods = form.getValues('periods')
    const periodExists = currentPeriods.some(p => p.periodId === periodId)

    if (periodExists) {
      form.setValue(
        'periods',
        currentPeriods.filter(p => p.periodId !== periodId),
        {
          shouldValidate: true,
        }
      )
    } else {
      form.setValue('periods', [...currentPeriods, { periodId }], {
        shouldValidate: true,
      })
    }
  }

  // Check for conflicts when form values change
  useEffect(() => {
    if (
      formValues.subject &&
      formValues.teacher &&
      formValues.room &&
      formValues.cohort &&
      formValues.periods.length > 0
    ) {
      setIsValidating(true)
      // Simulate API call to check for conflicts
      setTimeout(() => {
        const potentialConflicts = detectLessonConflicts(formValues)
        setConflicts(potentialConflicts)
        setIsValidating(false)
      }, 300)
    }
  }, [formValues])

  // Form submission handler
  function onSubmit(data: FormValues) {
    // Check for conflicts before submitting
    if (conflicts.length > 0 && !data.id) {
      return
    }

    // Convert form data back to the DB model and save
    const lessonData = mapFormDataToLesson(data)
    onSave(lessonData)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <div className='grid grid-cols-2 gap-4'>
          {/* Subject Field */}
          <FormField
            control={form.control}
            name='subject'
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor='subject'>Subject</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger id='subject'>
                      <SelectValue placeholder='Select subject' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {mockSubjects.map(subject => (
                      <SelectItem key={subject.id} value={subject.name}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Teacher Field */}
          <FormField
            control={form.control}
            name='teacher'
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor='teacher'>Teacher</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={viewMode === 'teacher'}
                >
                  <FormControl>
                    <SelectTrigger id='teacher'>
                      <SelectValue placeholder='Select teacher' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {mockTeachers.map(teacher => (
                      <SelectItem key={teacher.id} value={teacher.name}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Room Field */}
          <FormField
            control={form.control}
            name='room'
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor='room'>Room</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={viewMode === 'room'}
                >
                  <FormControl>
                    <SelectTrigger id='room'>
                      <SelectValue placeholder='Select room' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {mockRooms.map(room => (
                      <SelectItem key={room.id} value={room.name}>
                        {room.name} ({room.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Cohort Field */}
          <FormField
            control={form.control}
            name='cohort'
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor='cohort'>Cohort</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={viewMode === 'cohort'}
                >
                  <FormControl>
                    <SelectTrigger id='cohort'>
                      <SelectValue placeholder='Select cohort' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {mockCohorts.map(cohort => (
                      <SelectItem key={cohort.id} value={cohort.designation}>
                        {cohort.designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Week Type Field */}
          <FormField
            control={form.control}
            name='weekType'
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor='weekType'>Week Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger id='weekType'>
                      <SelectValue placeholder='Select week type' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={WeekType.A}>Week A</SelectItem>
                    <SelectItem value={WeekType.B}>Week B</SelectItem>
                    <SelectItem value={WeekType.All}>All Weeks</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Day Field */}
          <FormField
            control={form.control}
            name='day'
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor='day'>Day</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger id='day'>
                      <SelectValue placeholder='Select day' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={Day.Monday}>Monday</SelectItem>
                    <SelectItem value={Day.Tuesday}>Tuesday</SelectItem>
                    <SelectItem value={Day.Wednesday}>Wednesday</SelectItem>
                    <SelectItem value={Day.Thursday}>Thursday</SelectItem>
                    <SelectItem value={Day.Friday}>Friday</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Periods Field */}
        <FormField
          control={form.control}
          name='periods'
          render={() => (
            <FormItem>
              <div className='flex flex-col gap-2'>
                <FormLabel>Periods</FormLabel>
                <div className='grid grid-cols-5 gap-2'>
                  {mockPeriods.map(period => {
                    const isSelected = form
                      .getValues('periods')
                      .some(p => p.periodId === period.id)
                    return (
                      <div
                        key={period.id}
                        className='flex items-center space-x-2'
                      >
                        <Checkbox
                          id={`period-${period.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handlePeriodToggle(period.id)}
                        />
                        <FormLabel
                          htmlFor={`period-${period.id}`}
                          className='text-sm'
                        >
                          {period.name}
                        </FormLabel>
                      </div>
                    )
                  })}
                </div>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {/* Conflict Alerts */}
        {conflicts.length > 0 && (
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertTitle>Potential Conflicts</AlertTitle>
            <AlertDescription>
              <ul className='list-disc pl-5 space-y-1'>
                {conflicts.map((conflict, index) => (
                  <li key={`${conflict.message}-${index}`}>
                    {conflict.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Form Actions */}
        <div className='flex justify-end space-x-2 pt-4'>
          <Button type='button' variant='outline' onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type='submit'
            disabled={
              isValidating || (conflicts.length > 0 && !form.getValues().id)
            }
          >
            {isValidating
              ? 'Checking conflicts...'
              : form.getValues().id
                ? 'Update'
                : 'Create'}{' '}
            Lesson
          </Button>
        </div>
      </form>
    </Form>
  )
}
