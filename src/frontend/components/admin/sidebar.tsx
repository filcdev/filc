import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaCreditCard,
  FaDoorOpen,
  FaFlag,
  FaGear,
  FaGraduationCap,
  FaListCheck,
} from 'react-icons/fa6';
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
} from '~/frontend/components/ui/sidebar';
import { authClient } from '~/frontend/utils/authentication';

type MenuItem = {
  title: string;
  url: string;
  icon: typeof FaDoorOpen;
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
        label: t('admin.door'),
        items: [
          {
            title: t('admin.doorAccess'),
            url: '/admin/doors',
            icon: FaDoorOpen,
          },
          {
            title: t('doorlock.manageDevices'),
            url: '/admin/doors/devices',
            icon: FaGear,
            permission: 'device:upsert',
          },
          {
            title: t('doorlock.manageCards'),
            url: '/admin/doors/cards',
            icon: FaCreditCard,
            permission: 'card:read',
          },
          {
            title: t('doorlock.accessLogs'),
            url: '/admin/doors/logs',
            icon: FaListCheck,
            permission: 'doorlock:logs:read',
          },
        ],
      },
      {
        label: t('admin.server'),
        items: [
          {
            title: t('featureFlags.manage'),
            url: '/admin/feature-flags',
            icon: FaFlag,
            permission: 'feature-flags:read',
          },
        ],
      },
    ],
    [t]
  );

  const visibleCategories = useMemo(() => {
    return categories
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
      .filter((category) => category.items.length > 0);
  }, [categories, session?.user?.permissions]);

  return (
    <Sidebar>
      <SidebarHeader className="border-border border-b p-4">
        <Link className="flex items-center gap-3" to="/">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <FaGraduationCap className="h-5 w-5 text-primary-foreground" />
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
                    <SidebarMenuButton asChild>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
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
