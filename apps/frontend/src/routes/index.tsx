import { TabsContent } from '@radix-ui/react-tabs'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Loader } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import BlobBackground from '@/components/ui/blob-background'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import News from '@/components/views/public/news'
import Substitutions from '@/components/views/public/substitutions'
import { useAuth } from '@/lib/auth'

const Index = () => {
  const { isRefreshing, user } = useAuth()
  const router = useRouter()

  if (user) {
    void router.navigate({ to: '/home' })
  }

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
      <Tabs defaultValue="substitutions">
        <Navbar>
          <TabsList className="flex gap-4 bg-transparent">
            <TabsTrigger value="substitutions">Helyettesítések</TabsTrigger>
            <TabsTrigger value="news">Hírek</TabsTrigger>
          </TabsList>
        </Navbar>
        <main className="flex-1 grow">
          <TabsContent value="substitutions">
            <Substitutions />
          </TabsContent>
          <TabsContent value="news">
            <News />
          </TabsContent>
        </main>
      </Tabs>
    </>
  )
}

export const Route = createFileRoute('/')({
  component: Index
})
