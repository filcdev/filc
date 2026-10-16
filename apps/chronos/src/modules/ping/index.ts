import { base } from '#orpc';

export const ping = base.ping.ping.handler(() => ({
  message: 'pong' as const,
}));
