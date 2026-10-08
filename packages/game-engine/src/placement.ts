import { BUILDING_DEFINITIONS } from './definitions/buildings.js';

export interface Footprint {
  x: number;
  y: number;
  size: number;
}

export function footprintOf(type: string, x: number, y: number): Footprint {
  return { x, y, size: BUILDING_DEFINITIONS[type]?.size ?? 1 };
}

export function overlaps(a: Footprint, b: Footprint): boolean {
  return a.x < b.x + b.size && a.x + a.size > b.x && a.y < b.y + b.size && a.y + a.size > b.y;
}

export type PlacementError = 'UNKNOWN_TYPE' | 'OUT_OF_BOUNDS' | 'OVERLAP';

/**
 * Validates that a building of `type` can sit at (x, y). `excludeId` lets a building be moved
 * without colliding with its own old position.
 */
export function validatePlacement(
  existing: Array<{ id: string; type: string; x: number; y: number }>,
  type: string,
  x: number,
  y: number,
  gridSize: number,
  excludeId?: string,
): { ok: true } | { ok: false; error: PlacementError } {
  const def = BUILDING_DEFINITIONS[type];
  if (!def) return { ok: false, error: 'UNKNOWN_TYPE' };
  if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, error: 'OUT_OF_BOUNDS' };
  if (x < 0 || y < 0 || x + def.size > gridSize || y + def.size > gridSize) return { ok: false, error: 'OUT_OF_BOUNDS' };
  const fp = { x, y, size: def.size };
  for (const b of existing) {
    if (excludeId && b.id === excludeId) continue;
    if (overlaps(fp, footprintOf(b.type, b.x, b.y))) return { ok: false, error: 'OVERLAP' };
  }
  return { ok: true };
}

/**
 * Tiles where troops may NOT be deployed: every building footprint plus a one-tile margin.
 * Returned as a Uint8Array mask of gridSize*gridSize (1 = blocked).
 */
export function deploymentMask(buildings: Array<{ type: string; x: number; y: number; size?: number }>, gridSize: number): Uint8Array {
  const mask = new Uint8Array(gridSize * gridSize);
  for (const b of buildings) {
    const size = b.size ?? BUILDING_DEFINITIONS[b.type]?.size ?? 1;
    for (let y = b.y - 1; y < b.y + size + 1; y++) {
      for (let x = b.x - 1; x < b.x + size + 1; x++) {
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
        mask[y * gridSize + x] = 1;
      }
    }
  }
  return mask;
}

export function canDeployAt(mask: Uint8Array, gridSize: number, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= gridSize || ty >= gridSize) return false;
  return mask[ty * gridSize + tx] === 0;
}
