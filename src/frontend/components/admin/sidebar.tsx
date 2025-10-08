import { Link } from '@tanstack/react-router';
import { CreditCard, DoorOpen, Flag, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaGraduationCap } from 'react-icons/fa6';
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
  icon: typeof DoorOpen;
  permission?: string;
};

export function AdminSidebar() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();

  const items: MenuItem[] = useMemo(
    () => [
      {
        title: t('admin.doorAccess'),
        url: '/admin/doors',
        icon: DoorOpen,
      },
      {
        title: t('doorlock.manageDevices'),
        url: '/admin/doors/devices',
        icon: Settings,
        permission: 'device:upsert',
      },
      {
        title: t('doorlock.manageCards'),
        url: '/admin/doors/cards',
        icon: CreditCard,
        permission: 'card:read',
      },
      {
        title: t('featureFlags.manage'),
        url: '/admin/feature-flags',
        icon: Flag,
        permission: 'feature-flags:read',
      },
    ],
    [t]
  );

  const visibleItems = useMemo(() => {
    if (session?.user?.permissions.includes('*')) {
      return items;
    }
    if (!session?.user?.permissions) {
      return items.filter((item) => !item.permission);
    }
    return items.filter((item) => {
      if (!item.permission) {
        return true;
      }
      return session.user.permissions.includes(item.permission);
    });
  }, [items, session?.user?.permissions]);

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
        <SidebarGroup>
          <SidebarGroupLabel>{t('admin.title')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
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
      </SidebarContent>
      <SidebarFooter className="border-border border-t p-4">
        <div className="text-muted-foreground text-sm">
          {session?.user?.name}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
