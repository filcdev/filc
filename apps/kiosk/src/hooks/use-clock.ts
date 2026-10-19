import type { Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { dayjs } from '@/utils/dayjs';

/** Ticking wall clock for the ticker header: [date, time]. */
export function useClock(): [string, string] {
  const [clockText, setClockText] = useState<[string, string]>([
    '',
    'Betöltés...',
  ]);

  useEffect(() => {
    const tick = () => {
      setClockText([
        dayjs().format('YYYY. MMMM DD. dddd'),
        dayjs().format('HH:mm:ss'),
      ]);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return clockText;
}

/** A ticking clock as a Dayjs value, so time-based filters keep re-running even
 *  when a refetch returns a structurally identical payload. */
export function useNowTick(intervalMs: number): Dayjs {
  const [now, setNow] = useState<Dayjs>(() => dayjs());

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
