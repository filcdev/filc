import { useAuth } from '@/lib/auth'
import { Button } from '@filc/ui/components/button'
import { Logo } from '@filc/ui/components/logo'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@filc/ui/components/navigation-menu'
import { useState } from 'react'
import { FaBars, FaGear } from 'react-icons/fa6'
import { UserMenu } from './user-menu'

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const auth = useAuth()
  const { data: authData, isPending } = auth.useSession()

  if (isPending) {
    // todo: skeleton
    return null
  }

  return (
    <nav className='border-b bg-background'>
      <div className='container flex h-16 items-center justify-between px-4 mx-auto'>
        {/* Left side: Logo and navigation menu */}
        <div className='flex items-center gap-4'>
          <a href='/' className='flex items-center gap-2'>
            <Logo />
            <span className='text-xl font-bold'>Filc</span>
          </a>

          <NavigationMenu className='hidden md:flex'>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Actions</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className='grid gap-3 p-4 w-[200px]'>
                    <li>
                      <NavigationMenuLink asChild={true}>
                        <a
                          href='/dashboard'
                          className='flex w-full select-none items-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground'
                        >
                          Dashboard
                        </a>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild={true}>
                        <a
                          href='/projects'
                          className='flex w-full select-none items-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground'
                        >
                          Projects
                        </a>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild={true}>
                        <a
                          href='/tasks'
                          className='flex w-full select-none items-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground'
                        >
                          Tasks
                        </a>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild={true}
                  className={navigationMenuTriggerStyle()}
                >
                  <a href='/dashboard'>Dashboard</a>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Right side: Admin button and user menu */}
        <div className='flex items-center gap-4'>
          {/* Mobile menu button */}

          <div className='hidden md:flex md:items-center md:gap-4'>
            {authData?.user.name && (
              <Button variant='outline' size='sm' asChild={true}>
                <a href='/admin'>
                  <FaGear className='mr-2 h-4 w-4' />
                  Admin
                </a>
              </Button>
            )}
          </div>
          <UserMenu />
          <Button
            variant='ghost'
            size='icon'
            className='md:hidden'
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <FaBars className='h-5 w-5' />
            <span className='sr-only'>Toggle menu</span>
          </Button>
        </div>
      </div>

      {isMenuOpen && (
        <div className='container border-t py-4 md:hidden'>
          <div className='flex flex-col space-y-3'>
            <a
              href='/dashboard'
              className='text-sm font-medium'
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </a>
            <a
              href='/projects'
              className='text-sm font-medium'
              onClick={() => setIsMenuOpen(false)}
            >
              Projects
            </a>
            <a
              href='/tasks'
              className='text-sm font-medium'
              onClick={() => setIsMenuOpen(false)}
            >
              Tasks
            </a>
            {authData?.user.name && (
              <a
                href='/admin'
                className='text-sm font-medium'
                onClick={() => setIsMenuOpen(false)}
              >
                Admin
              </a>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
