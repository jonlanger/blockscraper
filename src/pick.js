// Exact voxel picking (Amanatides–Woo traversal) over the whole city grid, plus a
// working-level plane for starting new floors or digging basements at any depth.
import { CELL } from './catalog.js';

function slab(O, D, min, max) {
  let tmin = -Infinity, tmax = Infinity, axis = -1;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(D[a]) < 1e-9) {
      if (O[a] < min[a] || O[a] > max[a]) return null;
      continue;
    }
    let t1 = (min[a] - O[a]) / D[a], t2 = (max[a] - O[a]) / D[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) { tmin = t1; axis = a; }
    if (t2 < tmax) tmax = t2;
  }
  if (tmin > tmax || tmax < 0) return null;
  return { tmin, tmax, axis };
}

// opt: { minLevel, maxLevel, workLevel, filter(cell) }
export function pickCity(ray, city, opt) {
  const L = city.layout;
  const O = [ray.origin.x - L.ox, ray.origin.y, ray.origin.z - L.oz];
  const D = [ray.direction.x, ray.direction.y, ray.direction.z];
  const E = L.ext;
  const lo = [E.x0, opt.minLevel, E.z0], hi = [E.x1, opt.maxLevel, E.z1];
  let best = null;

  const box = slab(O, D, [E.x0 * CELL, opt.minLevel * CELL, E.z0 * CELL], [(E.x1 + 1) * CELL, (opt.maxLevel + 1) * CELL, (E.z1 + 1) * CELL]);
  if (box) {
    const t0 = Math.max(box.tmin, 0);
    const c = [0, 1, 2].map((a) => Math.min(hi[a], Math.max(lo[a], Math.floor((O[a] + D[a] * (t0 + 1e-4)) / CELL))));
    const step = [], tMax = [], tDelta = [];
    for (let a = 0; a < 3; a++) {
      step[a] = D[a] > 0 ? 1 : D[a] < 0 ? -1 : 0;
      if (step[a]) {
        tMax[a] = ((c[a] + (step[a] > 0 ? 1 : 0)) * CELL - O[a]) / D[a];
        tDelta[a] = CELL / Math.abs(D[a]);
      } else { tMax[a] = Infinity; tDelta[a] = Infinity; }
    }
    let n = [0, 0, 0];
    if (box.tmin > 0 && box.axis >= 0) n[box.axis] = -Math.sign(D[box.axis]);
    let t = t0;
    const maxSteps = (E.x1 - E.x0) + (E.z1 - E.z0) + (opt.maxLevel - opt.minLevel) + 8;
    for (let i = 0; i < maxSteps; i++) {
      const cell = city.get(c[0], c[1], c[2]);
      if (cell && (!opt.filter || opt.filter(cell))) { best = { ix: c[0], iy: c[1], iz: c[2], n, t, kind: 'cell' }; break; }
      const a = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
      t = tMax[a];
      c[a] += step[a];
      tMax[a] += tDelta[a];
      n = [0, 0, 0];
      n[a] = -step[a];
      if (c[a] < lo[a] || c[a] > hi[a]) break;
    }
  }

  if (Math.abs(D[1]) > 1e-6) {
    const t = (opt.workLevel * CELL - O[1]) / D[1];
    if (t > 0 && (!best || t < best.t)) {
      const ix = Math.floor((O[0] + D[0] * t) / CELL), iz = Math.floor((O[2] + D[2] * t) / CELL);
      if (L.inMap(ix, iz)) best = { ix, iy: opt.workLevel, iz, n: [0, 0, 0], t, kind: 'plane' };
    }
  }
  return best;
}
