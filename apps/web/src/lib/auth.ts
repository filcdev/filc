import {
  ac,
  root,
  admin,
  editor,
  teacher,
  student,
} from "@filc/auth/permissions";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const auth = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [
    adminClient(),
    organizationClient({
      ac,
      roles: {
        root,
        admin,
        editor,
        teacher,
        student,
      },
    }),
  ],
});
