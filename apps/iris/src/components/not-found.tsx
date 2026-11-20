import { Button } from '@filcdev/ui/components/button';
import { Link } from '@tanstack/react-router';
import { GraduationCap } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Static, self-contained artwork for the 404 page. Everything is inline SVG —
 * there is no image file to download, drag around or animate.
 */
function NotFoundBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
      preserveAspectRatio="none"
      viewBox="0 0 1440 900"
    >
      <defs>
        <linearGradient id="nf-wave-back" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#123a27" />
          <stop offset="100%" stopColor="#0a1b12" />
        </linearGradient>
        <linearGradient id="nf-wave-front" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#164a30" />
          <stop offset="50%" stopColor="#0d2b1c" />
          <stop offset="100%" stopColor="#1a5236" />
        </linearGradient>
        <filter id="nf-grain">
          <feTurbulence
            baseFrequency="0.75"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      <rect fill="#0a1c13" height="900" width="1440" />
      <path
        d="M0 620C260 540 420 700 700 620s430-120 740-20v300H0z"
        fill="url(#nf-wave-back)"
        opacity="0.55"
      />
      <path
        d="M0 740C250 660 480 800 760 720s410-80 680-10v190H0z"
        fill="url(#nf-wave-front)"
        opacity="0.5"
      />
      <rect filter="url(#nf-grain)" height="900" opacity="0.06" width="1440" />
    </svg>
  );
}

function ClassroomChair({
  scale = 1,
  x,
  y,
}: {
  scale?: number;
  x: number;
  y: number;
}) {
  return (
    <g
      stroke="#4f8f69"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      transform={`translate(${x} ${y}) scale(${scale})`}
    >
      {/* Tapered backrest with two slats */}
      <path d="M8 0 L62 -3 L60 36 L10 38 Z" fill="#102c1d" />
      <path d="M13 11 L59 9 M12 25 L59 23" stroke="#3d7857" strokeWidth="2" />
      {/* Seat, back posts and legs down to the floor */}
      <path d="M4 52 L70 50 L64 65 L10 67 Z" fill="#163d28" />
      <path d="M11 38 L10 52 M60 36 L61 52" />
      <path d="M12 67 L8 98 M63 65 L67 98 M22 66 L24 92" />
      <path d="M11 87 L64 86" stroke="#3d7857" strokeWidth="2" />
    </g>
  );
}

function NotFoundScene() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none h-auto w-full max-w-xl select-none"
      fill="none"
      viewBox="0 0 720 380"
    >
      <defs>
        <linearGradient id="nf-beam" x1="0" x2="0.7" y1="0" y2="1">
          <stop offset="0%" stopColor="#e2ffec" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#8fe0aa" stopOpacity="0" />
        </linearGradient>
        <radialGradient cx="50%" cy="50%" id="nf-floor-glow" r="50%">
          <stop offset="0%" stopColor="#a6f5c1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#a6f5c1" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Floor and its sketchy shading */}
      <ellipse cx="370" cy="316" fill="url(#nf-floor-glow)" rx="290" ry="38" />
      <path
        d="M74 312c128 9 366 10 568-3"
        stroke="#4b8a64"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="m152 328 32 8m-78-2 20 5m398-11 34 6m-78-2 24 5"
        stroke="#3d7857"
        strokeLinecap="round"
        strokeWidth="2"
      />

      {/* Empty blackboard on the right */}
      <g stroke="#5b9c78" strokeLinejoin="round" strokeWidth="3">
        <path d="M520 116h146v110H520z" fill="#0b2116" />
        <path d="M529 125h128v92H529z" stroke="#244c35" strokeWidth="2" />
        <path d="M548 226v20m90-20v20" />
      </g>

      {/* A couple of chairs pushed together on the left */}
      <ClassroomChair scale={0.92} x={142} y={222} />
      <ClassroomChair x={78} y={218} />

      {/* Flashlight beam, painted behind the student */}
      <path d="m450 248 112 52-86 18-40-56z" fill="url(#nf-beam)" />

      {/* Bewildered student */}
      <g
        stroke="#c6f7d8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      >
        {/* Hood and head */}
        <path
          d="M326 160c3-27 21-42 43-42s40 15 43 42l-13 15h-60z"
          fill="#1d4a32"
        />
        <path
          d="M338 155c0-19 13-33 31-33s31 14 31 33-13 35-31 35-31-16-31-35z"
          fill="#f0c78e"
        />
        <path
          d="M337 150c2-21 15-31 32-31s30 11 32 29c-11-8-22-10-32-8-13 2-23 6-32 10z"
          fill="#1a3b28"
          stroke="#1a3b28"
        />
        {/* Confused face */}
        <path d="m349 150 11-3m31 3-11-3" strokeWidth="2" />
        <path d="M356 165h4m22 0h4" strokeWidth="4" />
        <path d="M365 179c5-4 11-4 16 0" strokeWidth="2" />
        {/* Hoodie, arms and legs */}
        <path
          d="M330 191c-12 6-18 20-20 40l-4 55h88l-4-55c-2-20-8-34-20-40"
          fill="#235c3d"
        />
        <path d="M343 194c10 8 26 8 36 0" strokeWidth="2" />
        <path d="M360 203v40" stroke="#a9e3bf" strokeWidth="2" />
        <path d="M315 205c-10 16-14 32-12 47m101-47c11 14 19 26 25 38" />
        <path d="m340 286-8 50m48-50 8 50" />
        <path d="M316 337h29m39 0h29" strokeWidth="8" />
      </g>

      {/* Flashlight in his hand */}
      <g stroke="#d7ffe6" strokeLinejoin="round" strokeWidth="2">
        <g transform="rotate(24 437 246)">
          <rect fill="#8bd6a5" height="14" rx="4" width="26" x="424" y="239" />
          <path d="M446 237h7v18h-7z" fill="#f7fff9" />
        </g>
      </g>

      {/* Bewilderment */}
      <g
        fill="#7fbc96"
        fontFamily="Outfit Variable, sans-serif"
        fontWeight="700"
      >
        <text fontSize="24" x="298" y="120">
          ?
        </text>
        <text fontSize="28" x="418" y="104">
          ?
        </text>
        <text fontSize="17" x="440" y="145">
          ?
        </text>
      </g>
    </svg>
  );
}

/** The router renders this inside the root shell, with i18n still available. */
export function NotFoundPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('notFound.pageTitle');
  }, [t]);

  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20 text-[#eafff1]">
      <NotFoundBackdrop />

      <div className="absolute top-6 left-6 flex items-center gap-2 text-[#d9f5e3]">
        <GraduationCap
          aria-hidden="true"
          className="size-8"
          strokeWidth={1.75}
        />
        <span className="font-semibold text-2xl">filc</span>
      </div>

      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <h1 className="-mb-4 font-extrabold text-[#f4fff8] text-[clamp(4.5rem,16vw,8rem)] leading-none tracking-tight">
          404
        </h1>
        <NotFoundScene />
        <h2 className="mt-8 font-bold text-3xl sm:text-4xl">
          {t('notFound.title')}
        </h2>
        <p className="mt-4 max-w-xl text-[#b9d5c3] leading-relaxed">
          {t('notFound.message')}
        </p>
        {/* Override the shared button's theme tokens with the mockup's mint. */}
        <Button
          className="mt-8 h-11 px-6 [--primary-foreground:#0c2a19] [--primary:#8df5b3] [--ring:#8df5b3]"
          render={<Link to="/" />}
          size="lg"
        >
          {t('notFound.returnToHome')}
        </Button>
      </div>

      <p className="mt-12 text-center text-[#4f8a68] text-sm">
        {t('notFound.footer', { code: 404 })}
      </p>
    </main>
  );
}
