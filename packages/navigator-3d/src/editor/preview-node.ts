import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import { buildClassroomNode } from '../entities/classroom-node';
import { buildCorridorNode } from '../entities/corridor-node';
import { buildLiftNode, buildStairsNode } from '../entities/vertical-node';
import type { KioskNode } from '../kiosk/types';
import type { StoreyResolver } from '../types/three/storey-types';
import type { MergedEntity } from './merge';

/** Build a single kiosk node for the merged (in-flight) entity so the edit
 *  renders live. Returns null for buildings (no kiosk node — a building
 *  move is previewed by translating its existing nodes instead) and when
 *  the owning building is unknown. */
export function buildPreviewNode(
  merged: MergedEntity,
  graph: FullGraph,
  storeys: StoreyResolver
): KioskNode | null {
  if (merged.kind === 'building') {
    return null;
  }

  const b = graph.buildings.find((x) => x.id === merged.entity.building_id);
  if (!b) {
    return null;
  }

  switch (merged.kind) {
    case 'classroom':
      return buildClassroomNode(merged.entity, b, graph, storeys);
    case 'corridor':
      return buildCorridorNode(merged.entity, b, storeys);
    case 'lift':
      return buildLiftNode(merged.entity, b, storeys);
    case 'stairs':
      return buildStairsNode(merged.entity, b, storeys);
    default:
      return null;
  }
}
