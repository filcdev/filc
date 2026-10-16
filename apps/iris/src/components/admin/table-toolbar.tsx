import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import { Plus, RefreshCw } from 'lucide-react';

type TableToolbarProps = {
  /** Whether the create action shows; gated on the page's write permission. */
  canCreate: boolean;
  createLabel: string;
  onCreate: () => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  refreshLabel: string;
  search: string;
  searchPlaceholder: string;
};

/** List toolbar: the search field plus the refresh and create actions. */
export function TableToolbar({
  canCreate,
  createLabel,
  onCreate,
  onRefresh,
  onSearchChange,
  refreshLabel,
  search,
  searchPlaceholder,
}: TableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Input
        className="max-w-sm"
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        value={search}
      />
      <div className="ml-auto flex items-center gap-2">
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="h-4 w-4" />
          {refreshLabel}
        </Button>
        {canCreate && (
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {createLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
