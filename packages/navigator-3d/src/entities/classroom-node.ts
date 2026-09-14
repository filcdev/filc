import type { Building } from '@filcdev/api/domains/navigator/building';
import type { Classroom } from '@filcdev/api/domains/navigator/classroom';
import type { FullGraph } from '@filcdev/api/domains/navigator/graph';
// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';
import { ownFillMat, ownLineMat, tagApp } from '../kiosk/materials';
import { darkenColor, KIOSK_OPACITY, kioskTypeColor } from '../kiosk/palette';
import type { KioskNode } from '../kiosk/types';
import { FLOOR_HEIGHT } from '../types/three/material-types';
import type { StoreyResolver } from '../types/three/storey-types';

const DOOR_COLOR = 0xd9_9a_1f;

/** One classroom: fill box + wireframe + door panel. Pivot is the room
 *  center so rotation matches the editor. Only the fill box is pickable. */
export function buildClassroomNode(
  c: Classroom,
  b: Building,
  graph: FullGraph,
  storeys: StoreyResolver
): KioskNode {
  const color = kioskTypeColor(graph, c.type_id);
  const boxH = Math.min(c.size_z, FLOOR_HEIGHT);
  const storeyY = storeys.bottomY(b.id, c.storey);

  const group = new THREE.Group();
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(c.size_x, boxH, c.size_y),
    new THREE.MeshBasicMaterial({
      color,
      opacity: KIOSK_OPACITY.fill,
      side: THREE.DoubleSide,
      transparent: true,
    })
  );
  tagApp(fill, 'fill', color, KIOSK_OPACITY.fill);
  group.add(fill);

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(c.size_x, boxH, c.size_y)),
    ownLineMat(darkenColor(color, 0.85), KIOSK_OPACITY.line)
  );
  tagApp(wire, 'line', darkenColor(color, 0.85), KIOSK_OPACITY.line);
  group.add(wire);

  const doorH = Math.min(2.1, boxH - 0.05);
  const doorW = 0.95;
  const doorT = 0.08;
  const doorPos = new THREE.Vector3(
    0,
    -boxH * 0.5 + doorH * 0.5,
    c.size_y * 0.5 + doorT * 0.5
  );

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, doorH, doorT),
    ownFillMat(DOOR_COLOR, KIOSK_OPACITY.door)
  );
  door.position.copy(doorPos);
  tagApp(door, 'door', DOOR_COLOR, KIOSK_OPACITY.door);
  group.add(door);

  const doorLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(doorW, doorH, doorT)),
    ownLineMat(0xff_ff_ff, KIOSK_OPACITY.doorLine)
  );
  doorLine.position.copy(doorPos);
  tagApp(doorLine, 'doorLine', 0xff_ff_ff, KIOSK_OPACITY.doorLine);
  group.add(doorLine);

  group.position.set(b.x + c.x, storeyY + boxH * 0.5, b.y + c.y);
  group.rotation.y = -((c.rotation ?? 0) * Math.PI) / 180;

  return {
    appearance: [fill, door, wire, doorLine],
    buildingId: b.id,
    center: group.position.clone(),
    id: c.id,
    kind: 'classroom',
    object: group,
    pickables: [fill],
    storey: c.storey,
    typeId: c.type_id,
  };
}
