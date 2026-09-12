import type { StoreyResolver } from '../types/storey-types';

const TARGET_RISE = 1.5;
const SEGMENT_MAX_RISE = 10;
const SEGMENT_RUN = 7;
const LANDING_DEPTH = 0.5;

export type StairProfile = [number, number][];

// Walks one floor of the switchback, mutating `state` and pushing points.
function emitFloor(
  profile: StairProfile,
  state: { px: number; py: number; dirX: number },
  floorBottom: number,
  floorTop: number
): void {
  const floorH = floorTop - floorBottom;
  if (floorH <= 0) {
    return;
  }

  const segCount = Math.max(1, Math.ceil(floorH / SEGMENT_MAX_RISE));
  const segRise = floorH / segCount;
  const stepsPerSeg = Math.max(2, Math.round(segRise / TARGET_RISE));
  const stepRise = segRise / stepsPerSeg;
  const stepRun = SEGMENT_RUN / stepsPerSeg;

  for (let seg = 0; seg < segCount; seg++) {
    for (let i = 0; i < stepsPerSeg; i++) {
      state.py += stepRise;
      profile.push([state.px, state.py]);
      state.px += state.dirX * stepRun;
      profile.push([state.px, state.py]);
    }
    state.px += state.dirX * LANDING_DEPTH;
    profile.push([state.px, state.py]);
    state.dirX = -state.dirX;
  }
}

// Continuous switchback profile from min_storey bottom up to max_storey
// arrival level, in the stair's local frame (px is offset from anchor).
export function buildStairProfile(
  buildingId: string,
  storeys: StoreyResolver,
  minStorey: number,
  maxStorey: number
): StairProfile {
  const profile: StairProfile = [];
  const totalBottom = storeys.bottomY(buildingId, minStorey);
  const totalTop = storeys.bottomY(buildingId, maxStorey);
  if (totalTop - totalBottom <= 0) {
    return profile;
  }

  const state = { dirX: 1, px: 0, py: totalBottom };
  profile.push([state.px, state.py]);
  for (let f = minStorey; f < maxStorey; f++) {
    emitFloor(
      profile,
      state,
      storeys.bottomY(buildingId, f),
      storeys.bottomY(buildingId, f + 1)
    );
  }
  return profile;
}
