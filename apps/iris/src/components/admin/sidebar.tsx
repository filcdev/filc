import { Link } from '@tanstack/react-router';
import {
  Calendar,
  DoorOpen,
  GraduationCap,
  IdCard,
  List,
  Microchip,
  Shield,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
} from '@/components/ui/sidebar';
import { authClient } from '@/utils/authentication';

type MenuIcon = typeof Calendar;

type MenuItem = {
  title: string;
  url: string;
  icon: MenuIcon;
  permission?: string;
};

type MenuCategory = {
  label: string;
  items: MenuItem[];
};

export function AdminSidebar() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();

  const categories: MenuCategory[] = useMemo(
    () => [
      {
        items: [
          {
            icon: Calendar,
            permission: 'import:timetable',
            title: t('timetable.import'),
            url: '/admin/timetable/import',
          },
        ],
        label: t('admin.timetable'),
      },
      {
        items: [
          {
            icon: DoorOpen,
            permission: 'doorlock:stats:read',
            title: t('doorlock.dashboard'),
            url: '/admin/doorlock',
          },
          {
            icon: Microchip,
            permission: 'doorlock:devices:read',
            title: t('doorlock.devices'),
            url: '/admin/doorlock/devices',
          },
          {
            icon: IdCard,
            permission: 'doorlock:cards:read',
            title: t('doorlock.cards'),
            url: '/admin/doorlock/cards',
          },
          {
            icon: List,
            permission: 'doorlock:logs:read',
            title: t('doorlock.logs'),
            url: '/admin/doorlock/logs',
          },
        ],
        label: t('admin.doorlock'),
      },
      {
        items: [
          {
            icon: Users,
            permission: 'users:read',
            title: t('admin.users'),
            url: '/admin/users',
          },
          {
            icon: Shield,
            permission: 'roles:read',
            title: t('admin.roles'),
            url: '/admin/roles',
          },
        ],
        label: t('admin.management'),
      },
    ],
    [t]
  );

  const visibleCategories = useMemo(
    () =>
      categories
        .map((category) => {
          const visibleItems = category.items.filter((item) => {
            if (session?.user?.permissions.includes('*')) {
              return true;
            }
            if (!item.permission) {
              return true;
            }
            return session?.user?.permissions?.includes(item.permission);
          });
          return { ...category, items: visibleItems };
        })
        .filter((category) => category.items.length > 0),
    [categories, session?.user?.permissions]
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
        {visibleCategories.map((category) => (
          <SidebarGroup key={category.label}>
            <SidebarGroupLabel>{category.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {category.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      render={
                        <Link to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-border border-t p-4">
        <div className="text-muted-foreground text-sm">
          {session?.user?.name}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
