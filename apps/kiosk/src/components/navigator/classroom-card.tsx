import type { Classroom } from '@filcdev/api/domains/navigator/classroom';
import { Button } from '@filcdev/ui/components/button';
import { Card } from '@filcdev/ui/components/card';
import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import type { ClassroomInfo, Translator } from '@/utils/classroom-search';

type ClassroomCardProps = {
  classroom: Classroom;
  info: ClassroomInfo;
  itemRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  onNavigate: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  t: Translator;
};

/** One search result: name, type, location and a clamped description that can
 *  be expanded. Tapping the name selects the room; the Navigate button (shown
 *  once selected) starts routing to it. */
export function ClassroomCard({
  classroom,
  info,
  itemRefs,
  onNavigate,
  onSelect,
  selectedId,
  t,
}: ClassroomCardProps) {
  const [expanded, setExpanded] = useState(false);

  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!(element && info.classroom.description)) {
      return;
    }

    const check = () => {
      setIsOverflowing(element.scrollHeight > element.clientHeight);
    };

    check();

    const observer = new ResizeObserver(check);
    observer.observe(element);

    return () => observer.disconnect();
  }, [info.classroom.description]);

  const selected = classroom.id === selectedId;

  return (
    <Card className={`gap-1 p-3 ${selected ? 'bg-primary/50' : 'bg-muted'}`}>
      <div className="flex items-start justify-between gap-2">
        <button
          className="flex-1 text-left"
          onClick={() => onSelect(classroom.id)}
          ref={(element) => {
            itemRefs.current[classroom.id] = element;
          }}
          type="button"
        >
          <h2 className="font-bold text-lg">{t(classroom.name)}</h2>

          <div className="flex items-center gap-1 text-sm opacity-80">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: info.typeColor }}
            />
            {info.typeName}
          </div>
        </button>

        {selected && (
          <Button
            onClick={() => onNavigate(classroom.id)}
            size="sm"
            type="button"
          >
            {t('ui.card.navigate')}
          </Button>
        )}
      </div>

      <div className="mt-1 text-sm">
        <div className="flex items-center space-x-2">
          <svg
            aria-hidden={true}
            fill="currentColor"
            height="16"
            viewBox="0 0 16 16"
            width="16"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A32 32 0 0 1 8 14.58a32 32 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10" />
            <path d="M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4m0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
          </svg>

          <p>
            {info.buildingName} - {info.floorLabel}
          </p>
        </div>

        {classroom.description && (
          <p
            className={`opacity-80 ${expanded ? '' : 'line-clamp-2'}`}
            ref={textRef}
          >
            {t(classroom.description)}
          </p>
        )}
      </div>

      {classroom.description && (isOverflowing || expanded) && (
        <div className="mt-1 flex">
          <Button
            onClick={() => setExpanded((previous) => !previous)}
            size="xs"
            type="button"
            variant="ghost"
          >
            {expanded ? t('ui.common.less') : t('ui.common.more')}
          </Button>
        </div>
      )}
    </Card>
  );
}
