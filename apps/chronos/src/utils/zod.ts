import { createSchemaFactory } from 'drizzle-zod';

export const { createInsertSchema, createSelectSchema, createUpdateSchema } =
  createSchemaFactory({});
