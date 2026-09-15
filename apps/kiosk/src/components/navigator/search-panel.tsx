import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import { Card } from '@filcdev/ui/components/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@filcdev/ui/components/input-group';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ClassroomCard } from '@/components/navigator/classroom-card';
import { useKioskTranslations } from '@/hooks/use-kiosk-translations';
import { classroomInfo, searchClassrooms } from '@/utils/classroom-search';

type SearchPanelProps = {
  graph: FullGraph;
  onNavigate: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  /** Classroom type ids the highlighter is filtering to. */
  selectedTypeIds: string[];
};

/** Classroom search: type a name (or a type) and pick the room. The kiosk's
 *  idle reset remounts this panel (via its React key), which clears the query. */
export const SearchPanel = memo(function SearchPanelImpl({
  graph,
  onNavigate,
  onSelect,
  selectedId,
  selectedTypeIds,
}: SearchPanelProps) {
  const { t } = useKioskTranslations();

  const [query, setQuery] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      itemRefs.current[selectedId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  const results = useMemo(() => {
    const found = searchClassrooms(graph, query, t);

    if (selectedTypeIds.length === 0) {
      return found;
    }

    return found.filter((classroom) =>
      selectedTypeIds.includes(classroom.type_id)
    );
  }, [graph, query, selectedTypeIds, t]);

  return (
    <Card className="min-h-0 flex-1 flex-col gap-2 p-3">
      <InputGroup>
        <InputGroupAddon>
          <svg
            aria-hidden={true}
            fill="currentColor"
            height="16"
            viewBox="0 0 16 16"
            width="16"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
          </svg>
        </InputGroupAddon>

        <InputGroupInput
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('ui.search.placeholder')}
          ref={inputRef}
          type="text"
          value={query}
        />

        {query && (
          <InputGroupButton
            className="mr-1.5"
            onClick={() => setQuery('')}
            type="button"
          >
            ✕
          </InputGroupButton>
        )}
      </InputGroup>

      <div className="mt-2 min-h-0 flex-1 space-y-4 overflow-y-auto">
        {results.map((classroom) => (
          <ClassroomCard
            classroom={classroom}
            info={classroomInfo(graph, classroom, t)}
            itemRefs={itemRefs}
            key={classroom.id}
            onNavigate={onNavigate}
            onSelect={onSelect}
            selectedId={selectedId}
            t={t}
          />
        ))}
      </div>
    </Card>
  );
});
