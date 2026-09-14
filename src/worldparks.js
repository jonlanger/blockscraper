// World-inspired parks. Unlike the tiling parks, these read the whole connected area of their own
// type: it is split into rooms of about six blocks a side and each room gets one composition
// centered on it, so a basin, parterre or piazza grows with the space. Flat patterns and boxes are
// clipped to each block; round centerpieces are placed once, from the room's corner block.
import * as THREE from 'three';
import { PAT, SHAPES, lathe, tube, foliage, extrudeShape, hash } from './geo.js';
import { part, mtx, ironRailingPart } from './kit.js';
import { rbox, lampPostPart, benchPart } from './props.js';
import { anyTreePart } from './props2.js';

export const WORLD_PARKS = new Set(['bassin', 'parterre', 'chahar', 'wavepaving', 'starpiazza', 'jetgrid', 'bosque', 'cascade']);

const ROOM = 6;
const TAU = Math.PI * 2;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const EDGE = [[3.9, 2, Math.PI / 2], [0.1, 2, Math.PI / 2], [2, 3.9, 0], [2, 0.1, 0]];
const f1 = (n) => (+n).toFixed(1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frac = (v) => v - Math.floor(v);
const half = (v) => Math.round(v * 2) / 2;
const faceTo = (x, z) => Math.atan2(-x, -z); // ry that turns a part's +z toward the origin

// ---------- regions & rooms ----------
function regionOf(city, c) {
  const cache = city.parkRegions || (city.parkRegions = new Map());
  const key = `${c.x},${c.z}`;
  let reg = cache.get(key);
  if (reg) return reg;
  reg = { x0: c.x, x1: c.x, z0: c.z, z1: c.z, keys: new Set([key]), rooms: new Map() };
  const stack = [c];
  while (stack.length) {
    const cur = stack.pop();
    reg.x0 = Math.min(reg.x0, cur.x); reg.x1 = Math.max(reg.x1, cur.x);
    reg.z0 = Math.min(reg.z0, cur.z); reg.z1 = Math.max(reg.z1, cur.z);
    for (const [dx, dz] of N4) {
      const k = `${cur.x + dx},${cur.z + dz}`;
      if (reg.keys.has(k)) continue;
      const n = city.get(cur.x + dx, c.y, cur.z + dz);
      if (!n || n.m !== c.m) continue;
      reg.keys.add(k);
      stack.push(n);
    }
  }
  for (const k of reg.keys) cache.set(k, reg);
  return reg;
}

// Split [a0, a1] into rooms of about ROOM blocks and return the room containing v.
function span(a0, a1, v) {
  const n = a1 - a0 + 1, parts = Math.max(1, Math.round(n / ROOM)), size = Math.floor(n / parts);
  const i = Math.min(parts - 1, Math.floor((v - a0) / size));
  return [a0 + i * size, i === parts - 1 ? a1 : a0 + (i + 1) * size - 1];
}

// A room is only used when the region fills it completely; otherwise the block stands alone.
export function parkRoom(city, c) {
  const reg = regionOf(city, c);
  const [x0, x1] = span(reg.x0, reg.x1, c.x), [z0, z1] = span(reg.z0, reg.z1, c.z);
  const rk = `${x0},${z0}`;
  let full = reg.rooms.get(rk);
  if (full === undefined) {
    full = true;
    for (let x = x0; x <= x1 && full; x++) for (let z = z0; z <= z1; z++) if (!reg.keys.has(`${x},${z}`)) { full = false; break; }
    reg.rooms.set(rk, full);
  }
  return full ? { x0, x1, z0, z1, anchor: c.x === x0 && c.z === z0 } : { x0: c.x, x1: c.x, z0: c.z, z1: c.z, anchor: true };
}

// Drawing helpers in room coordinates (u along x, v along z, origin at the room center).
function stage(T, x0, y0, z0, c, room) {
  const top = y0 + 0.2;
  const hw = (room.x1 - room.x0 + 1) * 2, hd = (room.z1 - room.z0 + 1) * 2;
  const CX = x0 + (room.x0 - c.x) * 4 + hw, CZ = z0 + (room.z0 - c.z) * 4 + hd;
  const u0 = x0 - CX, v0 = z0 - CZ;
  return {
    top, hw, hd, anchor: room.anchor, small: hw < 8 || hd < 8,
    base: (col, pat) => T.g.m.box(x0 + 2, y0 + 0.1, z0 + 2, 4, 0.2, 4, [col, pat]),
    // Axis-aligned box, clipped to this block. Heights are relative to the park surface.
    rect(mat, a0, a1, b0, b1, ya, yb, color) {
      const ua = Math.max(a0, u0), ub = Math.min(a1, u0 + 4), va = Math.max(b0, v0), vb = Math.min(b1, v0 + 4);
      if (ub - ua < 0.002 || vb - va < 0.002) return;
      T.g[mat].box(CX + (ua + ub) / 2, top + (ya + yb) / 2, CZ + (va + vb) / 2, ub - ua, yb - ya, vb - va, color);
    },
    // Rasterize a pattern over this block. fn(u, v, wx, wz) -> [hex, pattern] | null.
    // Same-colored samples merge into runs; h = 0 draws flat inlays, h > 0 raised masses (hedges, lawns).
    raster(fn, res = 0.2, h = 0) {
      const n = Math.round(4 / res), g = T.g.m, y = top + 0.006;
      for (let j = 0; j < n; j++) {
        const za = z0 + j * res, zb = za + res, v = v0 + (j + 0.5) * res;
        let run = null, start = 0;
        for (let i = 0; i <= n; i++) {
          const col = i < n ? fn(u0 + (i + 0.5) * res, v, x0 + (i + 0.5) * res, za + res / 2) : null;
          if (col && run && col[0] === run[0] && col[1] === run[1]) continue;
          if (run) {
            const xa = x0 + start * res, xb = x0 + i * res;
            if (h) g.box((xa + xb) / 2, top + h / 2, (za + zb) / 2, xb - xa, h, res, run);
            else { g.tri(xa, y, za, xa, y, zb, xb, y, zb, run); g.tri(xa, y, za, xb, y, zb, xb, y, za, run); }
          }
          run = col; start = i;
        }
      }
    },
    P: (p, u, v, ry = 0, s = 1, y = 0) => T.P(p, CX + u, top + y, CZ + v, ry, 'wd', s),
    B: (p, lx, lz, ry = 0, s = 1, y = 0) => T.P(p, x0 + lx, top + y, z0 + lz, ry, 'wd', s),
  };
}

// ---------- basins & fountains ----------
function outline(kind, r) {
  const n = kind === 'octa' ? 8 : kind === 'star8' ? 16 : 72, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (kind === 'octa' ? Math.PI / 8 : 0);
    let rr = r;
    if (kind === 'quatre') rr = r * (0.8 + 0.2 * Math.abs(Math.cos(2 * a)));
    else if (kind === 'star8') rr = i % 2 ? r * 0.8 : r;
    pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  }
  return pts;
}
const ring = (kind, outer, inner) => () => { const s = new THREE.Shape(outline(kind, outer)); s.holes.push(new THREE.Path(outline(kind, inner))); return s; };
const FLAT = [-Math.PI / 2, 0, 0];

// kind: round | quatre | octa | star8. feature: jet | bronze | spouts | none.
export function basinPart(kind, R, feature = 'jet') {
  R = half(R);
  return part(`wp-basin:${kind}:${f1(R)}:${feature}`, (L) => {
    const stone = L('m', 0xddd6c8, PAT.MARBLE), water = L('glass', 0x4a95bd), spray = L('l', 0xe4f6ff), bronze = L('t', 0x6a5a3c);
    const rim = R > 3 ? 0.45 : 0.3, h = 0.5, key = `${kind}:${f1(R)}`;
    stone.geo(extrudeShape(`wpb-rim:${key}`, ring(kind, R + rim, R), h), mtx(0, h / 2, 0, ...FLAT));
    stone.geo(extrudeShape(`wpb-cap:${key}`, ring(kind, R + rim + 0.06, R - 0.05), 0.08), mtx(0, h + 0.04, 0, ...FLAT));
    water.geo(extrudeShape(`wpb-water:${key}`, () => new THREE.Shape(outline(kind, R)), 0.04), mtx(0, h - 0.12, 0, ...FLAT));
    const wl = h - 0.1;
    if (feature === 'jet') {
      const H = clamp(1.2 + R * 0.55, 1.6, 6.5);
      spray.geo(lathe(`wpb-jet:${f1(H)}`, [[0.14, 0], [0.08, H * 0.45], [0.035, H * 0.9], [0.001, H]], 10), mtx(0, wl, 0));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; spray.put(SHAPES.ico, Math.cos(a) * 0.32, wl + 0.06, Math.sin(a) * 0.32, 0.14, 0.08, 0.14); }
      if (R >= 3) for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU, c = Math.cos(a), s = Math.sin(a), r0 = R - 0.15;
        spray.geo(tube(`wpb-arc:${f1(R)}:${i}`, [[c * r0, h, s * r0], [c * R * 0.62, h + R * 0.3, s * R * 0.62], [c * R * 0.3, wl, s * R * 0.3]], 0.03, 12, 4), mtx());
      }
    } else if (feature === 'bronze') {
      // Tiered bronze fountain on a stone stem, like the pair in Lisbon's Rossio.
      const s = clamp(R * 0.42, 0.6, 1.3), k = f1(s);
      stone.geo(lathe(`wpb-ped:${k}`, [[0.55 * s, 0], [0.5 * s, 0.25 * s], [0.25 * s, 0.45 * s], [0.2 * s, 1.2 * s], [0.32 * s, 1.3 * s], [0.001, 1.32 * s]], 16), mtx(0, wl, 0));
      bronze.geo(lathe(`wpb-bowl:${k}`, [[0.001, 0], [0.3 * s, 0.05 * s], [0.95 * s, 0.3 * s], [1.0 * s, 0.38 * s], [0.9 * s, 0.4 * s], [0.001, 0.22 * s]], 24), mtx(0, wl + 1.25 * s, 0));
      water.put(SHAPES.cyl, 0, wl + 1.6 * s, 0, 0.88 * s, 0.02, 0.88 * s);
      bronze.geo(lathe(`wpb-fig:${k}`, [[0.26 * s, 0], [0.12 * s, 0.3 * s], [0.2 * s, 0.7 * s], [0.1 * s, 1.0 * s], [0.13 * s, 1.1 * s], [0.001, 1.32 * s]], 12), mtx(0, wl + 1.6 * s, 0));
      bronze.put(SHAPES.sphere, 0, wl + 3.05 * s, 0, 0.13 * s, 0.13 * s, 0.13 * s);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU, c = Math.cos(a), sn = Math.sin(a), r1 = 1.0 * s, r2 = Math.min(R - 0.2, 1.7 * s);
        spray.geo(tube(`wpb-fall:${k}:${f1(R)}:${i}`, [[c * r1, wl + 1.64 * s, sn * r1], [c * (r1 + 0.25), wl + 1.3 * s, sn * (r1 + 0.25)], [c * r2, wl, sn * r2]], 0.022, 10, 4), mtx());
      }
      spray.geo(lathe(`wpb-top:${k}`, [[0.03, 0], [0.015, 0.5 * s], [0.001, 0.58 * s]], 8), mtx(0, wl + 3.15 * s, 0));
    } else if (feature === 'spouts') {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
        spray.geo(tube(`wpb-spout:${f1(R)}:${i}`, [[c * 0.9, 1.2, s * 0.9], [c * 1.4, 1.35, s * 1.4], [c * Math.min(R - 0.3, 2.2), wl, s * Math.min(R - 0.3, 2.2)]], 0.04, 12, 5), mtx());
      }
    }
  });
}

// ---------- furniture, trees & monuments ----------
const chairPart = (col) => part(`wp-chair:${col}`, (L) => {
  const g = L('t', col);
  for (const x of [-0.19, 0.19]) for (const z of [-0.19, 0.19]) g.put(SHAPES.cyl8, x, 0.22, z, 0.014, 0.44, 0.014);
  for (let i = 0; i < 5; i++) g.bx(-0.21, 0.43, -0.2 + i * 0.085, 0.21, 0.455, -0.14 + i * 0.085);
  for (let i = 0; i < 4; i++) g.put(SHAPES.box, 0, 0.58 + i * 0.1, -0.23 - i * 0.012, 0.42, 0.05, 0.015, -0.12, 0, 0);
  for (const x of [-0.2, 0.2]) g.put(SHAPES.cyl8, x, 0.66, -0.24, 0.014, 0.46, 0.014, -0.12, 0, 0);
});
const bistroTablePart = () => part('wp-bistro', (L) => {
  L('t', 0x2f4f3f).geo(lathe('wp-bistro', [[0.22, 0], [0.2, 0.03], [0.03, 0.08], [0.025, 0.7], [0.3, 0.72], [0.3, 0.75], [0.001, 0.76]], 16), mtx());
});
const boatPart = (k) => part(`wp-boat:${k}`, (L) => {
  L('m', [0xc0392b, 0x2a66b0, 0xf2c14e][k], PAT.WOOD).geo(rbox(0.55, 0.1, 0.16, 0.05), mtx(0, 0.05, 0));
  L('m', 0x5a3a24).put(SHAPES.cyl8, 0, 0.35, 0, 0.008, 0.55, 0.008);
  L('m', 0xf8f4ea).geo(extrudeShape('wp-sail', () => new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.24, 0), new THREE.Vector2(0, 0.46)]), 0.006), mtx(0.01, 0.14, 0));
});
const cypressPart = (k) => part(`wp-cypress:${k}`, (L) => {
  const g = L('m', [0x2f4f2a, 0x365a30, 0x2a4a28][k], PAT.GRASS);
  L('m', 0x4a3424, PAT.TIMBER).put(SHAPES.cyl8, 0, 0.3, 0, 0.08, 0.6, 0.08);
  g.geo(lathe('wp-cypress', [[0.001, 0.3], [0.32, 0.9], [0.42, 2.0], [0.34, 3.4], [0.16, 4.4], [0.001, 4.9]], 10), mtx());
  for (let i = 0; i < 5; i++) g.geo(foliage(k * 0.3 + i * 0.15), mtx(Math.sin(i * 2.4) * 0.18, 1.0 + i * 0.75, Math.cos(i * 2.4) * 0.18, 0, i, 0, 0.3, 0.45, 0.3));
});
const citrusPart = (k) => part(`wp-citrus:${k}`, (L) => {
  L('m', 0x5a3f2a, PAT.TIMBER).geo(lathe('wp-citrus', [[0.09, 0], [0.06, 1.1]], 8), mtx());
  L('m', 0x3d6b35, PAT.GRASS).geo(foliage(k * 0.2), mtx(0, 1.55, 0, 0, k, 0, 0.75, 0.62, 0.75));
  const fruit = L('m', 0xf29a2e);
  for (let i = 0; i < 9; i++) { const a = i * 2.39 + k; fruit.put(SHAPES.sphere, Math.cos(a) * 0.62, 1.3 + ((i * 37) % 7) / 10, Math.sin(a) * 0.62, 0.07, 0.07, 0.07); }
});
// Box-pruned plane tree: the canopies line up into a clipped green ceiling.
const pleachedPart = (k) => part(`wp-pleached:${k}`, (L) => {
  const bark = L('m', 0x6a5a48, PAT.TIMBER), leaf = L('m', [0x4f7f3a, 0x557a3a, 0x5e8c41, 0x476f36][k], PAT.GRASS);
  bark.geo(lathe('wp-pl-trunk', [[0.17, 0], [0.12, 0.3], [0.1, 2.5]], 10), mtx());
  for (const a of [0.6, 2.2, 3.9, 5.4]) bark.put(SHAPES.cyl8, Math.cos(a) * 0.45, 2.55, Math.sin(a) * 0.45, 0.04, 0.9, 0.04, Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
  leaf.geo(rbox(3.1, 1.5, 3.1, 0.35), mtx(0, 3.2, 0));
  for (let i = 0; i < 6; i++) leaf.geo(foliage(k * 0.1 + i * 0.13), mtx(Math.cos(i) * 1.0, 3.9, Math.sin(i * 1.7) * 1.0, 0, i, 0, 0.7, 0.3, 0.7));
});
const conePart = () => part('wp-cone', (L) => {
  L('m', 0xb0714a).geo(lathe('wp-cone-pot', [[0.2, 0], [0.26, 0.36], [0.28, 0.4], [0.001, 0.4]], 12), mtx());
  L('m', 0x2f5a2a, PAT.GRASS).geo(lathe('wp-cone', [[0.001, 0], [0.42, 0.25], [0.36, 0.9], [0.001, 1.8]], 12), mtx(0, 0.35, 0));
});
const urnPart = () => part('wp-urn', (L) => {
  const s = L('m', 0xd8d0c0, PAT.MARBLE);
  s.bv(-0.3, 0, -0.3, 0.3, 0.8, 0.3, 0.02);
  s.geo(lathe('wp-urn', [[0.12, 0], [0.2, 0.06], [0.08, 0.15], [0.1, 0.25], [0.3, 0.5], [0.33, 0.62], [0.26, 0.66], [0.001, 0.64]], 16), mtx(0, 0.8, 0));
  L('m', 0x4f7f3a, PAT.GRASS).geo(foliage(0.4), mtx(0, 1.5, 0, 0, 0, 0, 0.32, 0.22, 0.32));
  const bloom = L('m', 0xe63946);
  for (let i = 0; i < 6; i++) bloom.put(SHAPES.ico, Math.cos(i) * 0.22, 1.62, Math.sin(i * 1.3) * 0.22, 0.05, 0.05, 0.05);
});
// Ground jet with a crown of falling droplets. hb: height bucket 0-5.
const jetPart = (hb) => part(`wp-jet:${hb}`, (L) => {
  const H = 0.4 + hb * 0.35, g = L('l', 0xe6f7ff);
  g.geo(lathe(`wpj:${hb}`, [[0.05, 0], [0.03, H * 0.6], [0.018, H], [0.001, H + 0.08]], 8), mtx());
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU, c = Math.cos(a), s = Math.sin(a);
    g.geo(tube(`wpjs:${hb}:${i}`, [[0, H, 0], [c * 0.22, H + 0.06, s * 0.22], [c * 0.4, H * 0.55, s * 0.4], [c * 0.48, 0.05, s * 0.48]], 0.012, 10, 4), mtx());
  }
  L('t', 0x2a2d31).put(SHAPES.cyl, 0, 0.005, 0, 0.09, 0.01, 0.09);
});
const equestrianPart = () => part('wp-equestrian', (L) => {
  const st = L('m', 0xe2d8c4, PAT.MARBLE), br = L('t', 0x5c4a30), y = 2.1;
  st.bv(-0.75, 0, -1.2, 0.75, 0.3, 1.2, 0.03);
  st.bv(-0.6, 0.3, -1.0, 0.6, 1.9, 1.0, 0.02);
  st.bv(-0.7, 1.9, -1.1, 0.7, y, 1.1, 0.03);
  br.geo(rbox(0.5, 0.55, 1.35, 0.22), mtx(0, y + 1.05, 0));
  for (const [x, z, r] of [[-0.16, 0.5, -0.5], [0.16, 0.45, 0], [-0.16, -0.5, 0], [0.16, -0.5, 0.15]]) br.put(SHAPES.cyl8, x, y + 0.45, z, 0.05, 0.85, 0.05, r, 0, 0);
  br.geo(rbox(0.22, 0.7, 0.3, 0.1), mtx(0, y + 1.5, 0.72, 0.6, 0, 0));
  br.geo(rbox(0.2, 0.22, 0.5, 0.08), mtx(0, y + 1.85, 0.98, 0.35, 0, 0));
  br.geo(tube('wp-eq-tail', [[0, y + 1.2, -0.68], [0, y + 1.0, -0.85], [0, y + 0.55, -0.9]], 0.05, 8, 5), mtx());
  br.geo(lathe('wp-eq-rider', [[0.2, 0], [0.18, 0.35], [0.14, 0.62], [0.08, 0.7], [0.001, 0.72]], 10), mtx(0, y + 1.3, 0.05));
  br.put(SHAPES.sphere, 0, y + 2.12, 0.08, 0.11, 0.13, 0.11);
  for (const x of [-0.26, 0.26]) br.put(SHAPES.cyl8, x, y + 1.15, 0.12, 0.05, 0.55, 0.05, 0.9, 0, 0);
  br.put(SHAPES.cyl8, 0.25, y + 1.75, 0.3, 0.035, 0.5, 0.035, 1.1, 0, -0.3);
});
const obeliskPart = () => part('wp-obelisk', (L) => {
  const st = L('m', 0xd9cdb4, PAT.MARBLE), gr = L('m', 0xc2a58c, PAT.ASHLAR);
  st.bv(-1.0, 0, -1.0, 1.0, 0.35, 1.0, 0.03); st.bv(-0.75, 0.35, -0.75, 0.75, 1.6, 0.75, 0.02); st.bv(-0.85, 1.6, -0.85, 0.85, 1.8, 0.85, 0.03);
  gr.geo(lathe('wp-obelisk', [[0.56, 0], [0.4, 7.0], [0.001, 7.6]], 4), mtx(0, 1.8, 0, 0, Math.PI / 4, 0));
  L('t', 0xd4af37).put(SHAPES.sphere, 0, 9.5, 0, 0.12, 0.12, 0.12);
});
const victoryColumnPart = () => part('wp-column', (L) => {
  const st = L('m', 0xd9cdb4, PAT.MARBLE), br = L('t', 0x7a6440);
  st.bv(-1.1, 0, -1.1, 1.1, 0.3, 1.1, 0.03); st.bv(-0.8, 0.3, -0.8, 0.8, 2.0, 0.8, 0.02);
  br.geo(lathe('wp-col', [[0.55, 0], [0.5, 0.2], [0.42, 0.4], [0.38, 8.0], [0.55, 8.2], [0.55, 8.5], [0.25, 8.6], [0.25, 9.0]], 20), mtx(0, 2.0, 0));
  for (let i = 0; i < 16; i++) br.put(SHAPES.torus, 0, 2.6 + i * 0.48, 0, 0.41, 0.41, 0.35, Math.PI / 2 + 0.12, 0, 0);
  br.geo(lathe('wp-col-fig', [[0.14, 0], [0.12, 0.4], [0.16, 0.7], [0.08, 0.95], [0.1, 1.05], [0.001, 1.2]], 10), mtx(0, 11.0, 0));
});

// ---------- builder ----------
export function buildWorldPark(T, id, x0, y0, z0, seed, exposed, city, c) {
  const room = parkRoom(city, c), S = stage(T, x0, y0, z0, c, room);
  const rh = (k) => hash(room.x0 + 3, room.z0 + 5, 29, k); // stable per room
  const curb = (d, w, h, color) => {
    const along = d >= 2, p = d % 2 === 0 ? 4 - w / 2 : w / 2;
    T.g.m.box(along ? x0 + 2 : x0 + p, S.top + h / 2, along ? z0 + p : z0 + 2, along ? 4 : w, h, along ? w : 4, color);
  };
  const edges = (fn) => exposed.forEach((e, d) => { if (e) fn(d); });

  switch (id) {
    // Jardin des Tuileries / Luxembourg: round basin, tall jet, toy boats, a ring of green chairs.
    case 'bassin': {
      S.base(0xd9ccad, PAT.GRAVEL);
      const R = clamp(half(Math.min(S.hw, S.hd) * 0.6), 1.2, 9), lawn = [0x6f9a4f, PAT.GRASS];
      if (!S.small) S.raster((u, v) => (Math.hypot(u, v) > R + 1.7 && Math.abs(u) > 1.1 && Math.abs(v) > 1.1 && Math.abs(u) < S.hw - 0.6 && Math.abs(v) < S.hd - 0.6 ? lawn : null), 0.25, 0.06);
      if (S.anchor) {
        S.P(basinPart(rh(1) < 0.3 ? 'quatre' : 'round', R, 'jet'), 0, 0);
        if (R >= 2) {
          const n = Math.floor((TAU * (R + 0.9)) / 1.2);
          for (let i = 0; i < n; i++) {
            if (rh(10 + i) < 0.35) continue;
            const a = (i / n) * TAU + 0.2, r = R + 0.85 + rh(200 + i) * 0.4, x = Math.cos(a) * r, z = Math.sin(a) * r;
            S.P(chairPart(0x3f6b4a), x, z, faceTo(x, z) + (rh(400 + i) - 0.5) * 0.9);
          }
          for (let i = 0; i < 3; i++) { const a = rh(600 + i) * TAU, r = R * (0.35 + 0.35 * rh(610 + i)); S.P(boatPart(i), Math.cos(a) * r, Math.sin(a) * r, rh(620 + i) * TAU, 1.4, 0.42); }
        }
        if (!S.small) {
          for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) S.P(lampPostPart(), x * (R + 2.0), z * (R + 2.0), faceTo(z, -x));
          if (S.hw >= 10 && S.hd >= 8) for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.P(anyTreePart(rh(700 + sx * 2 + sz), 1.15, 0), sx * (S.hw - 2.0), sz * (S.hd - 2.0));
        }
      }
      edges((d) => curb(d, 0.2, 0.28, [0x9a968e, PAT.ASHLAR]));
      break;
    }

    // Versailles: parterre de broderie — box-hedge scrolls on brick-dust gravel around a basin.
    case 'parterre': {
      S.base(0xe3d6b6, PAT.GRAVEL);
      const qx = S.hw / 2, qz = S.hd / 2, pr = Math.min(qx, qz) - 0.7, clear = clamp(Math.min(S.hw, S.hd) * 0.4, 1.4, 3.2), k = pr / (4.5 * Math.PI);
      // 0 path, 1 hedge, 2 colored gravel, 3 lawn
      const zone = (u, v) => {
        const a = Math.abs(u), b = Math.abs(v);
        if (a < 0.8 || b < 0.8 || Math.hypot(u, v) < clear) return 0;
        const ea = S.hw - 0.45 - a, eb = S.hd - 0.45 - b;
        if (ea < 0 || eb < 0) return 0;
        if (Math.min(ea, eb) < 0.24) return 1;
        if (pr < 0.8) return Math.min(ea, eb) > 0.55 ? 3 : 0;
        const du = a - qx, dv = b - qz, r = Math.hypot(du, dv);
        if (Math.abs(r - pr) < 0.13) return 1;
        if (r < pr) {
          const turns = (r / k - (Math.atan2(dv, du) + Math.PI)) / TAU;
          return r > 0.3 && Math.abs(turns - Math.round(turns)) * TAU * k < 0.11 ? 1 : 2;
        }
        if (Math.abs(Math.hypot(S.hw - 1.3 - a, S.hd - 1.3 - b) - 0.45) < 0.11) return 1;
        return 3;
      };
      const hedge = [0x355f2e, PAT.GRASS], dust = [0xb5654a, PAT.GRAVEL], lawn = [0x76a052, PAT.GRASS];
      S.raster((u, v) => { const z = zone(u, v); return z === 2 ? dust : z === 3 ? lawn : null; }, 0.2);
      S.raster((u, v) => (zone(u, v) === 1 ? hedge : null), 0.2, 0.42);
      if (S.anchor) {
        S.P(basinPart('quatre', clamp(clear - 0.8, 0.8, 2.2), 'jet'), 0, 0);
        if (pr >= 0.8) for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.P(conePart(), sx * qx, sz * qz);
        if (!S.small) for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.P(urnPart(), sx * (clear + 0.5) * 0.72, sz * (clear + 0.5) * 0.72);
      }
      break;
    }

    // Alhambra / Taj Mahal char bagh: four raised lawns split by marble water channels, a star pool,
    // cypress avenues and orange trees.
    case 'chahar': {
      S.base(0xc4906a, PAT.BRICK);
      const marble = [0xe8e2d6, PAT.MARBLE], water = [0x3f86ad, 0], grass = [0x5f8f47, PAT.GRASS];
      const pool = clamp(half(Math.min(S.hw, S.hd) * 0.3), 1.0, 3.0), cw = 0.35, lip = 0.22, gap = cw + lip + 0.55;
      for (const su of [-1, 1]) for (const sv of [-1, 1]) {
        const ua = su < 0 ? -S.hw + 0.5 : gap, ub = su < 0 ? -gap : S.hw - 0.5, va = sv < 0 ? -S.hd + 0.5 : gap, vb = sv < 0 ? -gap : S.hd - 0.5;
        if (ub - ua < 0.4 || vb - va < 0.4) continue;
        S.rect('m', ua, ub, va, vb, 0, 0.1, marble);
        S.rect('m', ua + 0.14, ub - 0.14, va + 0.14, vb - 0.14, 0.1, 0.17, grass);
      }
      for (const alongU of [true, false]) for (const s of [-1, 1]) {
        const len = alongU ? S.hw : S.hd, a0 = s < 0 ? -len + 0.5 : pool - 0.1, a1 = s < 0 ? -(pool - 0.1) : len - 0.5;
        if (a1 - a0 < 0.2) continue;
        const box = (b0, b1, ya, yb, col, mat = 'm') => (alongU ? S.rect(mat, a0, a1, b0, b1, ya, yb, col) : S.rect(mat, b0, b1, a0, a1, ya, yb, col));
        box(-(cw + lip), cw + lip, 0, 0.08, marble);
        box(cw, cw + lip, 0.08, 0.2, marble);
        box(-(cw + lip), -cw, 0.08, 0.2, marble);
        box(-cw, cw, 0.08, 0.15, water, 'wd');
      }
      if (S.anchor) {
        S.P(basinPart('star8', pool, 'jet'), 0, 0);
        const side = cw + lip + 0.3;
        if (!S.small) for (const [len, alongU] of [[S.hw, true], [S.hd, false]]) {
          for (let t = pool + 1.4, i = 0; t < len - 0.9; t += 2.4, i++) for (const s of [-1, 1]) for (const o of [-1, 1]) {
            if (alongU) S.P(cypressPart(i % 3), s * t, o * side); else S.P(cypressPart((i + 1) % 3), o * side, s * t);
          }
        }
        const bu = (gap + S.hw - 0.5) / 2, bv = (gap + S.hd - 0.5) / 2;
        if (S.hw - gap > 1.6 && S.hd - gap > 1.6) for (const su of [-1, 1]) for (const sv of [-1, 1]) S.P(citrusPart((su + 1 + (sv + 1) / 2) % 3), su * bu, sv * bv, 0, 1, 0.17);
      }
      edges((d) => curb(d, 0.3, 0.45, marble));
      break;
    }

    // Lisbon's Rossio: calçada portuguesa — black basalt waves on white limestone, a bronze fountain.
    case 'wavepaving': {
      S.base(0xe9e2cf, PAT.ASHLAR);
      const dark = [0x2e2e32, PAT.ASHLAR];
      S.raster((u, v, wx, wz) => (frac((wz + 1.2 * Math.sin((wx / 7.5) * TAU)) / 2.4) < 0.5 ? dark : null), 0.2);
      if (S.anchor && !S.small) {
        const R = clamp(half(Math.min(S.hw, S.hd) * 0.35), 1.5, 3);
        S.P(basinPart('octa', R, 'bronze'), 0, 0);
        for (const s of [-1, 1]) { const x = S.hw >= S.hd ? s * (R + 2.2) : 0, z = S.hw >= S.hd ? 0 : s * (R + 2.2); S.P(benchPart(), x, z, faceTo(x, z) + Math.PI); }
        if (S.hw >= 8 && S.hd >= 8) for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.P(lampPostPart(), sx * (S.hw - 1.2), sz * (S.hd - 1.2), faceTo(sx, sz) + Math.PI / 2);
      } else if (S.small && hash(c.x, c.z, 41) < 0.2) S.B(benchPart(), 2, 2, hash(c.x, c.z, 43) < 0.5 ? 0 : Math.PI / 2);
      edges((d) => curb(d, 0.2, 0.22, [0x9a968e, PAT.ASHLAR]));
      break;
    }

    // Rome's Campidoglio: an oval of interlocking curved lozenges radiating from a monument.
    case 'starpiazza': {
      S.base(0x8f877a, PAT.ASHLAR);
      const light = [0xe4dac4, PAT.ASHLAR], ex = S.hw - 0.8, ez = S.hd - 0.8, Rm = (ex + ez) / 2;
      S.raster((u, v) => {
        const nx = u / ex, nz = v / ez, r = Math.hypot(nx, nz);
        if (r >= 1) return light;
        if (r > 0.93) return null;
        if (r > 0.9 || r < 0.14) return light;
        const t = (Math.atan2(nz, nx) / TAU) * 12, q = r * 6;
        const d = Math.min(Math.abs(frac(t + q + 0.5) - 0.5), Math.abs(frac(t - q + 0.5) - 0.5));
        return d < 0.08 * Math.hypot(12 / (TAU * r * Rm), 6 / Rm) ? light : null;
      }, 0.12);
      if (S.anchor) {
        const kind = S.small ? 0 : Math.floor(rh(1) * 3);
        S.P([equestrianPart, obeliskPart, victoryColumnPart][kind](), 0, 0, S.hw > S.hd ? Math.PI / 2 : 0, S.small ? 0.6 : 1);
        if (!S.small) for (const s of [-1, 1]) {
          const x = S.hw >= S.hd ? s * (ex + 0.4) : 0, z = S.hw >= S.hd ? 0 : s * (ez + 0.4);
          S.P(lampPostPart(), x, z, faceTo(x, z) + Math.PI / 2);
        }
      }
      edges((d) => curb(d, 0.25, 0.35, [0xd8cdb8, PAT.ASHLAR]));
      break;
    }

    // Bordeaux's Miroir d'eau: a film of water on dark granite with a grid of ground jets.
    case 'jetgrid': {
      S.base(0x3a3e44, PAT.CONCRETE);
      const ins = (d) => (exposed[d] ? 0.35 : 0);
      const xa = x0 + ins(1), xb = x0 + 4 - ins(0), za = z0 + ins(3), zb = z0 + 4 - ins(2);
      T.g.wd.box((xa + xb) / 2, S.top + 0.012, (za + zb) / 2, xb - xa, 0.02, zb - za, [0x5d88a6, 0]);
      for (const lx of [1, 3]) for (const lz of [1, 3]) {
        const wx = x0 + lx, wz = z0 + lz;
        S.B(jetPart(Math.floor((0.5 + 0.5 * Math.sin(wx * 0.31 + Math.cos(wz * 0.23) * 2)) * 5.99)), lx, lz, 0, 1, 0.02);
      }
      edges((d) => curb(d, 0.35, 0.06, [0x55595f, PAT.CONCRETE]));
      break;
    }

    // Palais-Royal / Bryant Park: rows of box-pruned plane trees over gravel, café tables beneath.
    case 'bosque': {
      S.base(0xd8ccb0, PAT.GRAVEL);
      S.B(pleachedPart(Math.floor(seed * 4)), 2, 2);
      const h = hash(c.x, c.z, 23);
      if (h < 0.6) {
        const a = hash(c.x, c.z, 29) * TAU, lx = 2 + Math.cos(a) * 1.2, lz = 2 + Math.sin(a) * 1.2;
        S.B(bistroTablePart(), lx, lz);
        for (const o of [0.4, Math.PI + 0.4]) { const dx = Math.cos(a + o) * 0.55, dz = Math.sin(a + o) * 0.55; S.B(chairPart(0x2f4f3f), lx + dx, lz + dz, faceTo(dx, dz)); }
      } else if (h > 0.88) S.B(lampPostPart(), 0.5, 0.5, hash(c.x, c.z, 3) * TAU);
      edges((d) => { const [ex, ez, ry] = EDGE[d]; S.B(ironRailingPart(4, 0.8, false), ex, ez, ry); });
      break;
    }

    // Portland's Lovejoy Fountain: stepped concrete terraces with sheets of water spilling down.
    case 'cascade': {
      S.base(0xb9b2a4, PAT.CONCRETE);
      const conc = [0xc6bfb1, PAT.CONCRETE], sheet = [0x7fb2d4, 0], foam = [0xeef8ff, 0];
      const n = clamp(Math.floor((Math.min(S.hw, S.hd) - 1.0) / 0.95), 1, 6);
      for (let i = 0; i < n; i++) {
        const inset = 0.7 + i * 0.95, h = 0.42 * (i + 1), lo = h - 0.42, t = 0.03;
        const ua = -S.hw + inset, ub = S.hw - inset, va = -S.hd + inset, vb = S.hd - inset;
        S.rect('m', ua, ub, va, vb, 0, h, conc);
        S.rect('wd', ua + 0.02, ub - 0.02, va + 0.02, vb - 0.02, h, h + 0.02, sheet);
        S.rect('wd', ua - t, ua, va, vb, lo, h + 0.01, sheet); S.rect('wd', ub, ub + t, va, vb, lo, h + 0.01, sheet);
        S.rect('wd', ua, ub, va - t, va, lo, h + 0.01, sheet); S.rect('wd', ua, ub, vb, vb + t, lo, h + 0.01, sheet);
        S.rect('l', ua - 0.14, ua - t, va, vb, lo, lo + 0.04, foam); S.rect('l', ub + t, ub + 0.14, va, vb, lo, lo + 0.04, foam);
        S.rect('l', ua, ub, va - 0.14, va - t, lo, lo + 0.04, foam); S.rect('l', ua, ub, vb + t, vb + 0.14, lo, lo + 0.04, foam);
      }
      if (S.anchor) {
        const y = 0.42 * n + 0.02, w = S.hw - 0.7 - (n - 1) * 0.95, d = S.hd - 0.7 - (n - 1) * 0.95;
        S.P(jetPart(5), 0, 0, 0, 1.4, y);
        if (w > 1.2 && d > 1.2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.P(jetPart(1), sx * w * 0.55, sz * d * 0.55, 0, 1, y);
      }
      edges((d) => curb(d, 0.25, 0.3, [0x9a968e, PAT.CONCRETE]));
      break;
    }
  }
}
