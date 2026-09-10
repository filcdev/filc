import type {
  BufferGeometry,
  LineSegments,
  Material,
  Mesh,
  Object3D,
  Sprite,
} from 'three';
import { Color, DoubleSide, LineBasicMaterial, MeshBasicMaterial } from 'three';

/** Visual role of a tagged mesh. Drives how the appearance layer blends
 *  the base look with selection/highlight accents. */
export type AppRole = 'fill' | 'line' | 'door' | 'doorLine' | 'plate' | 'deck';

/** Stored on `mesh.userData.app`. `baseColor`/`baseOpacity` are the
 *  neutral look; the appearance layer derives the final values from
 *  these plus the current state, so it can always restore to base. */
export type AppData = {
  role: AppRole;
  baseColor: Color;
  baseOpacity: number;
};

/** Tag a mesh so the appearance layer will manage its material. The mesh
 *  MUST own its material (see `ownFillMat`/`ownLineMat`) — shared cached
 *  materials cannot be recolored per object. */
export function tagApp(
  obj: Mesh | LineSegments,
  role: AppRole,
  color: number,
  opacity: number
): Object3D {
  const data: AppData = {
    baseColor: new Color(color),
    baseOpacity: opacity,
    role,
  };
  obj.userData.app = data;
  return obj;
}

/** Per-instance fill material. Unlike blueprint/materials.ts these are
 *  NOT cached, so each object can be recolored independently. */
export function ownFillMat(color: number, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    depthWrite: false,
    opacity,
    side: DoubleSide,
    transparent: true,
  });
}

/** Per-instance line material. */
export function ownLineMat(color: number, opacity: number): LineBasicMaterial {
  return new LineBasicMaterial({
    color,
    opacity,
    transparent: true,
  });
}

/** Dispose geometry AND materials for an entire subtree. Safe here
 *  because every kiosk material is per-instance (never shared). */
export function disposeDeep(obj: Object3D): void {
  obj.traverse((o) => {
    const mesh = o as Mesh & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    mesh.geometry?.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) {
          m.dispose();
        }
      } else {
        mesh.material.dispose();
      }
    }
    const sprite = o as Sprite;
    if (sprite.isSprite && sprite.material?.map) {
      sprite.material.map.dispose();
    }
  });
}
