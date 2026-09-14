import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import { env } from '#utils/environment';
import { ApiHttpError, ok } from '#utils/http';
import { kioskWeatherResponseSchema } from '#utils/kiosk/schemas';
import { filcExt } from '#utils/openapi';
import { kioskFactory } from './_factory';

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

export const kioskWeatherRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt('Kiosk', '@unit KioskWeatherResponse'),
    description: 'Current weather for the TV kiosk, cached for ten minutes',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(kioskWeatherResponseSchema),
          },
        },
        description: 'Successful Response',
      },
      502: { description: 'Weather provider unavailable or unconfigured' },
    },
    tags: ['Kiosk'],
  }),
  async (c) => {
    if (!env.weatherApiKey) {
      throw new ApiHttpError(StatusCodes.BAD_GATEWAY, {
        message: 'Weather API key is not configured',
      });
    }

    if (cachedWeather && cachedWeather.expiresAt > Date.now()) {
      return ok(c, cachedWeather.value);
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
      throw new ApiHttpError(StatusCodes.BAD_GATEWAY, {
        cause: error,
        message: 'Failed to fetch weather',
      });
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

    return ok(c, value);
  }
);
