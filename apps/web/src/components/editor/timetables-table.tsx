'use client'

import type React from 'react'

import { mockTimetables } from '@/lib/editor/mock'
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
  const [timetables, setTimetables] = useState(mockTimetables)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTimetable, setEditingTimetable] = useState<any | null>(null)

  const handleAddTimetable = () => {
    setEditingTimetable({
      id: '',
      name: '',
      validFrom: '',
      validTo: '',
    })
    setIsDialogOpen(true)
  }

  const handleEditTimetable = (timetable: any) => {
    setEditingTimetable({
      ...timetable,
      validFrom: formatDateForInput(timetable.validFrom),
      validTo: formatDateForInput(timetable.validTo),
    })
    setIsDialogOpen(true)
  }

  const handleDeleteTimetable = (id: string) => {
    setTimetables(timetables.filter(timetable => timetable.id !== id))
  }

  const handleDuplicateTimetable = (timetable: any) => {
    const newTimetable = {
      ...timetable,
      id: Math.random().toString(36).substring(2, 9),
      name: `${timetable.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setTimetables([...timetables, newTimetable])
  }

  const handleSaveTimetable = (e: React.FormEvent) => {
    e.preventDefault()

    const formattedTimetable = {
      ...editingTimetable,
      validFrom: new Date(editingTimetable.validFrom).toISOString(),
      validTo: new Date(editingTimetable.validTo).toISOString(),
    }

    if (editingTimetable.id) {
      // Update existing timetable
      setTimetables(
        timetables.map(timetable =>
          timetable.id === editingTimetable.id ? formattedTimetable : timetable
        )
      )
    } else {
      // Add new timetable
      setTimetables([
        ...timetables,
        {
          ...formattedTimetable,
          id: Math.random().toString(36).substring(2, 9),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    }

    setIsDialogOpen(false)
  }

  // Helper function to format date for display
  const formatDateForDisplay = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  // Helper function to format date for input
  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString)
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
                  onClick={() => handleDeleteTimetable(timetable.id)}
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
                  setEditingTimetable({
                    ...editingTimetable,
                    name: e.target.value,
                  })
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='validFrom'>Valid From</Label>
              <Input
                id='validFrom'
                type='date'
                value={editingTimetable?.validFrom || ''}
                onChange={e =>
                  setEditingTimetable({
                    ...editingTimetable,
                    validFrom: e.target.value,
                  })
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='validTo'>Valid To</Label>
              <Input
                id='validTo'
                type='date'
                value={editingTimetable?.validTo || ''}
                onChange={e =>
                  setEditingTimetable({
                    ...editingTimetable,
                    validTo: e.target.value,
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
                {editingTimetable?.id ? 'Update' : 'Create'} Timetable
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
