import { departures } from '#routes/kiosk/departures';
import { heartbeat } from '#routes/kiosk/heartbeat';
import {
  createKiosk,
  deleteKiosk,
  listKiosks,
  updateKiosk,
} from '#routes/kiosk/index';
import { listNews } from '#routes/kiosk/news';
import { newsImage } from '#routes/kiosk/news-image';
import { petrikNews } from '#routes/kiosk/petrik-news';
import { weather } from '#routes/kiosk/weather';

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
