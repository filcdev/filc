import { mockTeachers } from '@/lib/editor/mock'
import type { teacher as Teacher } from '@filc/db/schema/timetable'
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
import type { FormEvent } from 'react'
import { FaPencil, FaPlus, FaTrash } from 'react-icons/fa6'

export function TeachersTable() {
  const [teachers, setTeachers] =
    useState<Insert<typeof Teacher>[]>(mockTeachers)
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [editingTeacher, setEditingTeacher] = useState<Insert<
    typeof Teacher
  > | null>(null)

  const handleAddTeacher = () => {
    setEditingTeacher({
      id: '',
      name: '',
      shortName: '',
      email: '',
    })
    setIsDialogOpen(true)
  }

  const handleEditTeacher = (teacher: Insert<typeof Teacher>) => {
    setEditingTeacher(teacher)
    setIsDialogOpen(true)
  }

  const handleDeleteTeacher = (id: string) => {
    setTeachers(teachers.filter(teacher => teacher.id !== id))
  }

  const handleSaveTeacher = (e: FormEvent) => {
    e.preventDefault()

    if (editingTeacher?.id) {
      // Update existing teacher
      setTeachers(
        teachers.map(teacher =>
          teacher.id === editingTeacher.id ? editingTeacher : teacher
        )
      )
    } else if (editingTeacher) {
      // Add new teacher with required fields
      const newTeacher: Insert<typeof Teacher> = {
        name: editingTeacher.name,
        shortName: editingTeacher.shortName,
        email: editingTeacher.email,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setTeachers([...teachers, newTeacher])
    }

    setIsDialogOpen(false)
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-bold'>Teachers</h2>
        <Button onClick={handleAddTeacher}>
          <FaPlus className='mr-2 h-4 w-4' /> Add Teacher
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Short Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className='text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map(teacher => (
            <TableRow key={teacher.id}>
              <TableCell>{teacher.name}</TableCell>
              <TableCell>{teacher.shortName}</TableCell>
              <TableCell>{teacher.email}</TableCell>
              <TableCell className='text-right'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleEditTeacher(teacher)}
                >
                  <FaPencil className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleDeleteTeacher(teacher.id ?? '')}
                >
                  <FaTrash className='h-4 w-4' />
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
              {editingTeacher?.id ? 'Edit Teacher' : 'Add New Teacher'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveTeacher} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                value={editingTeacher?.name || ''}
                onChange={e =>
                  setEditingTeacher(prev =>
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
                value={editingTeacher?.shortName || ''}
                onChange={e =>
                  setEditingTeacher(prev =>
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
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={editingTeacher?.email || ''}
                onChange={e =>
                  setEditingTeacher(prev =>
                    prev
                      ? {
                          ...prev,
                          email: e.target.value,
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
                {editingTeacher?.id ? 'Update' : 'Create'} Teacher
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
