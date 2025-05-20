'use client'

import type React from 'react'

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

export function RoomsTable() {
  const [rooms, setRooms] = useState<Insert<typeof Room>[]>(mockRooms)
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [editingRoom, setEditingRoom] = useState<Insert<typeof Room> | null>(
    null
  )

  const handleAddRoom = () => {
    setEditingRoom({
      id: '',
      name: '',
      shortName: '',
      capacity: 0,
    })
    setIsDialogOpen(true)
  }

  const handleEditRoom = (room: Insert<typeof Room>) => {
    setEditingRoom(room)
    setIsDialogOpen(true)
  }

  const handleDeleteRoom = (id: string) => {
    setRooms(rooms.filter(room => room.id !== id))
  }

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingRoom?.id) {
      // Update existing room
      setRooms(
        rooms.map(room => (room.id === editingRoom.id ? editingRoom : room))
      )
    } else if (editingRoom) {
      // Add new room with required fields
      const newRoom: Insert<typeof Room> = {
        name: editingRoom.name,
        shortName: editingRoom.shortName,
        capacity: editingRoom.capacity,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setRooms([...rooms, newRoom])
    }

    setIsDialogOpen(false)
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-bold'>Rooms</h2>
        <Button onClick={handleAddRoom}>
          <Plus className='mr-2 h-4 w-4' /> Add Room
        </Button>
      </div>

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
          {rooms.map(room => (
            <TableRow key={room.id}>
              <TableCell>{room.name}</TableCell>
              <TableCell>{room.shortName}</TableCell>
              <TableCell>{room.capacity}</TableCell>
              <TableCell className='text-right'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleEditRoom(room)}
                >
                  <Pencil className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => handleDeleteRoom(room.id ?? '')}
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
              {editingRoom?.id ? 'Edit Room' : 'Add New Room'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveRoom} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                value={editingRoom?.name || ''}
                onChange={e =>
                  setEditingRoom(prev =>
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
                value={editingRoom?.shortName || ''}
                onChange={e =>
                  setEditingRoom(prev =>
                    prev ? { ...prev, shortName: e.target.value } : null
                  )
                }
                required={true}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='capacity'>Capacity</Label>
              <Input
                id='capacity'
                type='number'
                value={editingRoom?.capacity || 0}
                onChange={e =>
                  setEditingRoom(prev =>
                    prev
                      ? {
                          ...prev,
                          capacity: Number.parseInt(e.target.value),
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
                {editingRoom?.id ? 'Update' : 'Create'} Room
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
