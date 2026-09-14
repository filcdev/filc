import { dist, type Vec3 } from '../types/three/vector';

class MinHeap<T> {
  private readonly data: { key: number; value: T }[] = [];

  push(key: number, value: T): void {
    this.data.push({ key, value });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    const top = this.data[0];
    if (!top) {
      return undefined;
    }
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top.value;
  }

  get size(): number {
    return this.data.length;
  }

  private bubbleUp(i: number): void {
    let index = i;
    while (index > 0) {
      // Parent index — plain integer halving.
      const parent = Math.floor((index - 1) / 2);
      const parentNode = this.data[parent];
      const node = this.data[index];
      if (!(parentNode && node) || parentNode.key <= node.key) {
        break;
      }
      this.data[parent] = node;
      this.data[index] = parentNode;
      index = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    let index = i;
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = index * 2 + 2;
      let smallest = index;

      const node = this.data[index];
      let smallestNode = node;
      const left = this.data[leftIndex];
      const right = this.data[rightIndex];

      if (
        smallestNode &&
        left &&
        leftIndex < n &&
        left.key < smallestNode.key
      ) {
        smallest = leftIndex;
        smallestNode = left;
      }
      if (
        smallestNode &&
        right &&
        rightIndex < n &&
        right.key < smallestNode.key
      ) {
        smallest = rightIndex;
        smallestNode = right;
      }

      if (smallest === index || !node || !smallestNode) {
        break;
      }

      this.data[smallest] = node;
      this.data[index] = smallestNode;
      index = smallest;
    }
  }
}

export class Astar {
  private nextId = 0;
  private readonly points = new Map<number, Vec3>();
  private readonly adj = new Map<number, Set<number>>();

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported A* search loop, kept verbatim
  findPath(start: number, goal: number): Vec3[] {
    const startPos = this.points.get(start);
    if (!startPos) {
      return [];
    }

    if (start === goal) {
      return [startPos];
    }

    const goalPos = this.points.get(goal);
    if (!goalPos) {
      return [];
    }

    const gScore = new Map<number, number>();
    const cameFrom = new Map<number, number>();
    const open = new MinHeap<number>();

    gScore.set(start, 0);
    open.push(dist(startPos, goalPos), start);

    while (open.size > 0) {
      const current = open.pop();
      if (current === undefined) {
        break;
      }
      if (current === goal) {
        return this.reconstruct(cameFrom, current);
      }

      const curPos = this.points.get(current);
      const curG = gScore.get(current);
      if (!curPos || curG === undefined) {
        continue;
      }

      for (const neighbor of this.adj.get(current) ?? new Set<number>()) {
        const neiPos = this.points.get(neighbor);
        if (!neiPos) {
          continue;
        }
        const tentative = curG + dist(curPos, neiPos);
        const existing = gScore.get(neighbor);
        if (existing === undefined || tentative < existing) {
          gScore.set(neighbor, tentative);
          cameFrom.set(neighbor, current);
          open.push(tentative + dist(neiPos, goalPos), neighbor);
        }
      }
    }

    return [];
  }

  private reconstruct(cameFrom: Map<number, number>, end: number): Vec3[] {
    const ids: number[] = [end];
    let cur = end;
    while (true) {
      const prev = cameFrom.get(cur);
      if (prev === undefined) {
        break;
      }
      cur = prev;
      ids.push(cur);
    }
    ids.reverse();

    const out: Vec3[] = [];
    for (const id of ids) {
      const point = this.points.get(id);
      if (point) {
        out.push(point);
      }
    }
    return out;
  }

  getAdj(): Map<number, Set<number>> {
    return this.adj;
  }

  getPoints(): Map<number, Vec3> {
    return this.points;
  }

  addPoint(pos: Vec3): number {
    const id = this.nextId++;
    this.points.set(id, pos);
    this.adj.set(id, new Set());
    return id;
  }

  getPoint(id: number): Vec3 | undefined {
    return this.points.get(id);
  }

  connect(a: number, b: number): void {
    this.adj.get(a)?.add(b);
    this.adj.get(b)?.add(a);
  }
}
