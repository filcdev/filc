'use client'

import type React from 'react'

import { mockPeriods } from '@/lib/editor/mock'
import type { period as Period } from '@filc/db/schema/timetable'
import type { Insert } from '@filc/db/types'
import { Button } from '@filc/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@filc/ui/components/dialog'
import { Input } from '@filc/ui/components/input'
import { Label } from '@filc/ui/components/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filc/ui/components/table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

// Define a type that extends the DB schema to include the name property needed in the UI
interface PeriodWithName extends Insert<typeof Period> {
  name: string
}

export function PeriodsTable() {
  const [periods, setPeriods] = useState<PeriodWithName[]>(
    () =>
      mockPeriods.map(period => ({
        ...period,
        startTime: new Date(period.startTime),
        endTime: new Date(period.endTime),
      })) as PeriodWithName[]
  )
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [editingPeriod, setEditingPeriod] = useState<PeriodWithName | null>(
    null
  )

  const handleAddPeriod = () => {
    setEditingPeriod({
      id: '',
      name: '',
      startTime: new Date(),
      endTime: new Date(),
    })
    setIsDialogOpen(true)
  }

  const handleEditPeriod = (period: PeriodWithName) => {
    setEditingPeriod({
      ...period,
    })
    setIsDialogOpen(true)
  }

  const handleDeletePeriod = (id: string) => {
    setPeriods(periods.filter(period => period.id !== id))
  }

  const handleSavePeriod = (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingPeriod) return

    if (editingPeriod.id) {
      // Update existing period
      setPeriods(
        periods.map(period =>
          period.id === editingPeriod.id ? editingPeriod : period
        )
      )
    } else {
      // Add new period with required fields
      const newPeriod: PeriodWithName = {
        ...editingPeriod,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setPeriods([...periods, newPeriod])
    }

    setIsDialogOpen(false)
  }

  // Helper function to format time for display
  const formatTimeForDisplay = (timeString: Date) => {
    return new Date(timeString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Helper function to format datetime for input fields
  const formatDateTimeForInput = (date: Date): string => {
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-bold'>Periods</h2>
        <Button onClick={handleAddPeriod}>
          <Plus className='mr-2 h-4 w-4' /> Add Period
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className='text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {periods.map(period => {
            const startTime = new Date(period.startTime)
            const endTime = new Date(period.endTime)
            const durationMinutes = Math.round(
              (endTime.getTime() - startTime.getTime()) / 60000
            )

            return (
              <TableRow key={period.id}>
                <TableCell>{period.name}</TableCell>
                <TableCell>{formatTimeForDisplay(period.startTime)}</TableCell>
                <TableCell>{formatTimeForDisplay(period.endTime)}</TableCell>
                <TableCell>{durationMinutes} minutes</TableCell>
                <TableCell className='text-right'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => handleEditPeriod(period)}
                  >
                    <Pencil className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => handleDeletePeriod(period.id ?? '')}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPeriod?.id ? 'Edit Period' : 'Add New Period'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePeriod} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                value={editingPeriod?.name || ''}
                onChange={e =>
                  setEditingPeriod(prev =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='startTime'>Start Time</Label>
              <Input
                id='startTime'
                type='datetime-local'
                value={
                  editingPeriod?.startTime
                    ? formatDateTimeForInput(editingPeriod.startTime)
                    : ''
                }
                onChange={e =>
                  setEditingPeriod(prev =>
                    prev
                      ? {
                          ...prev,
                          startTime: new Date(e.target.value),
                        }
                      : null
                  )
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='endTime'>End Time</Label>
              <Input
                id='endTime'
                type='datetime-local'
                value={
                  editingPeriod?.endTime
                    ? formatDateTimeForInput(editingPeriod.endTime)
                    : ''
                }
                onChange={e =>
                  setEditingPeriod(prev =>
                    prev
                      ? {
                          ...prev,
                          endTime: new Date(e.target.value),
                        }
                      : null
                  )
                }
                required={true}
              />
            </div>

            <div className='flex justify-end space-x-2 pt-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit'>
                {editingPeriod?.id ? 'Update' : 'Create'} Period
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
