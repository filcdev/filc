import { Navbar } from '@/components/navbar'
import { Outlet, createFileRoute } from '@tanstack/react-router'

const AppLayout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  )
}

export const Route = createFileRoute('/(app)')({
  component: AppLayout,
})
