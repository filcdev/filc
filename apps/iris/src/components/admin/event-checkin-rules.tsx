import type { EventFieldType } from '@filcdev/api/domains/events/fields';
import {
  defaultCheckinRules,
  type EventCheckinRule,
  type EventCheckinRuleAction,
  type EventCheckinRuleOp,
  type EventCheckinShow,
  eventCheckinRuleOpsByType,
  ruleOpHasValue,
} from '@filcdev/api/domains/events/rules';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@filcdev/ui/components/tooltip';
import { cn } from '@filcdev/ui/lib/utils';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { EventFieldItem } from '@/hooks/events';

const OPS: readonly EventCheckinRuleOp[] = [
  'equals',
  'contains',
  'gte',
  'lte',
  'is_true',
  'is_false',
];

const ACTIONS: readonly EventCheckinRuleAction[] = ['allow', 'deny'];

type Props = {
  fields: EventFieldItem[];
  onChange: (rules: EventCheckinRule[]) => void;
  value: EventCheckinRule[];
};

/** The operators this question type can be judged with, in a stable order. */
const opsFor = (type: EventFieldType | undefined): EventCheckinRuleOp[] =>
  type
    ? OPS.filter((op) => eventCheckinRuleOpsByType[type].includes(op))
    : [...eventCheckinRuleOpsByType.text];

/**
 * The starting value of a new condition: a select opens on its first option, a
 * tick has no right-hand side, everything else starts blank for the organizer
 * to type.
 */
const initialValue = (
  field: EventFieldItem | undefined,
  op: EventCheckinRuleOp
): string => {
  if (!ruleOpHasValue(op)) {
    return '';
  }
  return field?.type === 'select' ? (field.options?.[0] ?? '') : '';
};

/** A fresh conditional rule, aimed at the first saved question. */
const newRule = (field: EventFieldItem): EventCheckinRule => {
  const op = opsFor(field.type)[0];
  return {
    action: 'allow',
    id: crypto.randomUUID(),
    message: '',
    show: { email: false, fieldIds: [], name: true },
    when: { fieldId: field.id, op, value: initialValue(field, op) },
  };
};

/**
 * The door's rules as a list of sentences an organizer can read aloud: "if the
 * answer to this question is like this, then they may enter, and show this".
 * The catch-all wears its own wording and stays last; the buttons above and
 * below a rule are the whole ordering model.
 */
export function CheckinRulesEditor({ fields, onChange, value }: Props) {
  const { t } = useTranslation();
  const catchAllIndex = value.findIndex((rule) => rule.when === null);

  const update = (index: number, patch: Partial<EventCheckinRule>) =>
    onChange(
      value.map((rule, at) => (at === index ? { ...rule, ...patch } : rule))
    );

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= catchAllIndex || target >= value.length) {
      return;
    }
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const duplicate = (index: number) => {
    const next = [...value];
    next.splice(index + 1, 0, { ...value[index], id: crypto.randomUUID() });
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, at) => at !== index));
  };

  const add = () => {
    // A list with no catch-all cannot decide anything, so the first rule of an
    // unconfigured event is the catch-all itself; after that a new rule always
    // slots in above it.
    if (value.length === 0) {
      onChange(defaultCheckinRules());
      return;
    }
    const field = fields[0];
    if (!field) {
      return;
    }
    const next = [...value];
    next.splice(
      catchAllIndex < 0 ? next.length : catchAllIndex,
      0,
      newRule(field)
    );
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="font-medium text-sm">{t('events.checkinRules.title')}</p>
        <p className="text-muted-foreground text-xs">
          {t('events.checkinRules.orderFirstMatch')}
        </p>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t('events.checkinRules.noQuestions')}
        </p>
      ) : null}

      <ol className="space-y-3">
        {value.map((rule, index) => (
          <RuleCard
            canMoveDown={index < catchAllIndex - 1}
            canMoveUp={index > 0 && rule.when !== null}
            fields={fields}
            index={index}
            isCatchAll={rule.when === null}
            key={rule.id}
            onChange={(patch) => update(index, patch)}
            onDuplicate={() => duplicate(index)}
            onMoveDown={() => move(index, 1)}
            onMoveUp={() => move(index, -1)}
            onRemove={() => remove(index)}
            rule={rule}
          />
        ))}
      </ol>

      <Button
        disabled={fields.length === 0 && value.length > 0}
        onClick={add}
        type="button"
        variant="outline"
      >
        <Plus className="h-4 w-4" />
        {t('events.checkinRules.add')}
      </Button>
    </div>
  );
}

type RuleCardProps = {
  canMoveDown: boolean;
  canMoveUp: boolean;
  fields: EventFieldItem[];
  index: number;
  isCatchAll: boolean;
  onChange: (patch: Partial<EventCheckinRule>) => void;
  onDuplicate: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  rule: EventCheckinRule;
};

/** One rule of the list, as the sentence the organizer reads. */
function RuleCard({
  canMoveDown,
  canMoveUp,
  fields,
  index,
  isCatchAll,
  onChange,
  onDuplicate,
  onMoveDown,
  onMoveUp,
  onRemove,
  rule,
}: RuleCardProps) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const number = index + 1;
  const headingId = `${idPrefix}-heading`;
  const field = rule.when
    ? fields.find((item) => item.id === rule.when?.fieldId)
    : undefined;

  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        'space-y-4 rounded-lg border p-4',
        isCatchAll && 'border-primary/40 bg-muted/40'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm" id={headingId}>
          {isCatchAll
            ? t('events.checkinRules.catchAllTitle')
            : t('events.checkinRules.rule', { number })}
        </h3>
        {isCatchAll ? null : (
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={t('events.checkinRules.moveUp', { number })}
                    disabled={!canMoveUp}
                    onClick={onMoveUp}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent>
                {t('events.checkinRules.moveUp', { number })}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={t('events.checkinRules.moveDown', { number })}
                    disabled={!canMoveDown}
                    onClick={onMoveDown}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent>
                {t('events.checkinRules.moveDown', { number })}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={t('events.checkinRules.duplicate', { number })}
                    onClick={onDuplicate}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent>
                {t('events.checkinRules.duplicate', { number })}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={t('events.checkinRules.delete', { number })}
                    onClick={onRemove}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent>
                {t('events.checkinRules.delete', { number })}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {rule.when ? (
        <RuleCondition
          field={field}
          fields={fields}
          onChange={onChange}
          rule={rule}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">
          {t('events.checkinRules.then')}
        </span>
        <Select
          items={ACTIONS.map((action) => ({
            label: t(`events.checkinRules.actions.${action}`),
            value: action,
          }))}
          onValueChange={(action) =>
            action && onChange({ action: action as EventCheckinRuleAction })
          }
          value={rule.action}
        >
          <SelectTrigger
            aria-label={t('events.checkinRules.action')}
            className="min-w-40"
          >
            <SelectValue />
          </SelectTrigger>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-message`}>
          {t('events.checkinRules.message')}
        </Label>
        <Input
          id={`${idPrefix}-message`}
          onChange={(changeEvent) =>
            onChange({ message: changeEvent.target.value })
          }
          placeholder={t('events.checkinRules.messagePlaceholder')}
          value={rule.message}
        />
      </div>

      <RuleShow
        fields={fields}
        onChange={(show) => onChange({ show })}
        show={rule.show}
      />
    </li>
  );
}

/** The "if …" half: question, operator, and the value they compare against. */
function RuleCondition({
  field,
  fields,
  onChange,
  rule,
}: {
  field: EventFieldItem | undefined;
  fields: EventFieldItem[];
  onChange: (patch: Partial<EventCheckinRule>) => void;
  rule: EventCheckinRule;
}) {
  const { t } = useTranslation();
  const when = rule.when;
  if (!when) {
    return null;
  }

  const changeQuestion = (fieldId: string) => {
    const chosen = fields.find((item) => item.id === fieldId);
    const op = opsFor(chosen?.type)[0];
    onChange({ when: { fieldId, op, value: initialValue(chosen, op) } });
  };

  const changeOp = (op: EventCheckinRuleOp) =>
    onChange({
      when: { ...when, op, value: ruleOpHasValue(op) ? when.value : '' },
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium text-sm">
        {t('events.checkinRules.when')}
      </span>
      <Select
        items={fields.map((item) => ({ label: item.label, value: item.id }))}
        onValueChange={(fieldId) => fieldId && changeQuestion(fieldId)}
        value={when.fieldId}
      >
        <SelectTrigger
          aria-label={t('events.checkinRules.question')}
          className="min-w-40"
        >
          <SelectValue />
        </SelectTrigger>
      </Select>

      <Select
        items={opsFor(field?.type).map((op) => ({
          label: t(`events.checkinRules.ops.${op}`),
          value: op,
        }))}
        onValueChange={(op) => op && changeOp(op as EventCheckinRuleOp)}
        value={when.op}
      >
        <SelectTrigger
          aria-label={t('events.checkinRules.operator')}
          className="min-w-36"
        >
          <SelectValue />
        </SelectTrigger>
      </Select>

      <RuleValue
        field={field}
        onChange={(value) => onChange({ when: { ...when, value } })}
        op={when.op}
        value={when.value}
      />
    </div>
  );
}

/** The right-hand side, drawn as the question's own control. */
function RuleValue({
  field,
  onChange,
  op,
  value,
}: {
  field: EventFieldItem | undefined;
  onChange: (value: string) => void;
  op: EventCheckinRuleOp;
  value: string;
}) {
  const { t } = useTranslation();

  if (!ruleOpHasValue(op)) {
    return null;
  }

  if (field && field.type === 'select') {
    return (
      <Select
        items={(field.options ?? []).map((option) => ({
          label: option,
          value: option,
        }))}
        onValueChange={(next) => next && onChange(next)}
        value={value}
      >
        <SelectTrigger
          aria-label={t('events.checkinRules.value')}
          className="min-w-32"
        >
          <SelectValue />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Input
      aria-label={t('events.checkinRules.value')}
      className="w-36"
      inputMode={field?.type === 'number' ? 'decimal' : undefined}
      onChange={(changeEvent) => onChange(changeEvent.target.value)}
      type={field?.type === 'number' ? 'number' : 'text'}
      value={value}
    />
  );
}

/** The "and show this" half: identity switches and one tick per question. */
function RuleShow({
  fields,
  onChange,
  show,
}: {
  fields: EventFieldItem[];
  onChange: (show: EventCheckinShow) => void;
  show: EventCheckinShow;
}) {
  const { t } = useTranslation();
  const idPrefix = useId();

  const toggle = (fieldId: string, checked: boolean) =>
    onChange({
      ...show,
      fieldIds: checked
        ? [...show.fieldIds, fieldId]
        : show.fieldIds.filter((id) => id !== fieldId),
    });

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 font-medium text-sm">
        {t('events.checkinRules.show')}
      </legend>
      <div className="flex flex-wrap gap-4">
        <ShowToggle
          checked={show.name}
          id={`${idPrefix}-name`}
          label={t('events.checkinRules.showName')}
          onCheckedChange={(checked) => onChange({ ...show, name: checked })}
        />
        <ShowToggle
          checked={show.email}
          id={`${idPrefix}-email`}
          label={t('events.checkinRules.showEmail')}
          onCheckedChange={(checked) => onChange({ ...show, email: checked })}
        />
        {fields.map((item) => (
          <ShowToggle
            checked={show.fieldIds.includes(item.id)}
            id={`${idPrefix}-${item.id}`}
            key={item.id}
            label={item.label}
            onCheckedChange={(checked) => toggle(item.id, checked)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** One ticked choice of what a rule reveals. */
function ShowToggle({
  checked,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        id={id}
        onCheckedChange={(state) => onCheckedChange(state === true)}
      />
      <label
        className="cursor-pointer font-medium text-sm leading-none"
        htmlFor={id}
      >
        {label}
      </label>
    </div>
  );
}
