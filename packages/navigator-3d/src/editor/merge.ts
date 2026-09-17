import type { Building } from '@filcdev/api/domains/navigator/building';
import type { Classroom } from '@filcdev/api/domains/navigator/classroom';
import type { Corridor } from '@filcdev/api/domains/navigator/corridor';
import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import type { Lift } from '@filcdev/api/domains/navigator/lift';
import type { Stair } from '@filcdev/api/domains/navigator/stair';
import type { EditTarget } from './types';

/** Placeholder id for an entity being created (not yet saved). */
const NEW_ID = '';

// New entities start unnamed; the admin form supplies the name on save.
const defaultClassroom = (graph: FullGraph): Classroom => ({
  building_id: graph.buildings[0]?.id ?? NEW_ID,
  capacity: 0,
  description: '',
  id: NEW_ID,
  mapped: false,
  name: '',
  rotation: 0,
  short: '',
  size_x: 6,
  size_y: 6,
  size_z: 3,
  storey: 0,
  type_id: NEW_ID,
  x: 0,
  y: 0,
});

const defaultBuilding = (): Building => ({
  description: '',
  id: NEW_ID,
  mapped: false,
  name: '',
  x: 0,
  y: 0,
});

const defaultLift = (graph: FullGraph): Lift => ({
  building_id: graph.buildings[0]?.id ?? NEW_ID,
  id: NEW_ID,
  max_storey: 1,
  min_storey: 0,
  name: '',
  x: 0,
  y: 0,
});

const defaultStair = (graph: FullGraph): Stair => ({
  ...defaultLift(graph),
  rotation: 0,
});

const defaultCorridor = (): Corridor => ({
  barrier_free: false,
  building_id: NEW_ID,
  id: NEW_ID,
  is_outdoor: false,
  name: '',
  storey: 0,
  width: 0,
  x1: 0,
  x2: 0,
  y1: 0,
  y2: 0,
});

/** The edited entity's saved state (if any) merged with the in-flight
 *  preview. Used to build the live preview node + gizmo anchor without
 *  rebuilding the whole campus. Never mutates the graph. */
export type MergedEntity =
  | { kind: 'classroom'; entity: Classroom }
  | { kind: 'building'; entity: Building }
  | { kind: 'lift'; entity: Lift }
  | { kind: 'stairs'; entity: Stair }
  | { kind: 'corridor'; entity: Corridor };

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported merge logic, kept verbatim
export function mergeEntity(
  graph: FullGraph,
  target: EditTarget
): MergedEntity {
  const id = target.id;
  // biome-ignore lint/style/useDefaultSwitchClause: exhaustive over EditTarget; a default would be dead code
  switch (target.kind) {
    case 'classroom': {
      const existing = id
        ? graph.classrooms.find((c) => c.id === id)
        : undefined;
      return {
        entity: { ...(existing ?? defaultClassroom(graph)), ...target.preview },
        kind: 'classroom',
      };
    }
    case 'building': {
      const existing = id
        ? graph.buildings.find((b) => b.id === id)
        : undefined;
      return {
        entity: { ...(existing ?? defaultBuilding()), ...target.preview },
        kind: 'building',
      };
    }
    case 'lift': {
      const existing = id ? graph.lifts.find((l) => l.id === id) : undefined;
      return {
        entity: { ...(existing ?? defaultLift(graph)), ...target.preview },
        kind: 'lift',
      };
    }
    case 'stairs': {
      const existing = id ? graph.stairs.find((s) => s.id === id) : undefined;
      return {
        entity: { ...(existing ?? defaultStair(graph)), ...target.preview },
        kind: 'stairs',
      };
    }
    case 'corridor': {
      const existing = id
        ? graph.corridors.find((c) => c.id === id)
        : undefined;
      return {
        entity: { ...(existing ?? defaultCorridor()), ...target.preview },
        kind: 'corridor',
      };
    }
  }
}
