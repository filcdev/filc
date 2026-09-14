import z from 'zod';

/**
 * Path parameter for navigator entities. Their ids are text (upstream's ids
 * survive the import verbatim), so this is not a uuid.
 */
export const navigatorIdParamsSchema = z.object({ id: z.string().min(1) });

export type NavigatorIdParamsInput = z.infer<typeof navigatorIdParamsSchema>;
