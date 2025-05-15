import { useAuth } from '@/lib/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@filc/ui/components/avatar'
import { Button } from '@filc/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@filc/ui/components/dropdown-menu'
import { useNavigate } from '@tanstack/react-router'
import { FaGear, FaRightFromBracket, FaUser } from 'react-icons/fa6'

export const UserMenu = () => {
  const auth = useAuth()
  const { data: authData, isPending } = auth.useSession()
  const navigate = useNavigate()

  if (isPending) {
    // todo: skeleton
    return null
  }

  return authData?.user ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild={true}>
        <Button variant='ghost' size='icon' className='rounded-full'>
          <Avatar className='h-8 w-8'>
            <AvatarImage
              src={authData.user.image || '/placeholder.svg'}
              alt={authData.user.name}
            />
            <AvatarFallback>{authData.user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <div className='flex items-center justify-start gap-2 p-2'>
          <div className='flex flex-col space-y-1 leading-none'>
            {authData.user.name && (
              <p className='font-medium'>{authData.user.name}</p>
            )}
            {authData.user.email && (
              <p className='w-[200px] truncate text-sm text-muted-foreground'>
                {authData.user.email}
              </p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <FaUser className='mr-2 h-4 w-4' />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FaGear className='mr-2 h-4 w-4' />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => auth.signOut()}>
          <FaRightFromBracket className='mr-2 h-4 w-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button size='sm' onClick={() => navigate({ to: '/auth' })}>
      Login
    </Button>
  )
}
