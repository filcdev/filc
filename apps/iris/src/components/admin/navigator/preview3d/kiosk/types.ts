import type * as THREE from 'three';

/** What a kiosk node represents. Mirrors the graph entity kinds the
 *  kiosk cares about (floors are synthesized per building+storey). */
export type KioskNodeKind =
  | 'floor'
  | 'classroom'
  | 'corridor'
  | 'lift'
  | 'stairs';

/** One addressable thing in the kiosk scene. Geometry is built once and
 *  never rebuilt for appearance/selection changes — the appearance layer
 *  mutates the tagged sub-meshes in place, and the interaction layer
 *  raycasts the pickables. */
export type KioskNode = {
  kind: KioskNodeKind;
  /** Entity id. For floors this is the building id (storey lives in `storey`). */
  id: string;
  buildingId: string;
  /** Single storey for floor/classroom/corridor. */
  storey?: number;
  /** Storey span for lift/stairs. */
  storeyMin?: number;
  storeyMax?: number;
  /** Classroom type id — lets the appearance layer highlight by type
   *  without a graph lookup. Only set for classroom nodes. */
  typeId?: string;
  /** Visibility container — toggled by the appearance layer. */
  object: THREE.Object3D;
  /** Meshes tagged with `userData.app` that the appearance layer recolors. */
  appearance: THREE.Object3D[];
  /** Meshes the interaction layer raycasts against. */
  pickables: THREE.Object3D[];
  /** Center in root-local space, used by the camera rig to frame a floor. */
  center: THREE.Vector3;
};

/** Result of one campus build. */
export type KioskCampus = {
  root: THREE.Group;
  nodes: KioskNode[];
};

/** Which floor (building + storey) is isolated. `null` shows the whole campus. */
export type IsolatedFloor = { buildingId: string; storey: number } | null;

/** Selection endpoints, owned by the parent. Each is a classroom id. */
export type KioskSelection = { start?: string | null; end?: string | null };

/** Declarative description of how classrooms should be emphasized. Both
 *  filters are additive (a room matches if it is in either set). */
export type KioskHighlight = {
  typeIds?: string[];
  classroomIds?: string[];
  /** When true, non-matching classrooms are dimmed instead of left at base. */
  dimOthers?: boolean;
};

/** The full appearance state the overlay layer applies each frame. */
export type KioskAppearance = {
  isolatedFloor: IsolatedFloor;
  selection?: KioskSelection;
  highlight?: KioskHighlight;
};
