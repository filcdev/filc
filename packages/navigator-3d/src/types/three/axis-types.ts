export type Axis = {
  label: 'X' | 'Y' | 'Z' | '-X' | '-Y' | '-Z';
  color: string;
  /** World-space unit vector for this axis tip. */
  dir: [number, number, number];
  /** Filled labelled disc on the + side, hollow ring on the −. */
  positive: boolean;
};

export const AXES: Axis[] = [
  { color: '#ef4444', dir: [1, 0, 0], label: 'X', positive: true },
  { color: '#ef4444', dir: [-1, 0, 0], label: '-X', positive: false },
  { color: '#22c55e', dir: [0, 1, 0], label: 'Y', positive: true },
  { color: '#22c55e', dir: [0, -1, 0], label: '-Y', positive: false },
  { color: '#3b82f6', dir: [0, 0, 1], label: 'Z', positive: true },
  { color: '#3b82f6', dir: [0, 0, -1], label: '-Z', positive: false },
];
