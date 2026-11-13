import { ping } from '@/modules/ping/index';
import { time } from '@/modules/ping/time';
import { uptime } from '@/modules/ping/uptime';

export const pingRouter = { ping, time, uptime };
