import { Field, FieldLabel } from '@filcdev/ui/components/field';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';

type LabeledSelectFieldProps = {
  items: { label: string; value: string }[];
  /** Used as both the field label and the select placeholder. */
  label: string;
  onChange: (value: string) => void;
  value: string;
};

/** A labelled, full-width select, the shape the navigator forms use. */
export function LabeledSelectField({
  items,
  label,
  onChange,
  value,
}: LabeledSelectFieldProps) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        items={items}
        onValueChange={(next) => onChange(next ?? '')}
        value={value}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
      </Select>
    </Field>
  );
}
