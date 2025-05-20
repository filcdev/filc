import { CohortsTable } from '@/components/editor/cohorts-table'
import { PeriodsTable } from '@/components/editor/periods-table'
import { RoomTimetableView } from '@/components/editor/room-timetable-view'
import { RoomsTable } from '@/components/editor/rooms-table'
import { SchoolTimetableView } from '@/components/editor/school-timetable-view'
import { SubjectsTable } from '@/components/editor/subjects-table'
import { TeacherTimetableView } from '@/components/editor/teacher-timetable-view'
import { TeachersTable } from '@/components/editor/teachers-table'
import { TimetableView } from '@/components/editor/timetable-view'
import { TimetablesTable } from '@/components/editor/timetables-table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@filc/ui/components/tabs'
import { createFileRoute } from '@tanstack/react-router'

const Index = () => {
  return (
    <div className='container mx-auto py-6'>
      <h1 className='text-3xl font-bold mb-6'>
        School Timetable Management System
      </h1>

      <Tabs defaultValue='school-timetable'>
        <TabsList className='grid grid-cols-10 w-full mb-8'>
          <TabsTrigger value='school-timetable'>School View</TabsTrigger>
          <TabsTrigger value='timetable'>Cohort View</TabsTrigger>
          <TabsTrigger value='teacher-timetable'>Teacher View</TabsTrigger>
          <TabsTrigger value='room-timetable'>Room View</TabsTrigger>
          <TabsTrigger value='rooms'>Rooms</TabsTrigger>
          <TabsTrigger value='subjects'>Subjects</TabsTrigger>
          <TabsTrigger value='teachers'>Teachers</TabsTrigger>
          <TabsTrigger value='cohorts'>Cohorts</TabsTrigger>
          <TabsTrigger value='periods'>Periods</TabsTrigger>
          <TabsTrigger value='timetables'>Timetables</TabsTrigger>
        </TabsList>

        <TabsContent value='school-timetable' className='space-y-4'>
          <SchoolTimetableView />
        </TabsContent>

        <TabsContent value='timetable' className='space-y-4'>
          <TimetableView />
        </TabsContent>

        <TabsContent value='teacher-timetable' className='space-y-4'>
          <TeacherTimetableView />
        </TabsContent>

        <TabsContent value='room-timetable' className='space-y-4'>
          <RoomTimetableView />
        </TabsContent>

        <TabsContent value='rooms' className='space-y-4'>
          <RoomsTable />
        </TabsContent>

        <TabsContent value='subjects' className='space-y-4'>
          <SubjectsTable />
        </TabsContent>

        <TabsContent value='teachers' className='space-y-4'>
          <TeachersTable />
        </TabsContent>

        <TabsContent value='cohorts' className='space-y-4'>
          <CohortsTable />
        </TabsContent>

        <TabsContent value='periods' className='space-y-4'>
          <PeriodsTable />
        </TabsContent>

        <TabsContent value='timetables' className='space-y-4'>
          <TimetablesTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export const Route = createFileRoute('/(app)/timetable/page')({
  component: Index,
})
