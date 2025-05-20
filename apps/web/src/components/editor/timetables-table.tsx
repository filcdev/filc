'use client'

import type React from 'react'

import { mockTimetables } from '@/lib/editor/mock'
import type { timetable as Timetable } from '@filc/db/schema/timetable'
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
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

export function TimetablesTable() {
  const [timetables, setTimetables] = useState<Insert<typeof Timetable>[]>(() =>
    mockTimetables.map(timetable => ({
      ...timetable,
      validFrom: new Date(timetable.validFrom),
      validTo: new Date(timetable.validTo),
    }))
  )
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [editingTimetable, setEditingTimetable] = useState<Insert<
    typeof Timetable
  > | null>(null)

  const handleAddTimetable = () => {
    setEditingTimetable({
      id: '',
      name: '',
      validFrom: new Date(),
      validTo: new Date(),
    })
    setIsDialogOpen(true)
  }

  const handleEditTimetable = (timetable: Insert<typeof Timetable>) => {
    setEditingTimetable({
      ...timetable,
    })
    setIsDialogOpen(true)
  }

  const handleDeleteTimetable = (id: string) => {
    setTimetables(timetables.filter(timetable => timetable.id !== id))
  }

  const handleDuplicateTimetable = (timetable: Insert<typeof Timetable>) => {
    const newTimetable: Insert<typeof Timetable> = {
      ...timetable,
      id: Math.random().toString(36).substring(2, 9),
      name: `${timetable.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    setTimetables([...timetables, newTimetable])
  }

  const handleSaveTimetable = (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingTimetable) return

    if (editingTimetable.id) {
      // Update existing timetable
      setTimetables(
        timetables.map(timetable =>
          timetable.id === editingTimetable.id ? editingTimetable : timetable
        )
      )
    } else {
      // Add new timetable
      const newTimetable: Insert<typeof Timetable> = {
        ...editingTimetable,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setTimetables([...timetables, newTimetable])
    }

    setIsDialogOpen(false)
  }

  // Helper function to format date for display
  const formatDateForDisplay = (date: Date) => {
    return new Date(date).toLocaleDateString()
  }

  // Helper function to format date for input
  const formatDateForInput = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-bold'>Timetables</h2>
        <Button onClick={handleAddTimetable}>
          <Plus className='mr-2 h-4 w-4' /> Add Timetable
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Valid From</TableHead>
            <TableHead>Valid To</TableHead>
            <TableHead className='text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {timetables.map(timetable => (
            <TableRow key={timetable.id}>
              <TableCell>{timetable.name}</TableCell>
              <TableCell>{formatDateForDisplay(timetable.validFrom)}</TableCell>
              <TableCell>{formatDateForDisplay(timetable.validTo)}</TableCell>
              <TableCell className='text-right'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleEditTimetable(timetable)}
                >
                  <Pencil className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleDuplicateTimetable(timetable)}
                >
                  <Copy className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleDeleteTimetable(timetable.id ?? '')}
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTimetable?.id ? 'Edit Timetable' : 'Add New Timetable'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveTimetable} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                value={editingTimetable?.name || ''}
                onChange={e =>
                  setEditingTimetable(prev =>
                    prev
                      ? {
                          ...prev,
                          name: e.target.value,
                        }
                      : null
                  )
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='validFrom'>Valid From</Label>
              <Input
                id='validFrom'
                type='date'
                value={
                  editingTimetable?.validFrom
                    ? formatDateForInput(editingTimetable.validFrom)
                    : ''
                }
                onChange={e =>
                  setEditingTimetable(prev =>
                    prev
                      ? {
                          ...prev,
                          validFrom: new Date(e.target.value),
                        }
                      : null
                  )
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='validTo'>Valid To</Label>
              <Input
                id='validTo'
                type='date'
                value={
                  editingTimetable?.validTo
                    ? formatDateForInput(editingTimetable.validTo)
                    : ''
                }
                onChange={e =>
                  setEditingTimetable(prev =>
                    prev
                      ? {
                          ...prev,
                          validTo: new Date(e.target.value),
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
                {editingTimetable?.id ? 'Update' : 'Create'} Timetable
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
