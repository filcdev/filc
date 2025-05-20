'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@filc/ui/components/form'
import { Input } from '@filc/ui/components/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filc/ui/components/table'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'

// Define the form schema for validation
const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  validFrom: z.date({
    required_error: 'Valid from date is required',
    invalid_type_error: 'Invalid date format',
  }),
  validTo: z.date({
    required_error: 'Valid to date is required',
    invalid_type_error: 'Invalid date format',
  }),
})

// Type for our form values
type FormValues = z.infer<typeof formSchema>

// Helper function to format date for display
const formatDateForDisplay = (date: Date) => {
  return new Date(date).toLocaleDateString()
}

// Helper function to format date for input
const formatDateForInput = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: '',
      name: '',
      validFrom: new Date(),
      validTo: new Date(),
    },
  })

  useEffect(() => {
    if (editingTimetable) {
      form.reset({
        id: editingTimetable.id,
        name: editingTimetable.name,
        validFrom: editingTimetable.validFrom,
        validTo: editingTimetable.validTo,
      })
    }
  }, [editingTimetable, form])

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

  const onSubmit = (data: FormValues) => {
    if (data.id) {
      // Update existing timetable
      setTimetables(
        timetables.map(timetable =>
          timetable.id === data.id ? { ...data } : timetable
        )
      )
    } else {
      // Add new timetable
      const newTimetable: Insert<typeof Timetable> = {
        ...data,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setTimetables([...timetables, newTimetable])
    }

    setIsDialogOpen(false)
  }

  // Update the handle save function to use the form
  const handleSaveTimetable = (e: React.FormEvent) => {
    e.preventDefault()
    form.handleSubmit(onSubmit)()
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor='name'>Name</FormLabel>
                    <FormControl>
                      <Input id='name' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='validFrom'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor='validFrom'>Valid From</FormLabel>
                    <FormControl>
                      <Input
                        id='validFrom'
                        type='date'
                        value={formatDateForInput(field.value)}
                        onChange={(e) => {
                          field.onChange(new Date(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='validTo'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor='validTo'>Valid To</FormLabel>
                    <FormControl>
                      <Input
                        id='validTo'
                        type='date'
                        value={formatDateForInput(field.value)}
                        onChange={(e) => {
                          field.onChange(new Date(e.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
