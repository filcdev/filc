/** App version reported to Chronos with every heartbeat and shown in the
 *  ticker header. Injected at build time from `package.json` by
 *  vite.config.ts; falls back to "dev" when no define was applied. */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev';
