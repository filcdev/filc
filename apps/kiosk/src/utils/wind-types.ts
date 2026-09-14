type WindType = {
  id: number;
  name: string;
  /** Inclusive wind-speed range in km/h. */
  kph: { max: number; min: number };
};

/** Hungarian wind-strength names, taken from the PetrikTV ticker. */
const WIND_TYPES: WindType[] = [
  { id: 0, kph: { max: 1, min: 0 }, name: 'Teljes szélcsend' },
  { id: 1, kph: { max: 5, min: 2 }, name: 'Gyenge légmozgás' },
  { id: 2, kph: { max: 11, min: 6 }, name: 'Enyhe szellő' },
  { id: 3, kph: { max: 19, min: 12 }, name: 'Gyengéd fuvallat' },
  { id: 4, kph: { max: 28, min: 20 }, name: 'Mérsékelt szél' },
  { id: 5, kph: { max: 38, min: 29 }, name: 'Frissítő szellő' },
  { id: 6, kph: { max: 49, min: 39 }, name: 'Eleven szellő' },
  { id: 7, kph: { max: 61, min: 50 }, name: 'Izmos szél' },
  { id: 8, kph: { max: 74, min: 62 }, name: 'Majdnem vihar' },
  { id: 9, kph: { max: 87, min: 75 }, name: 'Csak vihar' },
  { id: 10, kph: { max: 102, min: 88 }, name: 'Esernyő tolvaj' },
  { id: 11, kph: { max: 117, min: 103 }, name: 'Fékezhetetlen vihar' },
  { id: 12, kph: { max: 999, min: 118 }, name: 'Armageddon' },
];

/** Name of the wind strength a speed falls into, or `null` if unmapped. */
export function getWindType(kph: number): WindType | null {
  const rounded = Math.round(kph);
  return (
    WIND_TYPES.find(
      (type) => rounded >= type.kph.min && rounded <= type.kph.max
    ) ?? null
  );
}
