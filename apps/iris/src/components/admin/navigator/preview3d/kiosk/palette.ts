import { Color } from 'three';
import { COLORS, STOREY_PALETTE } from '../types/color-types';
import type { FullGraph } from '../types/full-graph';

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
  const n = KIOSK_COLORS.floorPlate.length;
  const color = KIOSK_COLORS.floorPlate[((storey % n) + n) % n];
  return color ?? KIOSK_COLORS.classroomFallback;
}

/** Classroom base color from its type's colorhex, with a neutral
 *  fallback when the type is missing or has no usable color. */
export function kioskTypeColor(graph: FullGraph, typeId: string): number {
  const type = graph.classroom_types.find((t) => t.id === typeId);
  if (!type?.colorhex) {
    return KIOSK_COLORS.classroomFallback;
  }
  const hex = type.colorhex.replace('#', '').slice(0, 6);
  return new Color(`#${hex}`).getHex();
}

/** Darken a hex color by a factor in [0, 1]. */
export function darkenColor(hex: number, factor = 0.8): number {
  return new Color(hex).multiplyScalar(factor).getHex();
}
