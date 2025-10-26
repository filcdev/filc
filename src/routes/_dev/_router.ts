import { developmentFactory } from '~/routes/_dev/_factory';
import { introspect } from '~/routes/_dev/introspect';

export const developmentRouter = developmentFactory
  .createApp()
  .get('/introspect', ...introspect);
