import { useAuth } from '@/lib/auth'
import { Button } from '@filc/ui/components/button'
import { Logo } from '@filc/ui/components/logo'
import { createFileRoute } from '@tanstack/react-router'

const Auth = () => {
  const auth = useAuth()

  const onLogin = async () => {
    const result = await auth.signIn.social({
      provider: 'microsoft',
      callbackURL: `${window.location.origin}`,
    })

    if (result.error) {
      return
    }
  }

  return (
    <div className='p-2'>
      <Logo />
      <h3>Welcome to Filc</h3>
      <Button onClick={onLogin}>Login with Microsoft</Button>
    </div>
  )
}

export const Route = createFileRoute('/auth')({
  component: Auth,
})
