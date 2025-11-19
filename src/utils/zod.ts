import { z, type ZodAny } from 'zod';

const rewriteDates = (schema: any): any => {
  if (schema instanceof z.ZodDate) {
    return z.iso.datetime();
  }

  if (schema instanceof z.ZodNullable) {
    return rewriteDates(schema.unwrap()).nullable();
  }

  if (schema instanceof z.ZodOptional) {
    return rewriteDates(schema.unwrap()).optional();
  }

  if (schema instanceof z.ZodArray) {
    return z.array(rewriteDates(schema.element));
  }

  if (schema instanceof z.ZodUnion) {
    const options = schema.def.options.map((option) => rewriteDates(option));
    return z.union(options as any);
  }

  if (schema instanceof z.ZodObject) {
    const sanitizedShape: Record<string, ZodAny> = {};

    for (const [key, value] of Object.entries(schema.shape)) {
      sanitizedShape[key] = rewriteDates(value);
    }

    return z.object(sanitizedShape);
  }

  return schema;
};

export const ensureJsonSafeDates = <T extends z.ZodTypeAny>(schema: T): T => {
  return rewriteDates(schema) as T;
};
