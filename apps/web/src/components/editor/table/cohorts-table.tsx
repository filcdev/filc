import { mockRooms, mockTeachers } from '@/lib/editor/mock'
import { useTRPC } from '@/lib/trpc'
import type { cohort as Cohort } from '@filc/db/schema/timetable'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@filc/ui/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filc/ui/components/table'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

export function CohortsTable() {
  const t = useTRPC()
  const cohortQuery = useQuery(t.cohort.getAll.queryOptions())
  const cohortCreator = useMutation(t.cohort.create.mutationOptions({
    onSuccess: () => cohortQuery.refetch(),
  }))
  const cohortUpdater = useMutation(t.cohort.update.mutationOptions({
    onSuccess: () => cohortQuery.refetch(),
  }))
  const cohortDeleter = useMutation(t.cohort.delete.mutationOptions({
    onSuccess: () => cohortQuery.refetch(),
  }))
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [editingCohort, setEditingCohort] = useState<Insert<
    typeof Cohort
  > | null>(null)

  const handleAddCohort = () => {
    setEditingCohort({
      id: '',
      year: new Date().getFullYear(),
      designation: '',
      classMasterId: '',
      secondaryClassMasterId: '',
      headquartersRoomId: '',
    })
    setIsDialogOpen(true)
  }

  const handleEditCohort = (cohort: Insert<typeof Cohort>) => {
    setEditingCohort(cohort)
    setIsDialogOpen(true)
  }

  const handleDeleteCohort = (id: string) => {
    if (!id) return
    cohortDeleter.mutate(id)
  }

  const handleSaveCohort = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCohort) return
    if (editingCohort.id) {
      cohortUpdater.mutate({
        // why do I have to make this type assertion?
        id: editingCohort.id,
        ...editingCohort,
      })
    } else {
      cohortCreator.mutate(editingCohort)
    }
    setIsDialogOpen(false)
  }

  const getTeacherName = (id: string) => {
    const teacher = mockTeachers.find(t => t.id === id)
    return teacher ? teacher.name : 'Unknown'
  }

  const getRoomName = (id: string) => {
    const room = mockRooms.find(r => r.id === id)
    return room ? room.name : 'Unknown'
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-bold'>Cohorts</h2>
        <Button onClick={handleAddCohort}>
          <Plus className='mr-2 h-4 w-4' /> Add Cohort
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Class Master</TableHead>
            <TableHead>Secondary Class Master</TableHead>
            <TableHead>Headquarters Room</TableHead>
            <TableHead className='text-right'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cohortQuery.data?.map(cohort => (
            <TableRow key={cohort.id}>
              <TableCell>{cohort.year}</TableCell>
              <TableCell>{cohort.designation}</TableCell>
              <TableCell>{getTeacherName(cohort.classMasterId)}</TableCell>
              <TableCell>
                {getTeacherName(cohort.secondaryClassMasterId)}
              </TableCell>
              <TableCell>{getRoomName(cohort.headquartersRoomId)}</TableCell>
              <TableCell className='text-right'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleEditCohort(cohort)}
                >
                  <Pencil className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleDeleteCohort(cohort.id ?? '')}
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
              {editingCohort?.id ? 'Edit Cohort' : 'Add New Cohort'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCohort} className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='year'>Year</Label>
                <Input
                  id='year'
                  type='number'
                  value={editingCohort?.year || new Date().getFullYear()}
                  onChange={e =>
                    setEditingCohort(prev =>
                      prev
                        ? {
                            ...prev,
                            year: Number.parseInt(e.target.value),
                          }
                        : null
                    )
                  }
                  required={true}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='designation'>Designation</Label>
                <Input
                  id='designation'
                  value={editingCohort?.designation || ''}
                  onChange={e =>
                    setEditingCohort(prev =>
                      prev
                        ? {
                            ...prev,
                            designation: e.target.value,
                          }
                        : null
                    )
                  }
                  maxLength={3}
                  required={true}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='classMaster'>Class Master</Label>
              <Select
                value={editingCohort?.classMasterId || ''}
                onValueChange={value =>
                  setEditingCohort(prev =>
                    prev ? { ...prev, classMasterId: value } : null
                  )
                }
                required={true}
              >
                <SelectTrigger id='classMaster'>
                  <SelectValue placeholder='Select class master' />
                </SelectTrigger>
                <SelectContent>
                  {mockTeachers.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='secondaryClassMaster'>
                Secondary Class Master
              </Label>
              <Select
                value={editingCohort?.secondaryClassMasterId || ''}
                onValueChange={value =>
                  setEditingCohort(prev =>
                    prev
                      ? {
                          ...prev,
                          secondaryClassMasterId: value,
                        }
                      : null
                  )
                }
                required={true}
              >
                <SelectTrigger id='secondaryClassMaster'>
                  <SelectValue placeholder='Select secondary class master' />
                </SelectTrigger>
                <SelectContent>
                  {mockTeachers.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='headquartersRoom'>Headquarters Room</Label>
              <Select
                value={editingCohort?.headquartersRoomId || ''}
                onValueChange={value =>
                  setEditingCohort(prev =>
                    prev
                      ? {
                          ...prev,
                          headquartersRoomId: value,
                        }
                      : null
                  )
                }
                required={true}
              >
                <SelectTrigger id='headquartersRoom'>
                  <SelectValue placeholder='Select headquarters room' />
                </SelectTrigger>
                <SelectContent>
                  {mockRooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                {editingCohort?.id ? 'Update' : 'Create'} Cohort
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
