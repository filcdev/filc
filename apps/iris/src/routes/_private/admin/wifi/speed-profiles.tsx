import type {
  WifiRoleSpeedProfile,
  WifiSpeedProfile,
} from '@filcdev/api/domains/wifi/admin';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Plus, RefreshCw, Trash } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  WifiRoleProfileDialog,
  WifiSpeedProfileDialog,
} from '@/components/wifi/wifi-dialogs';
import {
  useDeleteWifiRoleProfile,
  useDeleteWifiSpeedProfile,
  useWifiRoleProfiles,
  useWifiSpeedProfiles,
} from '@/hooks/wifi-admin';

export const Route = createFileRoute('/_private/admin/wifi/speed-profiles')({
  component: WifiSpeedProfilesPage,
});

function WifiSpeedProfilesPage() {
  const { t } = useTranslation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMappingOpen, setIsMappingOpen] = useState(false);

  const [editingProfile, setEditingProfile] = useState<
    WifiSpeedProfile | undefined
  >();
  const [editingMapping, setEditingMapping] = useState<
    WifiRoleSpeedProfile | undefined
  >();

  const profilesQuery = useWifiSpeedProfiles();
  const mappingsQuery = useWifiRoleProfiles();

  const deleteProfileMutation = useDeleteWifiSpeedProfile();
  const deleteMappingMutation = useDeleteWifiRoleProfile();

  const handleEditProfile = (profile: WifiSpeedProfile) => {
    setEditingProfile(profile);
    setIsProfileOpen(true);
  };

  const handleCreateProfile = () => {
    setEditingProfile(undefined);
    setIsProfileOpen(true);
  };

  const handleDeleteProfile = (profile: WifiSpeedProfile) => {
    if (
      // biome-ignore lint/suspicious/noAlert: Admin UI
      window.confirm(
        t('wifiAdminProfiles.deleteConfirmTitle', 'Delete Profile')
      )
    ) {
      deleteProfileMutation.mutate(profile.id);
    }
  };

  const handleEditMapping = (mapping: WifiRoleSpeedProfile) => {
    setEditingMapping(mapping);
    setIsMappingOpen(true);
  };

  const handleCreateMapping = () => {
    setEditingMapping(undefined);
    setIsMappingOpen(true);
  };

  const handleDeleteMapping = (mapping: WifiRoleSpeedProfile) => {
    if (
      // biome-ignore lint/suspicious/noAlert: Admin UI
      window.confirm(
        t('wifiAdminProfiles.deleteMappingConfirmTitle', 'Delete Mapping')
      )
    ) {
      deleteMappingMutation.mutate(mapping.roleName);
    }
  };

  const profiles = profilesQuery.data ?? [];
  const mappings = mappingsQuery.data ?? [];

  return (
    <div className="flex h-full flex-col gap-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('wifiAdminProfiles.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('wifiAdminProfiles.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={profilesQuery.isFetching || mappingsQuery.isFetching}
            onClick={() => {
              profilesQuery.refetch();
              mappingsQuery.refetch();
            }}
            size="icon"
            variant="outline"
          >
            <RefreshCw
              className={
                profilesQuery.isFetching || mappingsQuery.isFetching
                  ? 'h-4 w-4 animate-spin'
                  : 'h-4 w-4'
              }
            />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-xl tracking-tight">
            {t(
              'wifiAdminProfiles.speedProfilesSection',
              'UniFi Speed Profiles'
            )}
          </h2>
          <Button className="gap-2" onClick={handleCreateProfile} size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('wifiAdminProfiles.addProfile', 'Create Profile')}
            </span>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wifiAdminProfiles.name', 'Name')}</TableHead>
                <TableHead>
                  {t('wifiAdminProfiles.download', 'Download (Mbps)')}
                </TableHead>
                <TableHead>
                  {t('wifiAdminProfiles.upload', 'Upload (Mbps)')}
                </TableHead>
                <TableHead className="w-[100px] text-right">
                  {t('wifiAdminProfiles.actions', 'Actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                if (profilesQuery.isLoading) {
                  return (
                    <TableRow>
                      <TableCell className="h-24 text-center" colSpan={4}>
                        Loading...
                      </TableCell>
                    </TableRow>
                  );
                }
                if (profiles.length === 0) {
                  return (
                    <TableRow>
                      <TableCell
                        className="h-24 text-center text-muted-foreground"
                        colSpan={4}
                      >
                        {t(
                          'wifiAdminProfiles.noProfilesFound',
                          'No profiles found.'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }
                return profiles
                  .filter((p) => p.name !== 'Default')
                  .map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.name}
                        {p.isWlanDefault && (
                          <Badge className="ml-2" variant="outline">
                            {t('wifi.wlan_default', 'WLAN default')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.downloadSpeedMbps === null ? (
                          <Badge variant="secondary">
                            {t('wifiAdminProfiles.unlimited', 'Unlimited')}
                          </Badge>
                        ) : (
                          p.downloadSpeedMbps
                        )}
                      </TableCell>
                      <TableCell>
                        {p.uploadSpeedMbps === null ? (
                          <Badge variant="secondary">
                            {t('wifiAdminProfiles.unlimited', 'Unlimited')}
                          </Badge>
                        ) : (
                          p.uploadSpeedMbps
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => handleEditProfile(p)}
                            size="icon"
                            variant="ghost"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            className="text-destructive"
                            onClick={() => handleDeleteProfile(p)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ));
              })()}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-xl tracking-tight">
            {t('wifiAdminProfiles.roleMappingsSection', 'Role Mappings')}
          </h2>
          <Button className="gap-2" onClick={handleCreateMapping} size="sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('wifiAdminProfiles.addMapping', 'Add Role Mapping')}
            </span>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t('wifiAdminProfiles.priority', 'Priority')}
                </TableHead>
                <TableHead>{t('wifiAdminProfiles.roleName', 'Role')}</TableHead>
                <TableHead>
                  {t('wifiAdminProfiles.speedProfile', 'Profile')}
                </TableHead>
                <TableHead>
                  {t('wifiAdminProfiles.download', 'Download')}
                </TableHead>
                <TableHead>{t('wifiAdminProfiles.upload', 'Upload')}</TableHead>
                <TableHead className="w-[100px] text-right">
                  {t('wifiAdminProfiles.actions', 'Actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                if (mappingsQuery.isLoading) {
                  return (
                    <TableRow>
                      <TableCell className="h-24 text-center" colSpan={6}>
                        Loading...
                      </TableCell>
                    </TableRow>
                  );
                }
                if (mappings.length === 0) {
                  return (
                    <TableRow>
                      <TableCell
                        className="h-24 text-center text-muted-foreground"
                        colSpan={6}
                      >
                        {t(
                          'wifiAdminProfiles.noMappingsFound',
                          'No mappings found.'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }
                return mappings.map((m) => {
                  const profile = profiles.find(
                    (p) => p.id === m.speedProfileId
                  );
                  return (
                    <TableRow key={m.roleName}>
                      <TableCell className="font-medium text-muted-foreground">
                        {m.priority}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Badge>{m.roleName}</Badge>
                      </TableCell>
                      <TableCell>
                        {profile ? (
                          profile.name
                        ) : (
                          <span className="text-destructive">
                            {m.speedProfileId}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!profile && '-'}
                        {profile && profile.downloadSpeedMbps === null && (
                          <Badge variant="secondary">
                            {t('wifiAdminProfiles.unlimited', 'Unlimited')}
                          </Badge>
                        )}
                        {profile?.downloadSpeedMbps}
                      </TableCell>
                      <TableCell>
                        {!profile && '-'}
                        {profile && profile.uploadSpeedMbps === null && (
                          <Badge variant="secondary">
                            {t('wifiAdminProfiles.unlimited', 'Unlimited')}
                          </Badge>
                        )}
                        {profile?.uploadSpeedMbps}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => handleEditMapping(m)}
                            size="icon"
                            variant="ghost"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            className="text-destructive"
                            onClick={() => handleDeleteMapping(m)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </div>
      </div>

      {isProfileOpen && (
        <WifiSpeedProfileDialog
          onOpenChange={setIsProfileOpen}
          open={isProfileOpen}
          profile={editingProfile}
        />
      )}

      {isMappingOpen && (
        <WifiRoleProfileDialog
          mapping={editingMapping}
          onOpenChange={setIsMappingOpen}
          open={isMappingOpen}
        />
      )}
    </div>
  );
}
