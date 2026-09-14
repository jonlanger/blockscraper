// City renderer: builds the whole city in spatial chunks so buildings can be any size.
// The active building renders with clipped materials, peelable facades and full interiors.
import * as THREE from 'three';
import { CELL, MODULES, palette, isHollow } from './catalog.js';
import { GeoBuilder, Frame, hash, rng, PAT } from './geo.js';
import { mtx } from './kit.js';
import { rbox } from './props.js';
import { anyTreePart } from './props2.js';
import { PartBatcher } from './batch.js';
import { applyPatterns } from './patterns.js';
import { FACADES, retainingWall, facadeContext } from './facades.js';
import { FACADES2 } from './facades2.js';
import { facadeExtras, roofDetail, buildTopper, buildOpen, paletteColors } from './details.js';
import { buildPark } from './parks.js';
import { buildInterior } from './interiors.js';
import { buildDecor } from './ornaments.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MAT_KEYS = ['m', 't', 'wl', 'wc', 'wd', 'l'];
const ALL_FACADES = { ...FACADES, ...FACADES2 };
const CAST = ['mold', 'balc', 'awn', 'canopy', 'col', 'pil', 'modil', 'balus', 'dent', 'top:', 'r:', 'tree', 'woodtank', 'hvac', 'bulkhead', 'fire', 'pk-', 'wp-', 'fr-', 'orn:', 'st:', 'win:'];

function makeMats(clippingPlanes) {
  const glass = (emissive) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.6, emissive, emissiveIntensity: 0, clippingPlanes });
  return {
    m: applyPatterns(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, clippingPlanes })),
    t: applyPatterns(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.78, clippingPlanes }), 0.15),
    wl: glass(0xffc477),
    wc: glass(0xd8ecff),
    wd: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.65, clippingPlanes }),
    l: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, clippingPlanes }),
  };
}

const CAR_GEO = (() => {
  const g = new GeoBuilder();
  g.addGeometry(rbox(2.9, 3.2, 2.9, 0.08), new THREE.Matrix4(), 0xc9a14a);
  g.box(0, 1.55, 0, 2.6, 0.04, 2.6, 0xfff4dc);
  return g.build();
})();
const CAR_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.7 });

export class CityRenderer {
  constructor(scene, city) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
    this.matsN = makeMats(null);
    this.matsA = makeMats([this.clip]);
    this.chunks = new Map();
    this.activeId = 0;
    this.elevators = [];
    this.elevGroup = new THREE.Group();
    scene.add(this.elevGroup);
    this.setCity(city);
  }

  setCity(city) {
    for (const ch of this.chunks.values()) this.disposeChunk(ch);
    this.chunks.clear();
    this.city = city;
    for (const ck of city.chunkCells.keys()) city.dirtyChunks.add(ck);
    this.activeId = 0;
    this.elevDirty = true;
  }

  setActive(id) {
    if (id === this.activeId) return;
    this.city.markBuilding(this.activeId);
    this.city.markBuilding(id);
    this.activeId = id;
    this.elevDirty = true;
  }

  get pending() { return this.city.dirtyChunks.size; }

  process(budgetMs = 24) {
    const t0 = performance.now();
    for (const ck of this.city.dirtyChunks) {
      this.city.dirtyChunks.delete(ck);
      this.buildChunk(ck);
      if (performance.now() - t0 > budgetMs) break;
    }
    if (this.elevDirty) { this.elevDirty = false; this.buildElevators(); }
  }

  disposeChunk(ch) {
    for (const m of ch.meshes) { m.geometry.dispose(); if (m.isBatchedMesh) m.dispose(); }
    this.group.remove(ch.group);
  }

  buildChunk(ck) {
    const city = this.city, L = city.layout;
    const old = this.chunks.get(ck);
    if (old) { this.disposeChunk(old); this.chunks.delete(ck); }
    const keys = city.chunkCells.get(ck);
    if (!keys || !keys.size) return;

    const group = new THREE.Group();
    const buckets = new Map();
    const G = (name) => {
      let b = buckets.get(name);
      if (!b) { b = {}; for (const k of MAT_KEYS) b[k] = new GeoBuilder(); buckets.set(name, b); }
      return b;
    };
    const batN = new PartBatcher(), batA = new PartBatcher();
    const castFor = (p) => CAST.some((pre) => p.key.startsWith(pre));
    const placer = (bucket, act, cast = true) => (p, matrix, colors, glass = 'wd') => (act ? batA : batN).place(p, matrix, colors, bucket, glass, cast && castFor(p));
    const local = (bucket, act, S, cast = true) => {
      const place = placer(bucket, act, cast), colors = paletteColors(S);
      return {
        g: G(bucket), S, colors,
        P: (p, x, y, z, ry = 0, glass = 'wd', s = 1, col) => place(p, mtx(x, y, z, 0, ry, 0, s, s, s), col ? { ...colors, ...col } : colors, glass),
        PM: (p, m, col, glass = 'wd') => place(p, m, col ? { ...colors, ...col } : colors, glass),
      };
    };
    const F = new Frame();
    const hollowAt = (x, y, z) => { const n = city.get(x, y, z); return !n || isHollow(n); };

    for (const key of keys) {
      const c = city.cells.get(key);
      if (!c) continue;
      const mod = MODULES[c.m], S = palette(c.s, c.v);
      const act = c.b === this.activeId, pre = act ? 'A:' : '';
      const x0 = L.wx(c.x), y0 = c.y * CELL, z0 = L.wz(c.z);
      const seed = hash(c.x + 11, c.y + 37, c.z + 5);
      const egg = city.eggs.get(key) || null;
      const below = city.get(c.x, c.y - 1, c.z);
      if (c.y > 0 && below && MODULES[below.m].open && !mod.topper) G(pre + 'always').m.bevel(x0 + 2, y0 + 0.04, z0 + 2, 4, 0.12, 4, [S.trim, PAT.CONCRETE], 0.02);
      else if (c.y > 0 && !below && !mod.open && !mod.topper) {
        // Floor spanning a street: a soffit with downlights over the traffic.
        const g = G(pre + 'always');
        g.m.bevel(x0 + 2, y0 + 0.08, z0 + 2, 4, 0.2, 4, [S.trim, PAT.CONCRETE], 0.03);
        for (const [lx, lz] of [[1, 1], [3, 1], [1, 3], [3, 3]]) g.l.box(x0 + lx, y0 - 0.03, z0 + lz, 0.4, 0.02, 0.4, 0xfff4dc);
      }

      if (mod.topper) {
        const nb = DIRS.map(([dx, dz]) => city.get(c.x + dx, c.y, c.z + dz)?.m === c.m);
        buildTopper(local(pre + 'always', act, S), c.m, x0, y0, z0, S, seed, nb, egg);
        continue;
      }
      if (mod.park) {
        const exposed = DIRS.map(([dx, dz]) => { const n = city.get(c.x + dx, c.y, c.z + dz); return !n || !MODULES[n.m].park; });
        buildPark(local(pre + 'always', act, S), c.m, x0, y0, z0, seed, exposed, egg, { city, c });
        continue;
      }
      if (mod.open) {
        const exposed = DIRS.map(([dx, dz]) => hollowAt(c.x + dx, c.y, c.z + dz));
        const T = local(pre + 'always', act, S);
        const sd = L.streetDir(c.x, c.z);
        buildOpen(T, c.m, x0, y0, z0, S, exposed, seed, sd, DIRS.map(([dx, dz]) => city.get(c.x + dx, c.y, c.z + dz)?.m === c.m), c.s, { above: !!city.get(c.x, c.y + 1, c.z) });
        if (egg?.type === 'forest') {
          T.P(anyTreePart(seed, 1.25, 1), x0 + 3.0, y0 + 0.36, z0 + 1.0);
          T.P(anyTreePart(seed + 0.3, 1.1, 5), x0 + 1.0, y0 + 0.36, z0 + 3.0);
          for (const [sx, sz] of [[0.22, 0.22], [3.78, 3.78]]) for (let i = 0; i < 5; i++) T.g.m.box(x0 + sx + Math.sin(i) * 0.1, y0 + 3.6 - i * 0.55, z0 + sz + 0.2, 0.18, 0.5, 0.12, [0x4f7f3a, PAT.GRASS]);
        }
        continue;
      }

      const topOpen = hollowAt(c.x, c.y + 1, c.z);
      for (let d = 0; d < 4; d++) {
        const [dx, dz] = DIRS[d];
        if (!hollowAt(c.x + dx, c.y, c.z + dz)) continue;
        F.set(x0 + 2 + dx * 2, y0, z0 + 2 + dz * 2, dx, dz);
        if (c.y < 0) { retainingWall(G(pre + 'ug' + d), F); continue; }
        const rx = dz, rz = -dx;
        const street = L.isOpenStreet(c.x + dx, c.z + dz) || !L.inMap(c.x + dx, c.z + dz);
        const ctx = {
          level: c.y, isTop: topOpen, isGround: c.y === 0, street,
          isEntrance: c.y === 0 && street && !!mod.entrance,
          seed, col: hash(c.x * 3 + d, c.z * 7 + 1, 11),
          cornerL: hollowAt(c.x - rx, c.y, c.z - rz), cornerR: hollowAt(c.x + rx, c.y, c.z + rz),
          decor: c.o?.[d] || null,
        };
        const X = facadeContext(F, S, c.s, ctx, G(pre + 'side' + d), placer(pre + 'side' + d, act));
        (ALL_FACADES[c.s] || FACADES.deco)(X);
        facadeExtras(X, c.m, c.s);
        const orn = c.o?.[d];
        if (orn) {
          // Runs of the same ornament on the same face join up across neighboring blocks.
          const joins = (x, y, z) => { const n = city.get(x, y, z); return !!n && n.o?.[d] === orn && !isHollow(n) && hollowAt(x + dx, y, z + dz); };
          buildDecor(X, orn, { up: joins(c.x, c.y + 1, c.z), down: c.y > 0 && joins(c.x, c.y - 1, c.z), left: joins(c.x - rx, c.y, c.z - rz), right: joins(c.x + rx, c.y, c.z + rz) });
        }
      }
      if (c.y >= 0 && topOpen) roofDetail(local(pre + 'always', act, S), x0, y0, z0, S, seed, !city.get(c.x, c.y + 1, c.z), c.s);

      if (act) {
        const bucket = pre + (c.y < 0 ? 'ugInt' : 'int');
        const ib = G(bucket);
        const place = placer(bucket, true, false);
        const sd = L.streetDir(c.x, c.z);
        buildInterior({ g: ib, place: (p, m, col) => place(p, m, col, 'wd') }, c.m, x0, y0, z0, rng(seed), c.ok !== false, sd === 3 ? 3 : 2, egg, c.s);
        for (const d of [0, 2]) {
          const n = city.get(c.x + DIRS[d][0], c.y, c.z + DIRS[d][1]);
          if (!n || isHollow(n) || n.m === c.m) continue;
          const wall = [0xe6e1d8, PAT.STUCCO];
          if (d === 0) ib.m.bevel(x0 + 4, y0 + 0.8, z0 + 2, 0.12, 1.1, 4, wall, 0.02);
          else ib.m.bevel(x0 + 2, y0 + 0.8, z0 + 4, 4, 1.1, 0.12, wall, 0.02);
        }
      }

      const t = (c.m === 'station' && c.y === -2) || (c.m === 'railplatform' && c.y === -4) ? L.touchingHBand(c.x, c.z) : null;
      if (t && (c.m === 'station' || t.band === L.railBand)) {
        const g = G(pre + 'always');
        const zc = L.hStreets[t.band].zc;
        const zEdge = t.side > 0 ? z0 + 4 : z0, zWall = t.side > 0 ? zc - 4.3 : zc + 4.3;
        const za = Math.min(zEdge, zWall), zb = Math.max(zEdge, zWall), mid = (za + zb) / 2, len = zb - za;
        const tile = c.m === 'station' ? 0x2f7de0 : 0xc0392b;
        g.m.box(x0 + 2, y0 + 0.12, mid, 3.2, 0.25, len, [0xbdb7aa, PAT.TILE]);
        g.m.box(x0 + 0.35, y0 + 2, mid, 0.3, 4, len, [0xe8e4da, PAT.TILE]);
        g.m.box(x0 + 3.65, y0 + 2, mid, 0.3, 4, len, [0xe8e4da, PAT.TILE]);
        g.m.box(x0 + 0.5, y0 + 1.2, mid, 0.02, 0.2, len, tile);
        g.m.box(x0 + 3.5, y0 + 1.2, mid, 0.02, 0.2, len, tile);
        g.m.box(x0 + 2, y0 + 3.85, mid, 3.6, 0.3, len, [0x77736c, PAT.CONCRETE]);
        g.l.box(x0 + 2, y0 + 3.62, mid, 0.3, 0.06, len, 0xfff4dc);
      }
    }

    const meshes = [];
    for (const [name, b] of buckets) {
      const mats = name.startsWith('A:') ? this.matsA : this.matsN;
      for (const k of MAT_KEYS) {
        if (b[k].empty) continue;
        const mesh = new THREE.Mesh(b[k].build(), mats[k]);
        mesh.userData.bucket = name;
        mesh.castShadow = name.includes('side') || name.endsWith('always');
        mesh.receiveShadow = true;
        group.add(mesh);
        meshes.push(mesh);
      }
    }
    const bn = batN.build(group, this.matsN), ba = batA.build(group, this.matsA);
    meshes.push(...bn.meshes, ...ba.meshes);
    const bucketMap = new Map([...bn.buckets, ...ba.buckets]);
    this.group.add(group);
    this.chunks.set(ck, { group, meshes, buckets: bucketMap, vis: new Map() });
  }

  buildElevators() {
    for (const e of this.elevators) this.elevGroup.remove(e.mesh);
    this.elevators = [];
    const B = this.city.buildings.get(this.activeId);
    if (!B || B.park) return;
    const L = this.city.layout;
    const cols = new Map();
    for (const c of B.cells) {
      if (c.m !== 'core') continue;
      const k = `${c.x},${c.z}`;
      if (!cols.has(k)) cols.set(k, []);
      cols.get(k).push(c.y);
    }
    for (const [k, ys] of cols) {
      const [x, z] = k.split(',').map(Number);
      ys.sort((a, b) => a - b);
      let start = ys[0];
      for (let i = 1; i <= ys.length; i++) {
        if (i < ys.length && ys[i] === ys[i - 1] + 1) continue;
        const end = ys[i - 1];
        const mesh = new THREE.Mesh(CAR_GEO, CAR_MAT);
        mesh.position.set(L.wx(x) + 2, 0, L.wz(z) + 2);
        this.elevGroup.add(mesh);
        const lvl = start + Math.floor(Math.random() * (end - start + 1));
        this.elevators.push({ mesh, a: start, b: end, pos: lvl * CELL, target: lvl, wait: Math.random() * 2 });
        if (i < ys.length) start = ys[i];
      }
    }
  }

  setNight(n) {
    for (const mats of [this.matsN, this.matsA]) { mats.wl.emissiveIntensity = n * 1.7; mats.wc.emissiveIntensity = n * 1.3; }
  }

  update(dt) {
    for (const e of this.elevators) {
      if (e.wait > 0) e.wait -= dt;
      else {
        const ty = e.target * CELL, d = ty - e.pos;
        e.pos += Math.sign(d) * Math.min(Math.abs(d), 7 * dt);
        if (Math.abs(ty - e.pos) < 0.01) { e.wait = 1 + Math.random() * 2.5; e.target = e.a + Math.floor(Math.random() * (e.b - e.a + 1)); }
      }
      e.mesh.position.y = e.pos + 0.25 + 1.6;
    }
  }

  // v: { cutaway, underground, cutLevel, isolate, hood }
  updateView(camPos, v) {
    const B = this.city.buildings.get(this.activeId), L = this.city.layout;
    let facing = [false, false, false, false];
    if (B) {
      const cx = L.wx((B.bbox.x0 + B.bbox.x1 + 1) / 2), cz = L.wz((B.bbox.z0 + B.bbox.z1 + 1) / 2);
      let vx = camPos.x - cx, vz = camPos.z - cz;
      const len = Math.hypot(vx, vz) || 1;
      vx /= len; vz /= len;
      facing = DIRS.map(([dx, dz]) => dx * vx + dz * vz > 0.3);
    }
    const hood = v.hood;
    this.clip.constant = !hood && v.cutLevel !== null ? (v.cutLevel + 1) * CELL - 0.02 : 1e6;
    const vis = (bucket) => {
      if (!bucket.startsWith('A:')) return !(v.isolate && !hood);
      const b = bucket.slice(2);
      if (b === 'int') return !hood && (v.cutaway || v.cutLevel !== null);
      if (b === 'ugInt') return !hood && (v.cutaway || v.underground);
      if (b === 'always' || hood) return true;
      if (b.startsWith('side')) return !(v.cutaway && facing[+b[4]]);
      return !((v.cutaway || v.underground) && facing[+b[2]]);
    };
    for (const ch of this.chunks.values()) {
      for (const m of ch.meshes) if (!m.isBatchedMesh) m.visible = vis(m.userData.bucket);
      for (const [b, list] of ch.buckets) {
        const want = vis(b);
        if (ch.vis.get(b) === want) continue;
        ch.vis.set(b, want);
        for (let i = 0; i < list.length; i += 2) list[i].setVisibleAt(list[i + 1], want);
      }
    }
    const showInt = !hood && (v.cutaway || v.cutLevel !== null), showUg = !hood && (v.cutaway || v.underground);
    for (const e of this.elevators) {
      const lvl = e.pos / CELL;
      e.mesh.visible = (lvl < 0 ? showUg : showInt) && (v.cutLevel === null || lvl <= v.cutLevel);
    }
  }
}
