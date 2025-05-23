import { Button } from '@filc/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@filc/ui/components/card'
import { Logo } from '@filc/ui/components/logo'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

const Page = () => {
  const navigate = useNavigate()

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
                <CardTitle>An error occured</CardTitle>
                <CardDescription>
                  An unknown error occured while signing you in to Filc. Please
                  try again in a few moments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant='outline'
                  className='w-full cursor-pointer'
                  onClick={() => navigate({ to: '/auth', replace: true })}
                >
                  Try again
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

export const Route = createFileRoute('/auth/error')({
  component: Page,
})
