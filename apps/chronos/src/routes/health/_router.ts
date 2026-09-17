import { healthFactory } from '#routes/health/_factory';
import { health } from '#routes/health/index';

export const healthRouter = healthFactory.createApp().get('/', ...health);
