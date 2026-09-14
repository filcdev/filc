import { CloudRain, Wind } from 'lucide-react';
import { Loading, QueryError } from '@/components/tv/query-states';
import { useKioskWeather } from '@/hooks/tv';
import { getWindType } from '@/utils/wind-types';

/** Current conditions at the school, proxied through Chronos. */
export function Weather() {
  const { data, isError, isLoading } = useKioskWeather();

  if (isLoading) {
    return <Loading />;
  }

  if (isError || !data) {
    return <QueryError />;
  }

  const wind = getWindType(data.windKph);

  return (
    <div className="mx-3 flex h-full flex-row items-center justify-between py-2">
      <div className="flex items-center justify-center">
        <img
          alt=""
          className="h-16 w-16"
          height={64}
          src={data.icon}
          width={64}
        />
        <span className="self-center text-nowrap font-bold text-lg">
          {data.tempC} °C
        </span>
      </div>
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex gap-2">
          <Wind className="size-6" />
          <span className="self-center text-nowrap text-md">
            {wind?.name ?? `${data.windKph} km/h`}
          </span>
        </div>
        <div className="flex gap-2">
          <CloudRain className="size-6" />
          <span className="self-center text-lg">{data.precipMm} mm</span>
        </div>
      </div>
    </div>
  );
}
