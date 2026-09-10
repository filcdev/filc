import { Group, Mesh, PlaneGeometry, Vector3 } from 'three';
import { ownFillMat, tagApp } from '../kiosk/materials';
import { KIOSK_OPACITY, kioskStoreyColor } from '../kiosk/palette';
import type { KioskNode } from '../kiosk/types';
import { GetBuildingBounds } from '../scene/bounds';
import type { FullGraph } from '../types/full-graph';
import type { Building } from '../types/navigator/building';
import type { StoreyResolver } from '../types/storey-types';
import { makeKioskBadge } from './badge';

const FLOOR_MARGIN = 2;

/** One floor plate (+ storey badge) for a building+storey. The plate is
 *  the pickable surface a user taps to isolate the floor. */
export function buildFloorNode(
  b: Building,
  storey: number,
  graph: FullGraph,
  storeys: StoreyResolver
): KioskNode {
  const raw = GetBuildingBounds(b, graph);
  const bounds = {
    h: raw.h + FLOOR_MARGIN * 2,
    w: raw.w + FLOOR_MARGIN * 2,
    x: raw.x - FLOOR_MARGIN,
    y: raw.y - FLOOR_MARGIN,
  };
  const floorPos = storeys.bottomY(b.id, storey);
  const color = kioskStoreyColor(storey);

  const group = new Group();

  const plate = new Mesh(
    new PlaneGeometry(bounds.w, bounds.h),
    ownFillMat(color, KIOSK_OPACITY.floorPlate)
  );
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(
    bounds.x + bounds.w * 0.5,
    floorPos - 0.01,
    bounds.y + bounds.h * 0.5
  );
  plate.renderOrder = -1;
  tagApp(plate, 'plate', color, KIOSK_OPACITY.floorPlate);
  group.add(plate);

  const badge = makeKioskBadge(storey, 0xdd_dd_dd);
  badge.position.set(bounds.x, floorPos + 1, bounds.y);
  badge.scale.set(5, 5, 1);
  group.add(badge);

  return {
    appearance: [plate],
    buildingId: b.id,
    center: new Vector3(plate.position.x, floorPos, plate.position.z),
    id: b.id,
    kind: 'floor',
    object: group,
    pickables: [],
    storey,
  };
}
