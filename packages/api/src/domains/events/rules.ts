import z from 'zod';
import type { EventFieldType } from './fields';

/**
 * The comparisons an organizer may put on a door rule. Each one belongs to a
 * question type, and the backend refuses an operator that does not fit the
 * question: `contains` on a number or `gte` on a checkbox is a payload mistake,
 * not a rule.
 */
export const eventCheckinRuleOps = [
  'equals',
  'contains',
  'gte',
  'lte',
  'is_true',
  'is_false',
] as const;

export type EventCheckinRuleOp = (typeof eventCheckinRuleOps)[number];

export const eventCheckinRuleOpSchema = z.enum(eventCheckinRuleOps);

/**
 * The operators each question type can be judged with. Kept next to the enum so
 * the organizer's editor and the backend validator read one table: a `select`
 * only matches exactly, free text may also contain, a number compares, and a
 * checkbox is ticked or not.
 */
export const eventCheckinRuleOpsByType: Record<
  EventFieldType,
  readonly EventCheckinRuleOp[]
> = {
  checkbox: ['is_true', 'is_false'],
  number: ['equals', 'gte', 'lte'],
  select: ['equals'],
  text: ['equals', 'contains'],
  textarea: ['equals', 'contains'],
};

/** Whether this operator reads a right-hand value at all. */
export const ruleOpHasValue = (op: EventCheckinRuleOp): boolean =>
  op !== 'is_true' && op !== 'is_false';

/**
 * One condition of a rule: the answer to `fieldId` satisfies `op value`. The
 * value is a string because every stored answer is one; a number's comparison
 * parses both sides.
 */
export const eventCheckinWhenSchema = z.object({
  fieldId: z.uuid(),
  op: eventCheckinRuleOpSchema,
  /** The right-hand side; empty for `is_true`/`is_false`. */
  value: z.string().default(''),
});

export type EventCheckinWhen = z.infer<typeof eventCheckinWhenSchema>;

/** What the door does when a rule's condition matches. */
export const eventCheckinRuleActions = ['allow', 'deny'] as const;

export type EventCheckinRuleAction = (typeof eventCheckinRuleActions)[number];

export const eventCheckinRuleActionSchema = z.enum(eventCheckinRuleActions);

/**
 * What the scanner may reveal when this rule decides. `fieldIds` names the
 * questions whose answers are shown, in this order; identity is a pair of
 * switches because name and email are separate privacy decisions.
 */
export const eventCheckinShowSchema = z.object({
  email: z.boolean().default(false),
  fieldIds: z.array(z.uuid()).default([]),
  name: z.boolean().default(true),
});

export type EventCheckinShow = z.infer<typeof eventCheckinShowSchema>;

/**
 * One readable rule of the door: "when this answer is like this, allow or deny,
 * show this, say this". The list is ordered and the first match wins; the last
 * rule is the catch-all (`when: null`) so there is always a decision.
 */
export const eventCheckinRuleSchema = z.object({
  action: eventCheckinRuleActionSchema,
  /** Stable key for the editor; never reused across rules. */
  id: z.uuid(),
  /** Shown by the scanner when the rule denies. Empty for an allow. */
  message: z.string().default(''),
  show: eventCheckinShowSchema,
  /** `null` is the catch-all; exactly one, and always the last rule. */
  when: eventCheckinWhenSchema.nullable(),
});

export type EventCheckinRule = z.infer<typeof eventCheckinRuleSchema>;

/**
 * The door's starting rule: everyone may enter, the scanner shows the name and
 * no answers. An event is never stored without at least one rule.
 */
export const defaultCheckinRules = (): EventCheckinRule[] => [
  {
    action: 'allow',
    id: crypto.randomUUID(),
    message: '',
    show: { email: false, fieldIds: [], name: true },
    when: null,
  },
];
