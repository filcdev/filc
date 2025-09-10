import { hc as client } from 'hono/client';
import type { AppType } from '~/index';

export const hc = client<AppType>('/');
