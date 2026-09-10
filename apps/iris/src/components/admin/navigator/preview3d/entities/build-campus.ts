import { Group } from 'three';
import type { KioskCampus, KioskNode } from '../kiosk/types';
import { computeCampusCenter } from '../scene/bounds';
import { buildStoreyResolver } from '../scene/storey-resolver';
import type { FullGraph } from '../types/full-graph';
import { getClassroomsInBuilding, getValidStoreys } from './building-helpers';
import { buildClassroomNode } from './classroom-node';
import { buildCorridorNode } from './corridor-node';
import { buildFloorNode } from './floor-node';
import { buildLiftNode, buildStairsNode } from './vertical-node';

/** Build the whole campus once, neutral. Every storey of every building
 *  is present and visible — floor isolation and highlighting are applied
 *  later by the appearance layer without touching geometry. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: single pass building every entity kind
export function buildKioskCampus(graph: FullGraph): KioskCampus {
  const root = new Group();
  const nodes: KioskNode[] = [];
  const storeys = buildStoreyResolver(graph.classrooms);
  const buildingsById = new Map(graph.buildings.map((b) => [b.id, b]));

  for (const b of graph.buildings) {
    const rooms = getClassroomsInBuilding(graph, b);
    for (const storey of getValidStoreys(rooms)) {
      nodes.push(buildFloorNode(b, storey, graph, storeys));
    }
  }

  for (const c of graph.classrooms) {
    const b = buildingsById.get(c.building_id);
    if (b) {
      nodes.push(buildClassroomNode(c, b, graph, storeys));
    }
  }

  for (const cor of graph.corridors) {
    const b = buildingsById.get(cor.building_id);
    if (!b) {
      continue;
    }
    const node = buildCorridorNode(cor, b, storeys);
    if (node) {
      nodes.push(node);
    }
  }

  for (const lift of graph.lifts) {
    const b = buildingsById.get(lift.building_id);
    if (!b) {
      continue;
    }
    const node = buildLiftNode(lift, b, storeys);
    if (node) {
      nodes.push(node);
    }
  }

  for (const s of graph.stairs) {
    const b = buildingsById.get(s.building_id);
    if (!b) {
      continue;
    }
    const node = buildStairsNode(s, b, storeys);
    if (node) {
      nodes.push(node);
    }
  }

  for (const node of nodes) {
    root.add(node.object);
  }

  const center = computeCampusCenter(graph);
  root.position.set(-center.x, 0, -center.y);

  return { nodes, root };
}
