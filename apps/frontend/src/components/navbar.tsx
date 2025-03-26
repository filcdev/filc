import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useRouter } from '@tanstack/react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const AuthenticatedUserSection = () => {
  const { user, logout } = useAuth()

  // we got rendered when the user is not logged in
  // this should not happen
  if (!user) return null

  return (
    <div className="flex gap-3">
      <Button variant="outline" size="sm" onClick={logout}>
        Kijelentkezés
      </Button>
      <Avatar>
        <AvatarFallback>
          {user.username?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}

export const Navbar = () => {
  const { user } = useAuth()
  const router = useRouter()

  const redirectToLogin = async () => {
    await router.navigate({ to: '/auth' })
  }

  return (
    <header className="bg-background/30 m-4 flex items-center justify-between rounded-lg border px-4 py-1.5">
      <div>
        <span className="text-lg font-semibold">Filc</span>
      </div>
      <div className="flex gap-3">
        {user ? (
          <AuthenticatedUserSection />
        ) : (
          <Button variant="outline" size="default" onClick={redirectToLogin}>
            Bejelentkezés
          </Button>
        )}
      </div>
    </header>
  )
}
