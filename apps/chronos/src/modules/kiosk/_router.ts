import { departures } from '#modules/kiosk/departures';
import { heartbeat } from '#modules/kiosk/heartbeat';
import {
  createKiosk,
  deleteKiosk,
  listKiosks,
  updateKiosk,
} from '#modules/kiosk/index';
import { listNews } from '#modules/kiosk/news';
import { newsImage } from '#modules/kiosk/news-image';
import { petrikNews } from '#modules/kiosk/petrik-news';
import { weather } from '#modules/kiosk/weather';

export const kioskRouter = {
  create: createKiosk,
  delete: deleteKiosk,
  departures,
  heartbeat,
  list: listKiosks,
  news: { image: newsImage, list: listNews },
  petrikNews,
  update: updateKiosk,
  weather,
};
