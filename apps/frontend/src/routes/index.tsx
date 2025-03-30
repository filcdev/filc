import { createFileRoute } from '@tanstack/react-router'
import { Loader } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import BlobBackground from '@/components/ui/blob-background'
import { useAuth } from '@/lib/auth'

const Index = () => {
  const { user, logout, isRefreshing } = useAuth()

  if (isRefreshing)
    return (
      <main className="flex grow items-center justify-center">
        <BlobBackground />
        <div className="z-10 flex flex-col items-center justify-center gap-4 text-white">
          <Loader className="size-12 animate-spin" />
          <span className="text-xl font-semibold">Betöltés...</span>
        </div>
      </main>
    )

  return (
    <>
      <div className="-z-10">
        <BlobBackground />
      </div>
      <Navbar />
      <main>
        {user ? JSON.stringify(user) : <p>Not logged in</p>}
        <button
          onClick={() => {
            logout()
          }}
        >
          Goobye
        </button>
      </main>
    </>
  )
}

export const Route = createFileRoute('/')({
  component: Index
})
