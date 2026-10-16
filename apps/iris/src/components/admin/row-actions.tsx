import { Button } from '@filcdev/ui/components/button';
import { Pen, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type RowActionsProps = {
  /** Accessible name of the delete action; defaults to the generic copy. */
  deleteLabel?: string;
  /** Accessible name of the edit action; defaults to the generic copy. */
  editLabel?: string;
  /** Disables the delete action while the row's deletion is in flight. */
  isDeleting?: boolean;
  onDelete: () => void;
  onEdit: () => void;
};

/** The edit and delete icon buttons of a table row. */
export function RowActions({
  deleteLabel,
  editLabel,
  isDeleting = false,
  onDelete,
  onEdit,
}: RowActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-2">
      <Button
        aria-label={editLabel ?? t('common.edit')}
        onClick={onEdit}
        size="icon"
        variant="outline"
      >
        <Pen className="h-4 w-4" />
      </Button>
      <Button
        aria-label={deleteLabel ?? t('common.delete')}
        disabled={isDeleting}
        onClick={onDelete}
        size="icon"
        variant="destructive"
      >
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  );
}
