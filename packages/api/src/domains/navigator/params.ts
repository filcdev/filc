import z from 'zod';

/** Path parameter for navigator endpoints addressed by id. */
export const idParamSchema = z.object({ id: z.uuid() });
