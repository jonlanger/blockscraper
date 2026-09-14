// Interior furniture and equipment parts. Origin at floor, centered; +z = front.
// Recolorable slots: 'wood', 'fabric', 'fabric2', 'metal', 'counter', 'accent'.
import * as THREE from 'three';
import { extrudeShape, extrudeProfile, lathe, tube, foliage, SHAPES, PAT } from './geo.js';
import { part, mtx } from './kit.js';
import { rbox } from './props.js';

const f2 = (n) => (+n).toFixed(2);
const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const BOOKS = [0x8c2f2f, 0x2f4a7a, 0x3b7a5e, 0xb07a2a, 0x5e3b7a, 0x2b2b2b, 0xd8cfae, 0x6b3a2a];

// ---------- office ----------
export function deskPart(w = 1.3, d = 0.7) {
  return part(`desk:${f2(w)}:${f2(d)}`, (L) => {
    const top = L('m', 'wood', PAT.WOOD), leg = L('t', 0x3a3d40), panel = L('m', 0x8a9aa8);
    top.bv(-w / 2, 0.72, -d / 2, w / 2, 0.76, d / 2, 0.012);
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) {
      leg.bx(x - 0.025, 0, -d / 2 + 0.05, x + 0.025, 0.72, -d / 2 + 0.1);
      leg.bx(x - 0.025, 0, d / 2 - 0.1, x + 0.025, 0.72, d / 2 - 0.05);
      leg.bx(x - 0.025, 0.02, -d / 2 + 0.05, x + 0.025, 0.06, d / 2 - 0.05);
    }
    panel.bx(-w / 2 + 0.08, 0.3, -d / 2 + 0.06, w / 2 - 0.08, 0.7, -d / 2 + 0.08);
    panel.bv(-w / 2, 0.76, -d / 2 - 0.02, w / 2, 1.2, -d / 2 + 0.02, 0.01, 0.9);
  });
}

export function monitorPart() {
  return part('monitor', (L) => {
    const dark = L('m', 0x1d1f24), screen = L('l', 0x9cc4ff), kb = L('m', 0x2b2b2b), paper = L('m', 0xf4f1ea), mug = L('m', 0xe8e2d4);
    dark.geo(lathe('mon-base', [[0.11, 0], [0.1, 0.015], [0.001, 0.02]], 16), mtx(0, 0.76, -0.12));
    dark.bx(-0.02, 0.76, -0.14, 0.02, 1.0, -0.11);
    dark.bv(-0.3, 0.92, -0.12, 0.3, 1.26, -0.09, 0.008);
    screen.bx(-0.28, 0.94, -0.089, 0.28, 1.24, -0.087);
    kb.bv(-0.22, 0.76, 0.02, 0.22, 0.78, 0.16, 0.005);
    for (let r = 0; r < 4; r++) kb.bx(-0.2, 0.781, 0.035 + r * 0.03, 0.2, 0.785, 0.055 + r * 0.03, 1.6);
    kb.put(SHAPES.sphere, 0.3, 0.775, 0.1, 0.03, 0.015, 0.045);
    paper.bx(-0.55, 0.76, -0.05, -0.35, 0.775, 0.22);
    mug.geo(lathe('mug', [[0.035, 0], [0.04, 0.09], [0.035, 0.09], [0.03, 0.01]], 12), mtx(0.45, 0.76, -0.1));
  });
}

export function officeChairPart() {
  return part('ochair', (L) => {
    const base = L('t', 0x2b2b2b), fab = L('m', 'fabric', PAT.CARPET);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      base.put(SHAPES.box, Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15, 0.3, 0.035, 0.05, 0, -a, 0);
      base.put(SHAPES.sphere, Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29, 0.03, 0.03, 0.03);
    }
    base.put(SHAPES.cyl, 0, 0.26, 0, 0.025, 0.36, 0.025);
    fab.geo(rbox(0.48, 0.09, 0.46, 0.04), mtx(0, 0.48, 0));
    fab.geo(rbox(0.44, 0.55, 0.07, 0.04), mtx(0, 0.82, 0.24, -0.12, 0, 0));
    base.bx(-0.015, 0.45, 0.2, 0.015, 0.62, 0.24);
    for (const x of [-0.26, 0.26]) { base.bx(x - 0.015, 0.5, -0.05, x + 0.015, 0.66, -0.02); fab.geo(rbox(0.06, 0.03, 0.26, 0.012), mtx(x, 0.67, -0.02)); }
  });
}

export function bookshelfPart(w = 1.0, h = 1.8, d = 0.35, seed = 0) {
  return part(`shelf:${f2(w)}:${f2(h)}:${f2(d)}:${Math.floor(seed * 4)}`, (L) => {
    const wood = L('m', 'wood', PAT.WOOD);
    wood.bv(-w / 2, 0, -d / 2, -w / 2 + 0.03, h, d / 2, 0.006);
    wood.bv(w / 2 - 0.03, 0, -d / 2, w / 2, h, d / 2, 0.006);
    wood.bx(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.015, 0.8);
    const n = Math.max(2, Math.round(h / 0.38));
    let s = Math.floor(seed * 1000) + 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i <= n; i++) {
      const y = (i * (h - 0.03)) / n;
      wood.bx(-w / 2 + 0.03, y, -d / 2, w / 2 - 0.03, y + 0.03, d / 2);
      if (i === n) break;
      let x = -w / 2 + 0.05;
      while (x < w / 2 - 0.08) {
        const bw = 0.025 + r() * 0.035, bh = 0.18 + r() * 0.12;
        if (r() < 0.1) { x += 0.06; continue; }
        L('m', BOOKS[Math.floor(r() * BOOKS.length)]).bv(x, y + 0.03, -d / 2 + 0.04, x + bw, y + 0.03 + bh, d / 2 - 0.03, 0.004);
        x += bw + 0.004;
      }
    }
  });
}

export function whiteboardPart(w = 1.4) {
  return part(`wb:${f2(w)}`, (L) => {
    const f = L('t', 0xb8bec4), b = L('m', 0xf8f8f8), ink = [0x2f6fd0, 0xc0392b, 0x2b2b2b];
    f.bv(-w / 2, 0, 0, w / 2, 0.95, 0.03, 0.01);
    b.bx(-w / 2 + 0.03, 0.03, 0.03, w / 2 - 0.03, 0.92, 0.035);
    ink.forEach((c, i) => L('m', c).bx(-w / 2 + 0.15, 0.7 - i * 0.18, 0.036, -w / 2 + 0.15 + (0.5 + i * 0.2), 0.715 - i * 0.18, 0.038));
    f.bx(-w / 2 + 0.1, -0.02, 0.0, w / 2 - 0.1, 0.0, 0.08);
  });
}

// ---------- living ----------
export function sofaPart(w = 1.9) {
  return part(`sofa:${f2(w)}`, (L) => {
    const f = L('m', 'fabric', PAT.CARPET), f2_ = L('m', 'fabric2', PAT.CARPET), leg = L('m', 0x3a2418);
    f.geo(rbox(w, 0.28, 0.85, 0.06), mtx(0, 0.26, 0));
    f.geo(rbox(w, 0.55, 0.22, 0.08), mtx(0, 0.62, -0.32));
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) f.geo(rbox(0.2, 0.55, 0.85, 0.08), mtx(x, 0.48, 0));
    const n = w > 1.6 ? 3 : 2, cw = (w - 0.2) / n;
    for (let i = 0; i < n; i++) {
      f.geo(rbox(cw - 0.02, 0.14, 0.62, 0.05), mtx(-w / 2 + 0.2 + cw * (i + 0.5) - 0.1 * (n === 2 ? 0 : 0), 0.46, 0.08));
      f.geo(rbox(cw - 0.04, 0.42, 0.16, 0.07), mtx(-w / 2 + 0.2 + cw * (i + 0.5) - 0.1 * 0, 0.72, -0.18, -0.15, 0, 0));
    }
    f2_.geo(rbox(0.36, 0.34, 0.12, 0.06), mtx(-w / 2 + 0.42, 0.72, -0.05, -0.3, 0.3, 0));
    for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) for (const z of [-0.35, 0.35]) leg.geo(lathe('sofaleg', [[0.03, 0], [0.025, 0.12], [0.001, 0.12]], 8), mtx(x, 0, z));
  });
}

export function armchairPart() {
  return part('armchair', (L) => {
    const f = L('m', 'fabric2', PAT.CARPET), leg = L('m', 0x3a2418);
    f.geo(rbox(0.8, 0.28, 0.8, 0.07), mtx(0, 0.28, 0));
    f.geo(rbox(0.8, 0.6, 0.18, 0.08), mtx(0, 0.68, -0.31, -0.12, 0, 0));
    for (const x of [-0.33, 0.33]) f.geo(rbox(0.14, 0.4, 0.78, 0.06), mtx(x, 0.5, 0));
    f.geo(rbox(0.5, 0.12, 0.55, 0.05), mtx(0, 0.47, 0.08));
    for (const x of [-0.33, 0.33]) for (const z of [-0.33, 0.33]) leg.put(SHAPES.cyl, x, 0.07, z, 0.025, 0.14, 0.025);
  });
}

export function coffeeTablePart(w = 1.0, d = 0.55) {
  return part(`ctable:${f2(w)}:${f2(d)}`, (L) => {
    const top = L('m', 'wood', PAT.WOOD), m = L('t', 0x2b2b2b), deco = L('m', 0xe8e2d4);
    top.bv(-w / 2, 0.36, -d / 2, w / 2, 0.4, d / 2, 0.015);
    top.bx(-w / 2 + 0.05, 0.12, -d / 2 + 0.05, w / 2 - 0.05, 0.14, d / 2 - 0.05);
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) m.bx(x - 0.02, 0, z - 0.02, x + 0.02, 0.36, z + 0.02);
    deco.geo(lathe('vase', [[0.05, 0], [0.08, 0.08], [0.04, 0.2], [0.05, 0.24], [0.04, 0.24]], 12), mtx(0.2, 0.4, 0));
    L('m', 0x8c2f2f).bv(-0.3, 0.4, -0.12, -0.05, 0.44, 0.08, 0.005);
  });
}

export function rugPart(w, d) {
  return part(`rug:${f2(w)}:${f2(d)}`, (L) => {
    L('m', 'fabric2', PAT.CARPET).bv(-w / 2, 0, -d / 2, w / 2, 0.02, d / 2, 0.008);
    L('m', 'accent', PAT.CARPET).bx(-w / 2 + 0.12, 0.021, -d / 2 + 0.12, w / 2 - 0.12, 0.023, d / 2 - 0.12);
    L('m', 'fabric2', PAT.CARPET).bx(-w / 2 + 0.2, 0.024, -d / 2 + 0.2, w / 2 - 0.2, 0.025, d / 2 - 0.2);
  });
}

export function bedPart(w = 1.5) {
  return part(`bed:${f2(w)}`, (L) => {
    const wood = L('m', 'wood', PAT.WOOD), sheet = L('m', 0xf3efe8), duvet = L('m', 'fabric', PAT.CARPET), head = L('m', 'fabric2', PAT.CARPET);
    wood.bv(-w / 2 - 0.04, 0.12, -1.02, w / 2 + 0.04, 0.32, 1.02, 0.02);
    for (const x of [-w / 2, w / 2]) for (const z of [-0.98, 0.98]) wood.bx(x - 0.03, 0, z - 0.03, x + 0.03, 0.14, z + 0.03);
    wood.bv(-w / 2 - 0.08, 0, -1.1, w / 2 + 0.08, 1.15, -1.0, 0.02);
    const cols = Math.round(w / 0.35);
    for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) head.geo(rbox(w / cols - 0.03, 0.26, 0.06, 0.03), mtx(-w / 2 + (i + 0.5) * (w / cols), 0.62 + j * 0.28, -0.97));
    sheet.geo(rbox(w, 0.22, 1.95, 0.08), mtx(0, 0.43, 0));
    duvet.geo(rbox(w + 0.08, 0.1, 1.3, 0.05), mtx(0, 0.52, 0.34));
    duvet.geo(rbox(w + 0.06, 0.06, 0.3, 0.03), mtx(0, 0.58, -0.25), 1.1);
    for (const x of [-w / 4, w / 4]) sheet.geo(rbox(w / 2 - 0.1, 0.14, 0.38, 0.07), mtx(x, 0.62, -0.72, -0.35, 0, 0));
  });
}

export function nightstandPart(lamp = true) {
  return part(`nstand:${lamp}`, (L) => {
    const wood = L('m', 'wood', PAT.WOOD), brass = L('t', 0xc9a14a), shade = L('l', 0xffe2a8);
    wood.bv(-0.24, 0, -0.2, 0.24, 0.55, 0.2, 0.012);
    for (const y of [0.12, 0.34]) { wood.bx(-0.21, y, 0.2, 0.21, y + 0.18, 0.21, 1.08); brass.put(SHAPES.sphere, 0, y + 0.09, 0.225, 0.018, 0.018, 0.018); }
    if (lamp) {
      brass.geo(lathe('nlamp', [[0.07, 0], [0.07, 0.02], [0.015, 0.04], [0.015, 0.3], [0.001, 0.3]], 14), mtx(0.05, 0.55, -0.05));
      shade.geo(lathe('nshade', [[0.13, 0], [0.08, 0.18], [0.075, 0.18], [0.125, 0.0]], 16), mtx(0.05, 0.78, -0.05));
    }
  });
}

export function wardrobePart(w = 1.0) {
  return part(`ward:${f2(w)}`, (L) => {
    const wood = L('m', 'wood', PAT.WOOD), brass = L('t', 0xc9a14a);
    wood.bv(-w / 2, 0, -0.3, w / 2, 2.0, 0.3, 0.015);
    wood.bv(-w / 2 - 0.03, 1.98, -0.33, w / 2 + 0.03, 2.08, 0.33, 0.015);
    for (const s of [-1, 1]) {
      wood.bv(s < 0 ? -w / 2 + 0.03 : 0.01, 0.1, 0.3, s < 0 ? -0.01 : w / 2 - 0.03, 1.92, 0.33, 0.01, 1.08);
      brass.bx(s * 0.05 - 0.01, 0.9, 0.33, s * 0.05 + 0.01, 1.15, 0.36);
    }
  });
}

export function kitchenPart(len = 2.4) {
  return part(`kitchen:${f2(len)}`, (L) => {
    const cab = L('m', 'wood', PAT.WOOD), top = L('m', 'counter', PAT.MARBLE), steel = L('t', 0xc0c6cc), dark = L('m', 0x1a1a1a), glow = L('l', 0xfff4dc);
    cab.bv(-len / 2, 0.1, -0.3, len / 2, 0.88, 0.3, 0.01);
    L('m', 0x1a1a1a).bx(-len / 2 + 0.03, 0, -0.26, len / 2 - 0.03, 0.1, 0.26);
    top.bv(-len / 2 - 0.02, 0.88, -0.32, len / 2 + 0.02, 0.92, 0.33, 0.008);
    const n = Math.round(len / 0.6);
    for (let i = 0; i < n; i++) {
      const x0 = -len / 2 + (i * len) / n + 0.02, x1 = -len / 2 + ((i + 1) * len) / n - 0.02;
      cab.bv(x0, 0.14, 0.3, x1, 0.84, 0.32, 0.01, 1.07);
      steel.bx((x0 + x1) / 2 - 0.08, 0.76, 0.33, (x0 + x1) / 2 + 0.08, 0.78, 0.35);
      cab.bv(x0, 1.45, -0.3, x1, 2.15, 0.02, 0.01, 1.05);
      steel.bx((x0 + x1) / 2 - 0.01, 1.52, 0.03, (x0 + x1) / 2 + 0.01, 1.66, 0.05);
    }
    dark.bx(-len / 2 + 0.3, 0.86, -0.2, -len / 2 + 0.85, 0.921, 0.2);
    steel.geo(tube('faucet', [[0, 0, 0], [0, 0.28, 0], [0.04, 0.34, 0], [0.16, 0.3, 0]], 0.015, 12, 6), mtx(-len / 2 + 0.58, 0.92, -0.26, 0, -Math.PI / 2, 0));
    dark.bx(len / 2 - 0.85, 0.921, -0.22, len / 2 - 0.25, 0.93, 0.22);
    for (const [x, z] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]]) steel.put(SHAPES.torus, len / 2 - 0.55 + x, 0.935, z, 0.06, 0.06, 0.4, Math.PI / 2);
    steel.geo(lathe('hood', [[0.35, 0], [0.12, 0.3], [0.12, 0.7], [0.001, 0.7]], 4), mtx(len / 2 - 0.55, 1.55, -0.1, 0, Math.PI / 4, 0, 1, 1, 0.8));
    glow.bx(-len / 2 + 0.05, 1.4, -0.1, len / 2 - 0.05, 1.42, 0.0);
  });
}

export function fridgePart() {
  return part('fridge', (L) => {
    const s = L('t', 0xd8dde2, PAT.PANEL), h = L('t', 0x8a9096);
    s.bv(-0.4, 0, -0.35, 0.4, 1.9, 0.35, 0.03);
    s.bx(-0.38, 1.18, 0.35, 0.38, 1.2, 0.36, 0.7);
    for (const [y0, y1] of [[0.7, 1.1], [1.28, 1.6]]) h.bx(0.3, y0, 0.36, 0.33, y1, 0.42);
  });
}

export function tvPart(w = 1.3) {
  return part(`tv:${f2(w)}`, (L) => {
    const cab = L('m', 'wood', PAT.WOOD), dark = L('m', 0x111111), glow = L('l', 0x22334a);
    cab.bv(-w / 2 - 0.2, 0, -0.22, w / 2 + 0.2, 0.48, 0.22, 0.012);
    for (let i = 0; i < 3; i++) cab.bv(-w / 2 - 0.17 + i * ((w + 0.34) / 3), 0.05, 0.22, -w / 2 - 0.2 + (i + 1) * ((w + 0.34) / 3) - 0.01, 0.43, 0.24, 0.008, 1.08);
    dark.bv(-w / 2, 0.62, -0.05, w / 2, 0.62 + w * 0.56, -0.01, 0.006);
    glow.bx(-w / 2 + 0.02, 0.64, -0.009, w / 2 - 0.02, 0.6 + w * 0.56, -0.008);
    dark.bx(-0.05, 0.48, -0.04, 0.05, 0.64, -0.02);
  });
}

export function floorLampPart() {
  return part('flamp', (L) => {
    const m = L('t', 0x2b2b2b), shade = L('l', 0xffe2a8);
    m.geo(lathe('flbase', [[0.16, 0], [0.16, 0.02], [0.02, 0.04], [0.015, 1.5], [0.001, 1.5]], 16), mtx());
    shade.geo(lathe('flshade', [[0.24, 0], [0.16, 0.3], [0.15, 0.3], [0.23, 0.0]], 18), mtx(0, 1.4, 0));
  });
}

export function diningSetPart(round = true) {
  return part(`dining:${round}`, (L) => {
    const wood = L('m', 'wood', PAT.WOOD), cloth = L('m', 0xf8f6f0), dish = L('m', 0xffffff), glow = L('l', 0xffc870);
    if (round) {
      wood.geo(lathe('dtable', [[0.25, 0], [0.26, 0.03], [0.06, 0.08], [0.05, 0.68], [0.001, 0.7]], 16), mtx());
      cloth.geo(lathe('dcloth', [[0.5, 0.52], [0.52, 0.76], [0.001, 0.77]], 24), mtx());
    } else {
      wood.bv(-0.55, 0.72, -0.4, 0.55, 0.76, 0.4, 0.015);
      for (const x of [-0.5, 0.5]) for (const z of [-0.35, 0.35]) wood.geo(lathe('tleg', [[0.03, 0], [0.025, 0.72], [0.001, 0.72]], 8), mtx(x, 0, z));
    }
    const top = round ? 0.77 : 0.76;
    const seats = round ? [[0, 0.75], [0, -0.75], [0.75, 0], [-0.75, 0]] : [[-0.3, 0.7], [0.3, 0.7], [-0.3, -0.7], [0.3, -0.7]];
    seats.forEach(([x, z]) => {
      const a = Math.atan2(-x, -z);
      const ch = chairPart();
      for (const l of ch.layers) L(l.mat, l.slot).g.addGeometry(l.geo, mtx(x, 0, z, 0, a, 0).clone(), 0xffffff);
      dish.geo(lathe('plate', [[0.001, 0], [0.1, 0.005], [0.12, 0.02], [0.11, 0.02]], 16), mtx(x * 0.45, top, z * 0.45));
    });
    glow.geo(lathe('candle', [[0.015, 0], [0.015, 0.14], [0.001, 0.17]], 8), mtx(0, top, 0));
  });
}

export function chairPart() {
  return part('chair', (L) => {
    const wood = L('m', 'wood', PAT.WOOD), f = L('m', 'fabric', PAT.CARPET);
    for (const x of [-0.19, 0.19]) for (const z of [-0.19, 0.19]) wood.geo(lathe('cleg', [[0.022, 0], [0.018, 0.44], [0.001, 0.44]], 8), mtx(x, 0, z));
    f.geo(rbox(0.46, 0.06, 0.46, 0.025), mtx(0, 0.47, 0));
    for (const x of [-0.19, 0.19]) wood.bx(x - 0.02, 0.44, 0.17, x + 0.02, 0.95, 0.21);
    wood.geo(rbox(0.44, 0.14, 0.03, 0.012), mtx(0, 0.88, 0.2, 0.08, 0, 0));
    for (const x of [-0.08, 0, 0.08]) wood.bx(x - 0.012, 0.5, 0.185, x + 0.012, 0.82, 0.205);
  });
}

export function stoolPart() {
  return part('stool', (L) => {
    const m = L('t', 0x2b2b2b), seat = L('m', 'fabric', PAT.CARPET);
    m.put(SHAPES.cyl, 0, 0.38, 0, 0.03, 0.7, 0.03);
    m.geo(lathe('stbase', [[0.2, 0], [0.19, 0.02], [0.03, 0.04], [0.001, 0.04]], 16), mtx());
    m.put(SHAPES.torus, 0, 0.3, 0, 0.14, 0.14, 0.5, Math.PI / 2);
    seat.geo(lathe('stseat', [[0.19, 0], [0.2, 0.05], [0.17, 0.09], [0.001, 0.1]], 16), mtx(0, 0.72, 0));
  });
}

export function pianoPart() {
  return part('piano', (L) => {
    const black = L('t', 0x0d0d0f), white = L('m', 0xf4f1ea), brass = L('t', 0xc9a14a);
    const body = shape([[-0.75, 0], [0.75, 0], [0.75, 0.9], [0.55, 1.4], [0.1, 1.75], [-0.4, 1.8], [-0.75, 1.55]]);
    black.geo(extrudeShape('piano-body', () => body, 0.3), mtx(0, 0.78, 0, -Math.PI / 2, 0, 0));
    black.geo(extrudeShape('piano-lid', () => body, 0.02), mtx(0.2, 1.25, -0.8, -Math.PI / 2 + 0.6, 0, 0.4));
    for (const [x, z] of [[-0.65, 0.05], [0.65, 0.05], [-0.1, -1.6]]) black.geo(lathe('pleg', [[0.06, 0], [0.05, 0.62], [0.07, 0.64]], 10), mtx(x, 0, z));
    black.bx(-0.75, 0.62, 0.0, 0.75, 0.8, 0.28);
    white.bx(-0.7, 0.8, 0.02, 0.7, 0.83, 0.2);
    for (let i = 0; i < 36; i++) if (i % 7 !== 2 && i % 7 !== 6) black.bx(-0.68 + i * 0.039, 0.83, 0.02, -0.66 + i * 0.039, 0.85, 0.12);
    brass.geo(lathe('pedals', [[0.02, 0], [0.02, 0.05]], 8), mtx(0, 0.05, 0.05));
    black.bv(-0.4, 0, 0.55, 0.4, 0.5, 0.9, 0.02);
  });
}

// ---------- hospitality & dining ----------
export function barCounterPart(len = 3.4) {
  return part(`bar:${f2(len)}`, (L) => {
    const wood = L('m', 'wood', PAT.WOOD), top = L('t', 'accent'), brass = L('t', 0xc9a14a), neon = L('l', 'neon');
    wood.bv(-len / 2, 0, -0.3, len / 2, 1.05, 0.3, 0.015);
    const n = Math.round(len / 0.5);
    for (let i = 0; i < n; i++) wood.bv(-len / 2 + (i * len) / n + 0.04, 0.12, 0.3, -len / 2 + ((i + 1) * len) / n - 0.04, 0.95, 0.33, 0.01, 1.1);
    top.geo(extrudeProfile('bartop', [[-0.35, 0], [0.38, 0], [0.42, 0.03], [0.4, 0.07], [-0.35, 0.07]], len + 0.1), mtx(0, 1.05, 0));
    brass.put(SHAPES.cyl, 0, 0.2, 0.45, 0.025, len, 0.025, 0, 0, Math.PI / 2);
    for (let x = -len / 2 + 0.3; x < len / 2; x += 0.9) brass.bx(x - 0.01, 0.12, 0.33, x + 0.01, 0.22, 0.46);
    neon.bx(-len / 2, 0.02, 0.32, len / 2, 0.05, 0.34);
  });
}

export function backBarPart(len = 3.4, seed = 0) {
  return part(`backbar:${f2(len)}:${Math.floor(seed * 3)}`, (L) => {
    const wood = L('m', 'wood', PAT.WOOD), mirror = L('t', 0xcfd6dc), glow = L('l', 'neon');
    wood.bv(-len / 2, 0, -0.2, len / 2, 0.9, 0.2, 0.01);
    mirror.bx(-len / 2 + 0.1, 1.0, -0.2, len / 2 - 0.1, 2.3, -0.18);
    for (const y of [1.2, 1.7]) {
      wood.bx(-len / 2 + 0.05, y, -0.2, len / 2 - 0.05, y + 0.03, 0.05);
      glow.bx(-len / 2 + 0.05, y - 0.02, -0.19, len / 2 - 0.05, y, 0.04);
      for (let x = -len / 2 + 0.15; x < len / 2 - 0.1; x += 0.13) {
        const c = [0x3b7a5e, 0x8c3b3b, 0xd4af37, 0xcfe6ee, 0x6b3a2a][Math.floor(((x + 7) * 13.7 + y * 3 + seed * 5) % 5)];
        L('glass', c).geo(lathe('bottle', [[0.035, 0], [0.037, 0.2], [0.012, 0.28], [0.012, 0.34], [0.001, 0.34]], 10), mtx(x, y + 0.03, -0.08));
      }
    }
  });
}

export function chandelierPart(r = 0.5) {
  return part(`chand:${f2(r)}`, (L) => {
    const brass = L('t', 0xd4af37), glow = L('l', 0xffe7b0), crystal = L('glass', 0xeaf6ff);
    brass.put(SHAPES.cyl, 0, 0.5, 0, 0.012, 1.0, 0.012);
    brass.geo(lathe(`chb:${f2(r)}`, [[0.001, 0], [0.08, 0.02], [0.1, 0.12], [0.05, 0.25], [0.001, 0.27]], 14), mtx(0, -0.2, 0));
    for (const [rr, y] of [[r, -0.1], [r * 0.6, 0.12]]) {
      brass.put(SHAPES.torus, 0, y, 0, rr, rr, 0.4, Math.PI / 2);
      const n = Math.round(rr * 16);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        glow.geo(lathe('chcandle', [[0.015, 0], [0.015, 0.09], [0.001, 0.13]], 6), mtx(Math.cos(a) * rr, y, Math.sin(a) * rr));
        crystal.put(SHAPES.ico, Math.cos(a + 0.2) * rr, y - 0.1, Math.sin(a + 0.2) * rr, 0.02, 0.05, 0.02);
      }
    }
  });
}

export function receptionDeskPart(w = 2.2) {
  return part(`recep:${f2(w)}`, (L) => {
    const wood = L('m', 'wood', PAT.WOOD), top = L('m', 'counter', PAT.MARBLE), brass = L('t', 0xc9a14a), glow = L('l', 0xffe7b0);
    const arc = (r0, r1) => shape([...Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (0.15 + 0.7 * (i / 12)); return [Math.cos(a) * r1, Math.sin(a) * r1 - r1 * 0.6]; }),
      ...Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (0.85 - 0.7 * (i / 12)); return [Math.cos(a) * r0, Math.sin(a) * r0 - r1 * 0.6]; })]);
    wood.geo(extrudeShape(`recep-body:${f2(w)}`, () => arc(w * 0.55, w * 0.7), 1.0), mtx(0, 0.5, 0, Math.PI / 2, 0, 0));
    top.geo(extrudeShape(`recep-top:${f2(w)}`, () => arc(w * 0.5, w * 0.76), 0.05), mtx(0, 1.05, 0, Math.PI / 2, 0, 0));
    brass.geo(extrudeShape(`recep-band:${f2(w)}`, () => arc(w * 0.69, w * 0.72), 0.05), mtx(0, 0.25, 0, Math.PI / 2, 0, 0));
    glow.geo(extrudeShape(`recep-glow:${f2(w)}`, () => arc(w * 0.7, w * 0.71), 0.02), mtx(0, 0.05, 0, Math.PI / 2, 0, 0));
    L('m', 0x1d1f24).bv(-0.3, 1.1, 0.2, 0.2, 1.45, 0.24, 0.01);
  });
}

export function fountainPart() {
  return part('fountain', (L) => {
    const stone = L('m', 0xd8d2c8, PAT.MARBLE), water = L('glass', 0x5fb8e0), jet = L('l', 0xcfefff);
    stone.geo(lathe('fnt-basin', [[1.25, 0], [1.3, 0.05], [1.3, 0.42], [1.2, 0.45], [1.15, 0.12], [0.001, 0.12]], 32), mtx());
    water.put(SHAPES.cyl, 0, 0.36, 0, 1.16, 0.02, 1.16);
    stone.geo(lathe('fnt-stem', [[0.2, 0], [0.12, 0.2], [0.09, 0.9], [0.5, 1.05], [0.55, 1.12], [0.45, 1.14], [0.1, 1.1], [0.06, 1.5], [0.12, 1.55], [0.001, 1.6]], 20), mtx(0, 0.12, 0));
    water.put(SHAPES.cyl, 0, 1.24, 0, 0.44, 0.02, 0.44);
    jet.geo(lathe('fnt-jet', [[0.03, 0], [0.015, 0.4], [0.001, 0.45]], 8), mtx(0, 1.72, 0));
  });
}

// ---------- fitness & pools ----------
export function treadmillPart() {
  return part('tread', (L) => {
    const d = L('m', 0x222222), m = L('t', 0x8a9096), s = L('l', 0x4cc9f0);
    d.geo(rbox(0.75, 0.2, 1.8, 0.05), mtx(0, 0.14, 0));
    d.bx(-0.28, 0.24, -0.8, 0.28, 0.25, 0.75, 0.6);
    for (const x of [-0.34, 0.34]) m.put(SHAPES.box, x, 0.75, -0.72, 0.05, 1.1, 0.05, 0.25, 0, 0);
    d.geo(rbox(0.7, 0.3, 0.15, 0.04), mtx(0, 1.25, -0.88, -0.6, 0, 0));
    s.bx(-0.2, 1.3, -0.84, 0.2, 1.4, -0.83);
    for (const x of [-0.34, 0.34]) m.put(SHAPES.cyl, x, 1.05, -0.55, 0.02, 0.5, 0.02, Math.PI / 2);
  });
}

export function weightRackPart() {
  return part('wrack', (L) => {
    const m = L('t', 0x3a3d40), plate = L('m', 0x151515), chrome = L('t', 0xd0d4d8);
    for (const x of [-0.7, 0.7]) { m.bx(x - 0.04, 0, -0.3, x + 0.04, 1.6, -0.22); m.bx(x - 0.04, 0, 0.22, x + 0.04, 1.6, 0.3); m.bx(x - 0.04, 0, -0.3, x + 0.04, 0.05, 0.3); }
    chrome.put(SHAPES.cyl, 0, 1.3, 0, 0.018, 1.9, 0.018, 0, 0, Math.PI / 2);
    for (const s of [-1, 1]) for (const [x, r] of [[0.8, 0.22], [0.86, 0.18]]) plate.put(SHAPES.cyl, s * x, 1.3, 0, r, 0.05, r, 0, 0, Math.PI / 2);
    for (let i = 0; i < 5; i++) { chrome.put(SHAPES.cyl, -0.5 + i * 0.25, 0.35, 0.4, 0.015, 0.3, 0.015, 0, 0, Math.PI / 2); for (const s of [-1, 1]) plate.put(SHAPES.cyl8, -0.5 + i * 0.25 + s * 0.12, 0.35, 0.4, 0.05 + i * 0.008, 0.05, 0.05 + i * 0.008, 0, 0, Math.PI / 2); }
    m.bv(-0.8, 0.2, 0.25, 0.8, 0.26, 0.55, 0.01);
  });
}

export function poolPart(w = 3.2, d = 2.4) {
  return part(`pool:${f2(w)}:${f2(d)}`, (L) => {
    const tile = L('m', 0xe8eef0, PAT.TILE), water = L('wd', 0x2ea8d0), deep = L('m', 0x4fb8d8, PAT.TILE), chrome = L('t', 0xd0d4d8), rope = L('m', 0xe63946), rope2 = L('m', 0xffffff);
    tile.bv(-w / 2 - 0.2, 0, -d / 2 - 0.2, w / 2 + 0.2, 0.18, -d / 2, 0.02);
    tile.bv(-w / 2 - 0.2, 0, d / 2, w / 2 + 0.2, 0.18, d / 2 + 0.2, 0.02);
    tile.bv(-w / 2 - 0.2, 0, -d / 2, -w / 2, 0.18, d / 2, 0.02);
    tile.bv(w / 2, 0, -d / 2, w / 2 + 0.2, 0.18, d / 2, 0.02);
    deep.bx(-w / 2, 0.0, -d / 2, w / 2, 0.02, d / 2);
    water.bx(-w / 2, 0.12, -d / 2, w / 2, 0.14, d / 2);
    for (const z of [-d / 6, d / 6]) for (let x = -w / 2; x < w / 2; x += 0.12) (Math.round(x * 8) % 2 ? rope : rope2).put(SHAPES.sphere, x + 0.06, 0.15, z, 0.045, 0.03, 0.045);
    for (const x of [w / 2 - 0.3, w / 2 - 0.55]) chrome.geo(tube(`ladder:${f2(x)}`, [[0, -0.3, 0], [0, 0.4, 0], [0, 0.55, -0.1], [0, 0.45, -0.3]], 0.02, 12, 6), mtx(x, 0, -d / 2 - 0.05, 0, 0, 0));
  });
}

export function loungerPart() {
  return part('lounger', (L) => {
    const f = L('m', 'fabric', PAT.CARPET), m = L('t', 0xd0d4d8);
    f.geo(rbox(0.6, 0.08, 1.3, 0.03), mtx(0, 0.35, 0.15));
    f.geo(rbox(0.6, 0.08, 0.7, 0.03), mtx(0, 0.55, -0.68, 0.55, 0, 0));
    for (const x of [-0.27, 0.27]) for (const z of [-0.5, 0.7]) m.bx(x - 0.015, 0, z - 0.015, x + 0.015, 0.33, z + 0.015);
  });
}

// ---------- civic / culture ----------
export function lockersPart(len = 2.0, h = 1.9) {
  return part(`lockers:${f2(len)}:${f2(h)}`, (L) => {
    const m = L('t', 'metal', PAT.PANEL), d = L('m', 0x2b2b2b);
    m.bv(-len / 2, 0, -0.25, len / 2, h, 0.2, 0.01);
    const n = Math.round(len / 0.4);
    for (let i = 0; i < n; i++) {
      const x0 = -len / 2 + (i * len) / n + 0.015, x1 = x0 + len / n - 0.03;
      for (const [y0, y1] of [[0.1, h / 2 - 0.02], [h / 2 + 0.02, h - 0.06]]) {
        m.bv(x0, y0, 0.2, x1, y1, 0.22, 0.004, 1.06);
        for (let k = 0; k < 4; k++) d.bx(x0 + 0.08, y1 - 0.12 - k * 0.04, 0.221, x1 - 0.08, y1 - 0.105 - k * 0.04, 0.223);
        d.bx(x1 - 0.06, (y0 + y1) / 2 - 0.05, 0.22, x1 - 0.04, (y0 + y1) / 2 + 0.05, 0.25);
      }
    }
  });
}

export function turnstilePart() {
  return part('turnstile', (L) => {
    const s = L('t', 0xb8bec4, PAT.PANEL), dark = L('m', 0x222222), g = L('l', 0x39ff88), r = L('l', 0xff4d4d);
    s.geo(rbox(0.22, 1.0, 1.1, 0.06), mtx(0, 0.5, 0));
    dark.bx(-0.1, 1.0, -0.4, 0.1, 1.01, 0.4);
    g.bx(-0.05, 1.01, 0.25, 0.05, 1.02, 0.35);
    r.bx(-0.05, 1.01, -0.35, 0.05, 1.02, -0.25);
    for (let k = 0; k < 3; k++) s.put(SHAPES.cyl, 0.3, 0.85, 0, 0.02, 0.5, 0.02, (k * Math.PI * 2) / 3 + 0.3, 0, Math.PI / 2);
    s.put(SHAPES.cyl, 0.14, 0.85, 0, 0.06, 0.08, 0.06, 0, 0, Math.PI / 2);
  });
}

export function ticketMachinePart(color = 0x2f7de0) {
  return part(`tmach:${color}`, (L) => {
    const b = L('t', color, PAT.PANEL), dark = L('m', 0x1a1a1a), scr = L('l', 0xd0f0ff), btn = L('l', 0xffd166);
    b.geo(rbox(0.7, 1.7, 0.45, 0.06), mtx(0, 0.85, 0));
    dark.bv(-0.28, 0.9, 0.2, 0.28, 1.45, 0.24, 0.01);
    scr.bx(-0.24, 0.95, 0.241, 0.24, 1.4, 0.243);
    for (let i = 0; i < 6; i++) btn.put(SHAPES.cyl, -0.18 + (i % 3) * 0.18, 0.72 - Math.floor(i / 3) * 0.1, 0.23, 0.03, 0.02, 0.03, Math.PI / 2);
    dark.bx(-0.2, 0.3, 0.22, 0.2, 0.42, 0.26);
  });
}

export function boardPart(w = 1.8, color = 0xffb347) {
  return part(`board:${f2(w)}:${color}`, (L) => {
    const f = L('t', 0x1a1a1a), face = L('l', color), dark = L('m', 0x050505);
    f.bv(-w / 2, 0, -0.08, w / 2, 0.8, 0.02, 0.02);
    dark.bx(-w / 2 + 0.05, 0.05, 0.02, w / 2 - 0.05, 0.75, 0.025);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      if ((r * 7 + c * 3) % 5 === 0) continue;
      face.bx(-w / 2 + 0.1 + c * ((w - 0.2) / 6), 0.62 - r * 0.13, 0.026, -w / 2 + 0.1 + c * ((w - 0.2) / 6) + (w - 0.2) / 6 - 0.04, 0.7 - r * 0.13, 0.03);
    }
    f.put(SHAPES.cyl8, -w / 3, 1.2, -0.03, 0.01, 0.8, 0.01);
    f.put(SHAPES.cyl8, w / 3, 1.2, -0.03, 0.01, 0.8, 0.01);
  });
}

export function clockPart(r = 0.35) {
  return part(`clock:${f2(r)}`, (L) => {
    const rim = L('t', 0xd4af37), face = L('l', 0xfff6dc), hand = L('m', 0x111111);
    face.put(SHAPES.cyl, 0, 0, 0, r, 0.02, r, Math.PI / 2);
    rim.put(SHAPES.torus, 0, 0, 0.012, r, r, 0.8);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; hand.put(SHAPES.box, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, 0.015, r * 0.04, r * 0.14, 0.01, 0, 0, a + Math.PI / 2); }
    hand.put(SHAPES.box, 0.0, r * 0.28, 0.02, r * 0.05, r * 0.6, 0.01);
    hand.put(SHAPES.box, r * 0.2, -r * 0.1, 0.022, r * 0.04, r * 0.45, 0.01, 0, 0, -2.0);
  });
}

export function carouselPart() {
  return part('carousel', (L) => {
    const steel = L('t', 0x8a9096, PAT.PANEL), belt = L('m', 0x222222);
    const stadium = (rw, rh) => { const s = new THREE.Shape(); s.absarc(-rw, 0, rh, Math.PI / 2, Math.PI * 1.5, false); s.absarc(rw, 0, rh, -Math.PI / 2, Math.PI / 2, false); return s; };
    steel.geo(extrudeShape('car-base', () => stadium(1.0, 0.7), 0.45), mtx(0, 0.225, 0, Math.PI / 2, 0, 0));
    belt.geo(extrudeShape('car-belt', () => { const s = stadium(1.0, 0.85); s.holes.push(stadium(1.0, 0.55)); return s; }, 0.06), mtx(0, 0.48, 0, Math.PI / 2, 0, 0));
    const bags = [0xe63946, 0x2b2b2b, 0x3a6ea5, 0xf2c14e, 0x6b4a33];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1, x = Math.cos(a) * 1.5, z = Math.sin(a) * 0.7;
      L('m', bags[i % 5]).geo(rbox(0.45, 0.3, 0.2, 0.05), mtx(x, 0.66, z, 0, a, 0));
    }
  });
}

export function serverRackPart() {
  return part('rack', (L) => {
    const r = L('m', 0x1b1f26, PAT.PANEL), grille = L('t', 0x3a3f47), led = L('l', 0x39ff14), led2 = L('l', 0x3ea8ff);
    r.bv(-0.3, 0, -0.5, 0.3, 2.1, 0.5, 0.01);
    for (let y = 0.1; y < 2.0; y += 0.09) {
      grille.bx(-0.27, y, 0.5, 0.27, y + 0.07, 0.51);
      (Math.floor(y * 11) % 3 ? led : led2).bx(0.18, y + 0.025, 0.51, 0.22, y + 0.045, 0.515);
    }
    grille.bx(0.24, 0.9, 0.51, 0.26, 1.3, 0.55);
  });
}

export function tankPart(h = 2.4, r = 0.6, color = 0x8e9aa3) {
  return part(`itank:${f2(h)}:${f2(r)}:${color}`, (L) => {
    const t = L('t', color, PAT.PANEL), s = L('t', 0x4a4f55), valve = L('t', 0xc0392b);
    t.geo(lathe(`itb:${f2(h)}:${f2(r)}`, [[0.001, 0.3], [r * 0.6, 0.32], [r, 0.45], [r, h - 0.15], [r * 0.6, h], [0.001, h + 0.05]], 24), mtx());
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.78; s.bx(Math.cos(a) * r * 0.8 - 0.03, 0, Math.sin(a) * r * 0.8 - 0.03, Math.cos(a) * r * 0.8 + 0.03, 0.45, Math.sin(a) * r * 0.8 + 0.03); }
    for (const y of [0.9, h - 0.5]) s.put(SHAPES.torus, 0, y, 0, r + 0.01, r + 0.01, 0.4, Math.PI / 2);
    s.put(SHAPES.cyl, r + 0.2, 0.8, 0, 0.07, 0.4, 0.07, 0, 0, Math.PI / 2);
    valve.put(SHAPES.torus, r + 0.35, 0.8, 0, 0.12, 0.12, 0.5, 0, Math.PI / 2, 0);
    s.put(SHAPES.cyl, 0, h + 0.2, 0, 0.06, 0.35, 0.06);
  });
}

export function controlPanelPart(w = 2.0) {
  return part(`cpanel:${f2(w)}`, (L) => {
    const b = L('t', 0x6d7880, PAT.PANEL), d = L('m', 0x222222), g = L('l', 0x7fff7f), o = L('l', 0xffb347), scr = L('l', 0x7fd8ff);
    b.bv(-w / 2, 0, -0.35, w / 2, 1.8, 0.0, 0.015);
    b.put(SHAPES.box, 0, 0.95, 0.12, w, 0.05, 0.35, 0.7, 0, 0);
    b.bv(-w / 2, 0, 0, w / 2, 0.85, 0.3, 0.015);
    for (let i = 0; i < 10; i++) (i % 3 ? g : o).put(SHAPES.cyl, -w / 2 + 0.2 + i * ((w - 0.4) / 9), 0.99, 0.14, 0.025, 0.02, 0.025, 0.7);
    for (const x of [-w / 4, w / 4]) { d.bx(x - 0.3, 1.1, 0.0, x + 0.3, 1.55, 0.02); scr.bx(x - 0.27, 1.13, 0.021, x + 0.27, 1.52, 0.023); }
    for (let i = 0; i < 4; i++) d.put(SHAPES.cyl, -w / 2 + 0.3 + i * 0.4, 1.7, 0.01, 0.07, 0.02, 0.07, Math.PI / 2);
  });
}

export function vaultDoorPart() {
  return part('vault', (L) => {
    const s = L('t', 0xb8922e), d = L('t', 0x6d5520), chrome = L('t', 0xd0d4d8);
    s.geo(lathe('vd', [[0.001, 0], [1.35, 0], [1.4, 0.08], [1.35, 0.3], [1.1, 0.35], [0.001, 0.35]], 40), mtx(0, 1.8, 0, Math.PI / 2, 0, 0));
    d.put(SHAPES.torus, 0, 1.8, 0.36, 1.2, 1.2, 1.0);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; chrome.put(SHAPES.cyl, Math.cos(a) * 1.05, 1.8 + Math.sin(a) * 1.05, 0.38, 0.05, 0.08, 0.05, Math.PI / 2); }
    chrome.put(SHAPES.torus, 0, 1.8, 0.5, 0.45, 0.45, 1.5);
    for (let k = 0; k < 3; k++) chrome.put(SHAPES.cyl, 0, 1.8, 0.48, 0.03, 0.9, 0.03, 0, 0, (k * Math.PI) / 3);
    chrome.put(SHAPES.cyl, 0, 1.8, 0.45, 0.12, 0.15, 0.12, Math.PI / 2);
    d.bv(1.35, 1.1, -0.05, 1.6, 2.5, 0.3, 0.03);
  });
}

export function cinemaRowPart(n = 6, pitch = 0.58) {
  return part(`cinrow:${n}:${f2(pitch)}`, (L) => {
    const f = L('m', 'fabric', PAT.CARPET), m = L('m', 0x1a1a1a);
    for (let i = 0; i < n; i++) {
      const x = -((n - 1) * pitch) / 2 + i * pitch;
      f.geo(rbox(0.5, 0.14, 0.48, 0.05), mtx(x, 0.42, 0.02));
      f.geo(rbox(0.5, 0.6, 0.14, 0.06), mtx(x, 0.75, 0.25, -0.15, 0, 0));
    }
    for (let i = 0; i <= n; i++) {
      const x = -(n * pitch) / 2 + i * pitch;
      m.geo(rbox(0.07, 0.35, 0.55, 0.03), mtx(x, 0.52, 0.05));
      m.bx(x - 0.03, 0, -0.2, x + 0.03, 0.35, 0.2);
    }
  });
}

export function screenPart(w = 3.4, h = 2.0) {
  return part(`screen:${f2(w)}:${f2(h)}`, (L) => {
    const face = L('l', 0xdfe8ff), frame = L('m', 0x111111), curtain = L('m', 0x8c1c2c, PAT.CARPET);
    frame.bv(-w / 2 - 0.1, 0.7, -0.08, w / 2 + 0.1, 0.8 + h, 0.0, 0.02);
    face.bx(-w / 2, 0.75, 0.001, w / 2, 0.75 + h, 0.01);
    const wave = Array.from({ length: 13 }, (_, i) => [0.05 + 0.04 * Math.sin(i * 1.6), -0.25 + (i / 12) * 0.5]);
    const prof = [...wave, ...wave.slice().reverse().map(([w_, v]) => [w_ - 0.04, v])];
    for (const s of [-1, 1]) curtain.geo(extrudeProfile('curtain', prof, h + 1.0), mtx(s * (w / 2 + 0.2), 0.5 + (h + 1.0) / 2, 0, 0, 0, Math.PI / 2));
    curtain.geo(extrudeProfile('curtain', prof, h + 1.0), mtx(0, h + 1.05, 0.02, 0, 0, 0, (w + 0.8) / (h + 1.0), 0.4, 1));
  });
}

export function libraryTablePart() {
  return part('libtable', (L) => {
    const wood = L('m', 'wood', PAT.WOOD), brass = L('t', 0xb08d57), shade = L('l', 0x3ecf7a), book = L('m', 0x8c2f2f);
    wood.bv(-1.0, 0.72, -0.45, 1.0, 0.78, 0.45, 0.02);
    for (const x of [-0.9, 0.9]) { wood.geo(lathe('libleg', [[0.05, 0], [0.04, 0.1], [0.055, 0.35], [0.035, 0.72]], 10), mtx(x, 0, -0.35)); wood.geo(lathe('libleg', [[0.05, 0], [0.04, 0.1], [0.055, 0.35], [0.035, 0.72]], 10), mtx(x, 0, 0.35)); }
    for (const x of [-0.45, 0.45]) {
      brass.geo(lathe('banker', [[0.08, 0], [0.07, 0.02], [0.015, 0.04], [0.015, 0.32], [0.001, 0.32]], 12), mtx(x, 0.78, 0));
      shade.geo(extrudeShape('bankshade', () => shape([[-0.14, 0], [0.14, 0], [0.1, 0.07], [-0.1, 0.07]]), 0.12), mtx(x, 1.08, 0.03));
    }
    book.bv(0.1, 0.78, 0.1, 0.35, 0.82, 0.3, 0.005);
    L('m', 0xf4f1ea).bx(-0.3, 0.78, 0.05, 0.05, 0.79, 0.3);
  });
}

export function sculpturePart(seed = 0) {
  const k = Math.floor(seed * 3);
  return part(`sculpt:${k}`, (L) => {
    const plinth = L('m', 0xfafafa), art = L('t', [0xd4af37, 0xc0c6cc, 0x2b2b2b][k]);
    plinth.bv(-0.3, 0, -0.3, 0.3, 1.0, 0.3, 0.01);
    if (k === 0) art.geo(new THREE.TorusKnotGeometry(0.22, 0.06, 64, 8), mtx(0, 1.35, 0));
    else if (k === 1) for (let i = 0; i < 5; i++) art.geo(rbox(0.25 - i * 0.03, 0.12, 0.25 - i * 0.03, 0.04), mtx(0, 1.06 + i * 0.13, 0, 0, i * 0.4, 0));
    else art.geo(lathe('sculpt-vase', [[0.001, 0], [0.18, 0.05], [0.22, 0.3], [0.08, 0.6], [0.14, 0.75], [0.001, 0.78]], 20), mtx(0, 1.0, 0));
  });
}

export function framedArtPart(w = 0.9, h = 0.7, color = 0xe63946) {
  return part(`art:${f2(w)}:${f2(h)}:${color}`, (L) => {
    const frame = L('t', 0xb08d57), canvas = L('m', color), light = L('l', 0xfff6e0);
    frame.bv(-w / 2, 0, 0, w / 2, h, 0.05, 0.012);
    canvas.bx(-w / 2 + 0.06, 0.06, 0.05, w / 2 - 0.06, h - 0.06, 0.055);
    L('m', 0xf4f1ea).bx(-w / 4, h * 0.3, 0.056, w / 6, h * 0.6, 0.058);
    frame.put(SHAPES.cyl8, 0, h + 0.12, 0.12, 0.012, 0.25, 0.012, Math.PI / 2.5);
    light.bx(-0.1, h + 0.16, 0.2, 0.1, h + 0.19, 0.26);
  });
}

export function labBenchPart(len = 3.4) {
  return part(`lab:${f2(len)}`, (L) => {
    const cab = L('m', 0xe8e8e8, PAT.PANEL), top = L('m', 0x222222), steel = L('t', 0xc0c6cc), glass = L('glass', 0xcfe6ee);
    cab.bv(-len / 2, 0, -0.35, len / 2, 0.86, 0.35, 0.01);
    top.bv(-len / 2 - 0.02, 0.86, -0.37, len / 2 + 0.02, 0.9, 0.37, 0.006);
    steel.bx(-len / 2, 1.3, -0.3, len / 2, 1.33, 0.0);
    for (let x = -len / 2 + 0.3; x < len / 2; x += 0.35) glass.geo(lathe('flask', [[0.06, 0], [0.065, 0.06], [0.02, 0.18], [0.02, 0.26]], 10), mtx(x, 0.9, -0.1));
    const liquids = [0x7cff6b, 0x3ef0ff, 0xff3ea5, 0xffe03e];
    for (let i = 0; i < 6; i++) L('l', liquids[i % 4]).geo(lathe('liquid', [[0.055, 0], [0.058, 0.05], [0.001, 0.05]], 10), mtx(-len / 2 + 0.3 + i * 0.35, 0.905, -0.1));
    steel.geo(tube('labtap', [[0, 0, 0], [0, 0.35, 0], [0.15, 0.4, 0]], 0.02, 10, 6), mtx(len / 2 - 0.5, 0.9, -0.28, 0, -Math.PI / 2, 0));
    steel.put(SHAPES.cyl, len / 2 - 0.9, 0.95, 0.1, 0.06, 0.1, 0.06);
    steel.put(SHAPES.cyl, len / 2 - 0.9, 1.15, 0.05, 0.03, 0.35, 0.03, 0.4);
  });
}

export function fumeHoodPart() {
  return part('fume', (L) => {
    const b = L('t', 0xdfe4e8, PAT.PANEL), glass = L('glass', 0xcfe6ee), light = L('l', 0xf0f8ff);
    b.bv(-0.6, 0, -0.45, 0.6, 2.3, 0.45, 0.02);
    glass.bx(-0.52, 0.95, 0.43, 0.52, 1.8, 0.45);
    b.bx(-0.55, 0.9, 0.45, 0.55, 0.95, 0.5);
    light.bx(-0.5, 1.85, 0.3, 0.5, 1.88, 0.42);
    b.put(SHAPES.cyl, 0, 2.6, -0.2, 0.15, 0.6, 0.15);
  });
}

export function hospitalBedPart() {
  return part('hbed', (L) => {
    const m = L('t', 0xd0d4d8), mat = L('m', 0xf8f8f8), sheet = L('m', 0x7fb2d9), iv = L('glass', 0xcfe6ee);
    m.bv(-0.45, 0.4, -1.0, 0.45, 0.5, 1.0, 0.02);
    for (const x of [-0.4, 0.4]) for (const z of [-0.9, 0.9]) { m.bx(x - 0.02, 0.08, z - 0.02, x + 0.02, 0.4, z + 0.02); m.put(SHAPES.sphere, x, 0.05, z, 0.05, 0.05, 0.05); }
    mat.geo(rbox(0.85, 0.15, 1.9, 0.05), mtx(0, 0.58, 0));
    sheet.geo(rbox(0.88, 0.06, 1.1, 0.03), mtx(0, 0.67, 0.35));
    mat.geo(rbox(0.5, 0.12, 0.3, 0.05), mtx(0, 0.7, -0.75));
    for (const x of [-0.47, 0.47]) m.geo(tube(`hrail:${x}`, [[0, 0, -0.4], [0, 0.35, -0.3], [0, 0.35, 0.3], [0, 0, 0.4]], 0.015, 16, 6), mtx(x, 0.5, 0));
    m.bv(-0.47, 0.5, -1.05, 0.47, 1.1, -0.98, 0.02);
    m.put(SHAPES.cyl, 0.7, 1.0, -0.8, 0.015, 2.0, 0.015);
    iv.geo(rbox(0.12, 0.2, 0.05, 0.02), mtx(0.7, 1.85, -0.8));
  });
}

export function schoolDeskPart() {
  return part('sdesk', (L) => {
    const wood = L('m', 0xd2b48c, PAT.WOOD), m = L('t', 0x4a4f55), seat = L('m', 'accent');
    wood.bv(-0.35, 0.7, -0.25, 0.35, 0.73, 0.25, 0.008);
    m.bx(-0.3, 0.45, -0.22, 0.3, 0.7, -0.2);
    for (const x of [-0.3, 0.3]) { m.bx(x - 0.015, 0, -0.2, x + 0.015, 0.7, -0.18); m.bx(x - 0.015, 0, 0.18, x + 0.015, 0.7, 0.2); }
    seat.geo(rbox(0.4, 0.04, 0.38, 0.015), mtx(0, 0.44, 0.55));
    seat.geo(rbox(0.38, 0.28, 0.03, 0.015), mtx(0, 0.72, 0.76, 0.1, 0, 0));
    for (const x of [-0.17, 0.17]) for (const z of [0.4, 0.7]) m.bx(x - 0.012, 0, z - 0.012, x + 0.012, 0.44, z + 0.012);
  });
}

export function chalkboardPart(w = 3.0) {
  return part(`chalk:${f2(w)}`, (L) => {
    const frame = L('m', 0x8a6a4a, PAT.WOOD), board = L('m', 0x2f4a3a), chalk = L('m', 0xe8e8e0);
    frame.bv(-w / 2, 0, 0, w / 2, 1.3, 0.05, 0.012);
    board.bx(-w / 2 + 0.06, 0.06, 0.05, w / 2 - 0.06, 1.24, 0.052);
    frame.bx(-w / 2, -0.04, 0.0, w / 2, 0.0, 0.12);
    for (let i = 0; i < 5; i++) chalk.bx(-w / 2 + 0.3, 1.0 - i * 0.18, 0.053, -w / 2 + 0.3 + 0.4 + ((i * 37) % 11) * 0.12, 1.02 - i * 0.18, 0.055);
  });
}

export function microscopePart() {
  return part('micro', (L) => {
    const w = L('t', 0xf2f2f2), d = L('t', 0x2b2b2b);
    w.bv(-0.1, 0, -0.12, 0.1, 0.03, 0.12, 0.01);
    w.put(SHAPES.box, 0, 0.14, -0.08, 0.05, 0.25, 0.05, -0.2, 0, 0);
    d.put(SHAPES.cyl, 0, 0.26, 0.0, 0.025, 0.18, 0.025, 0.5);
    d.bx(-0.06, 0.1, -0.02, 0.06, 0.11, 0.08);
  });
}

export function danceFloorPart(n = 4, size = 0.5, seed = 0) {
  return part(`dance:${n}:${f2(size)}:${Math.floor(seed * 4)}`, (L) => {
    const cols = [0xff3ea5, 0x3ef0ff, 0xffe03e, 0x7cff6b];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const lit = (i + j) % 2 === 0;
      const l = lit ? L('l', cols[(i * 3 + j + Math.floor(seed * 4)) % 4]) : L('m', 0x111111);
      l.bv(-(n * size) / 2 + i * size + 0.01, 0, -(n * size) / 2 + j * size + 0.01, -(n * size) / 2 + (i + 1) * size - 0.01, 0.03, -(n * size) / 2 + (j + 1) * size - 0.01, 0.006);
    }
    const ball = L('t', 0xe0e0e0);
    ball.put(SHAPES.cyl8, 0, 3.4, 0, 0.01, 0.6, 0.01);
    ball.geo(new THREE.IcosahedronGeometry(0.22, 1), mtx(0, 3.05, 0));
  });
}

export function bicyclePart() {
  return part('bike', (L) => {
    const fr = L('t', 'accent'), t = L('m', 0x151515), m = L('t', 0xc0c6cc);
    for (const z of [-0.5, 0.5]) { t.put(SHAPES.torus, 0, 0.34, z, 0.32, 0.32, 0.5, 0, Math.PI / 2, 0); for (let k = 0; k < 6; k++) m.put(SHAPES.box, 0, 0.34, z, 0.005, 0.62, 0.005, (k * Math.PI) / 6, 0, 0); }
    fr.geo(tube('bikeframe', [[0, 0.34, -0.5], [0, 0.55, -0.1], [0, 0.8, 0.35], [0, 0.34, 0.5], [0, 0.34, -0.5]], 0.022, 24, 6), mtx());
    fr.put(SHAPES.cyl8, 0, 0.6, -0.1, 0.02, 0.6, 0.02, 0.3);
    L('m', 0x222222).geo(rbox(0.1, 0.05, 0.25, 0.02), mtx(0, 0.92, -0.18));
    m.put(SHAPES.cyl8, 0, 0.98, 0.42, 0.015, 0.5, 0.015, 0, 0, Math.PI / 2);
  });
}

export function escalatorPart(rise = 4, run = 3.6, w = 1.1) {
  return part(`escal:${f2(rise)}:${f2(run)}:${f2(w)}`, (L) => {
    const steel = L('t', 0xb8bec4, PAT.PANEL), step = L('m', 0x3a3d40), rail = L('m', 0x111111), glass = L('glass', 0xcfe6ee);
    const n = Math.round(run / 0.4);
    for (let i = 0; i < n; i++) step.bx(-w / 2 + 0.08, (i * rise) / n, -run / 2 + (i * run) / n, w / 2 - 0.08, ((i + 1) * rise) / n, -run / 2 + ((i + 1) * run) / n);
    const ang = Math.atan2(rise, run), len = Math.hypot(rise, run);
    for (const s of [-1, 1]) {
      steel.put(SHAPES.box, s * (w / 2 - 0.04), rise / 2 - 0.2, 0, 0.08, 0.5, len, -ang, 0, 0);
      glass.put(SHAPES.box, s * (w / 2 - 0.04), rise / 2 + 0.45, 0, 0.02, 0.8, len, -ang, 0, 0);
      rail.put(SHAPES.box, s * (w / 2 - 0.04), rise / 2 + 0.88, 0, 0.1, 0.06, len, -ang, 0, 0);
    }
  });
}
