import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaBook,
  FaCalendarDays,
  FaGear,
  FaGraduationCap,
  FaRightFromBracket,
  FaRightToBracket,
  FaSpinner,
} from 'react-icons/fa6';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPositioner,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageSelector } from '@/components/util/language-selector';
import { authClient } from '@/utils/authentication';

type NavbarProps = {
  children?: ReactNode;
  showLinks?: boolean;
  showLogo?: boolean;
};

export function Navbar({
  children,
  showLinks = true,
  showLogo = false,
}: NavbarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data, isPending } = authClient.useSession();

  return (
    <nav className="border-border border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-3">
          {children}
          {showLogo && (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <FaGraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground text-xl">
                filc
              </span>
            </>
          )}
        </div>

        {showLinks && <NavLinks />}

        <div className="ml-auto flex items-center gap-3">
          {/* <Button
            className="relative text-muted-foreground hover:text-foreground"
            size="sm"
            variant="ghost"
          >
            <Bell className="h-4 w-4" />
            <Badge className="-top-1 -right-1 absolute h-5 w-5 rounded-full bg-primary p-0 text-primary-foreground text-xs">
              3
            </Badge>
          </Button> */}

          <LanguageSelector />

          {(() => {
            if (isPending) {
              return (
                <Button
                  className="h-9 w-24"
                  disabled
                  size="sm"
                  variant="outline"
                >
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                </Button>
              );
            }

            if (data?.user) {
              const displayName =
                data.user.nickname ||
                data.user.displayName ||
                data.user.name ||
                data.user.email ||
                t('unknown');
              const initialsSource =
                data.user.nickname ||
                data.user.displayName ||
                data.user.name ||
                data.user.email ||
                'U';
              const initials = initialsSource
                // biome-ignore lint/performance/useTopLevelRegex: not needed
                .split(/\s+/)
                .filter(Boolean)
                .map((segment) => segment[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        className="relative h-9 w-9 rounded-full"
                        variant="ghost"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            alt="Profile"
                            src={data.user.image ?? undefined}
                          />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    }
                  />
                  <DropdownMenuPositioner>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col space-y-1">
                            <p className="font-medium text-sm leading-none">
                              {displayName}
                            </p>
                            <p className="text-muted-foreground text-xs leading-none">
                              {data.user.email}
                            </p>
                          </div>
                        </DropdownMenuLabel>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <FaGear className="mr-2 h-4 w-4" />
                        <span>{t('settings')}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={async () => {
                          await authClient.signOut();
                        }}
                      >
                        <FaRightFromBracket className="mr-2 h-4 w-4" />
                        <span>{t('logout')}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenuPositioner>
                </DropdownMenu>
              );
            }

            return (
              <Button
                className="gap-2"
                onClick={() => navigate({ to: '/auth/login' })}
                size="sm"
                variant="default"
              >
                <FaRightToBracket className="h-4 w-4" />{' '}
                {t('sign_in') || 'Sign in'}
              </Button>
            );
          })()}
        </div>
      </div>
    </nav>
  );
}

function NavLinks() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="ml-8 hidden items-center gap-6 md:flex">
      <Button
        className="text-muted-foreground hover:text-foreground"
        onClick={() => navigate({ to: '/' })}
        size="sm"
        variant="ghost"
      >
        <FaCalendarDays className="mr-2 h-4 w-4" />
        {t('schedule')}
      </Button>
      <Button
        className="text-muted-foreground hover:text-foreground"
        onClick={() => navigate({ to: '/' })}
        size="sm"
        variant="ghost"
      >
        <FaBook className="mr-2 h-4 w-4" />
        {t('substitutions')}
      </Button>
    </div>
  );
}
