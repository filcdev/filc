import type { ClassroomType } from '@filcdev/api/domains/navigator/classroom-type';
import { Button } from '@filcdev/ui/components/button';
import { Card } from '@filcdev/ui/components/card';
import { type Dispatch, memo, type SetStateAction } from 'react';
import { useKioskTranslations } from '@/hooks/use-kiosk-translations';

type TypeHighlighterProps = {
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  types: ClassroomType[];
};

/** Toggling a classroom type dims every other room in the 3D view. */
export const TypeHighlighter = memo(function TypeHighlighterImpl({
  selectedIds,
  setSelectedIds,
  types,
}: TypeHighlighterProps) {
  const { t } = useKioskTranslations();

  const onClick = (type: ClassroomType) => {
    if (selectedIds.includes(type.id)) {
      setSelectedIds(selectedIds.filter((id) => id !== type.id));
      return;
    }

    setSelectedIds((previous) => [...previous, type.id]);
  };

  return (
    <Card className="min-h-0 shrink-0 gap-0 overflow-hidden bg-muted p-3">
      <h2 className="mb-2 font-semibold text-sm">
        {t('ui.highlighter.title')}
      </h2>

      <div className="flex flex-wrap gap-2 overflow-y-auto">
        {types.map((type) => {
          const active = selectedIds.includes(type.id);

          return (
            <Button
              key={type.id}
              onClick={() => onClick(type)}
              size="xs"
              type="button"
              variant={active ? 'default' : 'outline'}
            >
              <span
                className="mr-1 h-2 w-2 rounded-full"
                style={{ background: type.colorhex || '#888' }}
              />
              {t(type.name)}
            </Button>
          );
        })}
      </div>
    </Card>
  );
});
