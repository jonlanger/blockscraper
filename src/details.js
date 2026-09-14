// Shared exterior detailing (signage, AC units, flower boxes), rooftop equipment, crowns and
// open-air blocks, all built from detailed kit parts.
import * as THREE from 'three';
import { PAT, SHAPES, lathe, extrudeShape, tube, hash, Frame } from './geo.js';
import {
  part, mtx, windowPart, columnPart, ironRailingPart, glassRailingPart, acUnitPart, flowerBoxPart,
  bladeSignPart, canopyPart, awningPart, doorPart,
} from './kit.js';
import {
  hvacPart, ventPart, skylightPart, bulkheadPart, dishPart, chimneyPart, woodTankPart, solarPanelPart,
  treePart, shrubPart, pottedPlantPart, lampPostPart, benchPart, trashCanPart, bollardPart, rbox, carParts, GREENS,
} from './props.js';
import { clockPart, loungerPart, poolPart, diningSetPart } from './furniture.js';
import { bikeRackPart } from './props2.js';
import { MODULES } from './catalog.js';
import { ROOFS2 } from './roofs.js';
import { fireEscapePart } from './kit.js';
import { STRUCT_OPEN, STRUCT_TOPPERS } from './structures.js';

const sconcePart = () => part('sconce', (L) => {
  L('t', 0x2b2b2b).bx(-0.06, -0.12, 0, 0.06, 0.12, 0.05);
  L('t', 0x2b2b2b).put(SHAPES.cyl8, 0, 0.02, 0.12, 0.012, 0.18, 0.012, Math.PI / 2);
  L('l', 0xffd8a0).geo(lathe('sconce-glass', [[0.001, -0.14], [0.07, -0.1], [0.08, 0.08], [0.05, 0.14], [0.001, 0.15]], 10), mtx(0, 0, 0.24));
  L('t', 0x2b2b2b).geo(lathe('sconce-cap', [[0.1, 0], [0.001, 0.08]], 10), mtx(0, 0.15, 0.24));
});
const FIRE_STYLES = new Set(['brick', 'castiron', 'chicago']);
const NO_PIPE = new Set(['glass', 'midcentury', 'futurist', 'brutalist']);

export function paletteColors(S) {
  return {
    wall: S.wall, trim: S.trim, accent: S.accent, glass: S.glass, roof: S.roof, stone: S.trim, frame: S.trim,
    iron: 0x23272b, awning: S.accent, shutter: S.accent, door: 0x4a2f20, base: 0x3a3632, neon: S.accent,
    wood: 0x8a5a34, fabric: 0x3b5b8c, fabric2: 0x8c3b3b, metal: 0x9aa0a6, counter: 0xe8e4dc, paint: 0xc0392b, stripe: 0x2a9d8f,
  };
}

const addPart = (L, p, m) => { const mm = m.clone(); for (const l of p.layers) L(l.mat, l.slot).g.addGeometry(l.geo, mm, 0xffffff); };
function latheFlat(pts, segs) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), segs).toNonIndexed();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}
const latheSq = (pts) => latheFlat(pts.map(([hw, y]) => [hw * Math.SQRT2, y]), 4);
const R45 = () => mtx(0, 0, 0, 0, Math.PI / 4, 0);
const FACES = [0, 1, 2, 3].map((k) => { const a = (k * Math.PI) / 2; return [Math.sin(a), Math.cos(a), a]; });

// ---------------------------------------------------------------- facade extras
const SIGN = {
  shop: 0xff5a5f, cafe: 0xf4a261, market: 0x7cb342, cinema: 0xffd166, nightclub: 0xc77dff, gallery: 0xffffff,
  library: 0x8ecae6, gym: 0x4cc9f0, clinic: 0x4dd0e1, bikehub: 0x80ed99, ticketing: 0x2f7de0, trainhall: 0xf2c14e,
};
const WIN = {
  deco: [[-0.9, 0.65], [0.9, 0.65]], nouveau: [[-1, 0.8], [1, 0.8]], beaux: [[0, 0.85]], gothic: [[-0.95, 0.7], [0.95, 0.7]],
  brick: [[-0.8, 0.7], [0.8, 0.7]], chicago: [[0, 0.8]], castiron: [[-1.3, 0.6], [0, 0.6], [1.3, 0.6]], moderne: [[-0.9, 1.15], [0.9, 1.15]],
};

function produceStandPart() {
  return part('produce', (L) => {
    const wood = L('m', 0x8a6a4a, PAT.WOOD), fruit = [0xe63946, 0xf4a261, 0x7cb342, 0xffd166];
    for (const x of [-1.1, 0, 1.1]) {
      wood.bv(x - 0.45, 0, -0.3, x + 0.45, 0.55, 0.3, 0.02);
      wood.put(SHAPES.box, x, 0.72, 0.05, 0.9, 0.3, 0.5, -0.5, 0, 0);
      const c = L('m', fruit[Math.floor((x + 2) * 1.7) % 4]);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) c.put(SHAPES.sphere, x - 0.35 + i * 0.14, 0.78 + j * 0.07, 0.25 - j * 0.14, 0.07, 0.065, 0.07);
    }
  });
}

function marqueePart() {
  return part('marquee', (L) => {
    const d = L('m', 0x1a1a1a), bulb = L('l', 0xffe8a0), face = L('l', 0xfff7e0), gold = L('t', 0xc9a14a);
    d.geo(extrudeShape('marquee-body', () => new THREE.Shape([[-1.95, 0], [1.95, 0], [1.95, 0.5], [0, 0.95], [-1.95, 0.5]].map(([x, y]) => new THREE.Vector2(x, y))), 1.3), mtx(0, 0, 0.65));
    face.bx(-1.7, 0.08, 1.3, 1.7, 0.42, 1.32);
    for (let u = -1.85; u < 1.9; u += 0.22) { bulb.put(SHAPES.sphere, u, 0.02, 1.33, 0.04, 0.04, 0.04); bulb.put(SHAPES.sphere, u, 0.48 + (1 - Math.abs(u) / 1.95) * 0.45, 1.33, 0.04, 0.04, 0.04); }
    for (const s of [-1, 1]) gold.put(SHAPES.cyl8, s * 1.7, 1.1, 0.9, 0.02, 1.2, 0.02, -0.6, 0, 0);
  });
}

export function facadeExtras(X, mid, styleId) {
  const { c } = X;
  const mod = MODULES[mid];
  const r = (k) => hash((c.seed * 6151) | 0, c.level * 7 + k, 13);
  const colR = (k) => hash((c.col * 8191) | 0, k, 29);
  if (c.isGround && c.isEntrance && !NO_PIPE.has(styleId)) for (const s of [-1, 1]) X.P(sconcePart(), s * 1.5, 2.35, 0.1);
  if (!c.isGround && !c.street && !c.decor && FIRE_STYLES.has(styleId) && colR(1) < 0.4 && !mod.open) X.P(fireEscapePart(2.8, c.level === 1), 0, 0.6, 0.02);
  if (c.cornerR && !NO_PIPE.has(styleId) && colR(2) < 0.5) {
    X.shape('t', SHAPES.cyl8, 1.88, 2, 0.16, 0.055, 4.02, 0.055, 0x4a4f55);
    X.box('t', 1.8, 1.96, 1.2, 1.26, 0.0, 0.2, 0x4a4f55);
    if (c.isTop) X.box('t', 1.74, 2.02, 3.62, 3.92, 0.0, 0.3, 0x4a4f55, 0.01);
  }
  if (c.isGround && c.isEntrance) {
    if (SIGN[mid]) X.P(bladeSignPart(SIGN[mid]), -1.8, 2.45, 0.22);
    if (mid === 'cinema') X.P(marqueePart(), 0, 2.9, 0);
    if (mid === 'market') { X.P(awningPart(3.6, 1.1, 0.7, true), 0, 3.05, 0.12); X.P(produceStandPart(), 0, 0, 1.1); }
    if (mid === 'cafe') {
      // Sidewalk seating: striped awning, two tables, a chalkboard and a potted plant by the door.
      X.P(awningPart(3.4, 1.4, 0.6, true), 0, 3.1, 0.12);
      X.P(diningSetPart(true), 0.95, 0, 1.6);
      X.P(diningSetPart(r(7) < 0.5), -1.05, 0, 1.9);
      X.P(chalkboardPart(), 1.8, 0, 0.55);
      X.P(pottedPlantPart(r(9), 1.2), -1.85, 0, 0.45);
    }
    if (mid === 'lobby') for (const s of [-1, 1]) X.P(pottedPlantPart(r(s + 3), 1.6), s * 1.55, 0, 0.55);
  }
  if (!c.isGround && !c.decor && mod.residential && WIN[styleId]) {
    if (styleId === 'nouveau' && c.level % 2 === 1) return;
    if (styleId === 'chicago' && c.level % 3 === 1) return;
    for (const [u, v] of WIN[styleId]) {
      const k = r(Math.round(u * 10 + 20));
      if (k < 0.2) X.P(acUnitPart(), u, v + 0.02, -0.12);
      else if (k < 0.5) X.P(flowerBoxPart(0.9, k), u, v - 0.24, 0.02);
    }
  }
}

// ---------------------------------------------------------------- roofs
const CHIMNEY_STYLES = new Set(['brick', 'castiron', 'nouveau', 'beaux', 'mediterranean', 'chicago']);
export function roofDetail(T, x0, y0, z0, S, seed, bare, styleId) {
  T.g.m.box(x0 + 2, y0 + 3.9, z0 + 2, 4, 0.3, 4, [S.roof, PAT.GRAVEL]);
  if (!bare) return;
  const r = (k) => hash((seed * 4099) | 0, k, 17);
  const cx = x0 + 2, cz = z0 + 2, top = y0 + 4.05;
  switch (Math.floor(r(1) * 10)) {
    case 0: T.P(hvacPart(), cx - 0.2, top, cz, r(2) > 0.5 ? 0 : Math.PI / 2); break;
    case 1: T.P(skylightPart(1.6), cx, top, cz); break;
    case 2: for (let i = 0; i < 3; i++) T.P(ventPart(r(i + 3)), cx - 1.1 + i * 0.9, top, cz + 1 - r(i + 5) * 2); break;
    case 3: T.P(dishPart(), cx + 0.8, top, cz + 0.6, r(4) * 6); T.P(ventPart(r(9)), cx - 1, top, cz - 1); break;
    case 4: for (let i = 0; i < 2; i++) T.P(solarPanelPart(3.4, 0.9, 0.5), cx, top, cz - 0.8 + i * 1.5); break;
    case 5:
      if (CHIMNEY_STYLES.has(styleId)) T.P(chimneyPart(), cx + 1, top, cz - 1);
      else T.P(hvacPart(1.2, 0.9, 0.7), cx, top, cz);
      break;
    case 6: T.P(pottedPlantPart(r(3), 1.6), cx - 1, top, cz - 1); T.P(shrubPart(r(4)), cx + 0.8, top, cz + 0.6); break;
    case 7: if (r(8) < 0.4) T.P(bulkheadPart(), cx, top, cz, Math.floor(r(6) * 4) * (Math.PI / 2)); break;
  }
}

// ---------------------------------------------------------------- crowns
const TOPPERS = {
  spire: () => part('top:spire', (L) => {
    const wall = L('m', 'wall', PAT.ASHLAR), acc = L('t', 'accent'), glow = L('l', 0xffd27a);
    let y = 0;
    [[1.6, 1.3], [1.25, 1.3], [0.9, 1.5], [0.55, 1.4]].forEach(([hw, h], i) => {
      wall.geo(latheSq([[hw, y], [hw, y + h - 0.12], [0.001, y + h - 0.12]]), R45());
      acc.geo(latheSq([[hw + 0.08, y + h - 0.12], [hw + 0.1, y + h - 0.06], [hw + 0.04, y + h], [0.001, y + h]]), R45());
      for (const [nx, nz, a] of FACES) {
        for (const s of [-1, 1]) glow.put(SHAPES.box, nx * (hw + 0.005) + nz * s * hw * 0.45, y + h * 0.48, nz * (hw + 0.005) - nx * s * hw * 0.45, 0.14, h - 0.55, 0.02, 0, a, 0);
        acc.put(SHAPES.box, nx * (hw + 0.07), y + (h - 0.12) / 2, nz * (hw + 0.07), 0.1, h - 0.12, 0.14, 0, a, 0);
        if (i < 2) for (const s of [-1, 1]) acc.put(SHAPES.box, nx * (hw + 0.01) + nz * s * hw * 0.72, y + 0.3, nz * (hw + 0.01) - nx * s * hw * 0.72, 0.36, 0.05, 0.02, 0, a, s * 0.6);
      }
      y += h;
    });
    acc.geo(lathe('spire-needle', [[0.36, 0], [0.3, 0.35], [0.36, 0.42], [0.22, 1.1], [0.26, 1.16], [0.13, 2.8], [0.16, 2.86], [0.03, 7.6], [0.001, 7.8]], 12), mtx(0, y, 0));
    L('l', 0xff3b30).put(SHAPES.sphere, 0, y + 7.9, 0, 0.14, 0.14, 0.14);
  }),
  chrysler: () => part('top:chrysler', (L) => {
    const steel = L('t', 0xd6dde3, PAT.PANEL), wall = L('m', 'wall', PAT.ASHLAR), glow = L('l', 0xffe7a0);
    let y = 0;
    [[1.6, 1.6], [1.25, 1.5], [0.9, 1.4], [0.55, 1.3]].forEach(([hw, h], i) => {
      (i % 2 ? steel : wall).geo(latheSq([[hw, y], [hw, y + h], [0.001, y + h]]), R45());
      for (const [nx, nz, a] of FACES) {
        for (let ring = 0; ring < 3; ring++) {
          const rr = hw * (0.9 - ring * 0.18);
          steel.put(SHAPES.torusHalf, nx * (hw + 0.02 + ring * 0.01), y + h * 0.25, nz * (hw + 0.02 + ring * 0.01), rr, h * 0.6 * (1 - ring * 0.15), 1.2, 0, a, 0);
        }
        for (const s of [-0.32, 0, 0.32]) glow.put(SHAPES.cone4, nx * (hw + 0.03) + nz * s * hw, y + h * (s ? 0.42 : 0.62), nz * (hw + 0.03) - nx * s * hw, 0.13, 0.26, 0.02, 0, a, 0);
      }
      steel.geo(latheSq([[hw + 0.06, y + h - 0.08], [hw + 0.06, y + h], [0.001, y + h]]), R45());
      if (i === 0) for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) steel.geo(lathe('gargoyle', [[0.001, 0], [0.12, 0.05], [0.18, 0.2], [0.05, 0.3], [0.001, 0.3]], 8), mtx(sx * 1.65, 1.2, sz * 1.65, 0, 0, sx * 1.2));
      y += h;
    });
    steel.geo(lathe('chr-needle', [[0.3, 0], [0.22, 0.6], [0.26, 0.66], [0.02, 7.4], [0.001, 7.6]], 16), mtx(0, y, 0));
    L('l', 0xff3b30).put(SHAPES.sphere, 0, y + 7.7, 0, 0.13, 0.13, 0.13);
  }),
  dome: () => part('top:dome', (L) => {
    const wall = L('m', 'wall', PAT.ASHLAR), trim = L('m', 'trim'), copper = L('m', 0x5f9f8a, PAT.PANEL), gold = L('t', 0xd4af37), glow = L('glass', 'glass');
    wall.geo(lathe('dome-drum', [[1.8, 0], [1.85, 0.12], [1.7, 0.2], [1.7, 1.25], [1.9, 1.32], [1.95, 1.45], [0.001, 1.45]], 36), mtx());
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      addPart(L, columnPart('ionic', 1.05, 0.07, 'trim'), mtx(Math.sin(a) * 1.78, 0.2, Math.cos(a) * 1.78));
      glow.put(SHAPES.box, Math.sin(a + 0.26) * 1.71, 0.72, Math.cos(a + 0.26) * 1.71, 0.4, 0.75, 0.02, 0, a + 0.26, 0);
    }
    copper.geo(lathe('dome-shell', Array.from({ length: 13 }, (_, i) => { const t = (i / 12) * (Math.PI / 2); return [Math.cos(t) * 1.72, 1.45 + Math.sin(t) * 2.0]; }), 36), mtx());
    const rib = new THREE.TorusGeometry(1.74, 0.04, 5, 14, Math.PI / 2);
    for (let k = 0; k < 12; k++) copper.geo(rib, mtx(0, 1.45, 0, 0, (k / 12) * Math.PI * 2, 0, 1, 2.0 / 1.74, 1), 0.8);
    trim.geo(lathe('dome-lantern', [[0.45, 0], [0.45, 0.06], [0.38, 0.08], [0.38, 0.7], [0.46, 0.76], [0.001, 0.8]], 16), mtx(0, 3.42, 0));
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; glow.put(SHAPES.box, Math.sin(a) * 0.385, 3.8, Math.cos(a) * 0.385, 0.2, 0.45, 0.02, 0, a, 0); }
    copper.geo(lathe('dome-cap', [[0.5, 0], [0.001, 0.5]], 16), mtx(0, 4.22, 0));
    gold.geo(lathe('finial', [[0.05, 0], [0.12, 0.1], [0.05, 0.22], [0.08, 0.3], [0.001, 0.45]], 12), mtx(0, 4.7, 0));
  }),
  pinnacle: () => part('top:pinnacle', (L) => {
    const wall = L('m', 'wall', PAT.ASHLAR), trim = L('m', 'trim', PAT.ASHLAR);
    wall.geo(latheSq([[1.3, 0], [1.3, 2.5], [1.42, 2.55], [1.42, 2.7], [0.001, 2.7]]), R45());
    for (const [nx, nz, a] of FACES) {
      addPart(L, windowPart({ w: 0.8, h: 1.05, arch: 'pointed', cols: 2, depth: 0.14, frame: 0.04, sill: false, lintel: 'hood' }), mtx(nx * 1.46, 0.55, nz * 1.46, 0, a, 0));
      wall.geo(extrudeShape('gable', () => new THREE.Shape([[-0.9, 0], [0.9, 0], [0, 0.9]].map(([x, y]) => new THREE.Vector2(x, y))), 0.16), mtx(nx * 1.25, 2.7, nz * 1.25, 0, a, 0));
    }
    trim.geo(latheFlat([[1.12, 0], [1.14, 0.25], [0.95, 0.35], [0.02, 8.6], [0.001, 8.8]], 8), mtx(0, 2.7, 0, 0, Math.PI / 8, 0));
    for (let e = 0; e < 8; e++) { const a = (e / 8) * Math.PI * 2 + Math.PI / 8; for (let i = 1; i < 8; i++) { const t = i / 8, rr = 0.95 * (1 - t) + 0.05; trim.put(SHAPES.ico, Math.sin(a) * rr, 3.05 + t * 8.2, Math.cos(a) * rr, 0.07, 0.12, 0.07); } }
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      wall.bv(sx * 1.25 - 0.22, 0, sz * 1.25 - 0.22, sx * 1.25 + 0.22, 3.3, sz * 1.25 + 0.22, 0.03);
      trim.geo(latheFlat([[0.2, 0], [0.22, 0.08], [0.16, 0.14], [0.001, 2.1]], 8), mtx(sx * 1.25, 3.3, sz * 1.25));
      trim.put(SHAPES.ico, sx * 1.25, 5.5, sz * 1.25, 0.08, 0.14, 0.08);
    }
    L('t', 0xd4af37).geo(lathe('pin-finial', [[0.06, 0], [0.14, 0.1], [0.04, 0.25], [0.12, 0.35], [0.001, 0.6]], 10), mtx(0, 11.5, 0));
  }),
  clocktower: () => part('top:clock', (L) => {
    const wall = L('m', 'wall', PAT.ASHLAR), trim = L('m', 'trim'), roof = L('m', 'roof', PAT.SHINGLE), gold = L('t', 0xd4af37), dark = L('m', 0x151515);
    wall.geo(latheSq([[1.3, 0], [1.3, 3.3], [0.001, 3.3]]), R45());
    trim.geo(latheSq([[1.45, 3.3], [1.45, 3.42], [1.38, 3.5], [0.001, 3.5]]), R45());
    trim.geo(latheSq([[1.38, 0], [1.38, 0.3], [1.3, 0.36], [0.001, 0.36]]), R45());
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      trim.bv(sx * 1.3 - 0.16, 0, sz * 1.3 - 0.16, sx * 1.3 + 0.16, 3.3, sz * 1.3 + 0.16, 0.02);
      wall.bv(sx * 1.08 - 0.18, 3.5, sz * 1.08 - 0.18, sx * 1.08 + 0.18, 5.2, sz * 1.08 + 0.18, 0.02);
    }
    for (const [nx, nz, a] of FACES) {
      addPart(L, clockPart(0.78), mtx(nx * 1.31, 1.95, nz * 1.31, 0, a, 0));
      wall.geo(extrudeShape('belfry-arch', () => { const s = new THREE.Shape([[-0.9, 0], [0.9, 0], [0.9, 1.7], [-0.9, 1.7]].map(([x, y]) => new THREE.Vector2(x, y))); s.holes.push(new THREE.Path([[-0.55, 0], [0.55, 0], ...Array.from({ length: 9 }, (_, i) => { const t = (i / 8) * Math.PI; return [Math.cos(t) * 0.55, 1.0 + Math.sin(t) * 0.55]; })].map(([x, y]) => new THREE.Vector2(x, y)))); return s; }, 0.2), mtx(nx * 1.0, 3.5, nz * 1.0, 0, a, 0));
      addPart(L, ironRailingPart(1.1, 0.55, false), mtx(nx * 1.02, 3.5, nz * 1.02, 0, a, 0));
    }
    dark.geo(latheSq([[0.85, 3.5], [0.85, 5.2], [0.001, 5.2]]), R45());
    gold.geo(lathe('bell', [[0.001, 0], [0.4, 0], [0.38, 0.1], [0.25, 0.45], [0.2, 0.7], [0.001, 0.75]], 16), mtx(0, 4.0, 0));
    trim.geo(latheSq([[1.5, 5.2], [1.5, 5.36], [1.4, 5.45], [0.001, 5.45]]), R45());
    roof.geo(latheSq([[1.45, 5.45], [0.08, 8.2], [0.001, 8.3]]), R45());
    gold.geo(lathe('clk-finial', [[0.05, 0], [0.12, 0.08], [0.04, 0.3], [0.1, 0.4], [0.001, 0.8]], 10), mtx(0, 8.25, 0));
  }),
  lantern: () => part('top:lantern', (L) => {
    const steel = L('t', 0xd0d8dd), glass = L('glass', 0x9cc9e8);
    steel.bv(-1.75, 0, -1.75, 1.75, 0.35, 1.75, 0.04);
    glass.bx(-1.5, 0.35, -1.5, 1.5, 3.6, 1.5);
    for (const [nx, nz, a] of FACES) {
      for (let s = -1.5; s <= 1.51; s += 0.5) steel.put(SHAPES.box, nx * 1.52 + nz * s, 1.98, nz * 1.52 - nx * s, 0.05, 3.25, 0.06, 0, a, 0);
      for (const y of [1.2, 2.4]) steel.put(SHAPES.box, nx * 1.52, y, nz * 1.52, 3.05, 0.04, 0.06, 0, a, 0);
    }
    steel.geo(latheSq([[1.6, 3.6], [1.6, 3.75], [1.2, 3.9], [0.001, 3.9]]), R45());
    steel.geo(lathe('lan-mast', [[0.25, 0], [0.2, 0.5], [0.12, 1.0], [0.05, 7.0], [0.001, 7.2]], 12), mtx(0, 3.9, 0));
    for (const y of [5.0, 6.5, 8.0]) steel.put(SHAPES.torus, 0, y, 0, 0.12 - (y - 5) * 0.02, 0.12 - (y - 5) * 0.02, 1, Math.PI / 2);
    L('l', 0xff3b30).put(SHAPES.sphere, 0, 11.2, 0, 0.18, 0.18, 0.18);
  }),
  antenna: () => part('top:antenna', (L) => {
    const steel = L('t', 0xc8ccd0), base = L('t', 0x7d858c, PAT.PANEL), red = L('l', 0xff3b30);
    base.bv(-1.1, 0, -1.1, 1.1, 0.6, 1.1, 0.04);
    const H = 14, b = 0.75, t = 0.18;
    const at = (y) => b + (t - b) * (y / H);
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ang = Math.atan((b - t) / H);
      steel.put(SHAPES.cyl8, sx * (b + t) / 2, 0.6 + H / 2, sz * (b + t) / 2, 0.05, H, 0.05, -sz * ang, 0, sx * ang);
    }
    for (let y = 0; y < H; y += 1.6) {
      const r0 = at(y), r1 = at(y + 1.6);
      for (const [nx, nz, a] of FACES) {
        const len = Math.hypot(r0 + r1, 1.6);
        for (const s of [-1, 1]) steel.put(SHAPES.box, nx * (r0 + r1) / 2, 0.6 + y + 0.8, nz * (r0 + r1) / 2, 0.035, len, 0.035, 0, a, s * Math.atan((r0 + r1) / 1.6));
        steel.put(SHAPES.box, nx * r0, 0.6 + y, nz * r0, r0 * 2, 0.04, 0.04, 0, a, 0);
      }
    }
    addPart(L, dishPart(), mtx(0.4, 7, 0.4, 0, 0.8, 0, 0.7, 0.7, 0.7));
    addPart(L, dishPart(), mtx(-0.4, 9, -0.3, 0, 3.6, 0, 0.6, 0.6, 0.6));
    steel.geo(lathe('ant-mast', [[0.12, 0], [0.06, 3.5], [0.02, 5], [0.001, 5.1]], 10), mtx(0, 0.6 + H, 0));
    red.put(SHAPES.sphere, 0, 0.6 + H + 5.2, 0, 0.18, 0.18, 0.18);
    red.put(SHAPES.sphere, 0.2, 0.6 + H * 0.5, 0.2, 0.12, 0.12, 0.12);
    red.put(SHAPES.sphere, -0.2, 0.6 + H, -0.2, 0.12, 0.12, 0.12);
  }),
  neonsign: (seed) => {
    const k = Math.floor(seed * 4);
    return part(`top:neon:${k}`, (L) => {
      const steel = L('t', 0x555a60), dark = L('m', 0x1a1a1a, PAT.PANEL), bulb = L('l', 0xfff3c0);
      const col = [0xff3ea5, 0x3ef0ff, 0xffe03e, 0x7cff6b][k];
      const neon = L('l', col);
      const word = ['HOTEL', 'CAFE', 'JAZZ', 'CITY'][k];
      for (const x of [-1.6, 0, 1.6]) for (const z of [-0.3, 0.3]) steel.bx(x - 0.05, 0, z - 0.05, x + 0.05, 1.9, z + 0.05);
      for (const x of [-1.6, 0, 1.6]) steel.put(SHAPES.box, x, 0.95, 0, 0.04, 2.0, 0.04, 0.3, 0, 0);
      steel.bv(-1.9, 1.55, 0.2, 1.9, 1.62, 0.9, 0.01);
      addPart(L, ironRailingPart(3.8, 0.6, false), mtx(0, 1.62, 0.88));
      dark.bv(-1.9, 1.9, -0.08, 1.9, 3.6, 0.08, 0.02);
      const FONT = { H: ['101', '101', '111', '101', '101'], O: ['111', '101', '101', '101', '111'], T: ['111', '010', '010', '010', '010'], E: ['111', '100', '110', '100', '111'], L: ['100', '100', '100', '100', '111'], C: ['111', '100', '100', '100', '111'], A: ['010', '101', '111', '101', '101'], F: ['111', '100', '110', '100', '100'], J: ['001', '001', '001', '101', '111'], Z: ['111', '001', '010', '100', '111'], I: ['111', '010', '010', '010', '111'], Y: ['101', '101', '010', '010', '010'] };
      const px = 0.16, lw = px * 3 + 0.18, x0 = -(word.length * lw) / 2 + 0.09;
      [...word].forEach((ch, li) => FONT[ch].forEach((row, ry) => [...row].forEach((bit, rx) => {
        if (bit !== '1') return;
        for (const s of [-1, 1]) neon.bv(x0 + li * lw + rx * px, 3.3 - ry * px - px, s * 0.09 - 0.015, x0 + li * lw + rx * px + px - 0.02, 3.3 - ry * px - 0.02, s * 0.09 + 0.015, 0.01);
      })));
      for (let i = 0; i < 16; i++) for (const y of [1.98, 3.52]) for (const s of [-1, 1]) bulb.put(SHAPES.sphere, -1.8 + i * 0.24, y, s * 0.09, 0.035, 0.035, 0.02);
    });
  },
  helipad: () => part('top:helipad', (L) => {
    const steel = L('t', 0x6c7176), deck = L('m', 0x3a3d42, PAT.CONCRETE), paint = L('m', 0xffffff), yel = L('m', 0xf2c14e), green = L('l', 0x7cff9a), sock = L('m', 0xff7a1a);
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { steel.bx(sx * 1.6 - 0.12, 0, sz * 1.6 - 0.12, sx * 1.6 + 0.12, 1.0, sz * 1.6 + 0.12); steel.put(SHAPES.box, sx * 1.2, 0.55, sz * 1.2, 0.06, 1.1, 0.06, sz * 0.6, 0, -sx * 0.6); }
    deck.bv(-2.1, 1.0, -2.1, 2.1, 1.25, 2.1, 0.03);
    for (const x of [-0.5, 0.5]) paint.bx(x - 0.12, 1.25, -0.8, x + 0.12, 1.26, 0.8);
    paint.bx(-0.5, 1.25, -0.12, 0.5, 1.26, 0.12);
    yel.put(SHAPES.torus, 0, 1.26, 0, 1.55, 1.55, 0.3, Math.PI / 2);
    for (const [nx, nz, a] of FACES) {
      steel.put(SHAPES.box, nx * 2.35, 1.15, nz * 2.35, 4.4, 0.02, 0.5, -0.25, a, 0);
      for (let s = -1.9; s <= 1.91; s += 0.95) green.put(SHAPES.cyl, nx * 2.08 + nz * s, 1.3, nz * 2.08 - nx * s, 0.05, 0.08, 0.05);
    }
    steel.put(SHAPES.cyl8, 1.9, 2.0, -1.9, 0.02, 1.5, 0.02);
    sock.put(SHAPES.cone8, 2.15, 2.65, -1.9, 0.12, 0.55, 0.12, 0, 0, Math.PI / 2 + 0.3);
  }),
  turbine: (seed) => part(`top:turbine:${Math.floor(seed * 6)}`, (L) => {
    const w = L('t', 0xe8ecef), blade = L('m', 0xf4f6f8), base = L('t', 0x8a9096, PAT.PANEL);
    base.bv(-0.7, 0, -0.7, 0.7, 0.45, 0.7, 0.04);
    w.geo(lathe('tur-tower', [[0.26, 0], [0.12, 6.4], [0.001, 6.45]], 16), mtx(0, 0.45, 0));
    w.geo(rbox(0.55, 0.55, 1.5, 0.2), mtx(0, 6.95, -0.25));
    w.geo(lathe('tur-hub', [[0.001, 0], [0.24, 0.05], [0.22, 0.3], [0.001, 0.55]], 16), mtx(0, 6.95, 0.5, Math.PI / 2, 0, 0));
    const airfoil = extrudeShape('airfoil', () => new THREE.Shape([[0, -0.02], [0.18, -0.04], [0.28, -0.02], [0.3, 0], [0.26, 0.02], [0.1, 0.035], [0, 0.02]].map(([x, y]) => new THREE.Vector2(x - 0.15, y))), 2.6);
    for (let k = 0; k < 3; k++) {
      const a = seed * 6 + (k * Math.PI * 2) / 3;
      blade.geo(airfoil, mtx(Math.sin(a) * 1.45, 6.95 + Math.cos(a) * 1.45, 0.72, Math.PI / 2, 0, -a, 1 - 0.0, 1, 1));
    }
  }),
  solar: () => part('top:solar', (L) => { for (let i = 0; i < 3; i++) addPart(L, solarPanelPart(3.6, 1.0, 0.5), mtx(0, 0, -1.3 + i * 1.3)); }),
  watertower: () => woodTankPart(),
  roofgarden: (seed) => part(`top:garden:${Math.floor(seed * 4)}`, (L) => {
    const wood = L('m', 0x7a5236, PAT.WOOD), grass = L('m', 0x5f8a45, PAT.GRASS), timber = L('m', 0x8a6a4a, PAT.TIMBER), soil = L('m', 0x3b2a1e);
    wood.bv(-1.9, 0, -1.9, 1.9, 0.08, 1.9, 0.01);
    for (const [x, z] of [[-1.1, -1.1], [1.1, 1.0]]) { wood.bv(x - 0.65, 0.08, z - 0.65, x + 0.65, 0.6, z + 0.65, 0.02); soil.bx(x - 0.58, 0.55, z - 0.58, x + 0.58, 0.58, z + 0.58); }
    grass.bx(0.2, 0.08, -1.8, 1.8, 0.12, -0.3);
    addPart(L, treePart(seed, 0.65), mtx(-1.1, 0.58, -1.1));
    addPart(L, shrubPart(seed + 0.3, 0.9), mtx(1.1, 0.58, 1.0));
    addPart(L, benchPart(), mtx(1.0, 0.08, -1.2, 0, Math.PI, 0, 0.9, 0.9, 0.9));
    for (const [x, z] of [[-1.8, 0.2], [-1.8, 1.8], [0.2, 1.8]]) timber.bv(x - 0.07, 0.08, z - 0.07, x + 0.07, 2.3, z + 0.07, 0.01);
    for (let i = 0; i < 6; i++) timber.bx(-1.9, 2.3, 0.15 + i * 0.32, 0.3, 2.38, 0.23 + i * 0.32);
    timber.bx(-1.9, 2.38, 0.1, -1.7, 2.46, 1.9);
  }),
};

export function buildTopper(T, id, x0, y0, z0, S, seed, nb = [false, false, false, false], egg = null) {
  const p = TOPPERS[id] ? TOPPERS[id](seed) : ROOFS2[id] ? ROOFS2[id](seed, nb, egg) : STRUCT_TOPPERS[id] ? STRUCT_TOPPERS[id](seed, nb, egg) : null;
  if (p) T.P(p, x0 + 2, y0, z0 + 2, 0, 'wl');
}

// ---------------------------------------------------------------- open-air blocks
const EDGE = [[3.9, 2, Math.PI / 2], [0.1, 2, Math.PI / 2], [2, 3.9, 0], [2, 0.1, 0]];

function slabDeck(T, x0, y0, z0, S) {
  T.g.m.box(x0 + 2, y0 + 0.15, z0 + 2, 4, 0.3, 4, [S.roof, PAT.CONCRETE]);
  T.g.m.box(x0 + 2, y0 + 0.33, z0 + 2, 3.9, 0.06, 3.9, [0x9a7a55, PAT.WOOD]);
}
function edgeRails(T, x0, y0, z0, exposed) {
  exposed.forEach((e, d) => { if (e) { const [x, z, ry] = EDGE[d]; T.P(glassRailingPart(3.7, 1.05), x0 + x, y0 + 0.36, z0 + z, ry); } });
}

// sd: direction of the adjacent street (-1 if none); same: whether each neighbor is this block type.
// env: { above } — whether a block sits on top.
export function buildOpen(T, id, x0, y0, z0, S, exposed, seed, sd, same = [false, false, false, false], styleId = 'deco', env = {}) {
  if (STRUCT_OPEN[id]) return STRUCT_OPEN[id](T, { x0, y0, z0, S, exposed, seed, sd, same, styleId, ...env });
  if (FRONTAGE.has(id)) return buildFrontage(T, id, x0, y0, z0, S, exposed, seed, sd, same, styleId);
  const front = sd < 0 ? 2 : sd;
  const cx = x0 + 2, cz = z0 + 2;
  const corners = () => { for (const [sx, sz] of [[0.22, 0.22], [3.78, 0.22], [0.22, 3.78], [3.78, 3.78]]) T.P(columnPart('modern', 3.7, 0.15, 'wall'), x0 + sx, y0 + 0.3, z0 + sz); };
  if (id === 'skygarden') {
    slabDeck(T, x0, y0, z0, S); corners(); edgeRails(T, x0, y0, z0, exposed);
    T.g.m.bevel(x0 + 1.2, y0 + 0.6, z0 + 1.2, 1.8, 0.5, 1.8, [0x7a5236, PAT.WOOD], 0.03);
    T.g.m.box(x0 + 1.2, y0 + 0.86, z0 + 1.2, 1.7, 0.04, 1.7, [0x5f8a45, PAT.GRASS]);
    T.P(treePart(seed, 0.8), x0 + 1.2, y0 + 0.88, z0 + 1.2);
    T.P(shrubPart(seed + 0.4, 1), x0 + 3.1, y0 + 0.36, z0 + 0.9);
    T.P(benchPart(), x0 + 2.8, y0 + 0.36, z0 + 2.9, Math.PI);
    T.P(pottedPlantPart(seed + 0.2, 1.3), x0 + 0.7, y0 + 0.36, z0 + 3.2);
  } else if (id === 'skypool') {
    slabDeck(T, x0, y0, z0, S); corners(); edgeRails(T, x0, y0, z0, exposed);
    T.P(poolPart(3.1, 2.1), cx, y0 + 0.36, z0 + 1.55);
    for (const x of [1.0, 2.6]) T.P(loungerPart(), x0 + x, y0 + 0.36, z0 + 3.35, Math.PI / 2, 'wd', 1, { fabric: 0xffffff });
    const umb = part('umbrella', (L) => {
      L('t', 0xdddddd).put(SHAPES.cyl, 0, 1.1, 0, 0.025, 2.2, 0.025);
      L('m', 'accent').geo(lathe('umb', [[1.0, 0], [0.7, 0.18], [0.001, 0.35]], 8), mtx(0, 2.0, 0));
      L('t', 0x555555).geo(lathe('umb-base', [[0.25, 0], [0.22, 0.08], [0.03, 0.12]], 12), mtx());
    });
    T.P(umb, x0 + 1.8, y0 + 0.36, z0 + 3.4, 0, 'wd', 1, { accent: seed < 0.5 ? 0xf4f1ea : 0xe76f51 });
  } else if (id === 'subwayentrance') {
    const green = 0x2f5d50;
    T.g.m.box(cx, y0 + 0.04, z0 + 0.5, 4, 0.08, 1.0, [0x9e9a92, PAT.TILE]);
    T.g.m.box(cx, y0 + 0.04, z0 + 3.5, 4, 0.08, 1.0, [0x9e9a92, PAT.TILE]);
    T.g.m.box(cx, y0 + 0.045, cz, 3.4, 0.03, 1.9, 0x0d0d0d);
    for (let i = 0; i < 13; i++) T.g.m.bevel(x0 + 3.6 - i * 0.28, y0 - i * 0.31 - 0.15, cz, 0.3, 0.3, 1.8, [0xb8b3a8, PAT.ASHLAR], 0.02);
    for (const s of [-1, 1]) {
      T.g.m.box(cx, y0 - 2.2, cz + s * 1.0, 3.6, 4.4, 0.15, [0xe8e4da, PAT.TILE]);
      T.P(ironRailingPart(3.6, 1.0, false), cx, y0 + 0.05, cz + s * 1.05, 0, 'wd', 1, { iron: green });
      const globe = part('globe-lamp', (L) => {
        L('t', 0x2f5d50).geo(lathe('glp', [[0.1, 0], [0.1, 0.1], [0.05, 0.2], [0.04, 2.4], [0.08, 2.5], [0.001, 2.55]], 12), mtx());
        L('l', 0x9cff9c).put(SHAPES.sphere, 0, 2.75, 0, 0.22, 0.22, 0.22);
      });
      T.P(globe, x0 + 3.85, y0, cz + s * 1.05);
    }
    const kiosk = part('sub-kiosk', (L) => {
      const g = L('t', 0x2f5d50), glass = L('glass', 0x9cc9e8), sign = L('l', 0x2f7de0), white = L('l', 0xffffff);
      for (const [x, z] of [[-1.6, -1.2], [-1.6, 1.2], [1.8, -1.2], [1.8, 1.2]]) g.geo(lathe('kpost', [[0.07, 0], [0.05, 0.1], [0.045, 2.9], [0.08, 3.0]], 10), mtx(x, 0, z));
      g.bv(-1.8, 3.0, -1.35, 2.0, 3.1, 1.35, 0.02);
      glass.bx(-1.7, 3.1, -1.25, 1.9, 3.14, 1.25);
      for (let x = -1.4; x < 1.9; x += 0.45) g.bx(x - 0.02, 3.14, -1.3, x + 0.02, 3.2, 1.3);
      sign.put(SHAPES.cyl, -1.62, 2.3, 0, 0.42, 0.06, 0.42, 0, 0, Math.PI / 2);
      white.bx(-1.66, 2.1, -0.04, -1.65, 2.5, 0.04);
      white.put(SHAPES.box, -1.66, 2.38, -0.12, 0.01, 0.3, 0.06, 0.5, 0, 0);
      white.put(SHAPES.box, -1.66, 2.38, 0.12, 0.01, 0.3, 0.06, -0.5, 0, 0);
    });
    T.P(kiosk, cx, y0, cz);
  } else if (id === 'busbay' || id === 'taxistand') {
    const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][front];
    const F = new Frame().set(cx + dx * 2, y0, cz + dz * 2, dx, dz);
    const FP = (p, u, v, w, rotZ = 0, colors) => T.PM(p, F.matrix(u, v, w, 0, 0), colors);
    const FY = (p, u, w, ry, colors) => { const m = F.matrix(u, 0, w); m.multiply(new THREE.Matrix4().makeRotationY(ry)); T.PM(p, m, colors); };
    F.rect(T.g.m, -2, 2, 0, 0.08, -4, 0, [0x9e9a92, PAT.TILE]);
    F.rect(T.g.m, -2, 2, 0.08, 0.1, -0.2, 0, id === 'busbay' ? 0xc0392b : 0xf2c14e);
    if (id === 'busbay') {
      const shelter = part('bus-shelter', (L) => {
        const steel = L('t', 'accent'), glass = L('glass', 0xbfe0ee), ad = L('l', 0xfff2d0), ad2 = L('l', 0xd0f0ff), wood = L('m', 0x6b4a33, PAT.WOOD);
        for (const x of [-1.8, 1.8]) for (const z of [-1.3, 0.9]) steel.bv(x - 0.05, 0, z - 0.05, x + 0.05, 2.7, z + 0.05, 0.01);
        steel.bv(-1.95, 2.7, -1.5, 1.95, 2.85, 1.5, 0.03);
        glass.bx(-1.85, 2.85, -1.4, 1.85, 2.88, 1.4);
        glass.bx(-1.75, 0.15, -1.32, 1.75, 2.5, -1.29);
        for (const x of [-1.8, 1.8]) glass.bx(x - 0.015, 0.15, -1.25, x + 0.015, 2.5, 0.6);
        ad.bx(1.82, 0.4, -0.9, 1.86, 2.3, 0.3); ad2.bx(-1.86, 0.4, -0.9, -1.82, 2.3, 0.3);
        for (let i = 0; i < 4; i++) wood.bv(-1.4, 0.45, -1.1 + i * 0.1, 1.4, 0.49, -1.02 + i * 0.1, 0.01);
        for (const x of [-1.2, 1.2]) steel.bx(x - 0.03, 0, -1.1, x + 0.03, 0.45, -0.8);
        steel.put(SHAPES.cyl8, -1.8, 1.5, 2.2, 0.03, 3.0, 0.03);
        L('l', 0x2a9d8f).bv(-2.1, 2.5, 2.17, -1.5, 3.0, 2.23, 0.01);
      });
      FY(shelter, 0, -1.9, 0, { accent: S.accent });
      FY(trashCanPart(), 1.6, -0.4, 0);
    } else {
      const taxi = carParts();
      FY(taxi.paint, 0, -2.2, Math.PI / 2, { paint: 0xf2c14e });
      FY(taxi.rest, 0, -2.2, Math.PI / 2);
      FY(canopyPart(3.8, 1.8, 'accent'), 0, 1.6, Math.PI, { accent: 0xf2c14e });
      for (const u of [-1.6, 1.6]) FY(bollardPart(), u, -0.3, 0);
      const sign = part('taxi-sign', (L) => { L('t', 0x333333).put(SHAPES.cyl8, 0, 1.4, 0, 0.03, 2.8, 0.03); L('l', 0xffd000).bv(-0.4, 2.5, -0.04, 0.4, 2.9, 0.04, 0.01); });
      FY(sign, -1.8, -0.3, 0);
    }
    FY(lampPostPart(), 1.9, -3.6, -Math.PI / 2);
  }
}

// ---------------------------------------------------------------- entries & terraces
// Street-level open blocks that dress a building's frontage. They face the adjacent street or road
// (or away from the building when there is none). Frame: u along the frontage, v up, w out to the street.
const FRONTAGE = new Set(['sidewalkcafe', 'stoop', 'grandstair', 'portico', 'arcade', 'vestibule', 'forecourt', 'bikecorral']);
const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const OPP = [1, 0, 3, 2];
const ORDER = { beaux: 'corinthian', castiron: 'castiron', mediterranean: 'ionic', nouveau: 'ionic', gothic: 'doric', chicago: 'doric', brick: 'doric' };

const chalkboardPart = () => part('fr-chalkboard', (L) => {
  const wood = L('m', 0x6b4a33, PAT.WOOD), board = L('m', 0x1f2622), chalk = L('m', 0xe8e4da);
  for (const s of [-1, 1]) {
    wood.put(SHAPES.box, 0, 0.5, s * 0.14, 0.56, 1.0, 0.04, s * 0.28, 0, 0);
    board.put(SHAPES.box, 0, 0.52, s * 0.165, 0.46, 0.78, 0.01, s * 0.28, 0, 0);
  }
  for (let i = 0; i < 3; i++) chalk.put(SHAPES.box, 0, 0.75 - i * 0.18, 0.2, 0.3 - i * 0.05, 0.03, 0.012, 0.28, 0, 0);
});
const marketUmbrellaPart = () => part('fr-umbrella', (L) => {
  const pole = L('t', 0x3a3a3a);
  pole.put(SHAPES.cyl8, 0, 1.2, 0, 0.03, 2.4, 0.03);
  pole.geo(lathe('fr-umb-base', [[0.28, 0], [0.26, 0.06], [0.04, 0.1]], 12), mtx());
  L('m', 'awning').geo(lathe('fr-umb', [[1.45, 0], [1.0, 0.2], [0.001, 0.45]], 4), mtx(0, 2.15, 0, 0, Math.PI / 4, 0));
  L('m', 0xf2efe6).geo(lathe('fr-umb-valance', [[1.45, 0], [1.45, -0.18]], 4), mtx(0, 2.15, 0, 0, Math.PI / 4, 0));
});
const cafeLightsPart = () => part('fr-cafelights', (L) => {
  const post = L('t', 0x2b2b2b), wire = L('m', 0x111111), bulb = L('l', 0xffe2a0);
  for (const u of [-1.9, 1.9]) post.put(SHAPES.cyl8, u, 1.45, -0.2, 0.035, 2.9, 0.035);
  [[[-1.9, 2.85, -0.2], [1.9, 3.2, -3.9]], [[1.9, 2.85, -0.2], [-1.9, 3.2, -3.9]], [[-1.9, 2.85, -0.2], [1.9, 2.85, -0.2]]].forEach(([a, b], i) => {
    const pts = Array.from({ length: 9 }, (_, k) => { const t = k / 8; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 0.35, a[2] + (b[2] - a[2]) * t]; });
    wire.geo(tube(`fr-cl:${i}`, pts, 0.008, 16, 4), mtx());
    for (const [x, y, z] of pts) bulb.put(SHAPES.sphere, x, y - 0.06, z, 0.04, 0.055, 0.04);
  });
});
const vestibulePart = () => part('fr-vestibule', (L) => {
  const fr = L('t', 'frame'), glass = L('glass', 0xbfe0ee);
  fr.bv(-1.55, 3.1, -1.45, 1.55, 3.3, 1.45, 0.02);
  for (const x of [-1.5, 1.5]) for (const z of [-1.4, 1.4]) fr.bx(x - 0.05, 0, z - 0.05, x + 0.05, 3.1, z + 0.05);
  for (const x of [-1.5, 1.5]) glass.bx(x - 0.01, 0, -1.35, x + 0.01, 3.1, 1.35);
  glass.bx(-1.45, 0, 1.39, -1.0, 3.1, 1.41);
  glass.bx(1.0, 0, 1.39, 1.45, 3.1, 1.41);
  glass.bx(-1.0, 2.6, 1.39, 1.0, 3.1, 1.41);
  glass.bx(-1.45, 3.3, -1.4, 1.45, 3.32, 1.4);
  L('l', 0xfff2d0).bx(-0.8, 2.75, 1.42, 0.8, 2.95, 1.44);
});
const bikePart = () => part('fr-bike', (L) => {
  const tire = L('m', 0x151515), frame = L('t', 'accent'), dark = L('m', 0x222222);
  for (const x of [-0.52, 0.52]) tire.put(SHAPES.torus, x, 0.34, 0, 0.32, 0.32, 0.6);
  frame.put(SHAPES.cyl8, -0.2, 0.52, 0, 0.022, 0.72, 0.022, 0, 0, 0.9);
  frame.put(SHAPES.cyl8, 0.18, 0.52, 0, 0.022, 0.62, 0.022, 0, 0, -0.75);
  frame.put(SHAPES.cyl8, 0, 0.75, 0, 0.022, 0.6, 0.022, 0, 0, Math.PI / 2);
  frame.put(SHAPES.cyl8, 0.52, 0.62, 0, 0.02, 0.6, 0.02, 0, 0, 0.3);
  frame.put(SHAPES.cyl8, 0.46, 0.95, 0, 0.02, 0.5, 0.02, Math.PI / 2, 0, 0);
  dark.geo(rbox(0.22, 0.05, 0.1, 0.02), mtx(-0.3, 0.86, 0));
  dark.geo(rbox(0.3, 0.16, 0.26, 0.03), mtx(0.62, 0.82, 0));
});
const globeLampPart = () => part('fr-globelamp', (L) => {
  L('t', 0x23272b).geo(lathe('fr-glp', [[0.09, 0], [0.09, 0.08], [0.04, 0.16], [0.035, 1.0], [0.07, 1.06], [0.001, 1.1]], 12), mtx());
  L('l', 0xffe6b0).put(SHAPES.sphere, 0, 1.28, 0, 0.2, 0.2, 0.2);
});

function buildFrontage(T, id, x0, y0, z0, S, exposed, seed, sd, same, styleId) {
  const back = [0, 1, 2, 3].find((d) => !exposed[d] && !same[d]);
  const front = sd >= 0 ? sd : back !== undefined ? OPP[back] : 2;
  const [dx, dz] = DIR4[front];
  const F = new Frame().set(x0 + 2 + dx * 2, y0, z0 + 2 + dz * 2, dx, dz);
  const g = T.g, R = (k) => hash((seed * 7919) | 0, k, 41);
  const joins = (s) => same[DIR4.findIndex(([a, b]) => a === s * dz && b === -s * dx)]; // neighbor at +u (1) or -u (-1)
  const solidBack = !exposed[OPP[front]];
  const Y = (p, u, w, ry = 0, colors, v = 0, s = 1) => {
    const m = F.matrix(u, v, w);
    if (ry) m.multiply(new THREE.Matrix4().makeRotationY(ry));
    if (s !== 1) m.multiply(new THREE.Matrix4().makeScale(s, s, s));
    T.PM(p, m, colors);
  };
  const doorColors = { door: 0x3a2418, stone: S.trim, glass: S.glass };

  switch (id) {
    case 'sidewalkcafe': {
      F.rect(g.m, -2, 2, 0, 0.1, -4, 0, [0xbfae92, PAT.TILE]);
      const spots = R(1) < 0.5 ? [[-0.95, -1.5], [0.95, -3.0]] : [[0, -2.2]];
      spots.forEach(([u, w], i) => {
        Y(diningSetPart(R(2 + i) < 0.7), u, w, R(3 + i) * 6, { wood: 0x2b2b2b, fabric: S.accent }, 0.1);
        Y(marketUmbrellaPart(), u, w, 0, { awning: i % 2 ? 0xf2efe6 : S.accent }, 0.1, 0.8);
      });
      for (const [u0, u1] of [[-1.9, -0.45], [0.45, 1.9]]) {
        F.bev(g.m, u0, u1, 0.1, 0.55, -0.55, -0.15, [0x5a4632, PAT.WOOD], 0.02);
        Y(shrubPart(R(9 + u0), 0.55), (u0 + u1) / 2, -0.35, 0, undefined, 0.5);
      }
      if (R(12) < 0.8) Y(cafeLightsPart(), 0, 0, 0, undefined, 0.1);
      if (solidBack) Y(awningPart(4, 1.6, 0.55, true), 0, -4, 0, { awning: S.accent }, 3.3);
      if (!joins(1)) Y(chalkboardPart(), 1.75, -0.9, Math.PI / 2, undefined, 0.1);
      break;
    }
    case 'stoop': {
      F.rect(g.m, -2, 2, 0, 0.06, -4, 0, [0x9e9a92, PAT.TILE]);
      const mat = [S.wall, PAT.ASHLAR], n = 9, rise = 0.2, t = 0.3, top = n * rise, wf = -2.8 + n * t;
      F.bev(g.m, -1.15, 1.15, 0, top, -4, -2.8, mat, 0.02);
      for (let k = 0; k < n; k++) {
        F.bev(g.m, -0.8, 0.8, 0, (k + 1) * rise, wf - (k + 1) * t, wf - k * t + 0.03, mat, 0.012);
        F.rect(g.m, -1.15, -0.8, 0, (k + 1) * rise + 0.18, wf - (k + 1) * t, wf - k * t, mat);
        F.rect(g.m, 0.8, 1.15, 0, (k + 1) * rise + 0.18, wf - (k + 1) * t, wf - k * t, mat);
      }
      const slope = Math.atan2(rise, t), len = Math.hypot(n * t, n * rise);
      for (const s of [-1, 1]) {
        const m = F.matrix(s * 0.975, top / 2 + 0.18, (wf - 2.8) / 2);
        m.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationZ(slope));
        T.PM(ironRailingPart(len, 0.9, true), m);
        F.bev(g.m, s * 0.975 - 0.13, s * 0.975 + 0.13, 0, 1.0, wf - 0.3, wf - 0.04, mat, 0.02);
        Y(globeLampPart(), s * 0.975, wf - 0.17, 0, undefined, 1.0, 0.55);
        Y(ironRailingPart(1.2, 0.9, true), s * 1.08, -3.4, Math.PI / 2, undefined, top);
        if (R(4 + s) < 0.6) Y(pottedPlantPart(R(6 + s), 1.1), s * 1.6, -0.5);
      }
      if (solidBack) {
        Y(doorPart('panel', 1.1, 2.4), 0, -3.72, 0, doorColors, top);
        F.bev(g.m, -0.95, 0.95, top + 2.62, top + 2.82, -4, -3.5, [S.trim, PAT.ASHLAR], 0.02);
        for (const s of [-1, 1]) Y(sconcePart(), s * 0.95, -3.95, 0, undefined, top + 1.8);
      }
      break;
    }
    case 'grandstair': {
      const n = 19, rise = 0.2, t = 4 / n, mat = [S.trim, PAT.MARBLE];
      const ua = joins(-1) ? -2 : -1.6, ub = joins(1) ? 2 : 1.6;
      for (let k = 0; k < n; k++) F.bev(g.m, ua, ub, 0, (k + 1) * rise, -(k + 1) * t, -k * t + 0.02, mat, 0.01);
      for (const s of [-1, 1]) {
        if (joins(s)) continue;
        const u0 = s < 0 ? -2 : 1.6, u1 = s < 0 ? -1.6 : 2;
        for (let i = 0; i < 4; i++) F.bev(g.m, u0, u1, 0, (i + 1) * 0.95 + 0.3, -(i + 1), -i, [S.trim, PAT.ASHLAR], 0.02);
        Y(globeLampPart(), s * 1.8, -0.5, 0, undefined, 1.25);
      }
      const L2 = Math.hypot(4, 3.8);
      F.shape(g.t, SHAPES.cyl8, 0, 2.8, -2, 0.03, L2, 0.03, 0xc9a14a, 0, Math.atan2(-4, 3.8));
      for (const w of [-0.4, -2, -3.6]) F.shape(g.t, SHAPES.cyl8, 0, -w * 0.95 + 0.45, w, 0.02, 0.9, 0.02, 0xc9a14a);
      break;
    }
    case 'portico': {
      const order = ORDER[styleId] || 'doric', trim = [S.trim, PAT.ASHLAR];
      F.bev(g.m, -2, 2, 0, 0.12, -0.45, 0, trim, 0.015);
      F.bev(g.m, -2, 2, 0, 0.24, -0.9, -0.45, trim, 0.015);
      F.bev(g.m, -2, 2, 0, 0.36, -4, -0.9, trim, 0.02);
      for (const u of [-1, 1]) Y(columnPart(order, 3.2, 0.22, 'trim'), u, -1.4, 0, undefined, 0.36);
      F.rect(g.m, -2, 2, 3.5, 3.56, -4, -1.0, [S.wall, PAT.STUCCO]);
      F.bev(g.m, -2, 2, 3.56, 3.8, -4, -0.95, trim, 0.02);
      F.bev(g.m, -2.05, 2.05, 3.8, 3.98, -4, -0.8, [S.trim, 0], 0.03);
      if (!joins(-1) && !joins(1)) F.geo(g.m, extrudeShape('fr-pediment', () => new THREE.Shape([new THREE.Vector2(-2.1, 0), new THREE.Vector2(2.1, 0), new THREE.Vector2(0, 1.0)]), 3.2), 0, 3.98, -2.4, trim);
      if (solidBack) Y(doorPart('arched', 1.5, 2.6), 0, -3.72, 0, doorColors, 0.36);
      F.shape(g.t, SHAPES.cyl8, 0, 3.32, -2.4, 0.01, 0.36, 0.01, 0x2b2b2b);
      F.shape(g.l, SHAPES.sphere, 0, 3.02, -2.4, 0.15, 0.19, 0.15, 0xffe2a8);
      break;
    }
    case 'arcade': {
      const wall = [S.wall, PAT.STUCCO], trim = [S.trim, PAT.ASHLAR];
      F.rect(g.m, -2, 2, 0, 0.08, -4, 0, [0xd8cdb8, PAT.TILE]);
      F.geo(g.m, extrudeShape('fr-arcade', () => {
        const sh = new THREE.Shape([new THREE.Vector2(-2, 0), new THREE.Vector2(2, 0), new THREE.Vector2(2, 4), new THREE.Vector2(-2, 4)]);
        const h = new THREE.Path();
        h.moveTo(-1.5, 0.08); h.lineTo(1.5, 0.08); h.lineTo(1.5, 2.35); h.absarc(0, 2.35, 1.5, 0, Math.PI, false); h.lineTo(-1.5, 0.08);
        sh.holes.push(h);
        return sh;
      }, 0.5), 0, 0, -0.25, wall);
      F.bev(g.m, -0.14, 0.14, 3.62, 3.98, -0.02, 0.06, trim, 0.01);
      F.bev(g.m, -2, -1.5, 2.22, 2.38, -0.55, 0.05, trim, 0.01);
      F.bev(g.m, 1.5, 2, 2.22, 2.38, -0.55, 0.05, trim, 0.01);
      F.rect(g.m, -2, 2, 3.88, 4.0, -4, -0.5, [S.trim, PAT.STUCCO]);
      F.shape(g.t, SHAPES.cyl8, 0, 3.62, -2.2, 0.01, 0.5, 0.01, 0x2b2b2b);
      F.shape(g.l, SHAPES.sphere, 0, 3.25, -2.2, 0.15, 0.2, 0.15, 0xffe2a8);
      if (R(3) < 0.45) Y(diningSetPart(false), 0, -2.4, Math.PI / 2, { wood: 0x6b4a33, fabric: S.accent }, 0.08);
      break;
    }
    case 'vestibule': {
      F.rect(g.m, -2, 2, 0, 0.08, -4, 0, [0x8a8a86, PAT.TILE]);
      F.rect(g.m, -1.0, 1.0, 0.08, 0.1, -1.0, -0.2, 0x2a2a2a);
      Y(vestibulePart(), 0, -2.6, 0, { frame: S.accent }, 0.08);
      Y(doorPart('revolving', 1.9, 2.5), 0, -1.05, 0, { frame: S.accent }, 0.08);
      if (solidBack) Y(canopyPart(4, 2.6, 'frame'), 0, -4, 0, { frame: S.accent }, 3.5);
      for (const s of [-1, 1]) Y(pottedPlantPart(R(6 + s), 1.4), s * 1.75, -0.45);
      break;
    }
    case 'forecourt': {
      F.rect(g.m, -2, 2, 0, 0.08, -4, 0, [0xc4b8a2, PAT.TILE]);
      F.bev(g.m, -0.75, 0.75, 0, 0.5, -2.95, -1.45, [0x9a968e, PAT.ASHLAR], 0.04);
      F.rect(g.m, -0.65, 0.65, 0.5, 0.52, -2.85, -1.55, [0x3b2a1e, PAT.GRAVEL]);
      Y(treePart(R(2), 0.9), 0, -2.2, 0, undefined, 0.5);
      Y(benchPart(), -1.55, -2.2, -Math.PI / 2, undefined, 0.08);
      Y(benchPart(), 1.55, -2.2, Math.PI / 2, undefined, 0.08);
      for (const u of [-1.4, 0, 1.4]) Y(bollardPart(), u, -0.25);
      if (R(3) < 0.5) Y(bikeRackPart(), 1.2, -3.6);
      break;
    }
    case 'bikecorral': {
      F.rect(g.m, -2, 2, 0, 0.08, -4, 0, [0x9e9a92, PAT.TILE]);
      F.rect(g.m, -1.9, 1.9, 0.08, 0.09, -3.2, -0.6, [0x2e8b57, PAT.CONCRETE]);
      F.bev(g.t, -1.8, 1.8, 0.08, 0.22, -2.75, -2.6, [0x3a3a3a, 0], 0.01);
      for (let i = 0; i < 5; i++) {
        const u = -1.5 + i * 0.75;
        F.bev(g.t, u - 0.05, u + 0.05, 0.08, 0.75, -2.72, -2.62, [0x3a3a3a, 0], 0.01);
        if (R(10 + i) < 0.75) Y(bikePart(), u, -1.8, Math.PI / 2, { accent: 0x2a9d8f }, 0.08);
      }
      F.bev(g.t, 1.7, 1.95, 0.08, 1.6, -3.1, -2.85, [0x2a9d8f, 0], 0.02);
      F.rect(g.l, 1.74, 1.91, 1.1, 1.45, -2.85, -2.84, 0xbff0ff);
      break;
    }
  }
}
