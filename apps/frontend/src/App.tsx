import { Loader } from 'lucide-react'

import Auth from './components/Auth'
import Onboarding from './components/Onboarding'
import BlobBackground from './components/ui/blob-background'
import VerifyEmail from './components/VerifyEmail'
import { useAuth } from './lib/auth'

const Index = () => {
  const { user, logout, token, isRefreshing } = useAuth()

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
  if (!user) return <Auth />
  if (!user.isEmailVerified) return <VerifyEmail email={user.email} />
  if (!user.isOnboarded) return <Onboarding />

  return (
    <div>
      {JSON.stringify(user)}
      {token}
      {<p>Logged in as {user.email}</p>}
      {<p>Logged in as {user.username}</p>}
      <button onClick={logout}>Logout</button>
    </div>
  )
}

export default Index
