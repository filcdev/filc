import { base } from '#orpc';
import { env } from '#utils/environment';
import { badGateway } from '#utils/http';

const WEATHER_URL = 'https://api.weatherapi.com/v1/current.json';
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const WEATHER_TIMEOUT_MS = 10_000;

type WeatherResponse = {
  current: {
    condition: { icon: string };
    precip_mm: number;
    temp_c: number;
    wind_kph: number;
  };
};

type KioskWeather = {
  icon: string;
  precipMm: number;
  tempC: number;
  windKph: number;
};

let cachedWeather: { expiresAt: number; value: KioskWeather } | null = null;

export const weather = base.kiosk.weather.handler(async () => {
  if (!env.weatherApiKey) {
    throw badGateway('Weather API key is not configured');
  }

  if (cachedWeather && cachedWeather.expiresAt > Date.now()) {
    return cachedWeather.value;
  }

  const url = new URL(WEATHER_URL);
  url.searchParams.set('key', env.weatherApiKey);
  url.searchParams.set('q', env.kioskWeatherLocation);
  url.searchParams.set('lang', 'hu');

  let payload: WeatherResponse;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Weather API responded with ${response.status}`);
    }

    payload = (await response.json()) as WeatherResponse;
  } catch (error) {
    throw badGateway('Failed to fetch weather', error);
  }

  const value = {
    icon: payload.current.condition.icon,
    precipMm: payload.current.precip_mm,
    tempC: Math.round(payload.current.temp_c),
    windKph: payload.current.wind_kph,
  };

  cachedWeather = {
    expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    value,
  };

  return value;
});
