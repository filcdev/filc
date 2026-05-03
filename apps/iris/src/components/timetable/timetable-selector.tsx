import { CalendarCheck, ChevronsUpDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { TimetableItem } from './types';

type TimetableStatus = 'current' | 'past' | 'upcoming';

function getTimetableStatus(item: TimetableItem): TimetableStatus {
  const today = new Date().toISOString().slice(0, 10);
  const from = item.validFrom ?? null;
  const to = item.validTo ?? null;

  if (from && from > today) {
    return 'upcoming';
  }
  if (to && to < today) {
    return 'past';
  }
  return 'current';
}

const statusBadgeVariant: Record<
  TimetableStatus,
  'default' | 'secondary' | 'outline'
> = {
  current: 'default',
  past: 'secondary',
  upcoming: 'outline',
};

export function TimetableSelector({
  timetables,
  selectedId,
  onSelect,
  loading,
}: {
  timetables?: TimetableItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();

  if (loading || !timetables) {
    return <Skeleton className="h-9 w-44" />;
  }

  const selected = timetables.find((item) => item.id === selectedId);
  const selectedLabel = selected?.name ?? t('timetable.selectTimetable');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="h-9 w-44 justify-between"
            size="sm"
            variant="outline"
          >
            <span className="flex items-center gap-1.5 truncate">
              <CalendarCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronsUpDownIcon className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        {timetables.map((item) => {
          const status = getTimetableStatus(item);
          return (
            <DropdownMenuItem key={item.id} onClick={() => onSelect(item.id)}>
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <Badge variant={statusBadgeVariant[status]}>
                  {t(`timetable.status.${status}`)}
                </Badge>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
