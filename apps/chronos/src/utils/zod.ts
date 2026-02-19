import { createSchemaFactory } from 'drizzle-zod';
import { z } from 'zod';

const rewriteDates = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  if (schema instanceof z.ZodDate) {
    return z.iso.datetime();
  }

  if (schema instanceof z.ZodNullable) {
    return rewriteDates(schema.unwrap() as z.ZodTypeAny).nullable();
  }

  if (schema instanceof z.ZodOptional) {
    return rewriteDates(schema.unwrap() as z.ZodTypeAny).optional();
  }

  if (schema instanceof z.ZodArray) {
    return z.array(rewriteDates(schema.element as z.ZodTypeAny));
  }

  if (schema instanceof z.ZodUnion) {
    const options = schema.options.map((option) =>
      rewriteDates(option as z.ZodTypeAny)
    );
    return z.union(options as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  if (schema instanceof z.ZodObject) {
    const sanitizedShape: Record<string, z.ZodTypeAny> = {};

    for (const [key, value] of Object.entries(schema.shape)) {
      sanitizedShape[key] = rewriteDates(value as z.ZodTypeAny);
    }

    return z.object(sanitizedShape);
  }

  return schema;
};

export const ensureJsonSafeDates = <T extends z.ZodTypeAny>(schema: T): T =>
  rewriteDates(schema) as T;

export const { createInsertSchema, createSelectSchema, createUpdateSchema } =
  createSchemaFactory({});
