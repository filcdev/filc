/**
 * Decorative art for the site theme picker. Illustrations are Twemoji SVGs
 * (CC-BY 4.0 — see `apps/iris/public/assets/themes/ATTRIBUTION.md`) committed
 * as static assets under `/assets/themes/…`, layered over a theme-coloured
 * gradient wash. The parent supplies sizing via `className` (`absolute inset-0
 * h-full w-full` in the hero, `h-full w-full` in a card), so every layer is
 * positioned in percentages of the container and composes at both sizes.
 */

import { cn } from '@filcdev/ui/lib/utils';

type ArtProps = { className?: string };

export function DefaultArt({ className }: ArtProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none overflow-hidden bg-gradient-to-br from-teal-500/25 via-teal-600/5 to-teal-700/10',
        className
      )}
    >
      <div className="absolute top-[18%] right-[4%] h-[110%] w-[40%] rounded-full bg-teal-500/15" />
      <div className="absolute top-[8%] right-[16%] h-[72%] w-[24%] rounded-full bg-teal-400/20" />
      <div className="absolute bottom-[2%] left-[6%] h-[62%] w-[22%] rounded-full bg-teal-600/12" />
    </div>
  );
}

export function HalloweenArt({ className }: ArtProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none overflow-hidden bg-gradient-to-br from-violet-600/20 via-orange-500/10 to-orange-600/15',
        className
      )}
    >
      <img
        alt=""
        className="absolute bottom-[-6%] left-1/2 h-[76%] w-auto -translate-x-1/2"
        draggable={false}
        height={36}
        src="/assets/themes/halloween/pumpkin.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute top-[6%] left-[3%] h-[36%] w-auto -rotate-12"
        draggable={false}
        height={36}
        src="/assets/themes/halloween/bat.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute top-[5%] right-[5%] h-[32%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/halloween/moon.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute top-[38%] right-[14%] h-[38%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/halloween/ghost.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute top-[16%] left-[34%] h-[14%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/halloween/star.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute bottom-[4%] left-[2%] h-[30%] w-auto opacity-90"
        draggable={false}
        height={36}
        src="/assets/themes/halloween/spider-web.svg"
        width={36}
      />
    </div>
  );
}

export function ChristmasArt({ className }: ArtProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none overflow-hidden bg-gradient-to-br from-green-600/15 via-sky-500/10 to-sky-600/15',
        className
      )}
    >
      <img
        alt=""
        className="absolute right-[2%] -bottom-[6%] h-[85%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/christmas/tree.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute top-[0%] right-[13%] h-[16%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/christmas/star.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute bottom-[-2%] left-[4%] h-[42%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/christmas/snowman.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute bottom-[2%] left-[38%] h-[38%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/christmas/gift.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute top-[8%] left-[18%] h-[16%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/christmas/snowflake.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute top-[30%] left-[40%] h-[10%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/christmas/snowflake.svg"
        width={36}
      />
      <img
        alt=""
        className="absolute top-[14%] right-[30%] h-[13%] w-auto"
        draggable={false}
        height={36}
        src="/assets/themes/christmas/snowflake.svg"
        width={36}
      />
    </div>
  );
}
