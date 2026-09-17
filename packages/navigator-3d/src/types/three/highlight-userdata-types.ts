/** Typed userData payloads attached to the highlighted anchor of each
 *  entity kind. The gizmo layer reads these to size and position its
 *  handles without re-walking the graph. */

export type ClassroomHighlightUserData = {
  isHighlight: true;
  highlightKind: 'classroom';
  size_x: number;
  size_y: number;
  size_z: number;
  boxH: number;
  x: number;
  y: number;
  rotation: number;
};

export type BuildingHighlightUserData = {
  isHighlight: true;
  highlightKind: 'building';
  x: number;
  y: number;
};

export type CorridorHighlightUserData = {
  isHighlight: true;
  highlightKind: 'corridor';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  length: number;
};

export type LiftHighlightUserData = {
  isHighlight: true;
  highlightKind: 'lift';
  x: number;
  y: number;
  min_storey: number;
  max_storey: number;
  bottom_y: number;
  top_y: number;
};

export type StairsHighlightUserData = {
  isHighlight: true;
  highlightKind: 'stairs';
  x: number;
  y: number;
  min_storey: number;
  max_storey: number;
  rotation: number;
  bottom_y: number;
  top_y: number;
};

export type HighlightUserData =
  | ClassroomHighlightUserData
  | BuildingHighlightUserData
  | CorridorHighlightUserData
  | LiftHighlightUserData
  | StairsHighlightUserData;
