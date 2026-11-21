import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Input } from '@filcdev/ui/components/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { Textarea } from '@filcdev/ui/components/textarea';
import type { EventFieldItem } from '@/hooks/events';

type AnswerFieldProps = {
  field: EventFieldItem;
  value: string;
  onChange: (value: string) => void;
};

/**
 * One signup question, rendered by the type the organizer picked. Shared by the
 * student form and the guest form: the question set differs, the control does
 * not.
 */
export function AnswerField({ field, value, onChange }: AnswerFieldProps) {
  const id = `answer-${field.id}`;

  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          id={id}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          value={value}
        />
      );
    case 'number':
      return (
        <Input
          id={id}
          inputMode="numeric"
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          type="number"
          value={value}
        />
      );
    case 'select':
      return (
        <Select
          items={(field.options ?? []).map((option) => ({
            label: option,
            value: option,
          }))}
          onValueChange={(next) => onChange(next ?? '')}
          value={value === '' ? null : value}
        >
          <SelectTrigger className="w-full" id={id}>
            <SelectValue />
          </SelectTrigger>
        </Select>
      );
    case 'checkbox':
      return (
        <Checkbox
          checked={value === 'true'}
          id={id}
          onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
        />
      );
    default:
      return (
        <Input
          id={id}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          value={value}
        />
      );
  }
}
