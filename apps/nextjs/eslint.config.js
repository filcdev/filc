import baseConfig, { restrictEnvAccess } from "@filc/eslint-config/base";
import nextjsConfig from "@filc/eslint-config/nextjs";
import reactConfig from "@filc/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
];
