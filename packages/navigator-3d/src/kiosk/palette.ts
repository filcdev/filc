import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import { COLORS, STOREY_PALETTE } from '../types/three/color-types';

/** Kiosk accent colors. Selection endpoints reuse the path overlay's
 *  cyan/pink so the 3D markers and the route line agree. */
export const KIOSK_COLORS = {
  classroomFallback: 0x6f_8a_a8,
  corridor: COLORS.corridor,
  end: 0xff_55_77,
  floorPlate: STOREY_PALETTE,
  highlight: 0xff_e1_4d,
  lift: COLORS.lift,
  stairs: COLORS.stairs,
  start: 0x55_dd_ff,
  yard: COLORS.yard,
};

/** Base alpha per role, before any state factor. Tuned so floor plates
 *  read as ground, rooms read as solid, lines stay crisp. */
export const KIOSK_OPACITY = {
  deck: 0.7,
  door: 0.85,
  doorLine: 0.9,
  fill: 1.0,
  floorPlate: 0.18,
  line: 0.85,
};

export function kioskStoreyColor(storey: number): number {
  const palette = KIOSK_COLORS.floorPlate;
  const n = palette.length;
  const color = palette[((storey % n) + n) % n];
  // The palette is a fixed five-entry list, so this only guards a bad import.
  return color ?? COLORS.corridor;
}

/** Classroom base color from its type's colorhex, with a neutral
 *  fallback when the type is missing or has no usable color. */
export function kioskTypeColor(graph: FullGraph, typeId: string): number {
  const type = graph.classroom_types.find((t) => t.id === typeId);
  if (!type?.colorhex) {
    return KIOSK_COLORS.classroomFallback;
  }
  const parsed = Number(type.colorhex.replace('#', '0x').slice(0, 8));
  return Number.isFinite(parsed) ? parsed : KIOSK_COLORS.classroomFallback;
}

/** Darken a packed 24-bit `0xRRGGBB` color. */
export function darkenColor(hex: number, factor = 0.8) {
  // biome-ignore lint/suspicious/noBitwiseOperators: packed 24-bit RGB channel maths
  const r = ((hex >> 16) & 255) * factor;
  // biome-ignore lint/suspicious/noBitwiseOperators: packed 24-bit RGB channel maths
  const g = ((hex >> 8) & 255) * factor;
  // biome-ignore lint/suspicious/noBitwiseOperators: packed 24-bit RGB channel maths
  const b = (hex & 255) * factor;

  // biome-ignore lint/suspicious/noBitwiseOperators: packed 24-bit RGB channel maths
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
