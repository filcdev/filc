import { useAuth } from '@/lib/auth'
import { Button } from '@filc/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@filc/ui/components/card'
import { Logo } from '@filc/ui/components/logo'
import { createFileRoute } from '@tanstack/react-router'
import { FaMicrosoft } from 'react-icons/fa6'

const Page = () => {
  const auth = useAuth()

  const onLogin = async () => {
    const result = await auth.signIn.social({
      provider: 'microsoft',
      callbackURL: `${window.location.origin}`,
      errorCallbackURL: `${window.location.origin}/auth/error`,
    })

    if (result.error) {
      return
    }
  }

  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      <div className='flex flex-col gap-4 p-6 md:p-10'>
        <div className='flex justify-center gap-2 md:justify-start'>
          <a href='/' className='flex items-center gap-2 font-medium'>
            <Logo className='h-10 w-10' />
            Filc
          </a>
        </div>
        <div className='flex flex-1 items-center justify-center'>
          <div className='w-full max-w-xs'>
            <Card>
              <CardHeader>
                <CardTitle>Log in to Filc</CardTitle>
                <CardDescription>
                  This is a private app. Please log in with your Microsoft
                  account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant='outline'
                  className='w-full cursor-pointer'
                  onClick={onLogin}
                >
                  <FaMicrosoft />
                  Login with Microsoft
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <div className='relative hidden bg-muted lg:block'>
        <div className='absolute inset-0 h-full w-full object-cover bg-gradient-to-b from-primary to-secondary' />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/auth/')({
  component: Page,
})
