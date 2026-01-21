import { createFactory } from 'hono/factory';
import type { Context } from '#utils/types/globals';

export const doorlockFactory = createFactory<
  Context & {
    Variables: {
      device: { id: string; name: string } | undefined;
    };
  }
>();
