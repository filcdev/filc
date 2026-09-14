import { FLOOR_HEIGHT } from '../types/three/material-types';
import type { StoreyResolver } from '../types/three/storey-types';

export type ShaftBounds = {
  bottom: number;
  top: number;
  height: number;
};

// Shaft spans from min_storey bottom to max_storey top minus 1m of
// headroom so the box doesn't butt into the next floor's slab.
export function computeShaftBounds(
  buildingId: string,
  storeys: StoreyResolver,
  minStorey: number,
  maxStorey: number
): ShaftBounds {
  const bottom = storeys.bottomY(buildingId, minStorey);
  const top = storeys.bottomY(buildingId, maxStorey);
  return { bottom, height: Math.max(0, top - bottom + FLOOR_HEIGHT), top };
}
