import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';
import type { WeekFilter } from './helpers';

type WeekSelectorProps = {
  value: WeekFilter;
  onChange: (value: WeekFilter) => void;
  disabled?: boolean;
};

export function WeekSelector({
  value,
  onChange,
  disabled = false,
}: WeekSelectorProps) {
  const { t } = useTranslation();

  const items: Array<{
    value: WeekFilter;
    label: string;
  }> = [
    {
      label: t('timetable.weekA'),
      value: 'A',
    },
    {
      label: t('timetable.weekB'),
      value: 'B',
    },
    {
      label: t('timetable.weekAll'),
      value: 'all',
    },
  ];

  return (
    <div className="grid h-9 w-full grid-cols-3 items-center rounded-lg border border-border bg-muted/40 p-0.5 shadow-sm sm:inline-flex sm:w-auto">
      {items.map((item) => {
        const active = value === item.value;

        return (
          <Button
            className={cn(
              'h-7 w-full rounded-md px-2 font-semibold text-xs transition-all sm:w-auto sm:px-3',
              !active && 'text-muted-foreground',
              active &&
                item.value === 'A' &&
                'bg-blue-500 text-white shadow-sm hover:bg-blue-500/90 hover:text-white',
              active &&
                item.value === 'B' &&
                'bg-violet-500 text-white shadow-sm hover:bg-violet-500/90 hover:text-white',
              active &&
                item.value === 'all' &&
                'bg-background text-foreground shadow-sm hover:bg-background'
            )}
            disabled={disabled}
            key={item.value}
            onClick={() => onChange(item.value)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}
