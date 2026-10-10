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

export function WifiFilters({ filters, onChange }: WifiFiltersProps) {
  const profilesQuery = useWifiSpeedProfiles();
  const profiles = profilesQuery.data ?? [];
  const { t } = useTranslation();
  const minDevicesId = useId();

  const handleToggle = (key: keyof WifiFilterState) => {
    onChange({
      ...filters,
      [key]: !filters[key],
    });
  };

  const handleMinDevicesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number.parseInt(e.target.value, 10);
    onChange({
      ...filters,
      minDevices: Number.isNaN(val) ? 0 : val,
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'minDevices') {
      return (val as number) > 0;
    }
    return val === true;
  }).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className="h-9 gap-2" size="sm" variant="outline">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('wifiAdminUsers.filters', 'Filters')}
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
          <DropdownMenuLabel>
            {t('wifiAdminUsers.filters', 'Filters')}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={filters.bannedOnly}
          onCheckedChange={() => handleToggle('bannedOnly')}
        >
          {t('wifiAdminUsers.filterBanned', 'Banned only')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={filters.inactiveOnly}
          onCheckedChange={() => {
            onChange({
              ...filters,
              activeOnly: false, // Mutually exclusive
              inactiveOnly: !filters.inactiveOnly,
            });
          }}
        >
          {t('wifiAdminUsers.filterInactive', 'Inactive (>45 days)')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={filters.activeOnly}
          onCheckedChange={() => {
            onChange({
              ...filters,
              activeOnly: !filters.activeOnly,
              inactiveOnly: false, // Mutually exclusive
            });
          }}
        >
          {t('wifiAdminUsers.filterActive', 'Active (<45 days)')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={filters.sharedMacsOnly}
          onCheckedChange={() => handleToggle('sharedMacsOnly')}
        >
          {t('wifiAdminUsers.filterMultipleMacs', 'Shared MACs')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={filters.manualOnly}
          onCheckedChange={() => handleToggle('manualOnly')}
        >
          {t('wifiAdminUsers.filterManual', 'Manually created users')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <div className="p-2">
          <label
            className="mb-1 block font-medium text-muted-foreground text-xs"
            htmlFor={minDevicesId}
          >
            {t('wifiAdminUsers.minDevices', 'Min devices')}
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
            {t('wifiAdminUsers.speedProfile', 'Speed Profile')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                onValueChange={(v) =>
                  onChange({
                    ...filters,
                    speedProfileId: v === 'all' ? null : v,
                  })
                }
                value={filters.speedProfileId ?? 'all'}
              >
                <DropdownMenuRadioItem value="all">
                  {t('wifiAdminProfiles.all', 'All Profiles')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none">
                  {t('wifiAdminProfiles.none', 'None (Default)')}
                </DropdownMenuRadioItem>
                {profiles.map((p) => (
                  <DropdownMenuRadioItem key={p.id} value={p.id}>
                    {p.name}
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
