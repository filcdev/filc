'use client'

import type React from 'react'

import { WeekType } from '@/lib/editor/conflict'
import { detectLessonConflicts } from '@/lib/editor/conflict'
import {
  mockCohorts,
  mockPeriods,
  mockRooms,
  mockSubjects,
  mockTeachers,
} from '@/lib/editor/mock'
import { Alert, AlertDescription, AlertTitle } from '@filc/ui/components/alert'
import { Button } from '@filc/ui/components/button'
import { Checkbox } from '@filc/ui/components/checkbox'
import { Label } from '@filc/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@filc/ui/components/select'
import { AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { lesson as Lesson } from '@filc/db/schema/timetable'
import type { Insert } from '@filc/db/types'

interface LessonFormProps {
  lesson: Insert<typeof Lesson>
  onSave: (lesson: Insert<typeof Lesson>) => void
  onCancel: () => void
  viewMode?: 'cohort' | 'teacher' | 'room'
}

export function LessonForm({
  lesson,
  onSave,
  onCancel,
  viewMode = 'cohort',
}: LessonFormProps) {
  const [formData, setFormData] = useState(lesson)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [isValidating, setIsValidating] = useState(false)

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePeriodToggle = (periodId: string) => {
    const periodExists = formData.periods.some(
      (p: any) => p.periodId === periodId
    )

    if (periodExists) {
      setFormData(prev => ({
        ...prev,
        periods: prev.periods.filter((p: any) => p.periodId !== periodId),
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        periods: [...prev.periods, { periodId }],
      }))
    }
  }

  useEffect(() => {
    // Validate form when critical fields change
    if (
      formData.subject &&
      formData.teacher &&
      formData.room &&
      formData.cohort &&
      formData.periods.length > 0
    ) {
      setIsValidating(true)
      // Simulate API call to check for conflicts
      setTimeout(() => {
        const potentialConflicts = detectLessonConflicts(formData)
        setConflicts(potentialConflicts)
        setIsValidating(false)
      }, 300)
    }
  }, [formData]) // Updated to use formData as a whole dependency

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Final validation
    if (formData.periods.length === 0) {
      setConflicts([{ message: 'You must select at least one period' }])
      return
    }

    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='subject'>Subject</Label>
          <Select
            value={formData.subject}
            onValueChange={value => handleChange('subject', value)}
            required={true}
          >
            <SelectTrigger id='subject'>
              <SelectValue placeholder='Select subject' />
            </SelectTrigger>
            <SelectContent>
              {mockSubjects.map(subject => (
                <SelectItem key={subject.id} value={subject.name}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='teacher'>Teacher</Label>
          <Select
            value={formData.teacher}
            onValueChange={value => handleChange('teacher', value)}
            required={true}
            disabled={viewMode === 'teacher'}
          >
            <SelectTrigger id='teacher'>
              <SelectValue placeholder='Select teacher' />
            </SelectTrigger>
            <SelectContent>
              {mockTeachers.map(teacher => (
                <SelectItem key={teacher.id} value={teacher.name}>
                  {teacher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='room'>Room</Label>
          <Select
            value={formData.room}
            onValueChange={value => handleChange('room', value)}
            required={true}
            disabled={viewMode === 'room'}
          >
            <SelectTrigger id='room'>
              <SelectValue placeholder='Select room' />
            </SelectTrigger>
            <SelectContent>
              {mockRooms.map(room => (
                <SelectItem key={room.id} value={room.name}>
                  {room.name} ({room.capacity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='cohort'>Cohort</Label>
          <Select
            value={formData.cohort}
            onValueChange={value => handleChange('cohort', value)}
            required={true}
            disabled={viewMode === 'cohort'}
          >
            <SelectTrigger id='cohort'>
              <SelectValue placeholder='Select cohort' />
            </SelectTrigger>
            <SelectContent>
              {mockCohorts.map(cohort => (
                <SelectItem key={cohort.id} value={cohort.designation}>
                  {cohort.designation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='weekType'>Week Type</Label>
          <Select
            value={formData.weekType}
            onValueChange={value => handleChange('weekType', value as WeekType)}
            required={true}
          >
            <SelectTrigger id='weekType'>
              <SelectValue placeholder='Select week type' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WeekType.A}>Week A</SelectItem>
              <SelectItem value={WeekType.B}>Week B</SelectItem>
              <SelectItem value={WeekType.All}>All Weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Periods</Label>
        <div className='grid grid-cols-5 gap-2'>
          {mockPeriods.map(period => {
            const isSelected = formData.periods.some(
              (p: any) => p.periodId === period.id
            )
            return (
              <div key={period.id} className='flex items-center space-x-2'>
                <Checkbox
                  id={`period-${period.id}`}
                  checked={isSelected}
                  onCheckedChange={() => handlePeriodToggle(period.id)}
                />
                <Label htmlFor={`period-${period.id}`} className='text-sm'>
                  {period.name}
                </Label>
              </div>
            )
          })}
        </div>
      </div>

      {conflicts.length > 0 && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Potential Conflicts</AlertTitle>
          <AlertDescription>
            <ul className='list-disc pl-5 space-y-1'>
              {conflicts.map((conflict) => (
                <li key={conflict}>{conflict.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className='flex justify-end space-x-2 pt-4'>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={isValidating || (conflicts.length > 0 && !formData.id)}
        >
          {isValidating
            ? 'Checking conflicts...'
            : formData.id
              ? 'Update'
              : 'Create'}{' '}
          Lesson
        </Button>
      </div>
    </form>
  )
}
