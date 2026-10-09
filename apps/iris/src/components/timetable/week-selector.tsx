import {
  ToggleGroup,
  ToggleGroupItem,
} from '@filcdev/ui/components/toggle-group';
import { Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WeekFilter } from './helpers';

type WeekSelectorProps = {
  value: WeekFilter;
  onChange: (value: WeekFilter) => void;
  disabled?: boolean;
};

/**
 * Which week of the cycle to show.
 *
 * The same segmented track as the rest of the toolbar, with the A/B colours
 * kept as the active tone so the control matches the week badges in the grid.
 * On a phone it collapses to the A/B letters and an icon, which is what lets it
 * share a row with the timetable selector and the print button.
 *
 * The narrow/wide switch is CSS (`lg:`), not a media query in JS: the server
 * and the browser then render the same markup.
 */
export function WeekSelector({
  value,
  onChange,
  disabled = false,
}: WeekSelectorProps) {
  const { t } = useTranslation();

  const items: {
    label: string;
    tone: 'weekA' | 'weekB' | 'default';
    value: WeekFilter;
  }[] = [
    { label: t('timetable.weekA'), tone: 'weekA', value: 'A' },
    { label: t('timetable.weekB'), tone: 'weekB', value: 'B' },
    { label: t('timetable.weekAll'), tone: 'default', value: 'all' },
  ];

  return (
    <ToggleGroup
      aria-label={t('timetable.weekFilterLabel')}
      className="shrink-0"
      onValueChange={(next) => {
        const selected = next[0];
        if (selected) {
          onChange(selected as WeekFilter);
        }
      }}
      value={[value]}
    >
      {items.map((item) => (
        <ToggleGroupItem
          aria-label={item.label}
          className="px-2 lg:px-3"
          disabled={disabled}
          key={item.value}
          title={item.label}
          tone={item.tone}
          value={item.value}
        >
          {/* The letter is the mark for A/B in both layouts — the two icons
              would otherwise be identical. */}
          {item.value === 'all' ? (
            <>
              <Layers className="lg:hidden" />
              <span className="hidden lg:inline">{item.label}</span>
            </>
          ) : (
            <>
              <span className="font-semibold lg:hidden">{item.value}</span>
              <span className="hidden lg:inline">{item.label}</span>
            </>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
