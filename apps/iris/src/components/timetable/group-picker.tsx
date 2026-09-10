import { useTranslation } from 'react-i18next';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GroupItem } from '@/hooks/timetable-groups';
import { useSelectGroup } from '@/hooks/timetable-groups';

type DivisionGroupPickerProps = {
  /** The groups of the user's cohort, with the selection flags already set. */
  groups: GroupItem[];
};

/**
 * A per-division "pick your group" control for one cohort. Renders one
 * selector per division the cohort is split into, offering that division's
 * alternative groups. Choosing one persists the user's membership (one group
 * per division) and re-scopes their timetable to that group.
 */
export function DivisionGroupPicker({ groups }: DivisionGroupPickerProps) {
  const { t } = useTranslation();
  const selectGroup = useSelectGroup();

  const divisions = Array.from(
    new Set(
      groups
        .map((group) => group.divisionTag)
        .filter((tag): tag is string => Boolean(tag))
    )
  );

  if (divisions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {divisions.map((division) => {
        const options = groups.filter(
          (group) => group.divisionTag === division && !group.entireClass
        );
        const current = groups.find(
          (group) => group.divisionTag === division && group.selected
        );
        const label =
          options.find((group) => group.divisionLabel)?.divisionLabel ??
          division;
        const items = [
          { label: t('timetable.selectGroupPlaceholder'), value: '' },
          ...options.map((group) => ({ label: group.name, value: group.id })),
        ];
        return (
          <div
            className="flex items-center justify-between gap-2"
            key={division}
          >
            <span className="font-medium text-sm">{label}</span>
            <Select
              items={items}
              onValueChange={(value) => {
                if (value) {
                  selectGroup.mutate({ groupId: value });
                }
              }}
              value={current?.id ?? ''}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
