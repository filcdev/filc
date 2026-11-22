import { Button } from '@filcdev/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@filcdev/ui/components/tooltip';
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
  const editName = editLabel ?? t('common.edit');
  const deleteName = deleteLabel ?? t('common.delete');

  return (
    <div className="flex gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={editName}
              onClick={onEdit}
              size="icon"
              variant="outline"
            >
              <Pen className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent>{editName}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={deleteName}
              disabled={isDeleting}
              onClick={onDelete}
              size="icon"
              variant="destructive"
            >
              <Trash className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent>{deleteName}</TooltipContent>
      </Tooltip>
    </div>
  );
}
