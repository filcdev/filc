/**
 * The ticker's "nothing to show" mascot. Vendored from Tabler Icons (MIT,
 * `pacman` v1.39, unicode eebc) because lucide has no pacman, and the empty
 * tables are better served by one glyph that matches lucide's stroke style than
 * by a second icon library. Same 24px box, 2px round strokes and
 * `currentColor` as the lucide icons it sits next to.
 */
export function Pacman({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6.636 5.636a9 9 0 0 1 13.397 .747l-5.619 5.617l5.619 5.617a9 9 0 1 1 -13.397 -11.981" />
      <path d="M11.5 7.5a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
    </svg>
  );
}
