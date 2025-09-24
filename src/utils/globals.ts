import type { auth } from '~/utils/authentication';

export type Context = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

export type AuthenticatedContext = {
  Variables: {
    user: NonNullable<typeof auth.$Infer.Session.user>;
    session: NonNullable<typeof auth.$Infer.Session.session>;
  };
};

// biome-ignore lint/suspicious/noExplicitAny: TODO: improve any usage
export type SuccessResponse<T = any> = T extends any
  ? { success: true; data?: T }
  : { success: true; data: T };

export type ErrorResponse = {
  success: false;
  data?: unknown;
  error: string;
  cause?: unknown;
};
