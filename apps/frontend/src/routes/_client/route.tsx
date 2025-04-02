import { createFileRoute, Outlet } from '@tanstack/react-router'

import BlobBackground from '@/components/ui/blob-background'

export const Route = createFileRoute('/_client')({
  component: PathlessLayoutComponent
})

function PathlessLayoutComponent() {
  return (
    <>
      <BlobBackground />
      <div className="absolute top-0 left-0 flex h-screen w-screen flex-col overflow-scroll overflow-x-hidden">
        <Outlet />
      </div>
    </>
  )
}
