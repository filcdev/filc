import { TabsContent } from '@radix-ui/react-tabs'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Loader } from 'lucide-react'

import { Navbar } from '@/components/navbar'
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
      <main className="flex flex-1 grow items-center justify-center">
        <Loader className="size-12 animate-spin" />
        <span className="text-xl font-semibold">Betöltés...</span>
      </main>
    )

  return (
    <Tabs defaultValue="substitutions" className="flex flex-1 grow flex-col">
      <Navbar>
        <TabsList className="flex gap-4 bg-transparent">
          <TabsTrigger value="substitutions">Helyettesítések</TabsTrigger>
          <TabsTrigger value="news">Hírek</TabsTrigger>
        </TabsList>
      </Navbar>
      <main className="flex flex-1 grow">
        <TabsContent value="substitutions" asChild>
          <Substitutions />
        </TabsContent>
        <TabsContent value="news" asChild>
          <News />
        </TabsContent>
      </main>
    </Tabs>
  )
}

export const Route = createFileRoute('/_client/')({
  component: Index
})
