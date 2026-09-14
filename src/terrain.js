// Map blocks: a terrain layer on the plots. Each empty plot block may carry a land cover or water
// type and a height in metres. Block values are blended into one smooth heightfield that always
// returns to ground level where it meets streets, buildings and parks, so hills ramp down to the
// curb and lakes sink below it. Rendered in chunks with per-type decor (trees, crops, reeds…).
import * as THREE from 'three';
import { CELL, TERRAIN, TERRAIN_MIN_H, TERRAIN_MAX_H } from './catalog.js';
import { GeoBuilder, PAT, SHAPES, lathe, foliage, hash, rng } from './geo.js';
import { part, mtx } from './kit.js';
import { PartBatcher } from './batch.js';
import { applyPatterns } from './patterns.js';
import { shrubPart, lampPostPart, benchPart, bollardPart, pottedPlantPart, carParts, rbox } from './props.js';
import { anyTreePart, duckPart, newsstandPart } from './props2.js';

export const GROUND_Y = 0.02;   // top of the concrete plot slab
export const WATER_Y = -0.18;   // water surface
export const TCHUNK = 8;
export const tk = (x, z) => x * 4096 + z;
export const chunkKey = (x, z) => `${Math.floor(x / TCHUNK)},${Math.floor(z / TCHUNK)}`;
const isWater = (t) => TERRAIN[t]?.group === 'water';
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const LAND_REACH = 48; // how many blocks the land can grow past the grid
const hasCells = (city, x, z) => { for (let y = city.minY; y <= city.maxY; y++) if (city.get(x, y, z)) return true; return false; };

// Ground color and surface relief per type (water types: bed color + water color).
const LOOK = {
  grass: { c: 0x6f9a4f, p: PAT.GRASS }, meadow: { c: 0x86a852, p: PAT.GRASS }, forest: { c: 0x557a3e, p: PAT.GRASS },
  pines: { c: 0x4e6b45, p: PAT.GRASS }, farm: { c: 0x7a5a3a, p: PAT.GRAVEL }, sand: { c: 0xe2cf9e, p: PAT.STUCCO },
  desert: { c: 0xd9a86a, p: PAT.STUCCO }, rock: { c: 0x8a857c, p: PAT.CONCRETE }, snow: { c: 0xf1f4f7, p: PAT.STUCCO },
  dirt: { c: 0x8a6a4a, p: PAT.GRAVEL }, marsh: { c: 0x5f7048, p: PAT.GRASS },
  lake: { c: 0x4e5a4c, p: PAT.GRAVEL, water: 0x2d6f99 }, shallows: { c: 0xb8a67a, p: PAT.GRAVEL, water: 0x5cb0c8 },
};
const ROCK = new THREE.Color(0x8a8175), SNOW = new THREE.Color(0xf2f4f6), BED_SHALLOW = new THREE.Color(0xc2b080), BED_DEEP = new THREE.Color(0x3f4d45);

// Resting surface height of one block (before blending).
function surf(r, x, z) {
  switch (r.t) {
    case 'lake': return -2.4;
    case 'shallows': return -0.75;
    case 'marsh': return r.h - 0.1;
    case 'desert': return r.h + 0.3 + 0.35 * Math.sin(x * 1.7 + z * 0.6);
    case 'rock': return r.h + 0.35 + hash(x, z, 5) * 0.9;
    default: return r.h + 0.05;
  }
}

// Height of the land at a world position.
export function heightAt(city, wx, wz) {
  const L = city.layout, T = city.terrain;
  const fx = (wx - L.ox) / CELL, fz = (wz - L.oz) / CELL, cx = Math.floor(fx), cz = Math.floor(fz);
  if (!T.has(tk(cx, cz))) return GROUND_Y;
  // Fade to ground level within 2 m of any block without terrain.
  const lx = (fx - cx) * CELL, lz = (fz - cz) * CELL;
  let dmin = 2;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if ((!dx && !dz) || T.has(tk(cx + dx, cz + dz))) continue;
    const ex = dx < 0 ? lx : CELL - lx, ez = dz < 0 ? lz : CELL - lz;
    dmin = Math.min(dmin, dx && dz ? Math.hypot(ex, ez) : dx ? ex : ez);
  }
  // Smoothstep-weighted blend between the four nearest block centers.
  const gx = fx - 0.5, gz = fz - 0.5, ix = Math.floor(gx), iz = Math.floor(gz);
  const tx = smooth(0, 1, gx - ix), tz = smooth(0, 1, gz - iz);
  const v = (i, j) => { const r = T.get(tk(i, j)); return r ? surf(r, i, j) : GROUND_Y; };
  const a = v(ix, iz) + (v(ix + 1, iz) - v(ix, iz)) * tx, b = v(ix, iz + 1) + (v(ix + 1, iz + 1) - v(ix, iz + 1)) * tx;
  return GROUND_Y + (a + (b - a) * tz - GROUND_Y) * smooth(0, 1, dmin / 2);
}

// ---------- editing ----------
export function terrainBlocked(city, x, z) {
  if (!city.layout.inMap(x, z)) return 'Outside the map';
  if (city.layout.isStreet(x, z)) return "That's a street — shape the plots between streets";
  if (hasCells(city, x, z)) return 'Clear the buildings or parks here first';
  return null;
}

// Work out what a map block would change over `cells` (centered on cx, cz with brush radius r).
// Returns { out: [{ x, z, rec }], cost, err } without touching the city.
export function planTerrain(city, id, cells, cx, cz, r = 0) {
  const T = city.terrain, def = TERRAIN[id], out = [];
  if (def.group === 'land') return planLand(city, id, cells);
  if (def.group === 'streets') return planRoads(city, id, cells);
  let err = null, cost = 0;
  for (const [x, z] of cells) {
    if (id === 'clear' && city.roads.has(tk(x, z))) { out.push({ kind: 'road', x, z, rec: null }); continue; }
    const e = terrainBlocked(city, x, z);
    if (e) { err = err || e; continue; }
    const cur = T.get(tk(x, z)) || null, h0 = cur ? cur.h : 0;
    let next;
    if (def.group !== 'elev') next = { t: id, h: h0 };
    else if (id === 'clear') next = null;
    else {
      if (cur && isWater(cur.t)) { err = err || 'Water keeps its level — paint land over it first'; continue; }
      let h = h0;
      if (id === 'raise') h = h0 + 1;
      else if (id === 'lower') h = h0 - 1;
      else if (id === 'hill') { const d = Math.max(Math.abs(x - cx), Math.abs(z - cz)), rr = Math.max(2, r + 1); h = h0 + Math.round((2 + rr) * Math.max(0, 1 - d / rr)); }
      else if (id === 'mesa') h = Math.max(h0, 6);
      else if (id === 'level') h = 0;
      else if (id === 'smooth') {
        let s = 0;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = T.get(tk(x + dx, z + dz)); s += n && !isWater(n.t) ? n.h : 0; }
        h = Math.round(s / 9);
      }
      h = Math.max(TERRAIN_MIN_H, Math.min(TERRAIN_MAX_H, h));
      next = cur ? { t: cur.t, h } : { t: h < 0 ? 'dirt' : 'grass', h };
      if (!cur && h === 0) continue;
    }
    if (cur ? next && next.t === cur.t && next.h === cur.h : !next) continue;
    out.push({ kind: 'terrain', x, z, rec: next });
    cost += def.group === 'elev' && id !== 'clear' ? def.cost * Math.max(1, Math.abs((next?.h ?? 0) - h0)) : def.cost;
  }
  return { out, cost, err, count: out.length };
}

// Expand: new ground must be off the map and join existing land (directly or through the brush).
// Shrink: removes empty expanded land only.
function planLand(city, id, cells) {
  const L = city.layout, out = [];
  let err = null;
  if (id === 'expand') {
    const want = new Map(), ok = new Set();
    for (const [x, z] of cells) {
      if (L.inMap(x, z)) continue;
      if (x < -LAND_REACH || z < -LAND_REACH || x >= L.sizeX + LAND_REACH || z >= L.sizeZ + LAND_REACH) { err = err || 'The land can’t reach any further out'; continue; }
      want.set(tk(x, z), [x, z]);
    }
    // The grass margin around the grid already reads as the city's edge, so building out from it counts.
    const margin = (x, z) => x >= -2 && z >= -2 && x <= L.sizeX + 1 && z <= L.sizeZ + 1;
    const inReach = (x, z) => x >= -LAND_REACH && z >= -LAND_REACH && x < L.sizeX + LAND_REACH && z < L.sizeZ + LAND_REACH;
    // Aiming out into space grows a causeway back to the existing ground, as wide as the brush.
    const E = L.ext;
    for (const [x0, z0] of [...want.values()]) {
      let x = x0, z = z0;
      for (let i = 0; i < LAND_REACH * 2 && !L.inMap(x, z) && !margin(x, z); i++) {
        const dz = z < E.z0 ? 1 : z > E.z1 ? -1 : 0, dx = x < E.x0 ? 1 : x > E.x1 ? -1 : 0;
        if (dz) z += dz; else if (dx) x += dx; else break;
        if (!L.inMap(x, z) && inReach(x, z)) want.set(tk(x, z), [x, z]);
      }
    }
    for (let grew = true; grew;) {
      grew = false;
      for (const [k, [x, z]] of want) {
        if (ok.has(k) || !(margin(x, z) || N4.some(([dx, dz]) => L.inMap(x + dx, z + dz) || ok.has(tk(x + dx, z + dz))))) continue;
        ok.add(k);
        grew = true;
      }
    }
    for (const [k, [x, z]] of want) if (ok.has(k)) out.push({ kind: 'land', x, z, rec: true }); else err = err || 'New land has to join the existing ground';
    if (!out.length) err = err || 'This is already land — aim past the edge of the map';
  } else {
    for (const [x, z] of cells) {
      if (!city.land.has(tk(x, z))) { if (L.inGrid(x, z)) err = err || 'The original city grid stays'; continue; }
      if (city.roads.has(tk(x, z)) || city.terrain.has(tk(x, z))) { err = err || 'Clear the roads and terrain here first'; continue; }
      if (hasCells(city, x, z)) { err = err || 'Clear the buildings or parks here first'; continue; }
      out.push({ kind: 'land', x, z, rec: false });
    }
  }
  return { out, cost: out.length * TERRAIN[id].cost, err, count: out.length };
}

// Roads & paths go on dry, level, empty ground (level land cover is replaced).
function planRoads(city, id, cells) {
  const L = city.layout, out = [];
  let err = null, cost = 0, count = 0;
  for (const [x, z] of cells) {
    if (!L.inMap(x, z)) { err = err || 'Expand the land here first'; continue; }
    if (L.isGridStreet(x, z)) { err = err || "That's already a city street"; continue; }
    if (hasCells(city, x, z)) { err = err || 'Clear the buildings or parks here first'; continue; }
    const land = city.terrain.get(tk(x, z));
    if (land && (TERRAIN[land.t].group === 'water' || land.h !== 0)) { err = err || 'Roads need dry, level land'; continue; }
    if (city.roads.get(tk(x, z))?.t === id) continue;
    if (land) out.push({ kind: 'terrain', x, z, rec: null });
    out.push({ kind: 'road', x, z, rec: id });
    cost += TERRAIN[id].cost;
    count++;
  }
  return { out, cost, err, count };
}

// ---------- decor parts ----------
const FLOWERS = [0xe63946, 0xffd166, 0xffffff, 0xc77dff, 0xff6fb5, 0xf4a261];
const flowerPart = (k) => part(`tr-flowers:${k}`, (L) => {
  const stem = L('m', 0x5e8c41, PAT.GRASS);
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4, r = 0.12 + (i % 5) * 0.13, x = Math.cos(a) * r, z = Math.sin(a) * r;
    stem.put(SHAPES.cyl8, x, 0.16, z, 0.01, 0.32, 0.01);
    L('m', FLOWERS[(i + k) % 6]).put(SHAPES.ico, x, 0.34, z, 0.055, 0.035, 0.055);
  }
  stem.geo(foliage(k * 0.2), mtx(0, 0.05, 0, 0, k, 0, 0.45, 0.12, 0.45));
});
const reedsPart = (k) => part(`tr-reeds:${k}`, (L) => {
  const g = L('m', 0x8a9a50), head = L('m', 0x5a3a24);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.1 + k, r = (i % 4) * 0.1, h = 0.9 + ((i * 7 + k) % 5) * 0.15, x = Math.cos(a) * r, z = Math.sin(a) * r, lean = Math.sin(i + k) * 0.12;
    g.put(SHAPES.cyl8, x, h / 2, z, 0.012, h, 0.012, lean, 0, lean * 0.5);
    if (i % 3 === 0) head.put(SHAPES.cyl8, x - lean * 0.25 * h, h * 0.95, z + lean * 0.5 * h, 0.03, 0.18, 0.03, lean, 0, lean * 0.5);
  }
});
const cactusPart = (k) => part(`tr-cactus:${k}`, (L) => {
  const g = L('m', 0x4f7f3a, PAT.GRASS), h = 1.5 + k * 0.5;
  g.geo(lathe(`tr-cac:${k}`, [[0.16, 0], [0.18, 0.2], [0.17, h], [0.1, h + 0.12], [0.001, h + 0.16]], 10), mtx());
  for (const s of k ? [-1, 1] : [1]) {
    const y = 0.7 + (s + 1) * 0.2;
    g.put(SHAPES.cyl8, s * 0.26, y, 0, 0.09, 0.3, 0.09, 0, 0, Math.PI / 2);
    g.geo(lathe('tr-cac-arm', [[0.1, 0], [0.1, 0.6], [0.05, 0.68], [0.001, 0.7]], 8), mtx(s * 0.42, y, 0));
  }
});
const boulderPart = (k) => part(`tr-boulder:${k}`, (L) => {
  const s = L('m', 0x86817a, PAT.ASHLAR);
  s.geo(foliage(k * 0.13 + 0.05), mtx(0, 0.22, 0, 0.3, k, 0.2, 0.7, 0.5, 0.6));
  s.geo(foliage(k * 0.13 + 0.55), mtx(0.55, 0.12, 0.3, 0.1, k, 0.4, 0.35, 0.28, 0.3));
});
const umbrellaPart = (k) => part(`tr-umbrella:${k}`, (L) => {
  L('t', 0xd8d0c0).put(SHAPES.cyl8, 0, 1.0, 0, 0.025, 2.0, 0.025);
  const a = L('m', [0xe63946, 0x2a66b0, 0xf2c14e][k]), b = L('m', 0xf8f4ea);
  for (let i = 0; i < 8; i++) (i % 2 ? a : b).geo(lathe(`tr-umb:${i}`, [[1.0, 0], [0.001, 0.35]], 1), mtx(0, 1.8, 0, 0, (i / 8) * Math.PI * 2, 0));
  a.geo(lathe('tr-umb-full', [[1.0, 0], [0.001, 0.35]], 16), mtx(0, 1.79, 0));
  L('m', [0x2a9d8f, 0xff6fb5, 0xf4a261][k]).bx(0.6, 0.01, -0.35, 1.5, 0.03, 0.35);
});
const lilyPart = (k) => part(`tr-lily:${k}`, (L) => {
  const pad = L('m', 0x4f8a3a), bloom = L('m', 0xffc8e0);
  for (let i = 0; i < 6; i++) {
    const a = i * 2.3 + k, r = 0.2 + (i % 3) * 0.35, x = Math.cos(a) * r, z = Math.sin(a) * r;
    pad.put(SHAPES.cyl, x, 0, z, 0.2, 0.01, 0.2);
    if (i % 2 === k % 2) bloom.put(SHAPES.ico, x, 0.05, z, 0.06, 0.05, 0.06);
  }
});
const bikeGlyphPart = () => part('tr-bikeglyph', (L) => {
  const w = L('m', 0xf4f4f0);
  for (const x of [-0.42, 0.42]) w.put(SHAPES.torus, x, 0, 0, 0.26, 0.26, 0.7, Math.PI / 2);
  w.put(SHAPES.box, -0.18, 0, 0.06, 0.5, 0.008, 0.04, 0, 0.6, 0);
  w.put(SHAPES.box, 0.2, 0, 0.06, 0.48, 0.008, 0.04, 0, -0.6, 0);
  w.put(SHAPES.box, 0.02, 0, -0.14, 0.5, 0.008, 0.04);
});
const planterPart = (k) => part(`tr-planter:${k}`, (L) => {
  L('m', 0x9a968e, PAT.ASHLAR).geo(rbox(1.5, 0.45, 1.5, 0.08), mtx(0, 0.225, 0));
  L('m', 0x3b2a1e, PAT.GRAVEL).bx(-0.64, 0.44, -0.64, 0.64, 0.46, 0.64);
  L('m', [0x4f7f3a, 0x5e8c41, 0x3f6f35, 0x6a9a4a][k], PAT.GRASS).geo(foliage(k * 0.2), mtx(0.35, 0.56, -0.3, 0, k, 0, 0.35, 0.18, 0.35));
});
const CAR_COLORS = [0xc0392b, 0x2c3e50, 0xecf0f1, 0x27ae60, 0xf1c40f, 0x7f8c8d, 0x2980b9, 0x111111];
const CROPS = [[0xd9b85a, 0.45], [0x6f9a3a, 0.9], [0x9a7cc4, 0.35], [0x7cb342, 0.22]];

// ---------- renderer ----------
const _c = new THREE.Color(), _n = new THREE.Vector3();

export class TerrainRenderer {
  constructor(scene, mats) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mats = mats;
    this.chunks = new Map();
    this.pickables = [];
    this.surfaceMat = applyPatterns(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    this.waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.82 });
  }

  setCity(city) {
    for (const k of [...this.chunks.keys()]) this.drop(k);
    this.city = city;
    for (const r of city.terrain.values()) city.terrainDirty.add(chunkKey(r.x, r.z));
    for (const r of city.roads.values()) city.terrainDirty.add(chunkKey(r.x, r.z));
    this.pickables = [];
  }

  drop(k) {
    const ch = this.chunks.get(k);
    if (!ch) return;
    ch.group.traverse((o) => { if (o.isBatchedMesh) o.dispose(); else if (o.geometry) o.geometry.dispose(); });
    this.group.remove(ch.group);
    this.chunks.delete(k);
  }

  process(budgetMs = 16) {
    const dirty = this.city.terrainDirty;
    if (!dirty.size) return;
    const t0 = performance.now();
    for (const ck of dirty) {
      dirty.delete(ck);
      this.buildChunk(ck);
      if (performance.now() - t0 > budgetMs) break;
    }
    this.pickables = [...this.chunks.values()].flatMap((ch) => ch.pick);
  }

  setUnderground(on) {
    Object.assign(this.surfaceMat, { transparent: on, opacity: on ? 0.3 : 1, depthWrite: !on, needsUpdate: true });
    this.waterMat.opacity = on ? 0.3 : 0.82;
  }

  // Nearest point on the land or water surface under the ray, or null.
  pick(raycaster) {
    return raycaster.intersectObjects(this.pickables, false)[0]?.point || null;
  }

  buildChunk(ck) {
    this.drop(ck);
    const city = this.city, L = city.layout, T = city.terrain;
    const [cx, cz] = ck.split(',').map(Number);
    const P = [], N = [], C = [], A = [], WP = [], WN = [], WC = [];
    const bat = new PartBatcher(), ex = new GeoBuilder(), exW = new GeoBuilder();
    const n = 4, st = CELL / n, S = n + 3, hs = new Float32Array(S * S);

    for (let x = cx * TCHUNK; x < (cx + 1) * TCHUNK; x++) for (let z = cz * TCHUNK; z < (cz + 1) * TCHUNK; z++) {
      const rd = city.roads.get(tk(x, z));
      if (rd) this.buildRoad(rd, x, z, L.wx(x), L.wz(z), ex, bat);
      const r = T.get(tk(x, z));
      if (!r) continue;
      const look = LOOK[r.t], water = isWater(r.t), x0 = L.wx(x), z0 = L.wz(z);
      for (let i = -1; i <= n + 1; i++) for (let j = -1; j <= n + 1; j++) hs[(i + 1) * S + j + 1] = heightAt(city, x0 + i * st, z0 + j * st);
      const H = (i, j) => hs[(i + 1) * S + j + 1];
      const vert = (i, j) => {
        const y = H(i, j), dx = (H(i + 1, j) - H(i - 1, j)) / (2 * st), dz = (H(i, j + 1) - H(i, j - 1)) / (2 * st);
        const wx = x0 + i * st, wz = z0 + j * st;
        _n.set(-dx, 1, -dz).normalize();
        if (water) _c.copy(BED_SHALLOW).lerp(BED_DEEP, smooth(-0.2, -2.2, y));
        else {
          _c.set(look.c).multiplyScalar(0.92 + 0.16 * hash(Math.round(wx * 2), Math.round(wz * 2), 13));
          _c.lerp(ROCK, smooth(0.6, 1.4, Math.hypot(dx, dz)) * 0.8);
          if (r.t !== 'desert' && r.t !== 'sand') _c.lerp(SNOW, smooth(11, 17, y));
        }
        P.push(wx, y, wz); N.push(_n.x, _n.y, _n.z); C.push(_c.r, _c.g, _c.b); A.push(look.p);
      };
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { vert(i, j); vert(i, j + 1); vert(i + 1, j + 1); vert(i, j); vert(i + 1, j + 1); vert(i + 1, j); }
      if (water) {
        _c.set(look.water);
        for (const [a, b] of [[0, 0], [0, 4], [4, 4], [0, 0], [4, 4], [4, 0]]) { WP.push(x0 + a, WATER_Y, z0 + b); WN.push(0, 1, 0); WC.push(_c.r, _c.g, _c.b); }
      }
      this.decorate(r, x, z, x0, z0, bat, ex, exW);
    }

    const group = new THREE.Group(), pick = [];
    const mesh = (pos, nrm, col, mat, pat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      if (pat) g.setAttribute('pattern', new THREE.Float32BufferAttribute(pat, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      group.add(m);
      pick.push(m);
      return m;
    };
    if (P.length) mesh(P, N, C, this.surfaceMat, A).castShadow = true;
    if (WP.length) mesh(WP, WN, WC, this.waterMat);
    if (!ex.empty) { const m = new THREE.Mesh(ex.build(), this.mats.m); m.castShadow = m.receiveShadow = true; group.add(m); }
    if (!exW.empty) group.add(new THREE.Mesh(exW.build(), this.mats.wd));
    bat.build(group, this.mats);
    if (!group.children.length) return;
    this.group.add(group);
    this.chunks.set(ck, { group, pick });
  }

  // Roads, bike paths, boulevards, lanes and parking: flat street-level surfaces that join their own
  // kind and the city streets, with curbs, sidewalks or bollards where they meet anything else.
  buildRoad(rd, x, z, x0, z0, g, bat) {
    const city = this.city, L = city.layout, R = rng(hash(x, z, 57) + 0.02), Y = GROUND_Y;
    const nb = N4.map(([dx, dz]) => city.roads.get(tk(x + dx, z + dz))?.t || (L.isOpenGridStreet(x + dx, z + dz) ? 'street' : null));
    const wheels = (k) => !!k && k !== 'boulevard';
    const alongX = !!(nb[0] || nb[1]), alongZ = !!(nb[2] || nb[3]);
    const ax = alongZ && !alongX ? 'z' : 'x', straight = alongX !== alongZ;
    const across = ax === 'x' ? [2, 3] : [0, 1]; // [high-v edge, low-v edge]
    const box = (a0, a1, y0, y1, b0, b1, col) => g.box(x0 + (a0 + a1) / 2, Y + (y0 + y1) / 2, z0 + (b0 + b1) / 2, a1 - a0, y1 - y0, b1 - b0, col);
    // u runs along the road and v across it, both 0-4 within the block.
    const rect = (u0, u1, v0, v1, y0, y1, col) => (ax === 'x' ? box(u0, u1, y0, y1, v0, v1, col) : box(v0, v1, y0, y1, u0, u1, col));
    const strip = (d, from, to, y0, y1, col) => { const [a, b] = d % 2 === 0 ? [4 - to, 4 - from] : [from, to]; if (d < 2) box(a, b, y0, y1, 0, 4, col); else box(0, 4, y0, y1, a, b, col); };
    const edgePt = (d, inset, along) => { const p = d % 2 === 0 ? 4 - inset : inset; return d < 2 ? [p, along] : [along, p]; };
    const place = (p, lx, lz, ry = 0, y = 0, colors = {}, s = 1) => bat.place(p, mtx(x0 + lx, Y + y, z0 + lz, 0, ry, 0, s, s, s), colors, 'terrain', 'wd', true);
    const U = (p, u, v, ry = 0, y = 0, colors = {}, s = 1) => (ax === 'x' ? place(p, u, v, ry, y, colors, s) : place(p, v, u, ry + Math.PI / 2, y, colors, s));
    const toCenter = [Math.PI, 0, Math.PI / 2, -Math.PI / 2];
    const car = (u, v, ry, s = 1) => { const cp = carParts(); U(cp.paint, u, v, ry, 0.03, { paint: CAR_COLORS[Math.floor(R() * CAR_COLORS.length)] }, s); U(cp.rest, u, v, ry, 0.03, {}, s); };
    switch (rd.t) {
      case 'road': {
        box(0, 4, 0, 0.03, 0, 4, [0x3b3d42, PAT.GRAVEL]);
        N4.forEach((_, d) => {
          if (wheels(nb[d])) return;
          strip(d, 0, 0.8, 0, 0.16, [0xb8b3a8, PAT.TILE]);
          strip(d, 0.8, 0.92, 0, 0.17, [0x9a968e, PAT.ASHLAR]);
          const k = R();
          if (k < 0.3) { const [lx, lz] = edgePt(d, 0.4, 0.6 + R() * 2.8); place(lampPostPart(), lx, lz, toCenter[d], 0.16); }
          else if (k < 0.5) { const [lx, lz] = edgePt(d, 0.4, 0.6 + R() * 2.8); place(anyTreePart(R(), 0.9, [0, 0, 2, 5][Math.floor(R() * 4)]), lx, lz, R() * 6, 0.16); }
        });
        // A two-block-wide road shares its center line along the joining edge.
        if (straight) across.forEach((d, i) => { if (nb[d] === 'road') for (const u of [0.3, 2.3]) rect(u, u + 1.4, i === 0 ? 3.95 : 0, i === 0 ? 4 : 0.05, 0.03, 0.036, 0xe0b440); });
        const curb = across.findIndex((d) => !wheels(nb[d]));
        if (straight && curb >= 0 && R() < 0.35) car(2, curb === 0 ? 4 - 0.92 - 0.95 : 0.92 + 0.95, R() < 0.5 ? 0 : Math.PI);
        break;
      }
      case 'bikelane': {
        box(0, 4, 0, 0.03, 0, 4, [0x3b3d42, PAT.GRAVEL]);
        rect(0, 4, 0.45, 3.55, 0.03, 0.034, [0x2e8b57, PAT.CONCRETE]);
        if (straight) {
          for (const v of [0.4, 3.6]) rect(0, 4, v - 0.05, v + 0.05, 0.03, 0.036, 0xe8e8e0);
          for (const u of [0.4, 2.4]) rect(u, u + 1.2, 1.96, 2.04, 0.034, 0.038, 0xe8e8e0);
        }
        if (hash(x, z, 3) < 0.4) U(bikeGlyphPart(), 2, 1.1, 0, 0.036);
        N4.forEach((_, d) => {
          if (nb[d] === 'road' || nb[d] === 'street' || nb[d] === 'parking') { for (const a of [0.5, 2, 3.5]) { const [lx, lz] = edgePt(d, 0.15, a); place(bollardPart(), lx, lz, 0, 0.03, {}, 0.8); } return; }
          if (!wheels(nb[d])) strip(d, 0, 0.35, 0, 0.28, [0x9a968e, PAT.ASHLAR]);
        });
        break;
      }
      case 'boulevard': {
        box(0, 4, 0, 0.12, 0, 4, [0xcfc6b4, PAT.TILE]);
        N4.forEach((_, d) => {
          if (nb[d] === 'boulevard') return;
          strip(d, 0, 0.3, 0.12, 0.13, [0x8f877a, PAT.ASHLAR]);
          if (wheels(nb[d])) for (const a of [0.6, 2, 3.4]) { const [lx, lz] = edgePt(d, 0.15, a); place(bollardPart(), lx, lz, 0, 0.12); }
        });
        if (hash(x, z, 17) < 0.5 || !straight) {
          U(planterPart(Math.floor(R() * 4)), 2, 2, 0, 0.12);
          U(anyTreePart(R(), 1.15, [0, 0, 2, 4, 5][Math.floor(R() * 5)]), 2, 2, R() * 6, 0.57);
        } else {
          U(benchPart(), 2, 2.75, 0, 0.12);
          U(benchPart(), 2, 1.25, Math.PI, 0.12);
          U(lampPostPart(), 0.4, 2, 0, 0.12);
          if (R() < 0.25) U(newsstandPart(), 3.4, 2, Math.PI / 2, 0.12);
        }
        break;
      }
      case 'lane': {
        box(0, 4, 0, 0.06, 0, 4, [0x8a8378, PAT.ASHLAR]);
        if (straight) rect(0, 4, 1.85, 2.15, 0.06, 0.066, [0x6a655d, PAT.CONCRETE]);
        N4.forEach((_, d) => {
          const k = nb[d];
          if (k === 'lane' || k === 'boulevard') return;
          if (wheels(k)) { for (const a of [0.7, 2, 3.3]) { const [lx, lz] = edgePt(d, 0.3, a); place(bollardPart(), lx, lz, 0, 0.06); } return; }
          if (R() < 0.5) { const [lx, lz] = edgePt(d, 0.4, 0.5 + R() * 3); place(pottedPlantPart(R(), 1.3), lx, lz, 0, 0.06); }
        });
        break;
      }
      case 'parking': {
        box(0, 4, 0, 0.03, 0, 4, [0x3f4146, PAT.GRAVEL]);
        for (const u of [0, 2]) rect(u + 0.02, u + 0.1, 0.4, 3.6, 0.03, 0.036, 0xe8e8e0);
        for (const u of [1.06, 3.06]) if (R() < 0.65) car(u, 2, Math.PI / 2 + (R() < 0.5 ? 0 : Math.PI), 0.85);
        N4.forEach((_, d) => { if (!wheels(nb[d])) strip(d, 0, 0.2, 0, 0.15, [0x9a968e, PAT.CONCRETE]); });
        break;
      }
    }
  }

  decorate(r, x, z, x0, z0, bat, ex, exW) {
    const city = this.city, R = rng(hash(x, z, 91) + 0.01);
    const at = (lx, lz) => heightAt(city, x0 + lx, z0 + lz);
    const P = (p, lx, lz, s = 1, y = null, cast = true) => bat.place(p, mtx(x0 + lx, y ?? at(lx, lz), z0 + lz, 0, R() * 6.28, 0, s, s, s), {}, 'terrain', 'wd', cast);
    const spot = () => [0.7 + R() * 2.6, 0.7 + R() * 2.6];
    const nearLand = () => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const nb = city.terrain.get(tk(x + dx, z + dz)); return !nb || !isWater(nb.t); });
    const nearWater = () => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isWater(city.terrain.get(tk(x + dx, z + dz))?.t));
    switch (r.t) {
      case 'grass': if (R() < 0.3) P(shrubPart(R(), 0.8 + R() * 0.4), ...spot()); break;
      case 'meadow': for (let i = 0; i < 4; i++) P(flowerPart(Math.floor(R() * 6)), ...spot(), 0.8 + R() * 0.6, null, false); break;
      case 'forest': {
        const slots = [[1, 1], [3, 1], [1, 3], [3, 3]].sort(() => R() - 0.5).slice(0, 2 + Math.floor(R() * 2));
        for (const [a, b] of slots) P(anyTreePart(R(), 1.0 + R() * 0.5, [0, 0, 2, 4, 5][Math.floor(R() * 5)]), a + (R() - 0.5), b + (R() - 0.5));
        break;
      }
      case 'pines': for (const [a, b] of [[1, 1], [3, 1.4], [1.6, 3], [3.2, 3.2]]) if (R() < 0.85) P(anyTreePart(R(), 0.9 + R() * 0.7, 1), a + (R() - 0.5) * 0.6, b + (R() - 0.5) * 0.6); break;
      case 'snow': if (R() < 0.55) P(anyTreePart(R(), 0.8 + R() * 0.5, 1), ...spot()); if (R() < 0.3) P(boulderPart(Math.floor(R() * 4)), ...spot(), 0.6); break;
      case 'farm': {
        const [col, hgt] = CROPS[Math.floor(hash(Math.floor(x / 3), Math.floor(z / 3), 7) * 4)];
        for (let row = 0; row < 4; row++) for (let i = 0; i < 7; i++) {
          const lx = 0.35 + i * 0.55, lz = 0.5 + row, y = at(lx, lz), h = hgt * (0.85 + R() * 0.3);
          ex.box(x0 + lx, y + h / 2, z0 + lz, 0.42, h, 0.36, [col, PAT.GRASS]);
        }
        break;
      }
      case 'sand':
        if (R() < 0.12) P(anyTreePart(R(), 1.0, 3), ...spot());
        else if (nearWater() && R() < 0.35) P(umbrellaPart(Math.floor(R() * 3)), ...spot());
        break;
      case 'desert': if (R() < 0.4) P(cactusPart(Math.floor(R() * 3)), ...spot()); if (R() < 0.25) P(boulderPart(Math.floor(R() * 4)), ...spot(), 0.5); break;
      case 'rock': for (let i = 0, k = 1 + Math.floor(R() * 3); i < k; i++) P(boulderPart(Math.floor(R() * 4)), ...spot(), 0.7 + R() * 0.9); break;
      case 'dirt': if (R() < 0.2) P(boulderPart(Math.floor(R() * 4)), ...spot(), 0.35); break;
      case 'marsh':
        for (let i = 0; i < 3; i++) P(reedsPart(Math.floor(R() * 4)), ...spot(), 0.8 + R() * 0.5);
        if (R() < 0.6) { const [a, b] = spot(), y = at(a, b); exW.box(x0 + a, y + 0.03, z0 + b, 0.9 + R(), 0.02, 0.7 + R() * 0.8, [0x4f7f8f, 0]); }
        break;
      case 'shallows':
        if (nearLand() && R() < 0.5) P(reedsPart(Math.floor(R() * 4)), ...spot(), 1, WATER_Y - 0.6);
        if (R() < 0.35) P(lilyPart(Math.floor(R() * 3)), ...spot(), 1, WATER_Y + 0.01, false);
        break;
      case 'lake': if (R() < 0.08) P(duckPart(R()), ...spot(), 1, WATER_Y, false); break;
    }
  }
}
