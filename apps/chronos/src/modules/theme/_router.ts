import {
  createThemeSchedule,
  deleteThemeSchedule,
  getSiteTheme,
  listThemeSchedule,
  updateSiteTheme,
  updateThemeSchedule,
} from '#modules/theme/index';

export const themeRouter = {
  get: getSiteTheme,
  schedule: {
    create: createThemeSchedule,
    delete: deleteThemeSchedule,
    list: listThemeSchedule,
    update: updateThemeSchedule,
  },
  update: updateSiteTheme,
};
