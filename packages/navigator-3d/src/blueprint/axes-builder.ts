// biome-ignore lint/performance/noNamespaceImport: three.js namespace is its public API
import * as THREE from 'three';

type Disposable = { dispose: () => void };

export type AxesHelperHandle = {
  objects: THREE.Object3D[];
  dispose: () => void;
};

const AXIS_LENGTH = 200;

function makeAxisLine(
  color: number,
  start: THREE.Vector3,
  end: THREE.Vector3
): { line: THREE.Line; dispose: () => void } {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    opacity: 0.85,
    transparent: true,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 999;
  return {
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
    line,
  };
}

function makeAxisLabel(
  text: string,
  color: string,
  position: THREE.Vector3
): { sprite: THREE.Sprite; dispose: () => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }
  ctx.font = 'bold 96px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({
    depthTest: false,
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(8, 8, 1);
  sprite.renderOrder = 1000;
  return {
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
    sprite,
  };
}

function makeGrid(): { grid: THREE.GridHelper; dispose: () => void } {
  const grid = new THREE.GridHelper(
    AXIS_LENGTH * 2,
    40,
    0x66_66_66,
    0x33_33_33
  );
  const mat = grid.material as THREE.Material;
  mat.transparent = true;
  mat.opacity = 0.35;
  return {
    dispose: () => {
      grid.geometry.dispose();
      mat.dispose();
    },
    grid,
  };
}

export function buildAxes(): AxesHelperHandle {
  const group = new THREE.Group();
  const resources: Disposable[] = [];

  const axes: Array<{ color: number; from: THREE.Vector3; to: THREE.Vector3 }> =
    [
      {
        color: 0xff_50_50,
        from: new THREE.Vector3(-AXIS_LENGTH, 0, 0),
        to: new THREE.Vector3(AXIS_LENGTH, 0, 0),
      },
      {
        color: 0x50_e0_50,
        from: new THREE.Vector3(0, -AXIS_LENGTH, 0),
        to: new THREE.Vector3(0, AXIS_LENGTH, 0),
      },
      {
        color: 0x60_90_ff,
        from: new THREE.Vector3(0, 0, -AXIS_LENGTH),
        to: new THREE.Vector3(0, 0, AXIS_LENGTH),
      },
    ];
  for (const a of axes) {
    const { line, dispose } = makeAxisLine(a.color, a.from, a.to);
    group.add(line);
    resources.push({ dispose });
  }

  const labels: Array<{ text: string; color: string; pos: THREE.Vector3 }> = [
    {
      color: '#ff5050',
      pos: new THREE.Vector3(AXIS_LENGTH + 5, 0, 0),
      text: 'X',
    },
    {
      color: '#50e050',
      pos: new THREE.Vector3(0, AXIS_LENGTH + 5, 0),
      text: 'Y',
    },
    {
      color: '#6090ff',
      pos: new THREE.Vector3(0, 0, AXIS_LENGTH + 5),
      text: 'Z',
    },
  ];
  for (const l of labels) {
    const { sprite, dispose } = makeAxisLabel(l.text, l.color, l.pos);
    group.add(sprite);
    resources.push({ dispose });
  }

  const { grid, dispose: gridDispose } = makeGrid();
  resources.push({ dispose: gridDispose });

  return {
    dispose: () => {
      for (const resource of resources) {
        resource.dispose();
      }
    },
    objects: [group, grid],
  };
}
