import { Button } from '@filcdev/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@filcdev/ui/components/dropdown-menu';
import { Input } from '@filcdev/ui/components/input';
import { Filter } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useWifiSpeedProfiles } from '@/hooks/wifi-admin';

export type WifiFilterState = {
  speedProfileId: string | null;
  bannedOnly: boolean;
  inactiveOnly: boolean;
  activeOnly: boolean;
  sharedMacsOnly: boolean;
  manualOnly: boolean;
  minDevices: number;
};

export const defaultWifiFilterState: WifiFilterState = {
  activeOnly: false,
  bannedOnly: false,
  inactiveOnly: false,
  manualOnly: false,
  minDevices: 0,
  sharedMacsOnly: false,
  speedProfileId: null,
};

type WifiFiltersProps = {
  filters: WifiFilterState;
  onChange: (filters: WifiFilterState) => void;
};

/** A filter counts as active when it would actually narrow the list. */
const isActiveFilter = ([key, value]: [string, unknown]): boolean => {
  if (key === 'minDevices') {
    return (value as number) > 0;
  }
  if (key === 'speedProfileId') {
    return value !== null;
  }
  return value === true;
};

export function WifiFilters({ filters, onChange }: WifiFiltersProps) {
  const { t } = useTranslation();
  const minDevicesId = useId();
  const profilesQuery = useWifiSpeedProfiles();
  const profiles = profilesQuery.data?.speedProfiles ?? [];

  const handleToggle = (key: keyof WifiFilterState) => {
    onChange({ ...filters, [key]: !filters[key] });
  };

  const handleMinDevicesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(event.target.value, 10);
    onChange({ ...filters, minDevices: Number.isNaN(value) ? 0 : value });
  };

  const activeFiltersCount =
    Object.entries(filters).filter(isActiveFilter).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className="h-9 gap-2" size="sm" variant="outline">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('wifiAdminUsers.filters')}
            </span>
            {activeFiltersCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('wifiAdminUsers.filters')}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={filters.bannedOnly}
          onCheckedChange={() => handleToggle('bannedOnly')}
        >
          {t('wifiAdminUsers.filterBanned')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={filters.inactiveOnly}
          onCheckedChange={() =>
            onChange({
              ...filters,
              activeOnly: false, // Mutually exclusive
              inactiveOnly: !filters.inactiveOnly,
            })
          }
        >
          {t('wifiAdminUsers.filterInactive')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={filters.activeOnly}
          onCheckedChange={() =>
            onChange({
              ...filters,
              activeOnly: !filters.activeOnly,
              inactiveOnly: false, // Mutually exclusive
            })
          }
        >
          {t('wifiAdminUsers.filterActive')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={filters.sharedMacsOnly}
          onCheckedChange={() => handleToggle('sharedMacsOnly')}
        >
          {t('wifiAdminUsers.filterMultipleMacs')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={filters.manualOnly}
          onCheckedChange={() => handleToggle('manualOnly')}
        >
          {t('wifiAdminUsers.filterManual')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <div className="p-2">
          <label
            className="mb-1 block font-medium text-muted-foreground text-xs"
            htmlFor={minDevicesId}
          >
            {t('wifiAdminUsers.minDevices')}
          </label>
          <Input
            className="h-8"
            id={minDevicesId}
            min={0}
            onChange={handleMinDevicesChange}
            placeholder="0"
            type="number"
            value={filters.minDevices || ''}
          />
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t('wifiAdminUsers.speedProfile')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                onValueChange={(value) =>
                  onChange({
                    ...filters,
                    speedProfileId: value === 'all' ? null : value,
                  })
                }
                value={filters.speedProfileId ?? 'all'}
              >
                <DropdownMenuRadioItem value="all">
                  {t('wifiAdminProfiles.all')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none">
                  {t('wifiAdminProfiles.none')}
                </DropdownMenuRadioItem>
                {profiles.map((profile) => (
                  <DropdownMenuRadioItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
