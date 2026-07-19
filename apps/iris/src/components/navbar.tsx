import { useNavigate } from '@tanstack/react-router';
import {
  Book,
  Calendar,
  Cog,
  DoorOpen,
  GraduationCap,
  LogIn,
  LogOut,
  Menu,
  UserCog,
  X,
} from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BugReportDialog } from '@/components/bug-report-dialog';
import { NotificationBell } from '@/components/notification-bell';
import { SettingsDialog } from '@/components/settings-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { LanguageSelector } from '@/components/util/language-selector';
import {
  ADMIN_UI_PERMISSIONS,
  useHasPermission,
} from '@/hooks/use-has-permission';
import type { FileRoutesByTo } from '@/route-tree.gen';
import { cn } from '@/utils';
import { authClient } from '@/utils/authentication';

type NavbarProps = {
  children?: ReactNode;
  showLinks?: boolean;
  showLogo?: boolean;
};

type NavItem = {
  to: keyof FileRoutesByTo;
  icon: ElementType;
  labelKey: string;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { icon: Calendar, labelKey: 'schedule', to: '/' },
  { icon: Book, labelKey: 'substitutions', to: '/subs' },
  { adminOnly: true, icon: UserCog, labelKey: 'adminDashboard', to: '/admin' },
];

export function Navbar({
  children,
  showLinks = true,
  showLogo = false,
}: NavbarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data, isPending } = authClient.useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canSeeAdminUi = useHasPermission(
    ADMIN_UI_PERMISSIONS,
    data?.user?.permissions
  );

  return (
    <>
      <nav className="border-border border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 min-w-0 items-center px-6">
          <div className="flex min-w-0 items-center gap-3">
            {children}
            {data && showLinks && (
              <Button
                aria-controls="mobile-nav"
                aria-expanded={mobileMenuOpen}
                aria-label={
                  mobileMenuOpen
                    ? t('navigation.mobileMenuClose')
                    : t('navigation.mobileMenuOpen')
                }
                className="flex md:hidden"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                size="icon"
                variant="ghost"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            )}
            {showLogo && (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="truncate font-semibold text-foreground text-xl">
                  filc
                </span>
              </>
            )}
          </div>

          {data && showLinks && (
            <NavLinks
              userPermissions={data.user ? data.user.permissions : []}
            />
          )}

          <div className="ml-auto flex min-w-0 items-center gap-3">
            {data && <NotificationBell />}
            {data && <BugReportDialog />}

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
                    <Spinner />
                  </Button>
                );
              }

              if (data?.user) {
                const displayName = data.user.name;
                const displayNickname = data.user.nickname || displayName;
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
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col space-y-1">
                            <div className="flex flex-row gap-1">
                              <p className="font-medium text-sm leading-none">
                                {displayNickname}
                              </p>
                              <p className="font-medium text-muted-foreground text-sm leading-none">
                                {displayName === displayNickname
                                  ? null
                                  : `(${displayName})`}
                              </p>
                            </div>
                            <p className="text-muted-foreground text-xs leading-none">
                              {data.user.email}
                            </p>
                          </div>
                        </DropdownMenuLabel>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => navigate({ to: '/cards' })}
                      >
                        <DoorOpen />
                        <span>{t('doorlock.manage-cards')}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                        <Cog />
                        <span>{t('preferences.title')}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={async () => {
                          await authClient.signOut();
                        }}
                      >
                        <LogOut />
                        <span>{t('logout')}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
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
                  <LogIn className="h-4 w-4" /> {t('sign_in') || 'Sign in'}
                </Button>
              );
            })()}
          </div>
        </div>
      </nav>
      {data && showLinks && (
        <div
          className={cn(
            'grid border-border border-b bg-background/95 backdrop-blur transition-all duration-200 ease-in-out md:hidden',
            mobileMenuOpen
              ? 'grid-rows-[1fr] border-b'
              : 'grid-rows-[0fr] border-b-0'
          )}
          id="mobile-nav"
        >
          <div className="overflow-hidden">
            {mobileMenuOpen && (
              <div className="flex flex-col gap-1 px-4 py-3">
                {NAV_ITEMS.filter(
                  (item) => !item.adminOnly || canSeeAdminUi
                ).map((item) => (
                  <Button
                    className="justify-start gap-3"
                    key={item.to}
                    onClick={() => {
                      navigate({ to: item.to });
                      setMobileMenuOpen(false);
                    }}
                    variant="ghost"
                  >
                    <item.icon className="h-5 w-5" />
                    {t(item.labelKey)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <SettingsDialog onOpenChange={setSettingsOpen} open={settingsOpen} />
    </>
  );
}

function NavLinks({ userPermissions }: { userPermissions?: string[] }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const canSeeAdminUi = useHasPermission(ADMIN_UI_PERMISSIONS, userPermissions);

  return (
    <div className="ml-8 hidden items-center gap-6 md:flex">
      {NAV_ITEMS.filter((item) => !item.adminOnly || canSeeAdminUi).map(
        (item) => (
          <Button
            className="text-muted-foreground hover:text-foreground"
            key={item.to}
            onClick={() => navigate({ to: item.to })}
            size="sm"
            variant="ghost"
          >
            <item.icon />
            {t(item.labelKey)}
          </Button>
        )
      )}
    </div>
  );
}
