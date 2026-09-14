import type { Building } from '@filcdev/api/domains/navigator/building';
import type { Classroom } from '@filcdev/api/domains/navigator/classroom';
import type { Corridor } from '@filcdev/api/domains/navigator/corridor';
import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
import type { Lift } from '@filcdev/api/domains/navigator/lift';
import type { MyLocation } from '@filcdev/api/domains/navigator/my-location';
import type { Stair } from '@filcdev/api/domains/navigator/stair';
import { floorPositionOf } from '../entities/building-helpers';
import { corridorsIntersect } from '../entities/corridor-helper';
import { dist, type Vec3 } from '../types/three/vector';
import { Astar } from './astar';

type Connector = (Lift | Stair) & { isLift: boolean };

const CLASSROOM_CONNECTION_THRESHOLD = 15;
const CORRIDOR_POINTS = 2;

export class GraphPathBuilder {
  private readonly graph: FullGraph;
  private barrierFree: boolean;
  private readonly myLocation: MyLocation | null;

  private pointIdToClassroom = new Map<number, Classroom>();
  private pointIdToCorridor = new Map<number, Corridor>();
  private pointIdToStoreyConnector = new Map<
    number,
    { connector: Connector; storey: number }
  >();

  private corridorIdToPoints = new Map<string, number[]>();
  private classroomIdToPoint = new Map<string, number>();
  /** A* point id of the user's saved location, or -1 if none / unreachable. */
  private myLocationPointId = -1;

  private astar = new Astar();

  constructor(
    graph: FullGraph,
    barrierFree: boolean,
    myLocation: MyLocation | null = null
  ) {
    this.graph = graph;
    this.barrierFree = barrierFree;
    this.myLocation = myLocation;
    this.build();
  }

  getAstar(): Astar {
    return this.astar;
  }

  getPath(
    fromClassroomId: string,
    toClassroomId: string,
    isBarrierFree: boolean
  ): Vec3[] {
    if (this.barrierFree !== isBarrierFree) {
      this.barrierFree = isBarrierFree;
      this.build();
    }

    const start = this.classroomIdToPoint.get(fromClassroomId);
    const end = this.classroomIdToPoint.get(toClassroomId);

    if (start === undefined || end === undefined) {
      return [];
    }

    return this.astar.findPath(start, end);
  }

  /** Path from the user's saved location to a classroom. Empty if no
   *  location is set, the location couldn't be attached to any corridor,
   *  or the target is unknown. */
  getPathFromLocation(toClassroomId: string, isBarrierFree: boolean): Vec3[] {
    if (this.barrierFree !== isBarrierFree) {
      this.barrierFree = isBarrierFree;
      this.build();
    }

    if (this.myLocationPointId < 0) {
      return [];
    }

    const end = this.classroomIdToPoint.get(toClassroomId);
    if (end === undefined) {
      return [];
    }

    return this.astar.findPath(this.myLocationPointId, end);
  }

  private build(): void {
    this.pointIdToClassroom = new Map<number, Classroom>();
    this.pointIdToCorridor = new Map<number, Corridor>();
    this.pointIdToStoreyConnector = new Map<
      number,
      { connector: Connector; storey: number }
    >();

    this.corridorIdToPoints = new Map<string, number[]>();
    this.classroomIdToPoint = new Map<string, number>();
    this.myLocationPointId = -1;

    this.astar = new Astar();

    this.buildClassroomPoints();
    this.buildCorridorPoints();
    this.connectCorridors();
    this.connectClassroomsToCorridors();
    this.buildStoreyConnectorPoints();
    this.connectMyLocation();
  }

  /** Attach the user's saved location to the nearest corridor point on
   *  its storey (horizontal distance). Mirrors how classrooms hook into
   *  corridors, but the location isn't tied to a building, so any
   *  corridor on the matching storey is a candidate. */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported graph wiring, kept verbatim
  private connectMyLocation(): void {
    if (!this.myLocation) {
      return;
    }
    const loc = this.myLocation;

    let closestId = -1;
    let closestDistSq = Number.POSITIVE_INFINITY;

    for (const cor of this.graph.corridors) {
      if (cor.storey !== loc.storey) {
        continue;
      }
      if (this.barrierFree && !cor.barrier_free) {
        continue;
      }

      const pts = this.corridorIdToPoints.get(cor.id);
      if (!pts) {
        continue;
      }

      for (const pid of pts) {
        const p = this.astar.getPoint(pid);
        if (!p) {
          continue;
        }
        const dx = p.x - loc.x;
        const dz = p.z - loc.y;
        const distSq = dx * dx + dz * dz;

        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closestId = pid;
        }
      }
    }

    if (closestId === -1) {
      return;
    }

    // Sit the location point at the matched corridor's floor Y so the
    // connection is purely horizontal and the A* distance is sane.
    const corPos = this.astar.getPoint(closestId);
    if (!corPos) {
      return;
    }
    const locId = this.astar.addPoint({ x: loc.x, y: corPos.y, z: loc.y });
    this.astar.connect(locId, closestId);
    this.myLocationPointId = locId;
  }

  private buildClassroomPoints() {
    for (const c of this.graph.classrooms) {
      const id = this.astar.addPoint(this.classroomDoorPos(c));
      this.pointIdToClassroom.set(id, c);
      this.classroomIdToPoint.set(c.id, id);
    }
  }

  private buildCorridorPoints() {
    for (const cor of this.graph.corridors) {
      const points = this.getCorridorPoints(cor);

      let prevId = -1;
      for (const point of points) {
        const currId = this.astar.addPoint(point);

        this.pointIdToCorridor.set(currId, cor);

        const corToP = this.corridorIdToPoints.get(cor.id) || [];
        corToP.push(currId);
        this.corridorIdToPoints.set(cor.id, corToP);

        if (prevId >= 0) {
          this.astar.connect(prevId, currId);
        }

        prevId = currId;
      }
    }
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported graph wiring, kept verbatim
  private connectCorridors() {
    const corridors = this.graph.corridors;
    for (let i = 0; i < corridors.length; i++) {
      const corA = corridors[i];
      if (!corA) {
        continue;
      }

      for (let j = i + 1; j < corridors.length; j++) {
        const corB = corridors[j];
        if (!corB) {
          continue;
        }

        if (corA.storey !== corB.storey) {
          continue;
        }

        if (this.barrierFree && !corB.barrier_free) {
          continue;
        }

        if (!corridorsIntersect(corA, corB, this.graph.buildings)) {
          continue;
        }

        const pointsA = this.corridorIdToPoints.get(corA.id);
        const pointsB = this.corridorIdToPoints.get(corB.id);
        if (!(pointsA && pointsB)) {
          continue;
        }

        let closestDistSq = Number.POSITIVE_INFINITY;
        let closestA = -1;
        let closestB = -1;

        for (const idA of pointsA) {
          const pA = this.astar.getPoint(idA);
          if (!pA) {
            continue;
          }

          for (const idB of pointsB) {
            const pB = this.astar.getPoint(idB);
            if (!pB) {
              continue;
            }

            const dx = pA.x - pB.x;
            const dy = pA.z - pB.z;
            const distSq = dx * dx + dy * dy;

            if (distSq < closestDistSq) {
              closestDistSq = distSq;
              closestA = idA;
              closestB = idB;
            }
          }
        }

        if (closestA > -1 && closestB > -1) {
          this.astar.connect(closestA, closestB);
        }
      }
    }
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported graph wiring, kept verbatim
  private connectClassroomsToCorridors() {
    for (const c of this.graph.classrooms) {
      const classroomPointId = this.classroomIdToPoint.get(c.id);
      if (classroomPointId === undefined) {
        continue;
      }
      const classroomPos = this.astar.getPoint(classroomPointId);
      if (!classroomPos) {
        continue;
      }

      let closestId = -1;
      let closestDist = Number.POSITIVE_INFINITY;

      for (const cor of this.graph.corridors) {
        if (cor.storey !== c.storey || cor.building_id !== c.building_id) {
          continue;
        }
        if (cor.is_outdoor) {
          continue;
        }
        const pts = this.corridorIdToPoints.get(cor.id);

        if (!pts) {
          continue;
        }

        for (const pid of pts) {
          const point = this.astar.getPoint(pid);
          if (!point) {
            continue;
          }
          const d = dist(classroomPos, point);

          if (d > CLASSROOM_CONNECTION_THRESHOLD) {
            continue;
          }

          if (d < closestDist) {
            closestDist = d;
            closestId = pid;
          }
        }
      }

      if (closestId !== -1) {
        this.astar.connect(classroomPointId, closestId);
      }
    }
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported graph wiring, kept verbatim
  private buildStoreyConnectorPoints() {
    const allConnectors: Connector[] = this.barrierFree
      ? this.graph.lifts.map((l) => ({ ...l, isLift: true }))
      : this.graph.stairs.map((s) => ({ ...s, isLift: false }));

    const connectorStoreyPoints = new Map<string, Map<number, number>>();

    for (const connector of allConnectors) {
      const storeyMap = new Map<number, number>();
      for (
        let storey = connector.min_storey;
        storey <= connector.max_storey;
        storey++
      ) {
        const pos = this.connectorPosOnStorey(connector, storey);
        const id = this.astar.addPoint(pos);
        this.pointIdToStoreyConnector.set(id, { connector, storey });
        storeyMap.set(storey, id);
      }
      connectorStoreyPoints.set(connector.id, storeyMap);

      const storeys = [...storeyMap.keys()].sort((a, b) => a - b);
      for (let k = 0; k < storeys.length - 1; k++) {
        const fromStorey = storeys[k];
        const toStorey = storeys[k + 1];
        if (fromStorey === undefined || toStorey === undefined) {
          continue;
        }
        const from = storeyMap.get(fromStorey);
        const to = storeyMap.get(toStorey);
        if (from === undefined || to === undefined) {
          continue;
        }
        this.astar.connect(from, to);
      }
    }

    for (const connector of allConnectors) {
      const storeyMap = connectorStoreyPoints.get(connector.id);
      if (!storeyMap) {
        continue;
      }
      for (const [storey, connectorPoint] of storeyMap) {
        const connectorPos = this.astar.getPoint(connectorPoint);
        if (!connectorPos) {
          continue;
        }

        let closestId = -1;
        let closestDist = Number.POSITIVE_INFINITY;
        for (const cor of this.graph.corridors) {
          if (
            cor.storey !== storey ||
            cor.building_id !== connector.building_id
          ) {
            continue;
          }

          const pts = this.corridorIdToPoints.get(cor.id);
          if (!pts) {
            continue;
          }

          for (const pid of pts) {
            const point = this.astar.getPoint(pid);
            if (!point) {
              continue;
            }
            const d = dist(connectorPos, point);
            if (d < closestDist) {
              closestDist = d;
              closestId = pid;
            }
          }
        }

        if (closestId !== -1) {
          this.astar.connect(connectorPoint, closestId);
        }
      }
    }
  }

  private getBuilding(id: string): Building {
    const b = this.graph.buildings.find((x) => x.id === id);
    if (!b) {
      throw new Error(`Building ${id} not found`);
    }
    return b;
  }

  private classroomDoorPos(c: Classroom): Vec3 {
    const building = this.getBuilding(c.building_id);
    const rad = (c.rotation * Math.PI) / 180;
    // Vector2(0,1).rotated(rad) — same formula as `Classroom.GetDoorOffset`.
    const offX = -Math.sin(rad) * (c.size_y / 2);
    const offY = Math.cos(rad) * (c.size_y / 2);
    const x = c.x + building.x + offX;
    const z = c.y + building.y + offY;
    const y = floorPositionOf(this.graph, c.building_id, c.storey);
    return { x, y, z };
  }

  private corridorStartPos(cor: Corridor): Vec3 {
    const building = this.getBuilding(cor.building_id);
    return {
      x: building.x + cor.x1,
      y: floorPositionOf(this.graph, cor.building_id, cor.storey),
      z: building.y + cor.y1,
    };
  }

  private corridorEndPos(cor: Corridor): Vec3 {
    const building = this.getBuilding(cor.building_id);
    return {
      x: building.x + cor.x2,
      y: floorPositionOf(this.graph, cor.building_id, cor.storey),
      z: building.y + cor.y2,
    };
  }

  private getCorridorPoints(cor: Corridor): Vec3[] {
    const out: Vec3[] = [];
    const startPoint = this.corridorStartPos(cor);
    const endPoint = this.corridorEndPos(cor);
    const floorPos = floorPositionOf(this.graph, cor.building_id, cor.storey);
    const length = dist(startPoint, endPoint);

    if (length < 0.01) {
      return [startPoint];
    }

    const step = Math.min(1, 10 / CORRIDOR_POINTS / length);

    for (let t = 0; t < 1; t += step) {
      const x = startPoint.x + (endPoint.x - startPoint.x) * t;
      const z = startPoint.z + (endPoint.z - startPoint.z) * t;

      out.push({ x, y: floorPos, z });
    }

    out.push({ x: endPoint.x, y: floorPos, z: endPoint.z });

    return out;
  }

  private connectorPosOnStorey(c: Connector, storey: number): Vec3 {
    const building = this.getBuilding(c.building_id);
    const x = c.x + building.x;
    return {
      x,
      y: floorPositionOf(this.graph, c.building_id, storey),
      z: c.y + building.y,
    };
  }
}
