import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import { Alert, AlertDescription } from '@filcdev/ui/components/alert';
import { Button } from '@filcdev/ui/components/button';
import { Card } from '@filcdev/ui/components/card';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Label } from '@filcdev/ui/components/label';
import { useId, useMemo, useState } from 'react';
import { SearchableDropdown } from '@/components/searchable-dropdown';
import { useKioskTranslations } from '@/hooks/use-kiosk-translations';
import { searchClassrooms } from '@/utils/classroom-search';

type NavigatePanelProps = {
  barrierFree: boolean;
  endId: string;
  graph: FullGraph;
  /** Whether a "you are here" position is configured. */
  hasPos: boolean;
  needsStart: boolean;
  noRoute: boolean;
  onBack: () => void;
  onSelectStart: (id: string | null) => void;
  setBarrierFree: (value: boolean) => void;
  startId: string | null;
};

type DropdownItem = { id: string; name: string };

/** Synthetic dropdown entry standing for the configured location. */
const POSITION_ID = '-1';

/** Routing controls: pick a start (or the saved position), toggle barrier
 *  free, and see why no route is drawn. */
export function NavigatePanel({
  barrierFree,
  endId,
  graph,
  hasPos,
  needsStart,
  noRoute,
  onBack,
  onSelectStart,
  setBarrierFree,
  startId,
}: NavigatePanelProps) {
  const { resolve, t } = useKioskTranslations();
  const barrierFreeId = useId();
  const [query, setQuery] = useState('');

  const results = searchClassrooms(graph, query, t, resolve);

  // The synthetic "my position" item carries already-translated text; real
  // classroom items carry a human name that is translated at render.
  const dropdownItems = useMemo(() => {
    const items: DropdownItem[] = [];

    if (hasPos) {
      items.push({ id: POSITION_ID, name: t('ui.navigate.my_position') });
    }

    for (const classroom of results) {
      if (classroom.id !== endId) {
        items.push({ id: classroom.id, name: classroom.name });
      }
    }

    return items;
  }, [endId, hasPos, results, t]);

  const labelOf = (item: DropdownItem) =>
    item.id === POSITION_ID ? item.name : t(item.name);

  let dropdownText = t('ui.navigate.choose_room');
  if (hasPos) {
    dropdownText = t('ui.navigate.my_position');
  }
  if (startId) {
    const item = dropdownItems.find((entry) => entry.id === startId);
    dropdownText = item ? labelOf(item) : '';
  }

  const destination = graph.classrooms.find(
    (classroom) => classroom.id === endId
  );

  return (
    <Card className="gap-3 bg-muted p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('ui.navigate.title')}</h2>
        <Button onClick={onBack} size="xs" type="button" variant="ghost">
          {t('ui.navigate.back')}
        </Button>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: '#55ddff' }}
          />
          <div className="flex items-center space-x-2">
            <p>{t('ui.navigate.start')}</p>
            <SearchableDropdown
              getKey={(item) => item.id}
              getLabel={labelOf}
              items={dropdownItems}
              onSelect={(item) => {
                if (item.id === POSITION_ID) {
                  onSelectStart(null);
                  return;
                }

                onSelectStart(item.id);
              }}
              query={query}
              selectedKey={startId ?? POSITION_ID}
              setQuery={setQuery}
              triggerLabel={dropdownText}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: '#ff5577' }}
          />
          <span>
            {t('ui.navigate.destination')}{' '}
            <b>{destination ? t(destination.name) : ''}</b>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={barrierFree}
          className="size-5"
          id={barrierFreeId}
          onCheckedChange={(checked) => setBarrierFree(checked)}
        />
        <Label className="cursor-pointer" htmlFor={barrierFreeId}>
          {t('ui.navigate.barrier_free')}
        </Label>
      </div>

      {needsStart && (
        <Alert className="bg-secondary py-2 text-xs">
          <AlertDescription className="text-xs">
            {t('ui.navigate.needs_start')}
          </AlertDescription>
        </Alert>
      )}
      {noRoute && (
        <Alert className="py-2 text-warning text-xs">
          <AlertDescription className="text-warning text-xs">
            {t('ui.navigate.no_route')}
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
}
