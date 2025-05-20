'use client'

import type React from 'react'

import { mockPeriods } from '@/lib/editor/mock'
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

export function PeriodsTable() {
  const [periods, setPeriods] = useState(mockPeriods)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<any | null>(null)

  const handleAddPeriod = () => {
    setEditingPeriod({
      id: '',
      name: '',
      startTime: '',
      endTime: '',
    })
    setIsDialogOpen(true)
  }

  const handleEditPeriod = (period: any) => {
    setEditingPeriod({
      ...period,
      startTime: formatTimeForInput(period.startTime),
      endTime: formatTimeForInput(period.endTime),
    })
    setIsDialogOpen(true)
  }

  const handleDeletePeriod = (id: string) => {
    setPeriods(periods.filter(period => period.id !== id))
  }

  const handleSavePeriod = (e: React.FormEvent) => {
    e.preventDefault()

    const formattedPeriod = {
      ...editingPeriod,
      startTime: new Date(editingPeriod.startTime).toISOString(),
      endTime: new Date(editingPeriod.endTime).toISOString(),
    }

    if (editingPeriod.id) {
      // Update existing period
      setPeriods(
        periods.map(period =>
          period.id === editingPeriod.id ? formattedPeriod : period
        )
      )
    } else {
      // Add new period
      setPeriods([
        ...periods,
        {
          ...formattedPeriod,
          id: Math.random().toString(36).substring(2, 9),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    }

    setIsDialogOpen(false)
  }

  // Helper function to format time for display
  const formatTimeForDisplay = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Helper function to format time for input
  const formatTimeForInput = (timeString: string) => {
    const date = new Date(timeString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
                    onClick={() => handleDeletePeriod(period.id)}
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
                  setEditingPeriod({ ...editingPeriod, name: e.target.value })
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='startTime'>Start Time</Label>
              <Input
                id='startTime'
                type='datetime-local'
                value={editingPeriod?.startTime || ''}
                onChange={e =>
                  setEditingPeriod({
                    ...editingPeriod,
                    startTime: e.target.value,
                  })
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='endTime'>End Time</Label>
              <Input
                id='endTime'
                type='datetime-local'
                value={editingPeriod?.endTime || ''}
                onChange={e =>
                  setEditingPeriod({
                    ...editingPeriod,
                    endTime: e.target.value,
                  })
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
