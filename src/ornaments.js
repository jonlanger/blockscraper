// Facade ornaments: decorations attached to one face of a block (see DECOR in catalog.js). Each is drawn
// in the facade frame after the style's own facade — u along the wall, v up from the floor, w outward —
// and reads the style for its motif. j = { up, down, left, right }: the neighbor on that side carries the
// same ornament on the same face, so runs join (columns stack, friezes continue, balconies connect).
import * as THREE from 'three';
import { PAT, SHAPES, lathe, extrudeShape, extrudeProfile, tube, foliage, hash } from './geo.js';
import {
  part, mtx, columnPart, moldingPart, dentilPart, modillionPart, windowPart, ironRailingPart, glassRailingPart,
  balustradePart, flowerBoxPart,
} from './kit.js';
import { clockPart } from './furniture.js';
import { shade } from './facades.js';

const addPart = (L, p, m) => { const mm = m.clone(); for (const l of p.layers) L(l.mat, l.slot).g.addGeometry(l.geo, mm, 0xffffff); };
const lift = (c, k) => { const ch = (s) => { const v = (c >> s) & 255; return Math.round(v + (255 - v) * k) << s; }; return ch(16) | ch(8) | ch(0); };
const _ry = new THREE.Matrix4();
// Part in wall space turned by ry about the vertical.
const PY = (X, p, u, v, w, ry = 0, k = 0) => X.PM(p, X.F.matrix(u, v, w).multiply(_ry.makeRotationY(ry)), k);

export function family(style) {
  if (style === 'gothic') return 'gothic';
  if (style === 'deco' || style === 'moderne' || style === 'midcentury') return 'deco';
  if (style === 'glass' || style === 'futurist' || style === 'brutalist') return 'modern';
  if (style === 'nouveau' || style === 'solarpunk') return 'organic';
  return 'classic';
}

// ---------------------------------------------------------------- figures
let robe = null;
function robeGeo() {
  if (robe) return robe;
  const pts = [[0.001, 0], [0.25, 0], [0.26, 0.06], [0.22, 0.4], [0.18, 0.8], [0.15, 1.02], [0.17, 1.2], [0.2, 1.36], [0.16, 1.46], [0.07, 1.52], [0.001, 1.53]];
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.07 * Math.max(0, 1 - y / 1.1) * Math.cos(Math.atan2(z, x) * 9); // drapery folds
    p.setX(i, x * k); p.setZ(i, z * k * 0.78);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  robe = g;
  return g;
}

const WING = [[0, 0], [0.12, 0.3], [0.3, 0.62], [0.5, 0.86], [0.49, 0.62], [0.42, 0.56], [0.45, 0.4], [0.36, 0.33], [0.37, 0.15], [0.25, 0.1], [0.2, -0.12], [0.08, -0.06]];
const wingGeo = (side) => extrudeShape(`wing:${side}`, () => new THREE.Shape(WING.map(([x, y]) => new THREE.Vector2(x * side, y))), 0.035);

// A standing robed figure about 1.8 m tall: origin at the feet, facing +w.
// pose: 'torch' | 'wreath' | 'book' | 'winged' | 'carry' (arms raised to bear a capital).
export function figurePart(pose = 'torch', mat = 'm', slot = 'stone', pat = PAT.MARBLE) {
  return part(`orn:fig:${pose}:${mat}:${slot}:${pat}`, (L) => {
    const s = L(mat, slot, pat);
    s.geo(robeGeo(), mtx());
    s.put(SHAPES.sphere, 0, 1.4, 0, 0.23, 0.1, 0.13);
    s.put(SHAPES.cyl8, 0, 1.56, 0.01, 0.05, 0.12, 0.05);
    s.put(SHAPES.sphere, 0, 1.68, 0.02, 0.1, 0.12, 0.105);
    s.put(SHAPES.hemi, 0, 1.7, -0.01, 0.112, 0.1, 0.115, -0.35, 0, 0);
    const arm = (x0, y0, x1, y1, z1 = 0.03) => {
      const len = Math.hypot(x1 - x0, y1 - y0, z1), m = new THREE.Matrix4();
      m.lookAt(new THREE.Vector3(x0, y0, 0), new THREE.Vector3(x1, y1, z1), new THREE.Vector3(0, 0, 1));
      m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(0.045, len, 0.045));
      m.setPosition((x0 + x1) / 2, (y0 + y1) / 2, z1 / 2);
      s.geo(SHAPES.cyl8, m);
      s.put(SHAPES.sphere, x1, y1, z1, 0.05, 0.055, 0.05);
    };
    if (pose !== 'carry' && pose !== 'book') arm(-0.2, 1.38, -0.25, 0.9, 0.05);
    if (pose === 'torch' || pose === 'winged') {
      arm(0.19, 1.4, 0.36, 1.98);
      if (pose === 'torch') {
        s.put(SHAPES.cyl8, 0.36, 2.1, 0.03, 0.028, 0.32, 0.028);
        s.geo(lathe('fig-cup', [[0.03, 0], [0.09, 0.08], [0.1, 0.1], [0.001, 0.1]], 10), mtx(0.36, 2.24, 0.03));
        L('l', 0xffc36b).put(SHAPES.cone8, 0.36, 2.45, 0.03, 0.07, 0.24, 0.07);
      } else s.put(SHAPES.torus, 0.36, 2.1, 0.03, 0.11, 0.11, 1.6);
    } else if (pose === 'wreath') {
      arm(0.19, 1.4, 0.26, 1.08, 0.3);
      s.put(SHAPES.torus, 0.27, 1.02, 0.36, 0.12, 0.12, 1.8, 0.4, 0, 0);
    } else if (pose === 'book') {
      for (const x of [-1, 1]) arm(x * 0.2, 1.38, x * 0.12, 1.08, 0.24);
      s.put(SHAPES.box, 0, 1.12, 0.28, 0.34, 0.42, 0.05, -0.45, 0, 0);
    } else if (pose === 'carry') {
      for (const x of [-1, 1]) arm(x * 0.2, 1.4, x * 0.15, 1.86, 0.02);
      s.geo(lathe('fig-echinus', [[0.1, 0], [0.2, 0.08], [0.22, 0.14], [0.001, 0.14]], 16), mtx(0, 1.8, 0));
      s.bv(-0.26, 1.94, -0.22, 0.26, 2.06, 0.22, 0.015);
    }
    if (pose === 'winged') for (const x of [-1, 1]) s.geo(wingGeo(x), mtx(x * 0.08, 1.08, -0.12, 0.15, x * 0.55, 0, 1.1, 1.1, 1));
  });
}

// ---------------------------------------------------------------- sculpture & carving
const gargoylePart = () => part('orn:gargoyle', (L) => {
  const s = L('m', 'stone', PAT.ASHLAR), plain = L('m', 'stone'), cu = L('t', 0x5f9f8a);
  s.bv(-0.25, -0.12, -0.1, 0.25, 0.06, 0.58, 0.02);
  s.bv(-0.19, -0.32, -0.1, 0.19, -0.12, 0.4, 0.02);
  s.bv(-0.12, -0.52, -0.1, 0.12, -0.32, 0.2, 0.02);
  for (const x of [-1, 1]) plain.put(SHAPES.sphere, x * 0.13, 0.2, 0.2, 0.12, 0.15, 0.17);
  plain.put(SHAPES.ico, 0, 0.32, 0.42, 0.17, 0.2, 0.3, -0.6, 0, 0);
  for (const x of [-1, 1]) {
    plain.put(SHAPES.cyl8, x * 0.1, 0.2, 0.64, 0.045, 0.3, 0.045, 0.35, 0, 0);
    for (const dx of [-0.03, 0, 0.03]) plain.put(SHAPES.cone4, x * 0.1 + dx, 0.07, 0.74, 0.014, 0.07, 0.014, Math.PI / 2, 0, 0);
    plain.put(SHAPES.cone8, x * 0.08, 0.66, 0.74, 0.03, 0.18, 0.03, -0.35, 0, -x * 0.5);
    plain.put(SHAPES.cone4, x * 0.12, 0.57, 0.71, 0.04, 0.1, 0.02, 0, 0, -x * 0.8);
    plain.put(SHAPES.sphere, x * 0.055, 0.54, 0.9, 0.024, 0.02, 0.02, 0, 0, 0, 0.3);
    plain.geo(wingGeo(x), mtx(x * 0.12, 0.3, 0.3, 0.25, x * 0.95, -x * 0.15, 0.6, 0.6, 1));
  }
  plain.put(SHAPES.sphere, 0, 0.5, 0.79, 0.13, 0.12, 0.14);
  plain.put(SHAPES.box, 0, 0.47, 0.94, 0.13, 0.08, 0.17, 0.15, 0, 0);
  plain.put(SHAPES.box, 0, 0.37, 0.91, 0.11, 0.04, 0.14, -0.35, 0, 0);
  for (const x of [-0.04, 0, 0.04]) plain.put(SHAPES.cone4, x, 0.415, 1.0, 0.012, 0.035, 0.012, Math.PI, 0, 0);
  plain.geo(tube('garg-tail', [[0, 0.12, 0.12], [0.12, 0.03, 0.0], [0.2, 0.08, -0.06], [0.22, 0.22, -0.04]], 0.028, 12, 6), mtx());
  cu.put(SHAPES.cyl8, 0, 0.42, 1.12, 0.03, 0.34, 0.03, Math.PI / 2, 0, 0);
});

// Every building corner is the right-hand corner of exactly one wall, so only that wall sets a diagonal
// gargoyle there; the other walls keep theirs square to the facade.
function gargoyles(X) {
  const { c } = X, v = c.isTop ? 3.65 : 3.5, k = 1.35;
  const put = (u, w, ry) => X.PM(gargoylePart(), X.F.matrix(u, v, w).multiply(_ry.makeRotationY(ry)).scale(new THREE.Vector3(k, k, k)));
  put(-1.45, 0.15, 0);
  if (c.cornerR) put(1.95, 0.25, Math.PI / 4);
  else put(1.45, 0.15, 0);
}

const tabernaclePart = (fam) => part(`orn:tab:${fam}`, (L) => {
  const s = L('m', 'stone', PAT.ASHLAR), t = L('m', 'stone'), gold = L('t', 0xd4af37);
  s.bv(-0.28, 0.32, -0.02, 0.28, 0.5, 0.44, 0.02);
  s.bv(-0.2, 0.12, -0.02, 0.2, 0.32, 0.32, 0.02);
  t.geo(lathe('tab-drop', [[0.001, 0.14], [0.1, 0.12], [0.08, 0.03], [0.001, 0]], 8), mtx(0, -0.02, 0.15));
  t.bx(-0.3, 0.5, -0.02, 0.3, 2.35, 0.05, 0.72);
  const pose = fam === 'gothic' ? 'book' : fam === 'deco' ? 'torch' : fam === 'organic' ? 'winged' : 'wreath';
  addPart(L, figurePart(pose, 'm', 'stone', PAT.MARBLE), mtx(0, 0.5, 0.2, 0, 0, 0, 0.92, 0.92, 0.92));
  if (fam === 'gothic') {
    for (const x of [-0.26, 0.26]) t.put(SHAPES.cyl8, x, 1.42, 0.36, 0.028, 1.84, 0.028);
    s.bv(-0.32, 2.34, -0.02, 0.32, 2.48, 0.46, 0.015);
    t.geo(extrudeShape('tab-gable', () => new THREE.Shape([[-0.32, 0], [0.32, 0], [0, 0.62]].map(([x, y]) => new THREE.Vector2(x, y))), 0.06), mtx(0, 2.48, 0.42));
    t.geo(lathe('tab-spire', [[0.12, 0], [0.1, 0.1], [0.001, 1.0]], 8), mtx(0, 2.48, 0.2));
    for (let i = 0; i < 4; i++) for (const x of [-1, 1]) t.put(SHAPES.ico, x * (0.1 - i * 0.02), 2.64 + i * 0.2, 0.2, 0.035, 0.05, 0.035);
    t.put(SHAPES.ico, 0, 3.52, 0.2, 0.05, 0.08, 0.05);
  } else if (fam === 'deco') {
    [[0.34, 2.35], [0.26, 2.55], [0.16, 2.75]].forEach(([hw, y]) => s.bv(-hw, y, -0.02, hw, y + 0.2, 0.36, 0.015));
    for (let k = 0; k < 7; k++) { const a = (k / 6) * Math.PI; gold.put(SHAPES.box, Math.cos(a) * 0.18, 2.35 + Math.sin(a) * 0.18, 0.06, 0.02, 0.32, 0.02, 0, 0, a - Math.PI / 2); }
  } else if (fam === 'modern') {
    L('t', 0xc8ccd0).bv(-0.3, 2.35, -0.02, 0.3, 2.42, 0.5, 0.01);
    L('l', 0xfff0c8).bx(-0.22, 2.33, 0.1, 0.22, 2.35, 0.4);
  } else {
    for (const x of [-0.26, 0.26]) t.put(SHAPES.cyl8, x, 1.42, 0.34, 0.035, 1.84, 0.035);
    t.put(SHAPES.hemi, 0, 2.42, 0.02, 0.28, 0.22, 0.14, Math.PI / 2 - 0.3, 0, 0);
    s.bv(-0.36, 2.34, -0.02, 0.36, 2.5, 0.44, 0.015);
    t.geo(extrudeShape('tab-ped', () => new THREE.Shape([[-0.4, 0], [0.4, 0], [0, 0.26]].map(([x, y]) => new THREE.Vector2(x, y))), 0.44), mtx(0, 2.5, 0.22));
    t.geo(lathe('tab-urn', [[0.001, 0], [0.05, 0], [0.04, 0.03], [0.08, 0.1], [0.05, 0.18], [0.001, 0.22]], 10), mtx(0, 2.76, 0.22));
  }
});

function niches(X) {
  for (const s of [-1, 1]) X.P(tabernaclePart(family(X.style)), s * 1.72, 0, 0.12);
}

function caryatids(X, j) {
  const { c } = X, st = [X.colors.stone, PAT.ASHLAR];
  const u0 = -2 - (c.cornerL ? 0.3 : 0), u1 = 2 + (c.cornerR ? 0.3 : 0);
  for (const s of [-1, 1]) {
    const u = s * 1.6;
    X.box('m', u - 0.34, u + 0.34, 0, 0.42, 0.14, 0.86, st, 0.03);
    X.box('m', u - 0.38, u + 0.38, 0.42, 0.5, 0.1, 0.9, st, 0.015);
    X.P(figurePart('carry', 'm', 'stone', PAT.MARBLE), u, 0.5, 0.5);
  }
  X.box('m', u0, u1, 2.56, 2.76, -0.05, 0.84, st, 0.02);
  X.P(moldingPart('crown', u1 - u0, 'stone'), (u0 + u1) / 2, 2.98, 0.6);
  X.box('m', u0, u1, 2.76, 2.98, -0.05, 0.62, [X.colors.stone, PAT.NONE], 0.01);
  if (!j.up) for (let u = -1.5; u <= 1.51; u += 0.5) X.shape('m', SHAPES.cone4, u, 3.1, 0.7, 0.08, 0.24, 0.03, X.colors.stone, 0, 0);
}

function frieze(X) {
  const { c, S } = X, st = X.colors.stone, fam = family(X.style);
  const u0 = -2 - (c.cornerL ? 0.18 : 0), u1 = 2 + (c.cornerR ? 0.18 : 0);
  const v0 = 3.3, v1 = 3.9, w = 0.18, vm = (v0 + v1) / 2;
  X.box('m', u0, u1, v0, v1, -0.05, w - 0.04, [shade(st, 0.86), PAT.NONE]);
  X.box('m', u0, u1, v0 - 0.08, v0, -0.05, w + 0.03, st, 0.015);
  X.box('m', u0, u1, v1, v1 + 0.1, -0.05, w + 0.06, st, 0.015);
  for (let i = 0; i < 8; i++) {
    const u = -1.75 + i * 0.5;
    if (fam === 'classic') {
      if (i % 2 === 0) for (const k of [-1, 0, 1]) X.box('m', u + k * 0.07 - 0.025, u + k * 0.07 + 0.025, v0 + 0.03, v1 - 0.03, w - 0.05, w + 0.01, st, 0.006);
      else {
        X.shape('m', SHAPES.cyl, u, vm, w - 0.02, 0.07, 0.04, 0.07, st, 0, Math.PI / 2);
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; X.shape('m', SHAPES.ico, u + Math.cos(a) * 0.12, vm + Math.sin(a) * 0.12, w - 0.02, 0.06, 0.06, 0.03, st); }
      }
    } else if (fam === 'deco') {
      for (const s of [-1, 1]) X.shape('t', SHAPES.box, u + s * 0.12, vm, w, 0.3, 0.05, 0.03, S.accent, s * 0.8);
      for (let k = 0; k < 5; k++) { const a = 0.35 + (k / 4) * (Math.PI - 0.7); X.shape('m', SHAPES.box, u + Math.cos(a) * 0.1, v0 + 0.04 + Math.sin(a) * 0.1, w - 0.02, 0.03, 0.2, 0.03, st, a - Math.PI / 2); }
    } else if (fam === 'gothic') {
      for (const [du, dv] of [[0.07, 0], [-0.07, 0], [0, 0.07], [0, -0.07]]) X.shape('m', SHAPES.torus, u + du, vm + dv, w - 0.02, 0.075, 0.075, 1.5, st);
      X.shape('m', SHAPES.ico, u, vm, w - 0.02, 0.04, 0.04, 0.03, st);
      X.box('m', u + 0.235, u + 0.265, v0, v1, w - 0.05, w + 0.02, st, 0.006);
    } else if (fam === 'modern') {
      for (let k = 0; k < 4; k++) { const du = -0.19 + k * 0.125, d = 0.03 + 0.06 * (0.5 + 0.5 * Math.sin((i * 4 + k) * 0.6 + c.level)); X.box('m', u + du - 0.03, u + du + 0.03, v0 + 0.02, v1 - 0.02, w - 0.05, w - 0.02 + d, st, 0.006); }
      if (X.style === 'futurist' && i === 0) X.box('l', u0, u1, v0 + 0.02, v0 + 0.05, w + 0.03, w + 0.05, S.accent);
    } else {
      X.shape('m', SHAPES.ico, u + 0.12, vm + 0.1, w - 0.02, 0.09, 0.05, 0.03, st, 0.6);
      X.shape('m', SHAPES.ico, u - 0.12, vm - 0.1, w - 0.02, 0.09, 0.05, 0.03, st, -0.6);
      X.shape('m', SHAPES.sphere, u, vm, w, 0.06, 0.06, 0.04, X.style === 'solarpunk' ? 0xe6a23c : S.accent);
    }
  }
  if (fam === 'organic') X.geo('m', tube('frz-vine', Array.from({ length: 17 }, (_, k) => [-2 + k * 0.25, Math.sin(k * Math.PI / 2) * 0.16, 0]), 0.025, 64, 6), 0, vm, w - 0.03, st);
}

function clock(X) {
  const { S } = X, st = X.colors.stone, fam = family(X.style), vc = 2.2;
  if (fam === 'deco') for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; X.shape('t', SHAPES.box, Math.cos(a) * 1.45, vc + Math.sin(a) * 1.45, 0.1, 0.05, 0.55, 0.04, S.accent, a - Math.PI / 2); }
  X.shape('m', SHAPES.cyl, 0, vc, 0.08, 1.12, 0.16, 1.12, [st, fam === 'modern' ? PAT.NONE : PAT.ASHLAR], 0, Math.PI / 2);
  X.shape(fam === 'modern' ? 't' : 'm', SHAPES.torus, 0, vc, 0.17, 1.06, 1.06, 2.4, fam === 'modern' ? 0xc8ccd0 : st);
  if (fam !== 'modern') for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; X.shape('m', SHAPES.box, Math.cos(a) * 1.13, vc + Math.sin(a) * 1.13, 0.13, 0.22, 0.14, 0.14, st, a); }
  X.P(clockPart(0.9), 0, vc, 0.18);
  if (fam === 'classic' || fam === 'organic') {
    X.geo('m', extrudeShape('clk-ped', () => new THREE.Shape([[-1.3, 0], [1.3, 0], [0, 0.55]].map(([x, y]) => new THREE.Vector2(x, y))), 0.3), 0, vc + 1.18, 0.12, st);
    for (const s of [-1, 1]) X.shape('m', SHAPES.torus, s * 1.2, vc - 0.9, 0.16, 0.16, 0.16, 2.5, st);
  } else if (fam === 'gothic') {
    X.geo('m', extrudeShape('clk-gable', () => new THREE.Shape([[-1.3, 0], [1.3, 0], [0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y))), 0.26), 0, vc + 1.1, 0.1, st);
    for (let i = 1; i < 5; i++) for (const s of [-1, 1]) X.shape('m', SHAPES.ico, s * 1.3 * (1 - i / 5), vc + 1.1 + i * 0.2, 0.2, 0.05, 0.07, 0.05, st);
  }
}

// ---------------------------------------------------------------- pillars & projections
const ORDERS = { beaux: 'corinthian', castiron: 'castiron', mediterranean: 'ionic', nouveau: 'ionic', gothic: 'doric', chicago: 'doric', brick: 'doric', deco: 'doric' };

function columns(X, j) {
  const { c } = X, order = ORDERS[X.style] || 'modern', st = [X.colors.stone, PAT.ASHLAR];
  const r = order === 'modern' ? 0.17 : order === 'castiron' ? 0.14 : 0.21, slot = order === 'castiron' ? 'iron' : 'stone';
  const w = 0.64, base = !j.down, cap = !j.up, ped = base ? 0.24 : 0;
  const top = cap ? 3.68 : 4;
  for (const u of [-1.7, 1.7]) {
    if (base) X.box('m', u - r * 1.75, u + r * 1.75, 0, ped, w - r * 1.75, w + r * 1.75, st, 0.02);
    X.P(columnPart(order, top - ped, r, slot, base, cap), u, ped, w);
    if (cap) X.box('m', u - 0.14, u + 0.14, 3.5, 3.68, -0.1, w, st, 0.01);
  }
  if (cap) {
    const eL = c.cornerL ? w + 0.35 : 0, eR = c.cornerR ? w + 0.35 : 0, u0 = -2 - eL, u1 = 2 + eR;
    X.box('m', u0, u1, 3.68, 3.92, -0.1, w + r * 1.9, st, 0.02);
    X.box('m', u0, u1, 3.92, 4.02, -0.1, w + r * 1.9 + 0.08, [X.colors.stone, PAT.NONE], 0.015);
    if (order !== 'modern') X.P(dentilPart(u1 - u0, 'stone', 0.07), (u0 + u1) / 2, 3.9, w + r * 1.9);
  }
}

function buttresses(X, j) {
  const st = [X.colors.stone, PAT.ASHLAR];
  const spire = lathe('btr-pin', [[0.19, 0], [0.16, 0.1], [0.001, 1.3]], 8);
  for (const s of [-1, 1]) {
    const u = s * 1.76, hw = 0.24;
    if (!j.down) {
      X.box('m', u - hw - 0.07, u + hw + 0.07, 0, 1.3, -0.1, 1.05, st, 0.03);
      X.shape('m', SHAPES.box, u, 1.43, 0.82, hw * 2 + 0.14, 0.09, 0.52, st, 0, 0.7);
      X.box('m', u - hw, u + hw, 1.3, 4, -0.1, 0.62, st, 0.02);
    } else X.box('m', u - hw, u + hw, 0, 4, -0.1, 0.62, st, 0.02);
    X.box('m', u - hw - 0.03, u + hw + 0.03, 2.3, 2.42, -0.1, 0.68, st, 0.01);
    if (!j.up) {
      X.shape('m', SHAPES.box, u, 3.98, 0.5, hw * 2, 0.09, 0.3, st, 0, 0.6);
      X.box('m', u - hw * 0.75, u + hw * 0.75, 3.9, 4.7, 0.05, 0.42, st, 0.02);
      X.geo('m', spire, u, 4.7, 0.24, [X.colors.stone, 0]);
      for (let i = 0; i < 3; i++) for (const k of [-1, 1]) X.shape('m', SHAPES.ico, u + k * (0.12 - i * 0.035), 4.9 + i * 0.3, 0.24, 0.04, 0.06, 0.04, X.colors.stone);
    }
  }
}

function orielPart(fam, pat, corbel, roof) {
  return part(`orn:oriel:${fam}:${pat}:${corbel}:${roof}`, (L) => {
    const modern = fam === 'modern', wall = L('m', modern ? 'frame' : 'wall', modern ? PAT.PANEL : pat), st = L('m', 'stone');
    const D = 0.95, F = 0.72, B = 1.15, sideLen = Math.hypot(B - F, D), sideAng = Math.atan2(D, B - F);
    const plan = extrudeShape('oriel-plan', () => new THREE.Shape([[-B, 0], [B, 0], [F, D], [-F, D]].map(([x, z]) => new THREE.Vector2(x, z))), 0.18);
    wall.geo(plan, mtx(0, 0.09, 0, Math.PI / 2, 0, 0));
    st.geo(plan, mtx(0, 3.83, 0, Math.PI / 2, 0, 0, 1.06, 1.08, 1));
    // front and angled side faces: spandrel, window, head panel
    const faces = [[0, D, 0, F * 2], ...[-1, 1].map((s) => [s * (B + F) / 2, D / 2, s * sideAng, sideLen])];
    faces.forEach(([x, z, ry, len], i) => {
      const nx = Math.sin(ry), nz = Math.cos(ry), inX = x - nx * 0.06, inZ = z - nz * 0.06;
      wall.put(SHAPES.box, inX, 0.45, inZ, len, 0.54, 0.12, 0, ry, 0);
      wall.put(SHAPES.box, inX, 3.37, inZ, len, 0.74, 0.12, 0, ry, 0);
      addPart(L, windowPart({ w: len - (i ? 0.14 : 0.2), h: 2.28, cols: i ? 1 : 2, rows: modern ? 1 : 2, depth: 0.1, frame: 0.05, sill: !modern, pat, frameMat: modern ? 't' : 'm' }), mtx(x, 0.72, z, 0, ry, 0));
    });
    for (const s of [-1, 1]) st.put(SHAPES.box, s * F, 1.95, D, 0.1, 3.7, 0.1, 0, s * 0.4, 0);
    if (corbel) {
      st.geo(extrudeProfile('oriel-corbel', [[0, -1.05], [0.12, -0.95], [0.3, -0.6], [0.6, -0.26], [D, -0.04], [D, 0], [0, 0]], F * 2 + 0.3), mtx());
      st.geo(lathe('oriel-drop', [[0.001, 0.25], [0.1, 0.2], [0.07, 0.05], [0.001, 0]], 10), mtx(0, -1.3, 0.12));
    }
    if (roof) {
      if (fam === 'organic') L('m', 'roof', PAT.SHINGLE).put(SHAPES.hemi, 0, 3.96, 0, B * 0.98, 0.85, D * 1.02);
      else if (!modern) {
        const m = new THREE.Matrix4().makeScale(B / 0.707, 0.75, D / 0.707).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 4));
        m.setPosition(0, 4.3, 0);
        L('m', 'roof', PAT.SHINGLE).geo(SHAPES.cone4, m);
      }
      L('t', 0xd4af37).geo(lathe('oriel-finial', [[0.04, 0], [0.09, 0.08], [0.03, 0.2], [0.06, 0.26], [0.001, 0.45]], 8), mtx(0, fam === 'organic' ? 4.78 : 4.62, 0.12));
    }
  });
}

function oriel(X, j) {
  X.P(orielPart(family(X.style), X.meta.pat, !j.down, !j.up), 0, 0, 0.04);
}

const bracketPart = (slot, pat = 0) => part(`orn:bracket:${slot}:${pat}`, (L) => {
  L('m', slot, pat).geo(extrudeShape('orn-bracket', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0, -0.9); s.quadraticCurveTo(0.12, -0.45, 0.55, -0.28); s.quadraticCurveTo(1.05, -0.12, 1.3, 0); s.lineTo(0, 0);
    return s;
  }, 0.14), mtx(0, 0, 0, 0, -Math.PI / 2, 0));
});

function overhang(X, j) {
  const { c, S } = X, fam = family(X.style), D = 1.7;
  const u0 = -2 - (c.cornerL ? D : 0), u1 = 2 + (c.cornerR ? D : 0), len = u1 - u0, mid = (u0 + u1) / 2;
  const posts = [-1.5, 0, 1.5];
  if ((fam === 'modern' && X.style !== 'brutalist') || X.style === 'castiron' || X.style === 'moderne' || X.style === 'midcentury') {
    const steel = X.style === 'castiron' ? X.colors.iron : X.colors.frame;
    X.box('t', u0, u1, 3.52, 3.68, -0.1, D, [steel, PAT.PANEL], 0.02);
    X.box('wd', u0 + 0.1, u1 - 0.1, 3.68, 3.7, 0.05, D - 0.1, 0xbfe0ee);
    const rise = 1.2, run = D - 0.25, ang = Math.atan2(run, rise), L2 = Math.hypot(run, rise);
    for (const u of posts) X.g.t.addGeometry(SHAPES.cyl8, X.F.matrix(u, 3.52 - rise / 2, run / 2, 0, ang, 0.035, L2, 0.035), steel);
  } else if (fam === 'organic' || X.style === 'mediterranean' || X.style === 'brick') {
    const wood = [0x7a5236, PAT.WOOD];
    X.box('m', u0, u1, 3.62, 3.76, -0.1, D, wood);
    X.shape('m', SHAPES.box, mid, 3.9, D / 2 + 0.02, len, 0.1, D + 0.2, [X.colors.roof, PAT.ROOFTILE], 0, 0.14);
    for (let u = u0 + 0.2; u < u1; u += 0.42) X.box('m', u - 0.05, u + 0.05, 3.5, 3.64, -0.1, D + 0.12, [0x6b4a33, PAT.WOOD], 0.01);
    for (const u of posts) X.P(bracketPart(0x6b4a33, PAT.WOOD), u, 3.62, 0);
  } else {
    X.geo('m', extrudeProfile('ovh-slab', [[-0.1, -0.5], [0.25, -0.44], [D, -0.12], [D + 0.08, -0.08], [D + 0.08, 0.14], [-0.1, 0.14]], len), mid, 3.8, 0, [X.style === 'brutalist' ? X.colors.wall : X.colors.stone, X.style === 'brutalist' ? PAT.CONCRETE : PAT.NONE]);
    if (fam === 'deco') X.box('t', u0, u1, 3.74, 3.8, D + 0.08, D + 0.1, S.accent);
    else if (fam !== 'modern') for (const u of posts) X.P(bracketPart('stone', PAT.ASHLAR), u, 3.36, 0);
  }
  for (const u of [-1, 1]) X.shape('l', SHAPES.cyl, u, 3.34, D * 0.6, 0.09, 0.02, 0.09, 0xfff0c8);
}

function balcony(X, j) {
  const fam = family(X.style);
  const kind = X.style === 'brutalist' ? 'concrete' : X.style === 'beaux' || fam === 'gothic' ? 'stone' : fam === 'modern' || fam === 'deco' || X.style === 'solarpunk' ? 'glass' : 'iron';
  const D = 1.05, surf = kind === 'concrete' ? [X.colors.wall, PAT.CONCRETE] : [X.colors.stone, PAT.NONE];
  X.box('m', -2, 2, -0.12, 0.08, -0.05, D, surf, 0.02);
  X.P(moldingPart('slabEdge', 4.02, 'stone'), 0, 0.02, D - 0.02);
  const side = (s) => {
    if (kind === 'concrete') X.box('m', s * 2 - 0.08, s * 2 + 0.08, 0.08, 1.05, -0.05, D, surf, 0.02);
    else PY(X, kind === 'iron' ? ironRailingPart(D - 0.08, 1.0, false) : kind === 'glass' ? glassRailingPart(D - 0.08) : balustradePart(D - 0.1, 0.95, 'stone'), s * 1.95, 0.08, (D - 0.08) / 2, Math.PI / 2);
  };
  if (kind === 'iron') X.P(ironRailingPart(4, 1.0, true), 0, 0.08, D - 0.06);
  else if (kind === 'glass') X.P(glassRailingPart(4), 0, 0.08, D - 0.05);
  else if (kind === 'stone') X.P(balustradePart(4, 0.95, 'stone'), 0, 0.08, D - 0.14);
  else X.box('m', -2, 2, 0.08, 1.05, D - 0.16, D, surf, 0.03);
  if (!j.left) side(-1);
  if (!j.right) side(1);
  if (kind === 'iron' || kind === 'stone') for (const u of [-1.4, 0, 1.4]) X.PM(bracketPart('stone'), X.F.matrix(u, -0.12, 0, 0, 0, 0.7, 0.7, 0.7));
  if (fam === 'organic' || X.style === 'mediterranean') X.P(flowerBoxPart(1.2, hash(X.c.seed * 99 | 0, X.c.level, 3)), 0.9, 1.0, D - 0.02);
  if (X.style === 'solarpunk') X.box('m', -2, 2, 0.08, 0.3, D - 0.3, D - 0.08, [0x7a5236, PAT.WOOD], 0.02);
}

const finPart = (slot, pat, led) => part(`orn:fin:${slot}:${pat}:${led}`, (L) => {
  L('m', slot, pat).bv(-0.05, 0, 0, 0.05, 4, 0.92, 0.015);
  if (led) L('l', 'neon').bx(-0.02, 0.05, 0.92, 0.02, 3.95, 0.94);
});

function fins(X, j) {
  const { c } = X, concrete = X.style === 'brutalist';
  const p = finPart(concrete ? 'wall' : 'accent', concrete ? PAT.CONCRETE : PAT.PANEL, X.style === 'futurist');
  const ang = X.style === 'futurist' ? -0.7 + ((((c.level % 8) + 8) % 8) / 8) * 1.4 : X.style === 'midcentury' || concrete ? 0 : 0.35;
  for (const u of [-1.5, -0.5, 0.5, 1.5]) PY(X, p, u, 0, 0, ang);
  if (!j.up) X.box('m', -2, 2, 3.9, 4.02, -0.05, 0.98, concrete ? [X.colors.wall, PAT.CONCRETE] : [X.colors.accent, PAT.PANEL], 0.02);
}

// ---------------------------------------------------------------- trim & flourishes
function cornice(X, j) {
  const { c } = X, fam = family(X.style), st = X.colors.stone;
  const eL = c.cornerL ? 0.4 : 0, eR = c.cornerR ? 0.4 : 0, len = 4 + eL + eR, mid = (eR - eL) / 2;
  X.box('m', -2 - eL, 2 + eR, 3.1, 3.55, -0.05, 0.14, [st, PAT.NONE], 0.01);
  X.P(dentilPart(len, 'stone', 0.09), mid, 3.66, 0.14);
  X.P(modillionPart(len, 'stone'), mid, 3.84, 0.12);
  X.P(moldingPart('cornice', len + 0.2, 'stone'), mid, 4.0, 0);
  if (j.up) return;
  const urn = lathe('acro-urn', [[0.001, 0], [0.1, 0], [0.08, 0.05], [0.05, 0.1], [0.14, 0.24], [0.15, 0.34], [0.09, 0.44], [0.11, 0.48], [0.001, 0.62]], 12);
  for (const u of fam === 'gothic' ? [-1.5, -0.5, 0.5, 1.5] : [-1.5, 0, 1.5]) {
    if (fam === 'gothic') X.shape('m', SHAPES.cone4, u, 4.3, 0.36, 0.14, 0.5, 0.14, st, 0, 0);
    else if (fam === 'deco' || fam === 'modern') X.box('m', u - 0.14, u + 0.14, 4.08, 4.5, 0.12, 0.5, [st, PAT.NONE], 0.02);
    else X.geo('m', urn, u, 4.08, 0.34, [st, 0]);
  }
}

function neon(X, j) {
  const col = lift(X.colors.accent, 0.4), w0 = 0.4, w1 = 0.46;
  if (X.style === 'moderne') {
    for (const v of [1.0, 1.2, 1.4]) X.box('l', -2, 2, v, v + 0.05, w0, w1, col);
    return;
  }
  if (!j.left) X.box('l', -1.99, -1.93, 0, 4, w0, w1, col);
  if (!j.right) X.box('l', 1.93, 1.99, 0, 4, w0, w1, col);
  if (!j.up) X.box('l', -2, 2, 3.92, 3.98, w0, w1, col);
  if (family(X.style) === 'deco') for (const s of [-1, 1]) X.shape('l', SHAPES.box, s * 0.4, 3.55, w0 + 0.03, 0.95, 0.05, 0.06, col, -s * 0.55);
  X.box('t', -2, 2, 3.94, 3.96, 0, w0, 0x2b2b2b);
}

const flagPart = (c1, c2) => part(`orn:flag:${c1}:${c2}`, (L) => {
  L('t', 0xd8dce0).put(SHAPES.cyl8, 0, 1.2, 0, 0.03, 2.4, 0.03);
  L('t', 0xd4af37).put(SHAPES.sphere, 0, 2.44, 0, 0.06, 0.06, 0.06);
  L('t', 0xd8dce0).bx(-0.08, -0.05, -0.05, 0.08, 0.05, 0.05);
  const a = L('m', c1), b = L('m', c2);
  for (let i = 0; i < 4; i++) {
    const x = 0.2 + i * 0.32, z = Math.sin(i * 1.4) * 0.05, ry = (i % 2 ? 1 : -1) * 0.18;
    a.put(SHAPES.box, x, 1.95, z, 0.33, 0.8, 0.02, 0, ry, 0);
    b.put(SHAPES.box, x, 1.95, z + 0.004, 0.33, 0.22, 0.02, 0, ry, 0);
  }
});

function flags(X) {
  const { c } = X, r = hash((c.seed * 3571) | 0, c.level, 23);
  const pairs = [[0xc0392b, 0xf4f1ea], [0x1f3a5f, 0xf2c14e], [X.colors.accent, X.colors.trim], [0x2f5d50, 0xf4f1ea]];
  const [c1, c2] = pairs[Math.floor(r * pairs.length)];
  X.P(flagPart(c1, c2), 0, 3.2, 0.12, 0, 0, 0.8);
  for (const u of [-1.62, 1.62]) {
    X.shape('t', SHAPES.cyl8, u, 3.72, 0.3, 0.64, 0.02, 0.02, 0x2b2b2b, Math.PI / 2);
    for (const s of [-1, 1]) X.box('t', u + s * 0.29 - 0.015, u + s * 0.29 + 0.015, 3.66, 3.78, 0, 0.3, 0x2b2b2b);
    X.box('m', u - 0.26, u + 0.26, 1.35, 3.7, 0.27, 0.3, [c1, PAT.NONE]);
    X.box('m', u - 0.26, u + 0.26, 1.35, 1.5, 0.3, 0.31, [c2, PAT.NONE]);
    X.shape('t', SHAPES.cyl, u, 3.0, 0.31, 0.14, 0.01, 0.14, 0xd4af37, 0, Math.PI / 2);
  }
}

function ivy(X, j) {
  const { c } = X, R = (k) => hash((c.seed * 9277) | 0, c.level * 17 + k, 61);
  const greens = [0x3f6f35, 0x4f7f3a, 0x5e8c41, 0x355e2c];
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
    const v = (i + R(i)) * 0.5, u = s * (1.6 + (R(i + 20) - 0.5) * 0.7), k = 0.3 + R(i + 60) * 0.22;
    X.shape('m', foliage(R(i + 40)), u, v, 0.14, k, k * 0.9, 0.16, [greens[(i + (s > 0 ? 1 : 0)) % 4], PAT.GRASS]);
  }
  if (!j.up) for (let u = -1.3; u <= 1.31; u += 0.37) X.shape('m', foliage(R(u * 10 + 90)), u, 3.85 - R(u * 10 + 70) * 0.5, 0.16, 0.26, 0.24 + R(u * 7) * 0.3, 0.14, [greens[Math.floor(R(u * 5) * 4)], PAT.GRASS]);
  if (!c.isGround) X.P(flowerBoxPart(1.4, R(9)), 0, 0.5, 0.06);
}

const lanternPart = (modern) => part(`orn:lantern:${modern}`, (L) => {
  const iron = L('t', 'iron'), glow = L('l', 0xffd89a);
  iron.bv(-0.08, -0.16, -0.01, 0.08, 0.16, 0.04, 0.01);
  if (modern) {
    iron.bv(-0.1, -0.3, 0.04, 0.1, 0.3, 0.2, 0.01);
    glow.bx(-0.08, -0.28, 0.2, 0.08, 0.28, 0.21);
    return;
  }
  iron.put(SHAPES.cyl8, 0, 0.1, 0.26, 0.02, 0.52, 0.02, Math.PI / 2, 0, 0);
  iron.put(SHAPES.torus, 0, -0.05, 0.2, 0.14, 0.14, 1.2, 0, Math.PI / 2, 0);
  iron.put(SHAPES.cyl8, 0, 0.02, 0.5, 0.006, 0.14, 0.006);
  iron.put(SHAPES.cone8, 0, -0.1, 0.5, 0.15, 0.14, 0.15);
  glow.put(SHAPES.cyl8, 0, -0.33, 0.5, 0.1, 0.32, 0.1);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 8; iron.put(SHAPES.box, Math.cos(a) * 0.1, -0.33, 0.5 + Math.sin(a) * 0.1, 0.018, 0.34, 0.018); }
  iron.put(SHAPES.cone8, 0, -0.54, 0.5, 0.08, 0.1, 0.08, Math.PI, 0, 0);
});

function lanterns(X) {
  const modern = family(X.style) === 'modern' || X.style === 'midcentury';
  for (const s of [-1, 1]) X.P(lanternPart(modern), s * 1.72, 2.6, 0.12);
}

const BUILDERS = {
  gargoyle: gargoyles, niche: niches, caryatid: caryatids, frieze, clock, columns, buttress: buttresses, oriel, overhang,
  balcony, fins, cornice, neon, flags, ivy, lanterns,
};

export function buildDecor(X, id, j) {
  const b = BUILDERS[id];
  if (b) b(X, j);
}
