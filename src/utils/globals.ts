import type { auth } from '~/utils/authentication';

export type honoContext = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

export type authenticatedContext = {
  Variables: {
    user: NonNullable<typeof auth.$Infer.Session.user>;
    session: NonNullable<typeof auth.$Infer.Session.session>;
  };
};
