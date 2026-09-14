// Outdoor props: rooftop equipment, trees and planters, street furniture, vehicles and people.
// Origin at base center, +z = front, y up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { extrudeProfile, extrudeShape, lathe, tube, foliage, SHAPES, PAT, GeoBuilder } from './geo.js';
import { part, mtx } from './kit.js';

const f2 = (n) => (+n).toFixed(2);
const rbCache = new Map();
export function rbox(w, h, d, r = 0.05) {
  const k = `${f2(w)}:${f2(h)}:${f2(d)}:${f2(r)}`;
  let g = rbCache.get(k);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)); g.deleteAttribute('uv'); rbCache.set(k, g); }
  return g;
}
const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
export const GREENS = [0x4f7f3a, 0x3f6f35, 0x5e8c41, 0x6a9a4a, 0x7cb342, 0x557a3a];

// ---------- rooftop ----------
export function hvacPart(w = 1.9, d = 1.1, h = 0.9) {
  return part(`hvac:${f2(w)}:${f2(d)}:${f2(h)}`, (L) => {
    const body = L('t', 0xb9bfc4, PAT.PANEL), dark = L('m', 0x2e3134), steel = L('t', 0x7d858c);
    steel.bx(-w / 2 - 0.05, 0, -d / 2 + 0.1, w / 2 + 0.05, 0.1, -d / 2 + 0.2);
    steel.bx(-w / 2 - 0.05, 0, d / 2 - 0.2, w / 2 + 0.05, 0.1, d / 2 - 0.1);
    body.bv(-w / 2, 0.1, -d / 2, w / 2, h, d / 2, 0.03);
    for (let x = -w / 2 + 0.12; x < w / 2 - 0.1; x += 0.09) body.put(SHAPES.box, x, 0.45, d / 2 + 0.01, 0.07, 0.5, 0.015, 0, 0, 0, 0.8);
    for (const fx of [-w / 4, w / 4]) {
      steel.geo(lathe('fan-shroud', [[0.34, 0], [0.36, 0], [0.36, 0.14], [0.33, 0.16], [0.31, 0.02]], 24), mtx(fx, h, 0));
      dark.put(SHAPES.cyl, fx, h + 0.02, 0, 0.31, 0.02, 0.31);
      for (let k = 0; k < 5; k++) steel.put(SHAPES.box, fx, h + 0.06, 0, 0.28, 0.01, 0.08, 0, (k * Math.PI * 2) / 5, 0.25);
      steel.put(SHAPES.cyl, fx, h + 0.07, 0, 0.05, 0.05, 0.05);
      for (const r of [0.12, 0.22, 0.32]) steel.put(SHAPES.torus, fx, h + 0.15, 0, r, r, 0.25, Math.PI / 2);
    }
    steel.put(SHAPES.cyl, w / 2 + 0.2, 0.35, -0.2, 0.06, 0.5, 0.06, 0, 0, Math.PI / 2);
    steel.put(SHAPES.cyl, w / 2 + 0.42, 0.18, -0.2, 0.06, 0.36, 0.06);
  });
}

export function ventPart(seed = 0) {
  return part(`vent:${Math.floor(seed * 3)}`, (L) => {
    const s = L('t', 0x9aa1a6);
    const tall = 0.4 + Math.floor(seed * 3) * 0.2;
    s.geo(lathe(`vent:${f2(tall)}`, [[0.1, 0], [0.1, tall], [0.26, tall + 0.04], [0.28, tall + 0.08], [0.12, tall + 0.2], [0.001, tall + 0.22]], 16), mtx());
    s.geo(lathe('vent-flash', [[0.24, 0], [0.1, 0.06], [0.001, 0.06]], 16), mtx());
  });
}

export function skylightPart(w = 1.6) {
  return part(`sky:${f2(w)}`, (L) => {
    const curb = L('m', 0x8a8580, PAT.CONCRETE), glass = L('glass', 0xbfe3f2), frame = L('t', 0x5a6168);
    curb.bv(-w / 2, 0, -w / 2, w / 2, 0.3, w / 2, 0.03);
    glass.put(SHAPES.cone4, 0, 0.3 + w * 0.2, 0, w * 0.7, w * 0.4, w * 0.7, 0, Math.PI / 4, 0);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      frame.put(SHAPES.box, Math.cos(a) * w * 0.25, 0.3 + w * 0.2, Math.sin(a) * w * 0.25, w * 0.72, 0.04, 0.04, 0, -a, 0.52);
    }
    frame.bv(-w / 2 - 0.02, 0.28, -w / 2 - 0.02, w / 2 + 0.02, 0.34, w / 2 + 0.02, 0.01);
  });
}

export function bulkheadPart() {
  return part('bulkhead', (L) => {
    const wall = L('m', 'wall', PAT.STUCCO), trim = L('m', 0x77736c), door = L('t', 0x4a4f55), lamp = L('l', 0xfff0c8);
    wall.bv(-1.2, 0, -1.0, 1.2, 2.6, 1.0, 0.03);
    trim.geo(extrudeProfile('coping', [[-0.1, -0.06], [0.08, -0.06], [0.1, 0.0], [0.1, 0.08], [-0.1, 0.08]], 2.6), mtx(0, 2.6, 1.0));
    trim.bv(-1.3, 2.6, -1.1, 1.3, 2.72, 1.1, 0.02);
    door.bv(-0.45, 0, 1.0, 0.45, 2.1, 1.05, 0.01);
    door.put(SHAPES.cyl, 0.3, 1.05, 1.08, 0.02, 0.2, 0.02, 0, 0, Math.PI / 2);
    lamp.bv(-0.1, 2.25, 1.0, 0.1, 2.4, 1.1, 0.01);
    trim.bx(-0.5, -0.02, 1.0, 0.5, 0.05, 1.4);
  });
}

export function dishPart() {
  return part('dish', (L) => {
    const w = L('t', 0xe8eaec), g = L('t', 0x6d7278);
    g.bx(-0.3, 0, -0.3, 0.3, 0.08, 0.3);
    g.put(SHAPES.cyl, 0, 0.45, 0, 0.05, 0.8, 0.05);
    const bowl = lathe('dish-bowl', Array.from({ length: 9 }, (_, i) => { const r = (i / 8) * 0.55; return [r, r * r * 0.9]; }), 24);
    const m = mtx(0, 0.95, 0.05, -1.0, 0, 0);
    w.geo(bowl, m.clone());
    g.put(SHAPES.cyl8, 0, 1.15, 0.35, 0.015, 0.7, 0.015, -0.6, 0, 0);
    g.put(SHAPES.box, 0, 1.4, 0.6, 0.08, 0.08, 0.12);
  });
}

export function chimneyPart() {
  return part('chimney', (L) => {
    const b = L('m', 0x8a4a36, PAT.BRICK), cap = L('m', 0x77736c), pot = L('m', 0xb0714a);
    b.bv(-0.4, 0, -0.3, 0.4, 1.4, 0.3, 0.01);
    cap.bv(-0.48, 1.4, -0.38, 0.48, 1.52, 0.38, 0.02);
    for (const x of [-0.18, 0.18]) pot.geo(lathe('chpot', [[0.1, 0], [0.12, 0.05], [0.09, 0.28], [0.11, 0.32], [0.08, 0.34], [0.07, 0.3]], 12), mtx(x, 1.52, 0));
  });
}

export function woodTankPart() {
  return part('woodtank', (L) => {
    const wood = L('m', 0x8b5a3c, PAT.TIMBER), steel = L('t', 0x2b2b2b), roof = L('m', 0x4a3a2e, PAT.SHINGLE);
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) steel.put(SHAPES.box, x * 0.85, 1.5, z * 0.85, 0.12, 3.1, 0.12, x * -0.04, 0, z * 0.04);
    for (const y of [0.8, 2.0]) { steel.bx(-0.9, y, -0.9, 0.9, y + 0.06, -0.84); steel.bx(-0.9, y, 0.84, 0.9, y + 0.06, 0.9); }
    steel.put(SHAPES.cyl, 0, 3.0, 0, 1.25, 0.1, 1.25);
    wood.geo(lathe('tank-body', [[1.2, 0], [1.24, 1.1], [1.2, 2.3], [0.001, 2.3]], 28), mtx(0, 3.05, 0));
    for (const y of [3.35, 3.9, 4.5, 5.1]) steel.put(SHAPES.torus, 0, y, 0, 1.25, 1.25, 0.6, Math.PI / 2);
    roof.geo(lathe('tank-roof', [[1.36, 0], [1.3, 0.08], [0.1, 1.0], [0.06, 1.1], [0.001, 1.12]], 28), mtx(0, 5.35, 0));
    for (let y = 0.2; y < 3.0; y += 0.3) steel.bx(1.28, y, -0.2, 1.3, y + 0.03, 0.2);
    steel.bx(1.28, 0, -0.22, 1.31, 5.2, -0.19);
    steel.bx(1.28, 0, 0.19, 1.31, 5.2, 0.22);
  });
}

export function solarPanelPart(w = 3.6, d = 1.0, tilt = 0.5) {
  return part(`solarp:${f2(w)}:${f2(d)}:${f2(tilt)}`, (L) => {
    const cell = L('t', 0x1a2a44), frame = L('t', 0xb8bec4), leg = L('t', 0x6d7278);
    const m = () => mtx(0, 0.55, 0, -tilt, 0, 0);
    const g = new GeoBuilder();
    g.box(0, 0, 0, w, 0.04, d, 0xffffff);
    cell.geo(g.build(), m());
    const fg = new GeoBuilder();
    fg.box(0, 0.01, -d / 2, w + 0.04, 0.06, 0.04, 0xffffff);
    fg.box(0, 0.01, d / 2, w + 0.04, 0.06, 0.04, 0xffffff);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 6) fg.box(x, 0.025, 0, 0.02, 0.02, d, 0xffffff);
    fg.box(0, 0.025, 0, w, 0.02, 0.015, 0xffffff);
    frame.geo(fg.build(), m());
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) {
      leg.bx(x - 0.03, 0, -d * 0.4, x + 0.03, 0.35, -d * 0.35);
      leg.bx(x - 0.03, 0, d * 0.35, x + 0.03, 0.75, d * 0.4);
    }
  });
}

// ---------- nature ----------
export function treePart(seed = 0, size = 1) {
  const k = Math.floor(seed * 6) % 6;
  return part(`tree:${k}:${f2(size)}`, (L) => {
    const bark = L('m', 0x5a3f2a, PAT.TIMBER), leaf = L('m', GREENS[k], PAT.GRASS), leaf2 = L('m', GREENS[(k + 2) % 6], PAT.GRASS);
    const H = 2.2 * size;
    bark.geo(lathe(`trunk:${f2(size)}`, [[0.2 * size, 0], [0.14 * size, 0.2 * size], [0.11 * size, H * 0.6], [0.07 * size, H]], 10), mtx());
    for (let b = 0; b < 3; b++) {
      const a = b * 2.1 + k;
      bark.put(SHAPES.cyl8, Math.cos(a) * 0.3 * size, H * 0.75, Math.sin(a) * 0.3 * size, 0.05 * size, 0.9 * size, 0.05 * size, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
    }
    const blobs = [[0, H + 0.6 * size, 0, 1.0], [0.55, H + 0.25 * size, 0.2, 0.75], [-0.5, H + 0.35 * size, -0.25, 0.7], [0.1, H + 1.15 * size, -0.2, 0.65], [-0.2, H + 0.1 * size, 0.5, 0.6]];
    blobs.forEach(([x, y, z, s], i) => (i % 2 ? leaf2 : leaf).geo(foliage(seed + i * 0.17), mtx(x * size, y, z * size, 0, i, 0, s * size, s * size * 0.9, s * size)));
  });
}

export function shrubPart(seed = 0, s = 1) {
  const k = Math.floor(seed * 6) % 6;
  return part(`shrub:${k}:${f2(s)}`, (L) => {
    const leaf = L('m', GREENS[k], PAT.GRASS);
    for (let i = 0; i < 3; i++) leaf.geo(foliage(seed + i * 0.3), mtx((i - 1) * 0.35 * s, 0.35 * s, (i % 2) * 0.2 * s, 0, i, 0, 0.42 * s, 0.38 * s, 0.42 * s));
  });
}

export function pottedPlantPart(seed = 0, s = 1) {
  const k = Math.floor(seed * 6) % 6;
  return part(`pot:${k}:${f2(s)}`, (L) => {
    const pot = L('m', k % 2 ? 0xb0714a : 0x3a3a3a), soil = L('m', 0x3b2a1e), leaf = L('m', GREENS[k], PAT.GRASS);
    pot.geo(lathe(`potb:${f2(s)}`, [[0.1 * s, 0], [0.16 * s, 0.34 * s], [0.18 * s, 0.36 * s], [0.18 * s, 0.4 * s], [0.15 * s, 0.4 * s], [0.14 * s, 0.36 * s]], 14), mtx());
    soil.put(SHAPES.cyl, 0, 0.37 * s, 0, 0.145 * s, 0.02, 0.145 * s);
    if (k % 3 === 0) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        leaf.put(SHAPES.sphere, Math.cos(a) * 0.18 * s, 0.75 * s, Math.sin(a) * 0.18 * s, 0.05 * s, 0.35 * s, 0.12 * s, Math.sin(a) * 0.6, -a, Math.cos(a) * 0.6);
      }
    } else leaf.geo(foliage(seed), mtx(0, 0.72 * s, 0, 0, 0, 0, 0.3 * s, 0.38 * s, 0.3 * s));
  });
}

// ---------- street furniture ----------
export function lampPostPart() {
  return part('lamppost', (L) => {
    const iron = L('t', 0x23272b), glow = L('l', 0xfff0c0);
    iron.geo(lathe('lp-base', [[0.22, 0], [0.22, 0.12], [0.15, 0.2], [0.13, 0.55], [0.09, 0.62], [0.07, 0.7]], 16), mtx());
    iron.geo(lathe('lp-pole', [[0.07, 0], [0.045, 4.3], [0.06, 4.35], [0.001, 4.4]], 12), mtx(0, 0.7, 0));
    iron.geo(tube('lp-arm', [[0, 4.6, 0], [0.2, 5.05, 0], [0.6, 5.15, 0], [0.95, 5.0, 0]], 0.035, 16, 6), mtx());
    iron.geo(lathe('lp-head', [[0.001, 0], [0.18, 0.02], [0.24, 0.1], [0.08, 0.2], [0.001, 0.22]], 16), mtx(0.95, 4.72, 0));
    glow.geo(lathe('lp-bulb', [[0.001, 0], [0.12, 0.05], [0.16, 0.18], [0.001, 0.2]], 12), mtx(0.95, 4.55, 0));
    iron.put(SHAPES.torus, 0, 1.2, 0, 0.08, 0.08, 0.5, Math.PI / 2);
  });
}

export function benchPart() {
  return part('bench', (L) => {
    const iron = L('t', 0x2b2e33), wood = L('m', 0x7a5236, PAT.WOOD);
    for (const x of [-0.75, 0.75]) {
      iron.geo(extrudeShape('bench-end', () => shape([[-0.25, 0], [-0.2, 0], [-0.05, 0.42], [0.22, 0.42], [0.25, 0], [0.3, 0], [0.26, 0.46], [0.02, 0.46], [-0.1, 0.95], [-0.16, 0.95], [-0.04, 0.46]]), 0.06), mtx(x, 0, 0, 0, Math.PI / 2, 0));
    }
    for (let i = 0; i < 4; i++) wood.bv(-0.9, 0.44, -0.2 + i * 0.12, 0.9, 0.48, -0.12 + i * 0.12, 0.01);
    for (let i = 0; i < 3; i++) wood.put(SHAPES.box, 0, 0.6 + i * 0.12, -0.25 - i * 0.04, 1.8, 0.08, 0.03, 0.35, 0, 0);
  });
}

export function hydrantPart() {
  return part('hydrant', (L) => {
    const r = L('t', 0xc0392b), c = L('t', 0xd8d0c0);
    r.geo(lathe('hyd', [[0.15, 0], [0.15, 0.05], [0.11, 0.08], [0.1, 0.5], [0.13, 0.52], [0.12, 0.58], [0.09, 0.62], [0.05, 0.7], [0.001, 0.72]], 14), mtx());
    for (const a of [0, Math.PI]) c.put(SHAPES.cyl, Math.cos(a) * 0.13, 0.38, Math.sin(a) * 0.13, 0.045, 0.1, 0.045, 0, a, Math.PI / 2);
  });
}

export function trashCanPart() {
  return part('trash', (L) => {
    const g = L('t', 0x2f5d50), d = L('m', 0x1a1a1a);
    g.geo(lathe('trash', [[0.24, 0], [0.26, 0.9], [0.28, 0.92], [0.28, 0.98], [0.2, 1.02], [0.001, 1.05]], 16), mtx());
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; d.put(SHAPES.box, Math.cos(a) * 0.262, 0.5, Math.sin(a) * 0.262, 0.02, 0.7, 0.04, 0, -a, 0); }
  });
}

export function bollardPart() {
  return part('bollard', (L) => {
    L('t', 0x2b2e33).geo(lathe('boll', [[0.1, 0], [0.09, 0.8], [0.11, 0.84], [0.06, 0.95], [0.001, 0.96]], 12), mtx());
  });
}

// ---------- vehicles ----------
export function carParts() {
  const paint = part('car-paint', (L) => {
    const p = L('t', 'paint');
    p.geo(extrudeShape('car-body', () => shape([[-2.1, 0.32], [2.08, 0.32], [2.18, 0.5], [2.15, 0.78], [1.9, 0.92], [1.1, 0.98], [-1.5, 1.0], [-2.08, 0.92], [-2.18, 0.6]]), 1.74), mtx());
    p.geo(rbox(1.9, 0.08, 1.5, 0.03), mtx(-0.3, 1.43, 0));
    for (const [x, a] of [[0.92, -0.72], [-1.45, 0.75]]) for (const z of [-0.72, 0.72]) p.put(SHAPES.box, x, 1.2, z, 0.08, 0.5, 0.08, 0, 0, a);
    for (const x of [1.35, -1.35]) for (const z of [-0.88, 0.88]) p.geo(lathe('arch', [[0.45, -0.05], [0.42, 0.02], [0.001, 0.02]], 16), mtx(x, 0.34, z, Math.PI / 2 * Math.sign(z), 0, 0, 1, 1, 0.3));
  });
  const rest = part('car-rest', (L) => {
    const glass = L('m', 0x1e2a36), tire = L('m', 0x151515), rim = L('t', 0xc0c6cc), light = L('l', 0xfff3c0), tail = L('l', 0xff3b30), trim = L('t', 0x2b2b2b);
    glass.geo(extrudeShape('car-glass', () => shape([[1.12, 0.96], [0.62, 1.4], [-1.25, 1.42], [-1.72, 0.98]]), 1.56), mtx());
    for (const x of [1.35, -1.35]) for (const z of [-0.8, 0.8]) {
      tire.put(SHAPES.cyl, x, 0.34, z, 0.34, 0.24, 0.34, Math.PI / 2);
      rim.put(SHAPES.cyl, x, 0.34, z + Math.sign(z) * 0.07, 0.2, 0.12, 0.2, Math.PI / 2);
    }
    for (const z of [-0.6, 0.6]) { light.bv(2.1, 0.62, z - 0.2, 2.18, 0.74, z + 0.2, 0.01); tail.bv(-2.19, 0.66, z - 0.22, -2.12, 0.78, z + 0.22, 0.01); }
    trim.bv(2.05, 0.34, -0.8, 2.22, 0.46, 0.8, 0.02);
    trim.bv(-2.22, 0.34, -0.8, -2.05, 0.46, 0.8, 0.02);
    for (const z of [-0.9, 0.9]) trim.put(SHAPES.box, 0.75, 1.0, z, 0.18, 0.08, 0.06);
  });
  return { paint, rest };
}

export function busParts(len = 11) {
  const h = len / 2;
  const paint = part(`bus-paint:${len}`, (L) => {
    const p = L('t', 'paint'), stripe = L('t', 'stripe');
    p.geo(rbox(len, 2.9, 2.5, 0.25), mtx(0, 1.85, 0));
    stripe.bx(-h + 0.1, 0.8, -1.265, h - 0.1, 1.2, 1.265);
  });
  const rest = part(`bus-rest:${len}`, (L) => {
    const glass = L('m', 0x1e2a36), tire = L('m', 0x151515), rim = L('t', 0xc0c6cc), light = L('l', 0xfff3c0), sign = L('l', 0xffb347), roof = L('t', 0xcfd6dc);
    glass.bx(-h + 0.6, 1.9, -1.27, h - 1.3, 2.95, 1.27);
    glass.bx(h - 0.02, 1.4, -1.1, h + 0.02, 3.0, 1.1);
    glass.bx(h - 1.1, 0.5, 1.25, h - 0.3, 2.9, 1.28);
    for (const x of [-h + 2.4, h - 2.2]) for (const z of [-1.1, 1.1]) {
      tire.put(SHAPES.cyl, x, 0.5, z, 0.5, 0.32, 0.5, Math.PI / 2);
      rim.put(SHAPES.cyl, x, 0.5, z + Math.sign(z) * 0.1, 0.28, 0.14, 0.28, Math.PI / 2);
    }
    for (const z of [-0.85, 0.85]) light.bv(h + 0.01, 0.7, z - 0.2, h + 0.06, 0.9, z + 0.2, 0.01);
    sign.bx(h + 0.02, 3.05, -0.8, h + 0.05, 3.3, 0.8);
    roof.geo(rbox(len * 0.35, 0.35, 1.8, 0.1), mtx(-h * 0.3, 3.4, 0));
  });
  return { paint, rest };
}

export function trainCarParts(len, color, stripe) {
  const body = part(`train:${len}:${color}:${stripe}`, (L) => {
    const b = L('t', color, PAT.PANEL), s = L('t', stripe), under = L('m', 0x2b2b2b), glassL = L('l', 0xfff2c8), door = L('t', 0x9aa1a6);
    b.geo(extrudeShape('train-profile', () => shape([[-1.35, -1.1], [1.35, -1.1], [1.38, 0.8], [1.2, 1.35], [0.6, 1.55], [-0.6, 1.55], [-1.2, 1.35], [-1.38, 0.8]]), len), mtx(0, 0, 0, 0, Math.PI / 2, 0));
    s.bx(-len / 2, -0.75, -1.39, len / 2, -0.4, 1.39);
    for (let x = -len / 2 + 1.6; x < len / 2 - 1; x += 1.6) glassL.bx(x - 0.55, 0.05, -1.4, x + 0.55, 0.95, 1.4);
    for (const dx of [-len / 4, len / 4]) door.bx(dx - 0.65, -1.0, -1.41, dx + 0.65, 1.1, 1.41);
    for (const dx of [-len / 2 + 2, len / 2 - 2]) {
      under.bv(dx - 1.1, -1.55, -1.1, dx + 1.1, -1.1, 1.1, 0.05);
      for (const wx of [-0.6, 0.6]) for (const z of [-0.72, 0.72]) under.put(SHAPES.cyl, dx + wx, -1.5, z, 0.35, 0.12, 0.35, Math.PI / 2);
    }
  });
  return body;
}

// ---------- people ----------
export function personGeometries() {
  const clothes = new GeoBuilder(), skin = new GeoBuilder();
  const M = (x, y, z, sx, sy, sz, rx = 0) => mtx(x, y, z, rx, 0, 0, sx, sy, sz).clone();
  for (const x of [-0.08, 0.08]) {
    clothes.addGeometry(SHAPES.cyl, M(x, 0.42, 0, 0.07, 0.8, 0.07), 0x6b6b6b);
    clothes.addGeometry(rbox(0.12, 0.08, 0.24, 0.03), M(x, 0.04, 0.04, 1, 1, 1), 0x2b2b2b);
  }
  clothes.addGeometry(rbox(0.32, 0.55, 0.2, 0.08), M(0, 1.08, 0, 1, 1, 1), 0xffffff);
  for (const x of [-0.2, 0.2]) clothes.addGeometry(SHAPES.cyl, M(x, 1.02, 0, 0.05, 0.5, 0.05), 0xffffff);
  const g1 = clothes.build();
  skin.addGeometry(SHAPES.sphere, M(0, 1.52, 0, 0.12, 0.14, 0.13), 0xe0b090);
  skin.addGeometry(SHAPES.hemi, M(0, 1.55, -0.01, 0.13, 0.12, 0.14), 0x3a2a1e);
  for (const x of [-0.2, 0.2]) skin.addGeometry(SHAPES.sphere, M(x, 0.75, 0, 0.05, 0.06, 0.05), 0xe0b090);
  skin.addGeometry(SHAPES.cyl, M(0, 1.38, 0, 0.05, 0.08, 0.05), 0xe0b090);
  return { clothes: g1, skin: skin.build() };
}
