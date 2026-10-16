import { Button } from '@filcdev/ui/components/button';
import { Pencil, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type WifiRowActionsProps = {
  /** Runs after the delete was confirmed; the caller owns the confirmation. */
  onDelete: () => void;
  onEdit: () => void;
};

/** The edit and delete icon buttons of a wifi admin table row. */
export function WifiRowActions({ onDelete, onEdit }: WifiRowActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end gap-2">
      <Button
        aria-label={t('common.edit')}
        onClick={onEdit}
        size="icon"
        variant="ghost"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        aria-label={t('common.delete')}
        className="text-destructive"
        onClick={onDelete}
        size="icon"
        variant="ghost"
      >
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  );
}
