import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { mockRooms } from '@/lib/editor/mock'
import type { room as Room } from '@filc/db/schema/timetable'
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
  FormDescription,
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
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

const roomFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Room name is required'),
  shortName: z
    .string()
    .min(1, 'Short name is required')
    .max(5, 'Short name must be 5 characters or less'),
  capacity: z
    .number()
    .min(1, 'Capacity must be at least 1')
    .max(500, 'Capacity must be 500 or less'),
})

type RoomFormValues = z.infer<typeof roomFormSchema>

export function RoomsTable() {
  const [rooms, setRooms] = useState<Insert<typeof Room>[]>(mockRooms)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false)
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)

  // Setup the form with react-hook-form and zod validation
  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: {
      id: '',
      name: '',
      shortName: '',
      capacity: 0,
    },
  })

  const handleAddRoom = () => {
    // Reset the form for a new room
    form.reset({
      id: '',
      name: '',
      shortName: '',
      capacity: 0,
    })
    setEditingRoomId(null)
    setIsDialogOpen(true)
  }

  const handleEditRoom = (room: Insert<typeof Room>) => {
    // Set form values to the room being edited
    form.reset({
      id: room.id,
      name: room.name,
      shortName: room.shortName,
      capacity: room.capacity,
    })
    setEditingRoomId(room.id ?? null)
    setIsDialogOpen(true)
  }

  const handleDeletePrompt = (id: string) => {
    setRoomToDelete(id)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (roomToDelete) {
      setRooms(rooms.filter(room => room.id !== roomToDelete))
      setRoomToDelete(null)
      setIsDeleteDialogOpen(false)
    }
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteRoom = () => {
    if (roomToDelete) {
      setRooms(rooms.filter(room => room.id !== roomToDelete))
      setRoomToDelete(null)
    }
    setIsDeleteDialogOpen(false)
  }

  const handleSaveRoom = (values: RoomFormValues) => {
    if (editingRoomId) {
      // Update existing room
      setRooms(
        rooms.map(room =>
          room.id === editingRoomId
            ? { ...room, ...values, updatedAt: new Date() }
            : room
        )
      )
    } else {
      // Add new room with required fields
      const newRoom: Insert<typeof Room> = {
        ...values,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setRooms([...rooms, newRoom])
    }

    setIsDialogOpen(false)
  }

  // Filter rooms based on search query
  const filteredRooms = rooms.filter(
    room =>
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.shortName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-bold'>Rooms</h2>
        <Button onClick={handleAddRoom}>
          <Plus className='mr-2 h-4 w-4' /> Add Room
        </Button>
      </div>

      {/* Search bar */}
      <div>
        <Input
          placeholder='Search rooms by name or short name'
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className='mb-4'
        />
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Short Name</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRooms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className='h-24 text-center'>
                  No rooms found. Click "Add Room" to create one.
                </TableCell>
              </TableRow>
            ) : (
              filteredRooms.map(room => (
                <TableRow key={room.id}>
                  <TableCell>{room.name}</TableCell>
                  <TableCell>{room.shortName}</TableCell>
                  <TableCell>{room.capacity}</TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => handleEditRoom(room)}
                      aria-label={`Edit ${room.name}`}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => handleDeletePrompt(room.id ?? '')}
                      aria-label={`Delete ${room.name}`}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRoomId ? 'Edit Room' : 'Add New Room'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSaveRoom)}
              className='space-y-4'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder='Room name' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='shortName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Short name (max 5 chars)'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A short abbreviation for the room (max 5 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='capacity'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='Room capacity'
                        {...field}
                        onChange={e => field.onChange(Number(e.target.value))}
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
                  onClick={() => {
                    setIsDialogOpen(false)
                    form.reset()
                  }}
                >
                  Cancel
                </Button>
                <Button type='submit'>
                  {editingRoomId ? 'Update' : 'Create'} Room
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for deleting rooms */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className='py-4'>
            <p>
              Are you sure you want to delete this room? This action cannot be
              undone.
            </p>
          </div>
          <div className='flex justify-end space-x-2 pt-4'>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setRoomToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={handleConfirmDelete}
            >
              Delete Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
