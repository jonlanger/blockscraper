// Seven more architectural styles built from the parts kit. See facades.js for the context API.
import { PAT, SHAPES, hash } from './geo.js';
import {
  windowPart, storefrontPart, doorPart, moldingPart, modillionPart, columnPart, balconyPart,
  awningPart, canopyPart, shutterPart, flowerBoxPart, glassRailingPart,
} from './kit.js';
import { shade } from './facades.js';
import { shrubPart } from './props.js';

export { shade };
export const GREENS = [0x4f7f3a, 0x3f6f35, 0x5e8c41, 0x6a9a4a, 0x7cb342];
const MC = [0x2a9d8f, 0xe9c46a, 0xe76f51, 0x264653, 0xf4a261];

// ---------------------------------------------------------------- Streamline Moderne
function moderne(X) {
  const { c, S } = X;
  const st = [S.wall, PAT.STUCCO];
  if (c.isGround) {
    X.wall(-2, 2, 0, 4, -0.28, 0, [{ u: 0.75, v: 0.35, w: 2.3, h: 2.5 }, { u: -1.3, v: 0.35, w: 1.0, h: 2.5 }], st);
    X.P(storefrontPart({ w: 2.3, h: 2.5, doors: c.isEntrance, frameMat: 't', mullions: 1 }), 0.75, 0.35, 0, 0, 0, 0, 0.9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 7; j++) X.box('wl', -1.78 + i * 0.32, -1.5 + i * 0.32, 0.4 + j * 0.35, 0.72 + j * 0.35, -0.16, -0.04, 0xcfe6ee, 0.03);
    X.P(moldingPart('band', 4, 'trim', 'm'), 0, 0.17, 0);
    const d = c.isEntrance ? 1.5 : 0.8;
    X.box('m', -2, 2, 3.05, 3.2, 0, d, [S.trim, 0], 0.05);
    X.box('l', -2, 2, 3.08, 3.14, d, d + 0.04, S.accent);
    if (c.isEntrance) for (let k = 0; k < 3; k++) X.box('t', -0.9 + k * 0.1, -0.86 + k * 0.1, 3.2, 3.95, 0.02, 0.08 + k * 0.03, S.accent, 0.01);
  } else {
    X.wall(-2, 2, 0, 4, -0.28, 0, [{ u: 0, v: 1.15, w: 3.6, h: 2.1 }], st);
    X.P(windowPart({ w: 3.6, h: 2.1, cols: 4, rows: 2, depth: 0.28, frame: 0.05, frameMat: 't', sill: false }), 0, 1.15, 0, 0);
    for (const v of [0.35, 0.6, 0.85]) X.box('m', -2, 2, v, v + 0.07, 0, 0.07, [S.trim, 0], 0.02);
    X.box('m', -2, 2, 3.3, 3.4, 0, 0.35, st, 0.03);
    if (hash((c.seed * 1000) | 0, c.level, 3) < 0.15) {
      X.shape('t', SHAPES.torus, -1.55, 3.68, 0.03, 0.2, 0.2, 1.2, S.accent);
      X.shape(X.glass(4, 0.5), SHAPES.disc, -1.55, 3.68, 0.02, 0.19, 0.19, 1, S.glass);
    }
  }
  if (c.cornerR) X.shape('m', SHAPES.cyl, 2, c.isTop ? 2.3 : 2, -0.15, 0.3, c.isTop ? 4.6 : 4, 0.3, st);
  if (c.isTop) {
    X.box('m', -2, 2, 4, 4.5, -0.28, 0.08, st, 0.02);
    X.P(moldingPart('band', 4, 'trim', 'm'), 0, 4.55, -0.02);
    X.box('m', -0.14, 0.14, 4.5, 6.4, -0.3, 0.25, [S.trim, 0], 0.05);
    for (const v of [4.9, 5.3, 5.7]) X.box('m', -0.55, 0.55, v, v + 0.08, -0.2, 0.12, st, 0.02);
  }
}

// ---------------------------------------------------------------- Chicago School
function chicago(X) {
  const { c, S } = X;
  const tc = [S.wall, PAT.TERRACOTTA];
  const eL = c.cornerL ? 0.14 : 0, eR = c.cornerR ? 0.14 : 0, mid = (eR - eL) / 2, len = 4 + eL + eR;
  if (c.isGround) {
    X.wall(-2, 2, 0, 4, -0.3, 0, [{ u: 0, v: 0, w: 3.4, h: 3.2 }], tc);
    X.P(storefrontPart({ w: 3.4, h: 2.6, doors: c.isEntrance, frameMat: 't', mullions: 2 }), 0, 0, 0, 0, 0, 0, 0.85);
    for (let i = 0; i < 12; i++) X.box('wl', -1.7 + i * 0.283, -1.43 + i * 0.283, 2.68, 3.15, -0.26, -0.2, 0xe8e0c0, 0.01);
    for (const u of [-0.57, 0.57]) X.P(columnPart('castiron', 3.2, 0.08, 'iron'), u, 0, -0.1);
    X.P(moldingPart('string', len, 'stone'), mid, 3.4, 0.1);
  } else if (c.level % 3 === 1) {
    X.wall(-2, 2, 0, 4, -0.3, 0, [{ u: 0, v: 0.5, w: 3.0, h: 3.1 }], tc);
    X.box('m', -1.35, 1.35, 0.3, 0.8, 0, 0.65, tc, 0.04);
    X.box('m', -1.35, 1.35, 3.45, 3.75, 0, 0.65, tc, 0.04);
    X.P(windowPart({ w: 2.3, h: 2.65, cols: 1, rows: 1, depth: 0.1, frame: 0.07, sill: false }), 0, 0.8, 0.62, 0);
    for (const s of [-1, 1]) {
      X.P(windowPart({ w: 0.52, h: 2.65, sash: true, depth: 0.08, frame: 0.05, sill: false }), s * 1.28, 0.8, 0.33, s + 2, s > 0 ? Math.PI / 2 : 0);
      X.box('m', s * 1.35 - 0.04, s * 1.35 + 0.04, 0.8, 3.45, 0, 0.65, tc, 0.02);
    }
  } else {
    const ops = [{ u: 0, v: 0.8, w: 1.5, h: 2.55 }, { u: -1.28, v: 0.8, w: 0.6, h: 2.55 }, { u: 1.28, v: 0.8, w: 0.6, h: 2.55 }];
    X.wall(-2, 2, 0, 4, -0.3, 0, ops, tc);
    X.P(windowPart({ w: 1.5, h: 2.55, depth: 0.3, frame: 0.07 }), 0, 0.8, 0, 0);
    for (const s of [-1, 1]) X.P(windowPart({ w: 0.6, h: 2.55, sash: true, depth: 0.3, frame: 0.05 }), s * 1.28, 0.8, 0, s + 2);
    X.box('m', -1.7, 1.7, 0.18, 0.62, -0.02, 0.05, [S.trim, 0], 0.02);
    for (const u of [-1.2, -0.4, 0.4, 1.2]) X.shape('m', SHAPES.ico, u, 0.4, 0.07, 0.1, 0.1, 0.05, S.accent);
  }
  X.box('m', -2 - eL, -1.72, 0, 4, 0, 0.14, tc, 0.02);
  X.box('m', 1.72, 2 + eR, 0, 4, 0, 0.14, tc, 0.02);
  if (c.isTop) {
    X.box('m', -2 - eL, 2 + eR, 3.55, 4.05, -0.3, 0.16, tc, 0.02);
    X.P(modillionPart(len, 'stone'), mid, 4.05, 0.16);
    X.P(moldingPart('cornice', len + 0.6, 'stone'), mid, 4.32, 0.1);
    X.box('m', -2, 2, 4.4, 4.8, -0.3, 0.0, tc, 0.02);
  }
}

// ---------------------------------------------------------------- Mid-Century
function midcentury(X) {
  const { c, S } = X;
  const panel = hash((c.seed * 997) | 0, c.level, 11) < 0.5 ? S.accent : MC[Math.floor(hash((c.seed * 991) | 0, c.level, 5) * MC.length)];
  if (c.isGround) {
    X.P(storefrontPart({ w: 4, h: 3.2, doors: c.isEntrance, frameMat: 't', mullions: 3 }), 0, 0, -0.55, 0, 0, 0, 0.85);
    X.box('m', -2, 2, 3.2, 4, -0.75, 0.2, [S.wall, 0], 0.02);
    for (const u of [-1.2, 1.2]) X.P(columnPart('modern', 3.2, 0.09, 'frame'), u, 0, 0.1);
    X.shape('m', SHAPES.box, -1, 3.35, 0.95, 2.05, 0.08, 1.6, [S.wall, 0], -0.12);
    X.shape('m', SHAPES.box, 1, 3.35, 0.95, 2.05, 0.08, 1.6, [S.wall, 0], 0.12);
    X.box('m', -2, -1.35, 0.0, 1.2, -0.2, 0.25, [panel, PAT.TILE], 0.02);
    X.box('m', -2, 2, 0, 0.1, -0.75, 0.9, [0x9a968d, PAT.CONCRETE]);
  } else {
    X.box('m', -2, 2, 0, 0.9, -0.14, -0.05, [panel, PAT.PANEL], 0.01);
    X.box(X.glass(0), -2, 0, 0.9, 4, -0.16, -0.12, S.glass);
    X.box(X.glass(1), 0, 2, 0.9, 4, -0.16, -0.12, S.glass);
    for (const u of [-2, -1, 0, 1, 2]) X.box('t', u - 0.035, u + 0.035, 0, 4, -0.12, 0.05, S.trim, 0.008);
    X.box('t', -2, 2, 0.87, 0.93, -0.12, 0.05, S.trim, 0.008);
    if (c.level % 2 === 0) for (let u = -1.75; u < 1.8; u += 0.5) X.box('m', u - 0.03, u + 0.03, 0.95, 3.95, 0.05, 0.62, [S.wall, 0], 0.012);
    else { X.box('m', -2, 2, 3.88, 4, 0.05, 0.8, [S.wall, 0], 0.02); X.P(glassRailingPart(4, 1.0), 0, 0.92, 0.08); }
  }
  if (c.isTop) {
    X.box('m', -2, 2, 4.0, 4.55, -0.35, -0.25, [S.wall, 0]);
    X.box('m', -2, 2 + (c.cornerR ? 0.9 : 0), 4.55, 4.75, -0.35, 1.0, [S.wall, 0], 0.03);
    X.box('t', -2, 2 + (c.cornerR ? 0.9 : 0), 4.5, 4.55, 0.9, 1.0, S.trim);
  }
}

// ---------------------------------------------------------------- Parametric
function futurist(X) {
  const { c, S } = X;
  X.box(X.glass(0, 0.5), -2, 0, 0, 4, -0.3, -0.25, S.glass);
  X.box(X.glass(1, 0.5), 0, 2, 0, 4, -0.3, -0.25, S.glass);
  X.box('m', -2, 2, 0, 0.24, -0.3, 0.12, [S.trim, PAT.PANEL], 0.03);
  X.box('l', -2, 2, 0.24, 0.27, 0.04, 0.12, S.accent);
  for (let k = 0; k < 8; k++) {
    const u = -1.75 + k * 0.5;
    const along = X.F.ox * X.F.rx + X.F.oz * X.F.rz + u;
    const d0 = 0.12 + 0.6 * (0.5 + 0.5 * Math.sin(c.level * 0.35 + along * 0.22));
    const d1 = 0.12 + 0.6 * (0.5 + 0.5 * Math.sin((c.level + 1) * 0.35 + along * 0.22));
    for (let s = 0; s < 4; s++) {
      const d = d0 + ((d1 - d0) * (s + 0.5)) / 4;
      X.box('m', u - 0.045, u + 0.045, s, s + 1.001, -0.25, d, [S.wall, PAT.PANEL], 0.02);
    }
  }
  if (c.isGround) {
    X.shape('m', SHAPES.box, 0, 3.4, 1.1, 4.0, 0.14, 2.2, [S.wall, PAT.PANEL], 0, 0.12);
    X.box('l', -2, 2, 3.2, 3.24, 2.05, 2.15, S.accent);
    if (c.isEntrance) X.P(doorPart('revolving', 2.0, 2.7), 0, 0, 0.3);
  }
  if (c.isTop) {
    X.box('m', -2, 2, 4, 4.1, -0.3, 0.2, [S.trim, PAT.PANEL]);
    X.shape('wd', SHAPES.box, 0, 4.8, 0.1, 4.0, 1.6, 0.06, 0xb8e0f0, 0, 0.3);
    for (const u of [-1.9, -0.63, 0.63, 1.9]) X.shape('t', SHAPES.box, u, 4.8, 0.1, 0.05, 1.65, 0.09, S.trim, 0, 0.3);
    X.box('l', -2, 2, 5.52, 5.58, 0.25, 0.4, S.accent);
  }
}

// ---------------------------------------------------------------- Mediterranean
function mediterranean(X) {
  const { c, S } = X;
  const st = [S.wall, PAT.STUCCO];
  if (c.isGround) {
    X.wall(-2, 2, 0, 4, -0.3, 0.3, [{ u: -1, v: 0, w: 1.7, h: 2.2, arch: 'round' }, { u: 1, v: 0, w: 1.7, h: 2.2, arch: 'round' }], st);
    for (const u of [-2, 0, 2]) X.P(columnPart('doric', 2.3, 0.14, 'stone'), u, 0, 0.3);
    X.box('m', -2, 2, 0, 0.06, -1.1, 0.5, [0xcaa27a, PAT.TILE]);
    X.P(storefrontPart({ w: 4, h: 2.8, doors: c.isEntrance, frameMat: 't', mullions: 3 }), 0, 0, -0.9, 0, 0, 0, 0.8);
    X.box('m', -2, 2, 2.8, 4, -1.1, -0.3, st);
  } else {
    X.wall(-2, 2, 0, 4, -0.26, 0, [{ u: 0, v: 0.8, w: 1.1, h: 1.9, arch: 'round' }], st);
    X.P(windowPart({ w: 1.1, h: 1.9, arch: 'round', cols: 2, rows: 3, depth: 0.26, frame: 0.05, sill: c.level % 2 === 0 }), 0, 0.8, 0, 0);
    for (const s of [-1, 1]) X.P(shutterPart(0.56, 2.2), s * 0.88, 0.75, 0.02);
    if (c.level % 2 === 1) X.P(balconyPart(2.8, 0.7, 'iron', 'wall'), 0, 0.72, 0);
    else X.P(flowerBoxPart(1.0, hash((c.seed * 71) | 0, c.level, 2)), 0, 0.62, 0.02);
    X.shape('m', SHAPES.torusHalf, 0, 2.7, 0.02, 0.62, 0.62, 1, [S.trim, 0]);
  }
  if (c.isTop) {
    X.box('m', -2, 2, 3.8, 4.05, -0.26, 0.2, st);
    for (let u = -1.8; u < 1.9; u += 0.4) X.box('m', u - 0.05, u + 0.05, 3.85, 3.97, 0.2, 0.62, [0x6b4a33, PAT.WOOD], 0.01);
    X.P(moldingPart('eave', 4.3, 'roof', 'm', PAT.ROOFTILE), 0, 4.05, 0.1);
    X.shape('m', SHAPES.box, 0, 4.65, -0.6, 4.2, 0.14, 1.6, [S.roof, PAT.ROOFTILE], 0, 0.55);
    for (let u = -1.95; u < 2; u += 0.26) X.shape('m', SHAPES.cyl8, u, 4.72, -0.55, 0.06, 1.6, 0.06, [shade(S.roof, 0.85), 0], 0, 0.55 + Math.PI / 2);
  }
}

// ---------------------------------------------------------------- Cast-Iron Victorian
function castiron(X) {
  const { c, S } = X;
  const iron = [S.wall, PAT.NONE];
  if (c.isGround) {
    X.P(storefrontPart({ w: 3.9, h: 2.9, doors: c.isEntrance, frameMat: 'm', mullions: 2 }), 0, 0, 0, 0, 0, 0, 0.85);
    for (const u of [-1.95, -0.65, 0.65, 1.95]) X.P(columnPart('castiron', 3.0, 0.11, 'iron'), u, 0, 0.12);
    X.box('m', -2, 2, 3.0, 3.95, -0.25, 0.14, [S.trim, 0], 0.02);
    X.box('m', -1.8, 1.8, 3.2, 3.75, 0.14, 0.18, [0x1a1a1a, 0], 0.01);
    for (let u = -1.5; u < 1.6; u += 0.28) X.box('t', u - 0.08, u + 0.08, 3.35, 3.62, 0.18, 0.21, S.accent, 0.008);
    X.P(moldingPart('string', 4, 'iron', 't'), 0, 3.98, 0.12);
  } else {
    const ops = [-1.3, 0, 1.3].map((u) => ({ u, v: 0.6, w: 0.95, h: 2.2, arch: 'segment' }));
    X.wall(-2, 2, 0, 4, -0.22, 0, ops, iron);
    ops.forEach((o, k) => X.P(windowPart({ w: 0.95, h: 2.2, arch: 'segment', sash: true, cols: 1, rows: 2, depth: 0.22, frame: 0.05, lintel: 'keystone' }), o.u, 0.6, 0, k));
    for (const u of [-1.95, -0.65, 0.65, 1.95]) X.P(columnPart('castiron', 3.4, 0.07, 'iron'), u, 0.3, 0.08);
    X.P(moldingPart('string', 4, 'trim'), 0, 0.3, 0.02);
    X.P(moldingPart('crown', 4, 'trim'), 0, 3.92, 0.0);
  }
  if (c.isTop) {
    X.box('m', -2, 2, 3.95, 4.3, -0.22, 0.2, [S.trim, 0], 0.02);
    X.P(modillionPart(4, 'trim'), 0, 4.3, 0.2);
    X.P(moldingPart('cornice', 4.2, 'trim'), 0, 4.62, 0.05);
    X.shape('m', SHAPES.box, -0.6, 4.95, 0.3, 1.3, 0.14, 0.34, [S.trim, 0], 0.42);
    X.shape('m', SHAPES.box, 0.6, 4.95, 0.3, 1.3, 0.14, 0.34, [S.trim, 0], -0.42);
    X.box('t', -0.25, 0.25, 4.7, 4.95, 0.28, 0.46, S.accent, 0.02);
  }
}

// ---------------------------------------------------------------- Solarpunk
function solarpunk(X) {
  const { c, S } = X;
  const tim = [S.wall, PAT.TIMBER];
  const h = (k) => hash((c.seed * 7919) | 0, c.level, k);
  X.box(X.glass(0), -2, 0, 0.25, 4, -0.42, -0.36, S.glass);
  X.box(X.glass(1), 0, 2, 0.25, 4, -0.42, -0.36, S.glass);
  for (const u of [-1, 0, 1]) X.box('m', u - 0.04, u + 0.04, 0.25, 4, -0.38, -0.3, [0x5a3f2a, PAT.WOOD], 0.01);
  X.box('m', -2 - (c.cornerL ? 0.3 : 0), -1.72, 0, 4, -0.42, 1.0, tim, 0.03);
  X.box('m', 1.72, 2 + (c.cornerR ? 0.3 : 0), 0, 4, -0.42, 1.0, tim, 0.03);
  if (c.isGround) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) X.box('m', -1.7 + i * 0.3, -1.42 + i * 0.3, 0.1 + j * 0.5, 0.58 + j * 0.5, -0.32, -0.12 - h(i * 9 + j) * 0.18, [GREENS[(i + j * 3) % 5], PAT.GRASS], 0.05);
    X.box('m', -2, 2, 3.6, 4, -0.42, 1.05, tim, 0.03);
    if (c.isEntrance) X.P(doorPart('glass', 1.6, 2.8), 0.85, 0, -0.2);
  } else {
    X.box('m', -2, 2, 0, 0.25, -0.42, 1.0, tim, 0.02);
    X.P(glassRailingPart(3.44, 1.0), 0, 0.25, 0.94);
    X.box('m', -1.65, -0.2, 0.25, 0.7, 0.45, 0.88, [0x6b4a33, PAT.WOOD], 0.02);
    X.P(shrubPart(h(1), 0.85), -0.95, 0.55, 0.66);
    if (h(3) < 0.55) X.P(shrubPart(h(4), 1.1), 1.0, 0.25, 0.55);
    for (let k = 0; k < 4; k++) {
      const u = -1.5 + h(k + 20) * 3, len = 0.6 + h(k + 30) * 1.6;
      for (let s = 0; s < 3; s++) X.shape('m', SHAPES.ico, u + Math.sin(s * 2 + k) * 0.05, 4 - (len * (s + 0.5)) / 3, 0.97, 0.08, len / 5, 0.05, [GREENS[(k + s) % 5], PAT.GRASS]);
    }
    for (let i = 0; i < 5; i++) X.shape('t', SHAPES.box, 0, 3.55 + i * 0.001, 0.2 + i * 0.16, 3.4, 0.03, 0.14, 0x1d2b44, 0, -0.35);
  }
  if (c.isTop) {
    X.box('m', -2, 2, 4, 4.35, -0.42, 0.45, [S.roof, PAT.GRASS], 0.03);
    for (let k = 0; k < 3; k++) X.P(shrubPart(h(k + 50), 0.9), -1.3 + k * 1.3, 4.35, 0.05);
  }
}

export const FACADES2 = { moderne, chicago, midcentury, futurist, mediterranean, castiron, solarpunk };
