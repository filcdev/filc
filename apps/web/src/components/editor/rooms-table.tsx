'use client'

import type React from 'react'

import { mockRooms } from '@/lib/editor/mock'
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
  const [rooms, setRooms] = useState(mockRooms)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any | null>(null)

  const handleAddRoom = () => {
    setEditingRoom({
      id: '',
      name: '',
      shortName: '',
      capacity: 0,
    })
    setIsDialogOpen(true)
  }

  const handleEditRoom = (room: any) => {
    setEditingRoom(room)
    setIsDialogOpen(true)
  }

  const handleDeleteRoom = (id: string) => {
    setRooms(rooms.filter(room => room.id !== id))
  }

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingRoom.id) {
      // Update existing room
      setRooms(
        rooms.map(room => (room.id === editingRoom.id ? editingRoom : room))
      )
    } else {
      // Add new room
      setRooms([
        ...rooms,
        {
          ...editingRoom,
          id: Math.random().toString(36).substring(2, 9),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
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
                  onClick={() => handleDeleteRoom(room.id)}
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
                  setEditingRoom({ ...editingRoom, name: e.target.value })
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
                  setEditingRoom({ ...editingRoom, shortName: e.target.value })
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
                  setEditingRoom({
                    ...editingRoom,
                    capacity: Number.parseInt(e.target.value),
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
                {editingRoom?.id ? 'Update' : 'Create'} Room
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
