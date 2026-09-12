export type StoreyResolver = {
  /** Bottom Y of `storey` for `buildingId`. */
  bottomY: (buildingId: string, storey: number) => number;
  /** Height of `storey` for `buildingId`. */
  height: (buildingId: string, storey: number) => number;
};
