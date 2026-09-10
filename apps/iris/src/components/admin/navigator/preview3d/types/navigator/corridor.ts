export type Corridor = {
  id: string;
  name: string;
  storey: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  barrier_free: boolean;
  is_outdoor: boolean;
  building_id: string;
};
