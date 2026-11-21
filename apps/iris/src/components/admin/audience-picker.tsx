import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Label } from '@filcdev/ui/components/label';
import { useId } from 'react';
export type AudiencePickerProps = {
  /** Shown when nothing is picked, i.e. the selection means "everyone". */
  allHint: string;
  allLabel: string;
  /** Shown when at least one entry is picked. */
  hint: string;
  idPrefix: string;
  items: { id: string; name: string }[];
  label: string;
  /** Clears the selection, which means "everyone". */
  onClear: () => void;
  onToggle: (id: string, checked: boolean) => void;
  selectedIds: string[];
};

/**
 * A multi-select of ids with an "all" row that clears the selection: empty
 * means everyone. Shared by the announcement audience pickers and the event
 * class picker.
 */
export function AudiencePicker({
  allHint,
  allLabel,
  hint,
  idPrefix,
  items,
  label,
  onClear,
  onToggle,
  selectedIds,
}: AudiencePickerProps) {
  const allId = useId();
  const selectedIdSet = new Set(selectedIds);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedIds.length === 0}
            id={allId}
            onCheckedChange={(checked) => {
              if (checked) {
                onClear();
              }
            }}
          />
          <label
            className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor={allId}
          >
            {allLabel}
          </label>
        </div>
        {items.map((item) => (
          <div className="flex items-center gap-2" key={item.id}>
            <Checkbox
              checked={selectedIdSet.has(item.id)}
              id={`${idPrefix}-${item.id}`}
              onCheckedChange={(checked) => onToggle(item.id, Boolean(checked))}
            />
            <label
              className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              htmlFor={`${idPrefix}-${item.id}`}
            >
              {item.name}
            </label>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {selectedIds.length === 0 ? allHint : hint}
      </p>
    </div>
  );
}
