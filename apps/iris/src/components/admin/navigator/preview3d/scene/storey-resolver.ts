import type { Classroom } from '../types/navigator/classroom';
import type { StoreyResolver } from '../types/storey-types';

export const FLOOR_GAP = 30;

// Per-building storey stack: storey N+1 sits on the cumulative sum of
// storeys 0..N. Storey height = tallest room on that storey (+1m headroom),
// capped to FLOOR_HEIGHT. Storeys without rooms fall back to FLOOR_HEIGHT.
export function buildStoreyResolver(classrooms: Classroom[]): StoreyResolver {
  const heightOf = (bid: string, storey: number): number => {
    let maxH = 0;
    for (const c of classrooms) {
      if (c.building_id === bid && c.storey === storey && c.size_z > maxH) {
        maxH = c.size_z;
      }
    }
    return maxH;
  };

  const bottomCache = new Map<string, Map<number, number>>();
  const bottomOf = (bid: string, storey: number): number => {
    let perBuilding = bottomCache.get(bid);
    if (!perBuilding) {
      perBuilding = new Map();
      bottomCache.set(bid, perBuilding);
    }

    let startPos = 0;
    if (storey >= 0) {
      for (let i = 0; i < storey; i++) {
        startPos += heightOf(bid, i) + FLOOR_GAP;
      }
    } else {
      for (let i = -1; i >= storey; i--) {
        startPos -= heightOf(bid, i) + FLOOR_GAP;
      }
    }

    perBuilding.set(storey, startPos);
    return startPos;
  };

  return { bottomY: bottomOf, height: heightOf };
}
