import { mockSubjects } from '@/lib/editor/mock'
import type { subject as Subject } from '@filc/db/schema/timetable'
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
import { useState } from 'react'
import { FaPlus, FaRegPenToSquare, FaRegTrashCan } from 'react-icons/fa6'

export function SubjectsTable() {
  const [subjects, setSubjects] =
    useState<Insert<typeof Subject>[]>(mockSubjects)
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [editingSubject, setEditingSubject] = useState<Insert<
    typeof Subject
  > | null>(null)

  const handleAddSubject = () => {
    setEditingSubject({
      id: '',
      name: '',
      shortName: '',
      icon: '📚',
    })
    setIsDialogOpen(true)
  }

  const handleEditSubject = (subject: Insert<typeof Subject>) => {
    setEditingSubject(subject)
    setIsDialogOpen(true)
  }

  const handleDeleteSubject = (id: string) => {
    setSubjects(subjects.filter(subject => subject.id !== id))
  }

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingSubject?.id) {
      // Update existing subject
      setSubjects(
        subjects.map(subject =>
          subject.id === editingSubject.id ? editingSubject : subject
        )
      )
    } else if (editingSubject) {
      // Add new subject with required fields
      const newSubject: Insert<typeof Subject> = {
        name: editingSubject.name,
        shortName: editingSubject.shortName,
        icon: editingSubject.icon,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setSubjects([...subjects, newSubject])
    }

    setIsDialogOpen(false)
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-bold'>Subjects</h2>
        <Button onClick={handleAddSubject}>
          <FaPlus className='mr-2 h-4 w-4' /> Add Subject
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Icon</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Short Name</TableHead>
            <TableHead className='text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subjects.map(subject => (
            <TableRow key={subject.id}>
              <TableCell>{subject.icon}</TableCell>
              <TableCell>{subject.name}</TableCell>
              <TableCell>{subject.shortName}</TableCell>
              <TableCell className='text-right'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleEditSubject(subject)}
                >
                  <FaRegPenToSquare className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleDeleteSubject(subject.id ?? '')}
                >
                  <FaRegTrashCan className='h-4 w-4' />
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
              {editingSubject?.id ? 'Edit Subject' : 'Add New Subject'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSubject} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                value={editingSubject?.name || ''}
                onChange={e =>
                  setEditingSubject(prev =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='shortName'>Short Name</Label>
              <Input
                id='shortName'
                value={editingSubject?.shortName || ''}
                onChange={e =>
                  setEditingSubject(prev =>
                    prev
                      ? {
                          ...prev,
                          shortName: e.target.value,
                        }
                      : null
                  )
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='icon'>Icon (emoji)</Label>
              <Input
                id='icon'
                value={editingSubject?.icon || ''}
                onChange={e =>
                  setEditingSubject(prev =>
                    prev ? { ...prev, icon: e.target.value } : null
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
                {editingSubject?.id ? 'Update' : 'Create'} Subject
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
