import { getSiteTheme, updateSiteTheme } from '@/modules/theme/index';

export const themeRouter = {
  get: getSiteTheme,
  update: updateSiteTheme,
};
