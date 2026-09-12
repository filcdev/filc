import { CanvasTexture, Sprite, SpriteMaterial } from 'three';

/** Floor-number sprite. Self-contained (own texture + material) so the
 *  kiosk's deep-dispose can free it without touching the editor's cached
 *  badges in blueprint/storeyBadge.ts. */
export function makeKioskBadge(storey: number, color: number): Sprite {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire 2d canvas context');
  }

  const hex = `#${color.toString(16).padStart(6, '0')}`;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, `${hex}cc`);
  grad.addColorStop(0.6, `${hex}33`);
  grad.addColorStop(1, `${hex}00`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 78px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillText(storey === 0 ? 'F' : String(storey), size / 2 + 2, size / 2 + 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(storey === 0 ? 'F' : String(storey), size / 2, size / 2 + 2);

  const tex = new CanvasTexture(cv);
  tex.anisotropy = 4;
  const mat = new SpriteMaterial({
    depthTest: false,
    map: tex,
    transparent: true,
  });
  const sprite = new Sprite(mat);
  sprite.renderOrder = 5;
  return sprite;
}
