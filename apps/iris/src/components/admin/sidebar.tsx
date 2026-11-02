import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@filcdev/ui/components/sidebar';
import { cn } from '@filcdev/ui/lib/utils';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowRightLeft,
  ArrowUpDown,
  Bell,
  Bug,
  Building2,
  ChevronDown,
  DoorOpen,
  Eye,
  FlaskConical,
  GraduationCap,
  IdCard,
  KeyRound,
  Languages,
  Layers,
  LayoutDashboard,
  List,
  Microchip,
  MonitorSmartphone,
  Palette,
  RefreshCw,
  Route,
  ScrollText,
  Shield,
  Sparkles,
  UserRound,
  Users,
  Wifi,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasPermission } from '@/hooks/use-has-permission';
import { useWifiStatus } from '@/hooks/wifi';

type MenuIcon = typeof List;

type MenuItem = {
  title: string;
  url: string;
  icon: MenuIcon;
  permission?: string;
};

type MenuCategory = {
  id: string;
  label: string;
  items: MenuItem[];
};

/**
 * The sidebar menu tree: the static sections plus the two that depend on the
 * environment — wifi, hidden while the subsystem is off, and the dev tools.
 * It lives in a hook because the tree is data, not markup, and it keeps the
 * sidebar's own body down to how a category renders.
 */
function useAdminMenuCategories(): MenuCategory[] {
  const { t } = useTranslation();
  const wifiStatus = useWifiStatus();
  const wifiEnabled = wifiStatus.data?.enabled === true;

  return useMemo(
    () => [
      {
        id: 'overview',
        items: [
          {
            icon: LayoutDashboard,
            title: t('dashboard.title'),
            url: '/admin',
          },
        ],
        label: t('dashboard.overview'),
      },
      {
        id: 'timetable',
        items: [
          {
            icon: List,
            permission: permissions.importTimetable,
            title: t('timetable.manage'),
            url: '/admin/timetable/manage',
          },
          {
            icon: RefreshCw,
            permission: permissions.substitutionCreate,
            title: t('substitution.title'),
            url: '/admin/timetable/substitutions',
          },
          {
            icon: ArrowRightLeft,
            permission: permissions.movedLessonCreate,
            title: t('movedLesson.title'),
            url: '/admin/timetable/moved-lessons',
          },
          {
            icon: UserRound,
            permission: permissions.teacherManage,
            title: t('teachers.title'),
            url: '/admin/timetable/teachers',
          },
        ],
        label: t('admin.timetable'),
      },
      {
        id: 'communications',
        items: [
          {
            icon: Bell,
            permission: permissions.announcementsCreate,
            title: t('announcements.title'),
            url: '/admin/news/announcements',
          },
          {
            icon: Bell,
            permission: permissions.systemMessagesManage,
            title: t('systemMessages.title'),
            url: '/admin/news/system-messages',
          },
        ],
        label: t('admin.communications'),
      },
      {
        id: 'doorlock',
        items: [
          {
            icon: DoorOpen,
            permission: permissions.doorlockStatsRead,
            title: t('doorlock.dashboard'),
            url: '/admin/doorlock',
          },
          {
            icon: Microchip,
            permission: permissions.doorlockDevicesRead,
            title: t('doorlock.devices'),
            url: '/admin/doorlock/devices',
          },
          {
            icon: IdCard,
            permission: permissions.doorlockCardsRead,
            title: t('doorlock.cards'),
            url: '/admin/doorlock/cards',
          },
          {
            icon: List,
            permission: permissions.doorlockLogsRead,
            title: t('doorlock.logs'),
            url: '/admin/doorlock/logs',
          },
        ],
        label: t('admin.doorlock'),
      },
      {
        id: 'management',
        items: [
          {
            icon: Users,
            permission: permissions.usersRead,
            title: t('admin.users'),
            url: '/admin/users',
          },
          {
            icon: Shield,
            permission: permissions.rolesRead,
            title: t('admin.roles'),
            url: '/admin/roles',
          },
          {
            icon: KeyRound,
            permission: permissions.usersManage,
            title: t('admin.apiKeys'),
            url: '/admin/api-keys',
          },
          {
            icon: Bug,
            permission: permissions.bugReportsRead,
            title: t('admin.bugReports'),
            url: '/admin/bug-reports',
          },
          {
            icon: ScrollText,
            permission: permissions.activityLogRead,
            title: t('admin.activityLog'),
            url: '/admin/activity-log',
          },
        ],
        label: t('admin.management'),
      },
      {
        id: 'appearance',
        items: [
          {
            icon: Sparkles,
            permission: permissions.rolesManage,
            title: t('siteTheme.title'),
            url: '/admin/theme',
          },
        ],
        label: t('admin.appearance'),
      },
      {
        id: 'navigator',
        items: [
          {
            icon: LayoutDashboard,
            permission: permissions.navigatorManage,
            title: t('navigator.overview.title'),
            url: '/admin/navigator',
          },
          {
            icon: Building2,
            permission: permissions.navigatorManage,
            title: t('navigator.buildings.title'),
            url: '/admin/navigator/buildings',
          },
          {
            icon: Palette,
            permission: permissions.navigatorManage,
            title: t('navigator.classroomTypes.title'),
            url: '/admin/navigator/classroom-types',
          },
          {
            icon: DoorOpen,
            permission: permissions.navigatorManage,
            title: t('navigator.classrooms.title'),
            url: '/admin/navigator/classrooms',
          },
          {
            icon: Route,
            permission: permissions.navigatorManage,
            title: t('navigator.corridors.title'),
            url: '/admin/navigator/corridors',
          },
          {
            icon: ArrowUpDown,
            permission: permissions.navigatorManage,
            title: t('navigator.lifts.title'),
            url: '/admin/navigator/lifts',
          },
          {
            icon: Layers,
            permission: permissions.navigatorManage,
            title: t('navigator.stairs.title'),
            url: '/admin/navigator/stairs',
          },
          {
            icon: Languages,
            permission: permissions.navigatorManage,
            title: t('navigator.translations.title'),
            url: '/admin/navigator/translations',
          },
          {
            icon: Eye,
            permission: permissions.navigatorManage,
            title: t('navigator.preview.title'),
            url: '/admin/navigator/preview',
          },
        ],
        label: t('admin.navigator'),
      },
      {
        id: 'kiosks',
        items: [
          {
            icon: MonitorSmartphone,
            permission: permissions.kiosksManage,
            title: t('kiosk.title'),
            url: '/admin/kiosks',
          },
        ],
        label: t('admin.kiosks'),
      },
      ...(wifiEnabled
        ? [
            {
              id: 'wifi',
              items: [
                {
                  icon: Wifi,
                  permission: permissions.wifiRead,
                  title: t('wifiAdminDashboard.title'),
                  url: '/admin/wifi',
                },
                {
                  icon: Users,
                  permission: permissions.wifiRead,
                  title: t('wifiAdminUsers.title'),
                  url: '/admin/wifi/users',
                },
                {
                  icon: MonitorSmartphone,
                  permission: permissions.wifiRead,
                  title: t('wifiAdminNas.title'),
                  url: '/admin/wifi/nas',
                },
                {
                  icon: ArrowUpDown,
                  permission: permissions.wifiRead,
                  title: t('wifiAdminProfiles.title'),
                  url: '/admin/wifi/speed-profiles',
                },
              ],
              label: t('admin.wifi'),
            },
          ]
        : []),
      ...(import.meta.env.MODE === 'development'
        ? [
            {
              id: 'developer',
              items: [
                {
                  icon: FlaskConical,
                  permission: permissions.announcementsCreate,
                  title: t('devNotifications.title'),
                  url: '/admin/dev/notifications',
                },
              ],
              label: t('admin.developer'),
            },
          ]
        : []),
    ],
    [t, wifiEnabled]
  );
}

const CLOSED_SECTIONS_KEY = 'filc.admin-sidebar.closed';

function readClosedSections(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    const stored = window.localStorage.getItem(CLOSED_SECTIONS_KEY);
    if (!stored) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(stored);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : []
    );
  } catch {
    return new Set();
  }
}

export function AdminSidebar() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const userPermissions = session?.user?.permissions;
  const categories = useAdminMenuCategories();
  const [closedSections, setClosedSections] =
    useState<Set<string>>(readClosedSections);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      CLOSED_SECTIONS_KEY,
      JSON.stringify([...closedSections])
    );
  }, [closedSections]);

  const toggleSection = (id: string) => {
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleNavigate = (url: string) => {
    navigate({ to: url });
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const visibleCategories = useMemo(
    () =>
      categories
        .map((category) => {
          const visibleItems = category.items.filter(
            (item) =>
              !item.permission ||
              hasPermission(item.permission, userPermissions)
          );
          return { ...category, items: visibleItems };
        })
        .filter((category) => category.items.length > 0),
    [categories, userPermissions]
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-border border-b p-4">
        <Link className="flex items-center gap-3" to="/">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-xl">filc</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {visibleCategories.map((category) => {
          const isClosed = closedSections.has(category.id);
          const isOpen = !isClosed;
          const contentId = `admin-sidebar-${category.id}`;
          return (
            <SidebarGroup key={category.id}>
              <SidebarGroupLabel
                render={
                  <button
                    aria-controls={contentId}
                    aria-expanded={isOpen}
                    className="w-full cursor-pointer justify-between text-left hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    onClick={() => toggleSection(category.id)}
                    type="button"
                  >
                    <span>{category.label}</span>
                    <ChevronDown
                      className={cn(
                        'transition-transform duration-200',
                        isClosed && '-rotate-90'
                      )}
                    />
                  </button>
                }
              />
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
              >
                <div
                  aria-hidden={!isOpen}
                  className="overflow-hidden"
                  inert={!isOpen}
                >
                  <SidebarGroupContent id={contentId}>
                    <SidebarMenu>
                      {category.items.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton
                            className="flex items-center gap-2"
                            onClick={() => handleNavigate(item.url)}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </div>
              </div>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-border border-t p-4">
        <div className="text-muted-foreground text-sm">
          {session?.user?.name}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
