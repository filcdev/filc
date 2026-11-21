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

/**
 * Whose signup form shows the question. A question may be aimed at several at
 * once: the old `both` (guests and students) is now the pair
 * `['guest', 'student']`, and helpers are a form of their own.
 */
export const eventFieldAudiences = ['guest', 'student', 'helper'] as const;

export type EventFieldAudience = (typeof eventFieldAudiences)[number];

export const eventFieldAudienceSchema = z.enum(eventFieldAudiences);

/** Every audience ticked: what a new question starts with. */
export const defaultEventFieldAudiences: EventFieldAudience[] = [
  ...eventFieldAudiences,
];

/**
 * At least one audience, each at most once. An empty list would put the
 * question on no form at all, and a duplicate is a payload mistake rather than
 * a different meaning.
 */
export const eventFieldAudiencesSchema = z
  .array(eventFieldAudienceSchema)
  .min(1)
  .refine(
    (audiences) => new Set(audiences).size === audiences.length,
    'A question cannot be shown to the same audience twice'
  );

/** One organizer-defined question, as stored. */
export const eventFieldSchema = z.object({
  audiences: z.array(eventFieldAudienceSchema),
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
  audiences: eventFieldAudiencesSchema.default(defaultEventFieldAudiences),
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
