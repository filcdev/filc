import { Button } from '@filcdev/ui/components/button';
import { Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type PageHeaderProps = {
  /** Label of the add action, hidden while `canAdd` is false. */
  addLabel: string;
  /** Whether the add action shows; the editor pages hide it while editing. */
  canAdd?: boolean;
  description: string;
  onAdd: () => void;
  onRefresh: () => void;
  title: string;
};

/** Admin page title block: heading, description and the refresh/add actions. */
export function PageHeader({
  addLabel,
  canAdd = true,
  description,
  onAdd,
  onRefresh,
  title,
}: PageHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="h-4 w-4" />
          {t('navigator.refresh')}
        </Button>
        {canAdd && (
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
