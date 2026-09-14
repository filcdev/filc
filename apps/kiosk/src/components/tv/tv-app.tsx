import type { DepartureGroup } from '@filcdev/api/domains/kiosk/config';
import { DepartureContainer } from '@/components/tv/departure-container';
import { Header } from '@/components/tv/header';
import { RoomSubstitution } from '@/components/tv/room-substitutions';
import { Substitutions } from '@/components/tv/substitutions';
import { Weather } from '@/components/tv/weather';
import type { NewsTakeoverPolicy } from '@/hooks/tv';

type TvAppProps = {
  /** The kiosk's configured departure cards. */
  departures: DepartureGroup[];
  /** Which announcements this box presents full screen instead of scrolling. */
  newsPolicy: NewsTakeoverPolicy;
};

/** The PetrikTV ticker layout: departures, weather and room changes on the
 *  left, the substitution board on the right, the header on top. */
export function TvApp({ departures, newsPolicy }: TvAppProps) {
  return (
    // Every board inside is `h-full`/`1fr`, so the chain must be bounded here:
    // `.tv main` is zoomed 190%, and without `min-h-0` the grid grows to its
    // content and pushes the ticker off the bottom of the screen.
    <main className="flex h-full w-full flex-col overflow-hidden bg-radial from-primary to-secondary py-2 text-foreground">
      <div className="box mx-2 mb-2 flex shrink-0 flex-row justify-between p-1 px-2.5">
        <Header newsPolicy={newsPolicy} />
      </div>

      <div className="mx-1.5 grid min-h-0 flex-grow grid-cols-3 gap-1.5">
        {/* The weather line is one row of text: sized to its content so the
            departures and room changes keep the height they need. */}
        <div className="col-span-1 flex min-h-0 flex-col gap-1.5">
          <div className="box flex min-h-0 flex-col gap-2 overflow-hidden py-2">
            <DepartureContainer groups={departures} />
          </div>

          <div className="box min-h-0 overflow-hidden">
            <Weather />
          </div>

          <div className="box row-span-2 min-h-0 grow overflow-hidden">
            <RoomSubstitution />
          </div>
        </div>

        <div className="box col-span-2 row-span-1 min-h-0 overflow-hidden">
          <Substitutions />
        </div>
      </div>
    </main>
  );
}
