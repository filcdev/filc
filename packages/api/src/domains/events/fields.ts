import z from 'zod';

/**
 * The kinds of question an organizer may add to an event's signup form. Each
 * type maps to one control in the guest form and one column in the export;
 * `select` is the only one that reads its choices from `options`.
 */
export const eventFieldTypes = [
  'text',
  'textarea',
  'select',
  'number',
  'checkbox',
] as const;

export type EventFieldType = (typeof eventFieldTypes)[number];

export const eventFieldTypeSchema = z.enum(eventFieldTypes);

/** Whose signup form shows the question. */
export const eventFieldAppliesToValues = ['guest', 'student', 'both'] as const;

export type EventFieldAppliesTo = (typeof eventFieldAppliesToValues)[number];

export const eventFieldAppliesToSchema = z.enum(eventFieldAppliesToValues);

/** One organizer-defined question, as stored. */
export const eventFieldSchema = z.object({
  appliesTo: eventFieldAppliesToSchema,
  eventId: z.uuid(),
  id: z.uuid(),
  label: z.string(),
  options: z.array(z.string()).nullable(),
  position: z.number(),
  required: z.boolean(),
  type: eventFieldTypeSchema,
});

export type EventField = z.infer<typeof eventFieldSchema>;

/**
 * One question in a `fields.replace` payload. An `id` names the row being kept
 * (answers stay attached to it); omitting it inserts a new question.
 */
export const eventFieldInputSchema = z.object({
  appliesTo: eventFieldAppliesToSchema.default('guest'),
  id: z.uuid().optional(),
  label: z.string().min(1),
  /** Only read for `select`; other types store no options. */
  options: z.array(z.string().min(1)).nullable().optional(),
  position: z.number().int().min(0),
  required: z.boolean().default(false),
  type: eventFieldTypeSchema,
});

export type EventFieldInput = z.infer<typeof eventFieldInputSchema>;

/** The body of `fields.replace`: the complete question set for one event. */
export const eventFieldsReplaceSchema = z.object({
  fields: z.array(eventFieldInputSchema),
  id: z.uuid(),
});
