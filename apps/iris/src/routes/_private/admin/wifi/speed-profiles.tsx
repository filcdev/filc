import { permissions } from '@filcdev/api/permissions';
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
import { PermissionGuard } from '@/components/util/permission-guard';
import {
  WifiRoleProfileDialog,
  WifiSpeedProfileDialog,
} from '@/components/wifi/wifi-dialogs';
import {
  useDeleteWifiRoleProfile,
  useDeleteWifiSpeedProfile,
  useWifiRoleProfiles,
  useWifiSpeedProfiles,
  type WifiRoleSpeedProfile,
  type WifiSpeedProfile,
} from '@/hooks/wifi-admin';
import { confirmDestructiveAction } from '@/utils/confirm';

/**
 * The controller ships a built-in `Default` group; it is not something an admin
 * edits, so it is hidden. Everything that keys off the visible list uses the
 * filtered array — checking the raw list would render an empty table with no
 * empty-state message.
 */
const HIDDEN_PROFILE_NAME = 'Default';

export const Route = createFileRoute('/_private/admin/wifi/speed-profiles')({
  component: () => (
    <PermissionGuard permission={permissions.wifiRead}>
      <WifiSpeedProfilesPage />
    </PermissionGuard>
  ),
});

function WifiSpeedProfilesPage() {
  const { t } = useTranslation();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);

  const [editingProfile, setEditingProfile] = useState<
    WifiSpeedProfile | undefined
  >();
  const [editingMapping, setEditingMapping] = useState<
    WifiRoleSpeedProfile | undefined
  >();

  const profilesQuery = useWifiSpeedProfiles();
  const mappingsQuery = useWifiRoleProfiles();

  const deleteProfile = useDeleteWifiSpeedProfile();
  const deleteMapping = useDeleteWifiRoleProfile();

  const profiles = profilesQuery.data?.speedProfiles ?? [];
  const mappings = mappingsQuery.data?.roleSpeedProfiles ?? [];
  const visibleProfiles = profiles.filter(
    (profile) => profile.name !== HIDDEN_PROFILE_NAME
  );

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
            {t('wifiAdminProfiles.speedProfilesSection')}
          </h2>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingProfile(undefined);
              setProfileDialogOpen(true);
            }}
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('wifiAdminProfiles.addProfile')}
            </span>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wifiAdminProfiles.name')}</TableHead>
                <TableHead>{t('wifiAdminProfiles.download')}</TableHead>
                <TableHead>{t('wifiAdminProfiles.upload')}</TableHead>
                <TableHead className="w-[100px] text-right">
                  {t('wifiAdminProfiles.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profilesQuery.isLoading && (
                <TableRow>
                  <TableCell className="h-24 text-center" colSpan={4}>
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              )}
              {!profilesQuery.isLoading && visibleProfiles.length === 0 && (
                <TableRow>
                  <TableCell
                    className="h-24 text-center text-muted-foreground"
                    colSpan={4}
                  >
                    {t('wifiAdminProfiles.noProfilesFound')}
                  </TableCell>
                </TableRow>
              )}
              {!profilesQuery.isLoading &&
                visibleProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.name}
                      {profile.isWlanDefault && (
                        <Badge className="ml-2" variant="outline">
                          {t('wifi.wlan_default')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {profile.downloadSpeedMbps === null ? (
                        <Badge variant="secondary">
                          {t('wifiAdminProfiles.unlimited')}
                        </Badge>
                      ) : (
                        profile.downloadSpeedMbps
                      )}
                    </TableCell>
                    <TableCell>
                      {profile.uploadSpeedMbps === null ? (
                        <Badge variant="secondary">
                          {t('wifiAdminProfiles.unlimited')}
                        </Badge>
                      ) : (
                        profile.uploadSpeedMbps
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => {
                            setEditingProfile(profile);
                            setProfileDialogOpen(true);
                          }}
                          size="icon"
                          variant="ghost"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          className="text-destructive"
                          onClick={() => {
                            if (
                              confirmDestructiveAction(
                                t('wifiAdminProfiles.deleteConfirmTitle')
                              )
                            ) {
                              deleteProfile.mutate({ id: profile.id });
                            }
                          }}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-xl tracking-tight">
            {t('wifiAdminProfiles.roleMappingsSection')}
          </h2>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingMapping(undefined);
              setMappingDialogOpen(true);
            }}
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('wifiAdminProfiles.addMapping')}
            </span>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wifiAdminProfiles.priority')}</TableHead>
                <TableHead>{t('wifiAdminProfiles.roleName')}</TableHead>
                <TableHead>{t('wifiAdminProfiles.speedProfile')}</TableHead>
                <TableHead>{t('wifiAdminProfiles.download')}</TableHead>
                <TableHead>{t('wifiAdminProfiles.upload')}</TableHead>
                <TableHead className="w-[100px] text-right">
                  {t('wifiAdminProfiles.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappingsQuery.isLoading && (
                <TableRow>
                  <TableCell className="h-24 text-center" colSpan={6}>
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              )}
              {!mappingsQuery.isLoading && mappings.length === 0 && (
                <TableRow>
                  <TableCell
                    className="h-24 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    {t('wifiAdminProfiles.noMappingsFound')}
                  </TableCell>
                </TableRow>
              )}
              {!mappingsQuery.isLoading &&
                mappings.map((mapping) => {
                  const profile = profiles.find(
                    (entry) => entry.id === mapping.speedProfileId
                  );

                  return (
                    <TableRow key={mapping.roleName}>
                      <TableCell className="font-medium text-muted-foreground">
                        {mapping.priority}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Badge>{mapping.roleName}</Badge>
                      </TableCell>
                      <TableCell>
                        {profile ? (
                          profile.name
                        ) : (
                          <span className="text-destructive">
                            {mapping.speedProfileId}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {profile?.downloadSpeedMbps === null ? (
                          <Badge variant="secondary">
                            {t('wifiAdminProfiles.unlimited')}
                          </Badge>
                        ) : (
                          (profile?.downloadSpeedMbps ?? '-')
                        )}
                      </TableCell>
                      <TableCell>
                        {profile?.uploadSpeedMbps === null ? (
                          <Badge variant="secondary">
                            {t('wifiAdminProfiles.unlimited')}
                          </Badge>
                        ) : (
                          (profile?.uploadSpeedMbps ?? '-')
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => {
                              setEditingMapping(mapping);
                              setMappingDialogOpen(true);
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            className="text-destructive"
                            onClick={() => {
                              if (
                                confirmDestructiveAction(
                                  t(
                                    'wifiAdminProfiles.deleteMappingConfirmTitle'
                                  )
                                )
                              ) {
                                deleteMapping.mutate({
                                  id: mapping.roleName,
                                });
                              }
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>

      <WifiSpeedProfileDialog
        onOpenChange={setProfileDialogOpen}
        open={profileDialogOpen}
        profile={editingProfile}
      />
      <WifiRoleProfileDialog
        mapping={editingMapping}
        onOpenChange={setMappingDialogOpen}
        open={mappingDialogOpen}
      />
    </div>
  );
}
