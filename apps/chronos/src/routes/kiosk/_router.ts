import { kioskFactory } from '#routes/kiosk/_factory';
import { kioskDeparturesRoute } from '#routes/kiosk/departures';
import { kioskHeartbeatRoute } from '#routes/kiosk/heartbeat';
import {
  createKioskRoute,
  deleteKioskRoute,
  listKiosksRoute,
  updateKioskRoute,
} from '#routes/kiosk/index';
import { kioskNewsRoute } from '#routes/kiosk/news';
import { kioskNewsImageRoute } from '#routes/kiosk/news-image';
import { kioskWeatherRoute } from '#routes/kiosk/weather';

export const kioskRouter = kioskFactory
  .createApp()
  // Public kiosk data
  .post('/heartbeat', ...kioskHeartbeatRoute)
  .get('/news', ...kioskNewsRoute)
  .get('/news/:id/image', ...kioskNewsImageRoute)
  .get('/weather', ...kioskWeatherRoute)
  .post('/departures', ...kioskDeparturesRoute)
  // Kiosk registry
  .get('/', ...listKiosksRoute)
  .post('/', ...createKioskRoute)
  .put('/:id', ...updateKioskRoute)
  .delete('/:id', ...deleteKioskRoute);
