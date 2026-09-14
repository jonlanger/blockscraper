// More outdoor props: tree species, vehicle types, street furniture and animals.
import * as THREE from 'three';
import { lathe, tube, foliage, extrudeShape, SHAPES, PAT } from './geo.js';
import { part, mtx } from './kit.js';
import { rbox, treePart, GREENS } from './props.js';

const f2 = (n) => (+n).toFixed(2);
const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));

// species: 0 deciduous, 1 conifer, 2 birch, 3 palm, 4 red maple, 5 flowering cherry
export function anyTreePart(seed = 0, size = 1, species = 0) {
  if (species === 0) return treePart(seed, size);
  const k = Math.floor(seed * 4) % 4;
  return part(`tree2:${species}:${k}:${f2(size)}`, (L) => {
    const s = size;
    if (species === 1) {
      const bark = L('m', 0x4a3424, PAT.TIMBER), needles = L('m', [0x2f5a3a, 0x3a6a42, 0x264d33, 0x345f3c][k], PAT.GRASS);
      bark.geo(lathe('conif-trunk', [[0.14, 0], [0.1, 0.8], [0.05, 3.6]], 8), mtx(0, 0, 0, 0, 0, 0, s, s, s));
      for (let i = 0; i < 5; i++) {
        const y = (0.7 + i * 0.62) * s, r = (1.25 - i * 0.22) * s;
        const g = new THREE.ConeGeometry(r, 1.1 * s, 10, 1);
        const p = g.attributes.position;
        for (let v = 0; v < p.count; v++) if (p.getY(v) < 0) { const a = Math.atan2(p.getZ(v), p.getX(v)); const w = 1 + 0.18 * Math.sin(a * 5 + i + k); p.setX(v, p.getX(v) * w); p.setZ(v, p.getZ(v) * w); p.setY(v, p.getY(v) - 0.12 * Math.abs(Math.sin(a * 5 + i))); }
        g.computeVertexNormals();
        needles.geo(g, mtx(0, y + 0.55 * s, 0, 0, i * 0.7, 0));
      }
    } else if (species === 2) {
      const bark = L('m', 0xe8e4da, PAT.NONE), dark = L('m', 0x2b2b2b), leaf = L('m', [0x8ab04a, 0x9cc05a, 0x7aa040, 0xb0c860][k], PAT.GRASS);
      for (const [dx, lean] of [[0, 0.05], [0.25, -0.12]]) {
        bark.geo(lathe('birch', [[0.09, 0], [0.07, 1.5], [0.035, 3.4]], 8), mtx(dx * s, 0, 0, 0, 0, lean, s, s, s));
        for (let i = 0; i < 6; i++) dark.put(SHAPES.box, dx * s + Math.sin(lean) * -i * 0.5 * s, (0.4 + i * 0.5) * s, 0.07 * s, 0.06 * s, 0.02 * s, 0.02, 0, 0, lean);
      }
      for (let i = 0; i < 6; i++) leaf.geo(foliage(seed + i * 0.2), mtx((Math.sin(i * 2.3) * 0.5 + 0.1) * s, (2.6 + (i % 3) * 0.45) * s, Math.cos(i * 2.3) * 0.5 * s, 0, i, 0, 0.5 * s, 0.7 * s, 0.5 * s));
    } else if (species === 3) {
      const bark = L('m', 0x8a6a4a, PAT.TIMBER), frond = L('m', [0x3f7a2e, 0x4a8a34, 0x5a9a3a, 0x357028][k]), coco = L('m', 0x5a3a24);
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([Math.sin(t * 1.2 + k) * 0.6 * t * s, t * 4.6 * s, 0]); }
      bark.geo(tube(`palm:${k}:${f2(s)}`, pts, 0.12 * s, 16, 8), mtx());
      for (let i = 1; i < 8; i++) bark.put(SHAPES.torus, pts[i][0], pts[i][1], 0, 0.13 * s, 0.13 * s, 0.5, Math.PI / 2);
      const [tx, ty] = pts[8];
      for (let f = 0; f < 9; f++) {
        const a = (f / 9) * Math.PI * 2;
        const fp = []; for (let i = 0; i <= 5; i++) { const t = i / 5; fp.push([tx + Math.cos(a) * t * 1.8 * s, ty + (0.4 * t - 1.1 * t * t) * s, Math.sin(a) * t * 1.8 * s]); }
        frond.geo(tube(`frond:${k}:${f}:${f2(s)}`, fp, 0.1 * s, 10, 3), mtx(0, 0, 0, 0, 0, 0, 1, 0.35, 1).multiply(new THREE.Matrix4().makeTranslation(0, ty * 1.86, 0)));
      }
      for (let i = 0; i < 4; i++) coco.put(SHAPES.sphere, tx + Math.cos(i * 1.6) * 0.14 * s, ty - 0.12 * s, Math.sin(i * 1.6) * 0.14 * s, 0.09 * s, 0.1 * s, 0.09 * s);
    } else {
      const bark = L('m', 0x4a3424, PAT.TIMBER);
      const cols = species === 4 ? [0xb8321e, 0xd4541e, 0x9a2a1a, 0xe07a2e] : [0xf2b8c8, 0xf8d0dc, 0xe8a0b8, 0xffffff];
      bark.geo(lathe(`mtrunk`, [[0.14, 0], [0.1, 1.0], [0.06, 1.8]], 8), mtx(0, 0, 0, 0, 0, 0, s, s, s));
      for (let b = 0; b < 4; b++) { const a = b * 1.7 + k; bark.put(SHAPES.cyl8, Math.cos(a) * 0.35 * s, 1.75 * s, Math.sin(a) * 0.35 * s, 0.04 * s, 1.0 * s, 0.04 * s, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
      const blobs = [[0, 2.5, 0, 1.0], [0.7, 2.2, 0.3, 0.7], [-0.6, 2.3, -0.3, 0.75], [0.2, 2.9, -0.4, 0.6], [-0.3, 2.1, 0.6, 0.6]];
      blobs.forEach(([x, y, z, sc], i) => L('m', cols[(i + k) % 4], PAT.GRASS).geo(foliage(seed + i * 0.3), mtx(x * s, y * s, z * s, 0, i, 0, sc * s, sc * 0.75 * s, sc * s)));
    }
  });
}

// ---------- vehicles ----------
export function vanParts() {
  const paint = part('van-paint', (L) => {
    const p = L('t', 'paint');
    p.geo(rbox(4.8, 1.9, 1.95, 0.18), mtx(0, 1.35, 0));
    p.geo(rbox(0.9, 0.8, 1.9, 0.25), mtx(2.3, 0.85, 0));
  });
  const rest = part('van-rest', (L) => {
    const glass = L('m', 0x1e2a36), tire = L('m', 0x151515), rim = L('t', 0xc0c6cc), light = L('l', 0xfff3c0), tail = L('l', 0xff3b30), trim = L('t', 0x2b2b2b);
    glass.put(SHAPES.box, 2.25, 1.75, 0, 0.45, 0.75, 1.8, 0, 0, 0.35);
    for (const z of [-0.985, 0.985]) glass.bx(0.6, 1.5, z - 0.01, 2.0, 2.05, z + 0.01);
    for (const x of [1.6, -1.6]) for (const z of [-0.85, 0.85]) { tire.put(SHAPES.cyl, x, 0.36, z, 0.36, 0.26, 0.36, Math.PI / 2); rim.put(SHAPES.cyl, x, 0.36, z + Math.sign(z) * 0.08, 0.22, 0.12, 0.22, Math.PI / 2); }
    for (const z of [-0.7, 0.7]) { light.bv(2.72, 0.8, z - 0.18, 2.78, 0.95, z + 0.18, 0.01); tail.bv(-2.43, 0.9, z - 0.1, -2.38, 1.3, z + 0.1, 0.01); }
    trim.bv(2.6, 0.35, -0.9, 2.82, 0.5, 0.9, 0.02);
    trim.bx(-0.5, 0.6, -0.99, -0.46, 2.1, -0.97);
  });
  return { paint, rest };
}

export function truckParts() {
  const paint = part('truck-paint', (L) => {
    const p = L('t', 'paint');
    p.geo(rbox(1.9, 2.0, 2.2, 0.2), mtx(2.6, 1.5, 0));
  });
  const rest = part('truck-rest', (L) => {
    const box = L('m', 0xf4f1ea, PAT.PANEL), glass = L('m', 0x1e2a36), tire = L('m', 0x151515), rim = L('t', 0xc0c6cc), light = L('l', 0xfff3c0), frame = L('t', 0x2b2b2b), stripe = L('m', 0xc0392b);
    box.geo(rbox(4.4, 2.7, 2.4, 0.06), mtx(-0.7, 1.95, 0));
    stripe.bx(-2.9, 1.4, -1.21, 1.5, 1.6, 1.21);
    glass.put(SHAPES.box, 3.56, 1.95, 0, 0.05, 0.8, 1.9, 0, 0, 0.2);
    frame.bx(-3.0, 0.4, -0.9, 3.5, 0.6, 0.9);
    for (const x of [2.8, -1.6, -2.5]) for (const z of [-0.95, 0.95]) { tire.put(SHAPES.cyl, x, 0.45, z, 0.45, 0.3, 0.45, Math.PI / 2); rim.put(SHAPES.cyl, x, 0.45, z + Math.sign(z) * 0.1, 0.25, 0.12, 0.25, Math.PI / 2); }
    for (const z of [-0.8, 0.8]) light.bv(3.55, 0.9, z - 0.15, 3.6, 1.1, z + 0.15, 0.01);
    frame.bv(3.45, 0.5, -1.05, 3.7, 0.75, 1.05, 0.02);
  });
  return { paint, rest };
}

// ---------- street furniture ----------
export function trafficLightPart() {
  return part('traffic', (L) => {
    const pole = L('t', 0x2b2e33), box = L('m', 0x1a1a1a), red = L('l', 0xff3b30), amb = L('l', 0x553a10), grn = L('l', 0x0f3a1a);
    pole.geo(lathe('tl-pole', [[0.12, 0], [0.09, 0.2], [0.07, 4.8], [0.001, 4.85]], 12), mtx());
    pole.geo(tube('tl-arm', [[0, 4.5, 0], [0, 4.8, 1.5], [0, 4.85, 3.6]], 0.05, 12, 6), mtx());
    box.geo(rbox(0.36, 1.05, 0.3, 0.05), mtx(0, 4.2, 3.4));
    for (const [y, l] of [[4.52, red], [4.2, amb], [3.88, grn]]) { l.put(SHAPES.cyl, 0, y, 3.56, 0.11, 0.03, 0.11, Math.PI / 2); box.put(SHAPES.cyl, 0, y + 0.08, 3.62, 0.14, 0.12, 0.14, Math.PI / 2 + 0.4, 0, 0); }
    box.geo(rbox(0.3, 0.6, 0.22, 0.04), mtx(0, 2.6, 0.15));
    L('l', 0xffffff).bx(-0.1, 2.5, 0.27, 0.1, 2.75, 0.28);
  });
}

export function bikeRackPart() {
  return part('bikerack', (L) => {
    const s = L('t', 0x9aa1a6);
    for (let i = 0; i < 4; i++) s.geo(tube('bikeloop', [[0, 0, -0.3], [0, 0.75, -0.25], [0, 0.85, 0], [0, 0.75, 0.25], [0, 0, 0.3]], 0.025, 16, 6), mtx(-0.75 + i * 0.5, 0, 0));
  });
}

export function newsstandPart() {
  return part('newsstand', (L) => {
    const g = L('t', 0x2f5d50, PAT.PANEL), glass = L('glass', 0xcfe6ee), paper = L('m', 0xf4f1ea), mag = [0xe63946, 0x2a9d8f, 0xf4a261, 0x3a6ea5];
    g.geo(rbox(2.2, 2.4, 1.3, 0.05), mtx(0, 1.2, 0));
    g.bv(-1.3, 2.4, -0.8, 1.3, 2.55, 1.0, 0.03);
    glass.bx(-1.0, 1.0, 0.66, 1.0, 2.1, 0.68);
    for (let i = 0; i < 8; i++) L('m', mag[i % 4]).bx(-0.95 + i * 0.24, 1.2 + (i % 2) * 0.4, 0.62, -0.77 + i * 0.24, 1.5 + (i % 2) * 0.4, 0.64);
    paper.bv(-0.9, 0.8, 0.66, 0.9, 0.95, 0.95, 0.01);
    L('l', 0xffd166).bx(-0.8, 2.25, 0.66, 0.8, 2.38, 0.67);
  });
}

export function mailboxPart() {
  return part('mailbox', (L) => {
    const b = L('t', 0x2f4a8a), w = L('m', 0xffffff);
    b.bx(-0.03, 0, -0.03, 0.03, 0.4, 0.03);
    b.geo(extrudeShape('mailbox', () => { const s = new THREE.Shape(); s.moveTo(-0.25, 0); s.lineTo(0.25, 0); s.lineTo(0.25, 0.7); s.absarc(0, 0.7, 0.25, 0, Math.PI, false); s.lineTo(-0.25, 0); return s; }, 0.45), mtx(0, 0.35, 0, 0, Math.PI / 2, 0));
    w.bx(0.226, 0.7, -0.12, 0.23, 0.8, 0.12);
  });
}

export function parkingMeterPart() {
  return part('meter', (L) => {
    const p = L('t', 0x6d7278), h = L('t', 0x9aa1a6), s = L('l', 0x7fff9f);
    p.geo(lathe('meterpole', [[0.05, 0], [0.04, 1.0]], 8), mtx());
    h.geo(rbox(0.22, 0.34, 0.16, 0.05), mtx(0, 1.17, 0));
    s.bx(-0.07, 1.2, 0.081, 0.07, 1.28, 0.083);
  });
}

export function busStopSignPart() {
  return part('busstop', (L) => {
    L('t', 0x9aa1a6).geo(lathe('bspole', [[0.05, 0], [0.04, 2.8]], 8), mtx());
    L('l', 0x2a9d8f).geo(rbox(0.5, 0.5, 0.04, 0.05), mtx(0, 2.6, 0.05));
    L('m', 0xffffff).bx(-0.15, 2.5, 0.075, 0.15, 2.7, 0.08);
    L('m', 0x1a1a1a).bx(-0.2, 1.6, 0.03, 0.2, 2.2, 0.06);
  });
}

export function planterBoxPart(seed = 0) {
  return part(`planterbox:${Math.floor(seed * 4)}`, (L) => {
    L('m', 0x8a8580, PAT.CONCRETE).bv(-0.9, 0, -0.45, 0.9, 0.6, 0.45, 0.04);
    L('m', 0x3b2a1e).bx(-0.82, 0.55, -0.37, 0.82, 0.58, 0.37);
    for (let i = 0; i < 4; i++) L('m', GREENS[(i + Math.floor(seed * 6)) % 6], PAT.GRASS).geo(foliage(seed + i * 0.2), mtx(-0.6 + i * 0.4, 0.8, 0, 0, i, 0, 0.26, 0.28, 0.26));
    for (let i = 0; i < 5; i++) L('m', [0xe63946, 0xf4a261, 0xffffff, 0xc77dff][i % 4]).put(SHAPES.ico, -0.7 + i * 0.35, 0.95, 0.25 - (i % 2) * 0.4, 0.05, 0.05, 0.05);
  });
}

// ---------- animals ----------
export function dogPart(seed = 0) {
  const k = Math.floor(seed * 4) % 4;
  return part(`dog:${k}`, (L) => {
    const fur = L('m', [0x8a5a34, 0x2b2b2b, 0xe8dcc0, 0xc08040][k]), dark = L('m', 0x1a1a1a);
    fur.geo(rbox(0.6, 0.28, 0.24, 0.1), mtx(0, 0.5, 0));
    fur.geo(rbox(0.26, 0.22, 0.2, 0.08), mtx(0.38, 0.72, 0, 0, 0, 0.3));
    fur.geo(rbox(0.14, 0.1, 0.12, 0.04), mtx(0.52, 0.66, 0));
    dark.put(SHAPES.sphere, 0.6, 0.67, 0, 0.03, 0.03, 0.03);
    for (const [x, z] of [[0.22, 0.08], [0.22, -0.08], [-0.22, 0.08], [-0.22, -0.08]]) fur.put(SHAPES.cyl8, x, 0.2, z, 0.04, 0.4, 0.04);
    fur.put(SHAPES.cyl8, -0.38, 0.65, 0, 0.025, 0.3, 0.025, 0, 0, 0.8);
    for (const z of [-0.07, 0.07]) fur.put(SHAPES.cone4, 0.36, 0.88, z, 0.05, 0.12, 0.03);
  });
}

export function duckPart(seed = 0) {
  return part(`duck:${Math.floor(seed * 2)}`, (L) => {
    const body = L('m', seed < 0.5 ? 0x6b5a3a : 0xf4f1ea), head = L('m', seed < 0.5 ? 0x2f6a3a : 0xf4f1ea), beak = L('m', 0xf2a03a);
    body.put(SHAPES.sphere, 0, 0.08, 0, 0.16, 0.09, 0.1);
    head.put(SHAPES.sphere, 0.13, 0.19, 0, 0.06, 0.06, 0.06);
    beak.put(SHAPES.cone4, 0.2, 0.18, 0, 0.025, 0.07, 0.02, 0, 0, -Math.PI / 2);
    body.put(SHAPES.cone4, -0.16, 0.12, 0, 0.04, 0.09, 0.05, 0, 0, Math.PI / 2 + 0.4);
  });
}
