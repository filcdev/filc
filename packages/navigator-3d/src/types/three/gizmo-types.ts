import type * as THREE from 'three';

/** Partial patch emitted while dragging a handle. The parent
 *  component folds it back into form state, which feeds the
 *  preview merge, which rebuilds the scene — so handles visibly
 *  track the cursor as a side effect of the data flow.
 *
 *  Different highlight kinds use different subsets:
 *    - classroom: size_x/y/z, x/y
 *    - building:  x, y
 *    - lift / stairs: x, y, min_storey, max_storey
 *    - corridor:  x1, y1, x2, y2, width
 */
export type ResizePatch = {
  size_x?: number;
  size_y?: number;
  size_z?: number;
  /** Classroom door angle, in degrees (real number — not constrained
   *  to 0/90/180/270 anymore). */
  rotation?: number;
  x?: number;
  y?: number;
  min_storey?: number;
  max_storey?: number;
  /** Stair angle around Y, in degrees. */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  width?: number;
};

export type ResizeHandleSpec = {
  kind: 'resize';
  axis: 'x' | 'y' | 'z';
  side: 1 | -1;
  sizeKey: 'size_x' | 'size_y' | 'size_z';
  /** "symmetric" handles grow/shrink the room from both sides at
   *  once (the +X handle moves 1m, the -X face also moves 1m, so
   *  the total size delta is 2 × the drag). "anchored" handles
   *  only move their own face. */
  mode: 'symmetric' | 'anchored';
};

export type TranslateHandleSpec = { kind: 'translate' };

/** Translate the entity in the XY (floor) plane. `xKey`/`yKey` name
 *  the userData fields that hold the *current* position; the matching
 *  patch fields name the keys we emit. Lets the same handler drive
 *  building (x,y), lift/stairs (x,y), corridor endpoints (x1/y1, x2/y2),
 *  and any future 2D-anchored entity. */
export type TranslateXYHandleSpec = {
  kind: 'translate-xy';
  /** userData keys holding start values (numbers). */
  xKey: string;
  yKey: string;
  /** ResizePatch keys to emit. */
  patchXKey: 'x' | 'x1' | 'x2' | 'x';
  patchYKey: 'y' | 'y1' | 'y2' | 'y';
};

/** Vertical drag that snaps to integer storey deltas. `side === +1`
 *  edits max_storey (top arrow); `side === -1` edits min_storey
 *  (bottom arrow). Clamped so min_storey never crosses max_storey. */
export type StoreyHandleSpec = {
  kind: 'storey';
  side: 1 | -1;
};

/** Symmetric corridor-width arrow. Drag perpendicular to the
 *  corridor's centerline; the perpendicular direction is captured
 *  on drag start (in world space) so the corridor can be aimed in
 *  any direction. */
export type CorridorWidthHandleSpec = {
  kind: 'corridor-width';
};

/** Rotate around the world Y axis. Drag the ring; the angle is
 *  computed from the cursor's bearing relative to the anchor in
 *  the XZ plane. `patchKey` is the field the patch should set:
 *  `rotation` for classrooms, `rotation` for stairs. */
export type RotateHandleSpec = {
  kind: 'rotate';
  patchKey: 'rotation' | 'rotation';
};

export type HandleSpec =
  | ResizeHandleSpec
  | TranslateHandleSpec
  | TranslateXYHandleSpec
  | StoreyHandleSpec
  | CorridorWidthHandleSpec
  | RotateHandleSpec;

export type ResizeDragState = {
  kind: 'resize';
  spec: ResizeHandleSpec;
  /** World-space unit vector along which dragging moves the
   *  handle. Captured at drag start so the room can rotate or
   *  re-center mid-drag without invalidating the math. */
  worldAxis: THREE.Vector3;
  startHandlePos: THREE.Vector3;
  startSize: number;
};
export type TranslateDragState = {
  kind: 'translate';
  startDoorX: number;
  startDoorY: number;
  startWorldHit: THREE.Vector3;
  floorY: number;
};
/** Floor-plane translate for buildings, lift/stairs anchors, and
 *  corridor endpoints. Re-uses the flat-plane math from the
 *  classroom translate but pulls start values from arbitrary
 *  userData keys named by the spec. */
export type TranslateXYDragState = {
  kind: 'translate-xy';
  spec: TranslateXYHandleSpec;
  startX: number;
  startY: number;
  startWorldHit: THREE.Vector3;
  floorY: number;
};
export type StoreyDragState = {
  kind: 'storey';
  spec: StoreyHandleSpec;
  /** World-space vertical line (anchor + up-axis) the cursor projects onto. */
  anchor: THREE.Vector3;
  startMinStorey: number;
  startMaxStorey: number;
  startHandleY: number;
};

export type CorridorWidthDragState = {
  kind: 'corridor-width';
  /** Perpendicular world axis along which dragging widens the corridor. */
  worldAxis: THREE.Vector3;
  startHandlePos: THREE.Vector3;
  startWidth: number;
};

export type RotateDragState = {
  kind: 'rotate';
  spec: RotateHandleSpec;
  /** World-space center of the rotation (target's anchor in XZ). */
  centerXZ: THREE.Vector2;
  /** Y of the floor plane the cursor is projected onto. */
  floorY: number;
  /** Cursor bearing at drag start (atan2 around centerXZ). */
  startCursorAngle: number;
  /** Target's rotation value at drag start, in degrees. */
  startRotationDeg: number;
};

export type DragState =
  | ResizeDragState
  | TranslateDragState
  | TranslateXYDragState
  | StoreyDragState
  | CorridorWidthDragState
  | RotateDragState;
