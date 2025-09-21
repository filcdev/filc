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

export type SuccessResponse = {
  success: true;
  data?: unknown;
};

export type ErrorResponse = {
  success: false;
  data?: unknown;
  error: string;
};
