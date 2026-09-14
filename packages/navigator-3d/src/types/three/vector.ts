export type Vec3 = { x: number; y: number; z: number };

export function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function Vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function Vec3Length(vec: Vec3) {
  return Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
}

export function Vec3Normalize(vec: Vec3): Vec3 {
  const len = Vec3Length(vec);
  return { x: vec.x / len, y: vec.y / len, z: vec.z / len };
}

export function Vec3GetDirVector(start: Vec3, end: Vec3): Vec3 {
  const sub = Vec3Sub(end, start);
  return Vec3Normalize(sub);
}

export class Vec2 {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  add(v: Vec2) {
    return new Vec2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vec2) {
    return new Vec2(this.x - v.x, this.y - v.y);
  }

  mul(s: number) {
    return new Vec2(this.x * s, this.y * s);
  }

  dot(v: Vec2) {
    return this.x * v.x + this.y * v.y;
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  normalize() {
    const len = this.length();
    return len === 0 ? new Vec2(0, 0) : this.mul(1 / len);
  }

  perp() {
    return new Vec2(-this.y, this.x);
  }
}
