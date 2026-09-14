// Facade system: a per-side context (merged surfaces + detailed kit parts) and the first seven
// architectural styles. Wall frame: u ∈ [-2, 2] along the wall, v ∈ [0, 4] up, w outward.
import * as THREE from 'three';
import { PAT, SHAPES, extrudeShape, lathe, hash } from './geo.js';
import {
  windowPart, storefrontPart, doorPart, moldingPart, dentilPart, modillionPart, columnPart, pilasterPart,
  balustradePart, ironRailingPart, balconyPart, awningPart, canopyPart, archPts,
} from './kit.js';

const f2 = (n) => (+n).toFixed(2);
export const shade = (c, k) =>
  (Math.min(255, Math.floor(((c >> 16) & 255) * k)) << 16) | (Math.min(255, Math.floor(((c >> 8) & 255) * k)) << 8) | Math.min(255, Math.floor((c & 255) * k));

// Per-style surface pattern and part colors. String values refer to palette keys.
export const META = {
  deco:          { pat: PAT.ASHLAR, frame: 'trim', stone: 'wall', base: 0x2f2b28 },
  nouveau:       { pat: PAT.STUCCO, frame: 0xe8e2d4, stone: 'trim', iron: 'accent' },
  glass:         { pat: PAT.NONE, frame: 'trim', stone: 'trim', base: 0x3a3632 },
  beaux:         { pat: PAT.ASHLAR, frame: 0xf4f1ea, stone: 'trim', door: 0x3a2418 },
  gothic:        { pat: PAT.ASHLAR, frame: 0x3a3a3a, stone: 'trim', door: 0x4a2f20 },
  brutalist:     { pat: PAT.CONCRETE, frame: 0x3a3d40, stone: 'wall' },
  brick:         { pat: PAT.BRICK, frame: 'trim', stone: 'accent', iron: 'trim' },
  moderne:       { pat: PAT.STUCCO, frame: 'accent', stone: 'wall' },
  chicago:       { pat: PAT.TERRACOTTA, frame: 0x2b2b2b, stone: 'wall', iron: 0x2b2b2b },
  midcentury:    { pat: PAT.NONE, frame: 0xb8bec4, stone: 'wall' },
  futurist:      { pat: PAT.PANEL, frame: 'trim', stone: 'wall' },
  mediterranean: { pat: PAT.STUCCO, frame: 0xf4f1ea, stone: 'wall', shutter: 'accent', iron: 0x2b2b2b },
  castiron:      { pat: PAT.NONE, frame: 'wall', stone: 'wall', iron: 'wall' },
  solarpunk:     { pat: PAT.TIMBER, frame: 0x6b4a33, stone: 'trim' },
};

const riseOf = (arch, w) => (arch === 'round' ? w / 2 : arch === 'pointed' ? w * 0.8 : arch === 'segment' ? w * 0.18 : 0);

// F: Frame, S: palette, c: side ctx, g: merged builders, place(part, matrix, colors, glassKey)
export function facadeContext(F, S, styleId, c, g, place) {
  const meta = META[styleId] || META.deco;
  const pal = (v, fallback) => (v === undefined ? fallback : typeof v === 'string' ? S[v] : v);
  const X = {
    F, S, c, g, meta, style: styleId,
    W: [S.wall, meta.pat],
    colors: {
      wall: S.wall, trim: S.trim, accent: S.accent, glass: S.glass, roof: S.roof,
      stone: pal(meta.stone, S.trim), frame: pal(meta.frame, S.trim), iron: pal(meta.iron, 0x23272b),
      awning: S.accent, shutter: pal(meta.shutter, S.accent), door: pal(meta.door, 0x4a2f20), base: pal(meta.base, 0x3a3632), neon: S.accent,
    },
    glass(k, frac = 0.55) {
      const r = hash((c.seed * 9973) | 0, c.level * 31 + k, 7);
      return r < frac * 0.3 ? 'wc' : r < frac ? 'wl' : 'wd';
    },
    P(part, u, v, w = 0, k = 0, rotZ = 0, rotX = 0, frac) {
      if (part.opts && !part.opts.blind && part.opts.h > 0.6 && !c.isGround) {
        const r = hash((c.seed * 7919) | 0, c.level * 13 + k, Math.round(u * 10) + 50);
        if (r > 0.35) part = windowPart({ ...part.opts, blind: 1 + Math.floor(((r - 0.35) / 0.65) * 5) });
      }
      place(part, F.matrix(u, v, w, rotZ, rotX), X.colors, X.glass(k, frac));
    },
    // Part at an arbitrary wall-space matrix (e.g. turned about the vertical).
    PM(part, m, k = 0, frac) { place(part, m, X.colors, X.glass(k, frac)); },
    box(mat, u0, u1, v0, v1, w0, w1, surf, bev = 0) {
      if (bev) F.bev(g[mat], u0, u1, v0, v1, w0, w1, surf, bev);
      else F.rect(g[mat], u0, u1, v0, v1, w0, w1, surf);
    },
    shape(mat, geom, u, v, w, su, sv, sw, surf, rotZ = 0, rotX = 0) { F.shape(g[mat], geom, u, v, w, su, sv, sw, surf, rotZ, rotX); },
    geo(mat, geom, u, v, w, surf, rotZ = 0, rotX = 0) { F.geo(g[mat], geom, u, v, w, surf, rotZ, rotX); },
    // Solid wall panel with real openings (rectangles with optional arched heads).
    wall(u0, u1, v0, v1, w0, w1, openings = [], surf = X.W) {
      const uc = (u0 + u1) / 2, W = u1 - u0, H = v1 - v0;
      const key = `${f2(W)}:${f2(H)}:` + openings.map((o) => [o.u - uc, o.v - v0, o.w, o.h].map(f2).join(',') + (o.arch || '')).join(';');
      const geom = extrudeShape(`wall:${key}`, () => {
        const s = new THREE.Shape([[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]].map(([x, y]) => new THREE.Vector2(x, y)));
        for (const o of openings) {
          const x0 = o.u - uc - o.w / 2, x1 = o.u - uc + o.w / 2, y0 = o.v - v0, y1 = y0 + o.h;
          const pts = [[x0, y0], [x1, y0]];
          if (o.arch && o.arch !== 'none') for (const [ax, ay] of archPts(o.arch, o.w / 2, riseOf(o.arch, o.w)).reverse()) pts.push([o.u - uc + ax, y1 + ay]);
          else pts.push([x1, y1], [x0, y1]);
          s.holes.push(new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x, y))));
        }
        return s;
      }, w1 - w0, 16);
      F.geo(g.m, geom, uc, v0, (w0 + w1) / 2, surf);
    },
  };
  return X;
}

// ---------------------------------------------------------------- Art Deco
function deco(X) {
  const { c, S } = X;
  const eL = c.cornerL ? 0.22 : 0, eR = c.cornerR ? 0.22 : 0, mid = (eR - eL) / 2, len = 4 + eL + eR;
  if (c.isGround) {
    X.box('m', -2 - eL, -1.65, 0.46, 4, -0.3, 0.2, X.W, 0.03);
    X.box('m', 1.65, 2 + eR, 0.46, 4, -0.3, 0.2, X.W, 0.03);
    if (c.isEntrance) {
      for (const s of [-1, 1]) X.P(moldingPart('plinth', 0.9 + (s < 0 ? eL : eR), 'base', 'm', PAT.MARBLE), s * (1.55 + (s < 0 ? eL : eR) / 2), 0, 0);
      X.wall(-1.65, 1.65, 0, 4, -0.3, 0, [{ u: 0, v: 0, w: 2.2, h: 2.2, arch: 'round' }]);
      X.P(doorPart('glass', 1.9, 2.2), 0, 0, -0.08);
      X.shape('wl', SHAPES.halfDisc, 0, 2.2, -0.24, 1.1, 1.1, 1, 0xffe7a0);
      for (let k = 1; k < 8; k++) { const a = (k / 8) * Math.PI; X.shape('t', SHAPES.box, Math.cos(a) * 0.55, 2.2 + Math.sin(a) * 0.55, -0.2, 1.1, 0.035, 0.04, S.accent, a); }
      X.shape('t', SHAPES.torusHalf, 0, 2.2, 0.02, 1.16, 1.16, 2.2, S.accent);
      for (const s of [-1, 1]) X.box('t', s * 1.1 - 0.06, s * 1.1 + 0.06, 0, 2.2, -0.3, 0.06, S.accent, 0.012);
      X.box('t', -0.9, 0.9, 3.45, 3.82, 0, 0.08, S.accent, 0.02);
      X.box('l', -0.8, 0.8, 3.5, 3.77, 0.08, 0.09, 0xfff0c8);
    } else {
      X.P(moldingPart('plinth', len, 'base', 'm', PAT.MARBLE), mid, 0, 0);
      X.P(storefrontPart({ w: 3.3, h: 2.6, doors: false, frameMat: 't', mullions: 2 }), 0, 0.46, 0, 0, 0, 0, 0.85);
      X.wall(-1.65, 1.65, 3.06, 4, -0.3, 0);
      X.box('t', -1.65, 1.65, 3.06, 3.18, -0.3, 0.05, S.accent, 0.012);
      for (let k = 0; k < 6; k++) for (const s of [-1, 1]) X.shape('t', SHAPES.box, -1.25 + k * 0.5 + s * 0.09, 3.55, 0.02, 0.24, 0.045, 0.04, S.accent, s * 0.6);
    }
    X.P(moldingPart('string', len, 'stone'), mid, 3.94, 0.2);
  } else {
    for (const [u, k] of [[-0.9, 0], [0.9, 1]]) {
      X.P(windowPart({ w: 1.0, h: 2.7, rows: 3, depth: 0.3, frame: 0.05, frameMat: 't', sill: false }), u, 0.65, 0, k);
      X.box('t', u - 0.5, u + 0.5, 0, 0.65, -0.3, -0.18, [S.trim, PAT.PANEL], 0.012);
      X.box('t', u - 0.5, u + 0.5, 3.35, 4, -0.3, -0.18, [S.trim, PAT.PANEL], 0.012);
      for (const s of [-1, 1]) X.shape('t', SHAPES.box, u + s * 0.13, 0.33, -0.16, 0.34, 0.055, 0.04, S.accent, s * 0.55);
      X.box('t', u - 0.35, u + 0.35, 3.62, 3.7, -0.18, -0.15, S.accent);
    }
    X.box('m', -2 - eL, -1.4, 0, 4, -0.3, 0.2, X.W, 0.025);
    X.box('m', 1.4, 2 + eR, 0, 4, -0.3, 0.2, X.W, 0.025);
    X.box('m', -0.4, 0.4, 0, 4, -0.3, 0.22, X.W, 0.025);
    X.box('m', -0.16, 0.16, 0, 4, 0.22, 0.34, X.W, 0.02);
    for (const du of [-0.28, 0.28]) X.box('m', du - 0.025, du + 0.025, 0.1, 3.9, 0.21, 0.225, shade(S.wall, 0.72));
  }
  if (c.isTop) {
    X.box('m', -2 - eL, 2 + eR, 4, 4.55, -0.3, 0.2, X.W, 0.02);
    X.P(moldingPart('decocap', len, 'stone'), mid, 4.55, 0);
    X.box('m', -1.25, 1.25, 4.81, 5.35, -0.3, 0.06, X.W, 0.02);
    X.P(moldingPart('decocap', 2.5, 'stone'), 0, 5.35, -0.14);
    X.box('m', -0.55, 0.55, 5.61, 6.15, -0.3, -0.04, X.W, 0.02);
    X.box('t', -0.08, 0.08, 6.15, 7.1, -0.2, 0.02, S.accent, 0.015);
    X.box('l', -1.2, 1.2, 4.58, 4.61, 0.22, 0.25, 0xffe7b0);
  }
}

// ---------------------------------------------------------------- Art Nouveau
function nouveau(X) {
  const { c, S } = X;
  if (c.isGround) {
    X.wall(-2, 2, 0, 4, -0.32, 0, [{ u: 0, v: 0, w: 2.6, h: 2.2, arch: 'round' }], [S.trim, PAT.RUSTIC]);
    X.P(windowPart({ w: 2.6, h: 2.2, arch: 'round', cols: 3, depth: 0.32, frame: 0.07, frameMat: 't', sill: false, lintel: 'voussoir' }), 0, 0, 0, 0, 0, 0, 0.85);
    if (c.isEntrance) {
      X.P(doorPart('glass', 1.6, 2.2), 0, 0, -0.14);
      X.P(canopyPart(3.2, 1.5, 'iron'), 0, 3.62, 0);
    }
    X.P(moldingPart('string', 4, 'stone'), 0, 3.92, 0.02);
  } else {
    const bal = c.level % 2 === 1;
    const v0 = bal ? 0.25 : 0.8, h = bal ? 2.25 : 1.75;
    const ops = [{ u: -1, v: v0, w: 1.3, h, arch: 'round' }, { u: 1, v: v0, w: 1.3, h, arch: 'round' }];
    X.wall(-2, 2, 0, 4, -0.28, 0, ops);
    ops.forEach((o, k) => {
      X.P(windowPart({ w: 1.3, h, arch: 'round', cols: 2, rows: bal ? 3 : 2, depth: 0.28, frame: 0.055, sill: !bal, lintel: 'keystone' }), o.u, v0, 0, k);
      for (const s of [-1, 1]) X.shape('m', SHAPES.ico, o.u + s * 0.22, v0 + h + 0.72, 0.03, 0.09, 0.06, 0.05, S.trim);
    });
    if (bal) X.P(balconyPart(3.7, 0.65, 'iron', 'stone'), 0, 0.25, 0);
    X.box('m', -0.14, 0.14, 0, 4, 0, 0.08, X.W, 0.03);
    X.P(moldingPart('string', 4, 'stone'), 0, 0.12, 0);
  }
  if (c.isTop) {
    X.box('m', -2, 2, 3.9, 4.15, -0.28, 0.04, X.W);
    X.P(moldingPart('crown', 4.1, 'stone'), 0, 4.15, 0);
    X.shape('m', SHAPES.box, 0, 5.15, -0.38, 4.0, 2.0, 0.18, [S.roof, PAT.SHINGLE], 0, -0.5);
    X.wall(-0.55, 0.55, 4.25, 5.35, 0.12, 0.26, [{ u: 0, v: 4.45, w: 0.7, h: 0.45, arch: 'round' }]);
    X.box('m', -0.55, -0.45, 4.25, 5.35, -0.9, 0.12, X.W);
    X.box('m', 0.45, 0.55, 4.25, 5.35, -0.9, 0.12, X.W);
    X.P(windowPart({ w: 0.7, h: 0.45, arch: 'round', depth: 0.14, frame: 0.045, sill: false }), 0, 4.45, 0.26, 5, 0, 0, 0.4);
    X.shape('m', SHAPES.hemi, 0, 5.35, -0.32, 0.64, 0.42, 0.62, [S.roof, PAT.SHINGLE]);
    X.shape('t', SHAPES.ico, 0, 5.82, -0.32, 0.06, 0.12, 0.06, S.accent);
    X.P(ironRailingPart(4, 0.35, true), 0, 6.02, -1.05);
  }
}

// ---------------------------------------------------------------- Modern Glass
function glass(X) {
  const { c, S } = X;
  const cap = S.trim;
  X.box(X.glass(0, 0.45), -2, 0, 0.38, 4, -0.15, -0.11, S.glass);
  X.box(X.glass(1, 0.45), 0, 2, 0.38, 4, -0.15, -0.11, S.glass);
  X.box('wd', -2, 2, 0, 0.38, -0.15, -0.09, 0x2d3e4d);
  X.box('m', -2, 2, 0.05, 0.33, -0.45, -0.16, 0x444a50);
  for (const u of [-2, 0, 2]) {
    X.box('t', u - 0.05, u + 0.05, 0, 4, -0.13, 0.02, cap, 0.012);
    X.box('t', u - 0.028, u + 0.028, 0, 4, 0.02, 0.11, cap, 0.01);
  }
  for (const v of [0.38, 4]) X.box('t', -2, 2, v - 0.04, v + 0.04, -0.13, 0.06, cap, 0.01);
  if (!c.isGround && c.level % 2 === 0) {
    for (const u of [-1, 1]) X.box('t', u - 0.025, u + 0.025, 3.45, 3.62, 0.06, 0.95, cap, 0.008);
    for (let i = 0; i < 4; i++) X.shape('t', SHAPES.box, 0, 3.55, 0.24 + i * 0.2, 4, 0.02, 0.16, cap, 0, -0.35);
  }
  if (c.isGround) {
    X.P(moldingPart('band', 4, 'base', 'm', PAT.MARBLE), 0, 0.12, 0);
    if (c.isEntrance) {
      X.P(doorPart('revolving', 2.0, 2.6), 0, 0, 0.55);
      X.P(canopyPart(3.6, 2.0, 'frame'), 0, 3.05, 0);
    }
  }
  if (c.isTop) {
    X.box('wd', -2, 2, 4, 4.9, -0.1, -0.06, 0x9cc3dd);
    X.P(moldingPart('band', 4, 'frame', 't'), 0, 4.95, -0.08);
    X.box('l', -2, 2, 4.02, 4.05, 0.07, 0.1, 0xd8ecff);
  }
}

// ---------------------------------------------------------------- Beaux-Arts
function beaux(X) {
  const { c, S } = X;
  const eL = c.cornerL ? 0.15 : 0, eR = c.cornerR ? 0.15 : 0, mid = (eR - eL) / 2, len = 4 + eL + eR;
  const rustic = [S.wall, PAT.RUSTIC];
  if (c.level <= 1) {
    if (c.isGround && c.isEntrance) {
      X.wall(-2, 2, 0, 4, -0.35, 0, [{ u: 0, v: 0, w: 2.0, h: 2.1, arch: 'round' }], rustic);
      X.P(doorPart('panel', 1.72, 2.1), 0, 0, 0);
      X.P(windowPart({ w: 2.0, h: 0.05, arch: 'round', depth: 0.35, sill: false, lintel: 'voussoir', frame: 0.05 }), 0, 2.1, 0, 0, 0, 0, 1);
    } else {
      X.wall(-2, 2, 0, 4, -0.35, 0, [{ u: 0, v: 0.7, w: 1.5, h: 1.9, arch: 'round' }], rustic);
      X.P(windowPart({ w: 1.5, h: 1.9, arch: 'round', cols: 2, rows: 2, depth: 0.35, frame: 0.05, lintel: 'voussoir' }), 0, 0.7, 0, 0);
    }
    for (const [u0, u1] of [[-2 - eL, -1.72], [1.72, 2 + eR]]) for (let v = 0; v < 4; v += 0.5) X.box('m', u0, u1, v + 0.03, v + 0.47, -0.35, 0.1, rustic, 0.04);
    if (c.isGround) X.P(moldingPart('plinth', len, 'stone'), mid, 0, 0);
    else X.P(moldingPart('string', len, 'stone'), mid, 3.9, 0.08);
  } else {
    X.wall(-2, 2, 0, 4, -0.28, 0, [{ u: 0, v: 0.85, w: 1.3, h: 2.35 }]);
    X.P(windowPart({ w: 1.3, h: 2.35, cols: 2, rows: 2, sash: true, depth: 0.28, frame: 0.06, lintel: c.level % 2 ? 'hood' : 'pediment' }), 0, 0.85, 0, 0);
    X.P(pilasterPart(4, 0.42, 0.14, 'stone', true), -1.79 - eL / 2, 0, 0);
    X.P(pilasterPart(4, 0.42, 0.14, 'stone', true), 1.79 + eR / 2, 0, 0);
    X.P(moldingPart('string', len, 'stone'), mid, 0.1, 0);
    if (c.level === 2) X.P(balconyPart(2.2, 0.55, 'stone', 'stone'), 0, 0.85, 0);
  }
  if (c.isTop) {
    X.box('m', -2 - eL, 2 + eR, 3.62, 4.05, -0.28, 0.14, [S.trim, PAT.NONE], 0.01);
    X.P(dentilPart(len, 'stone', 0.09), mid, 4.05, 0.14);
    X.P(modillionPart(len, 'stone'), mid, 4.27, 0.12);
    X.P(moldingPart('cornice', len + 0.3, 'stone'), mid, 4.5, 0);
    X.P(balustradePart(4, 0.9, 'stone'), 0, 4.58, -0.12);
  }
}

// ---------------------------------------------------------------- Neo-Gothic
function gothic(X) {
  const { c, S } = X;
  const eL = c.cornerL ? 0.35 : 0, eR = c.cornerR ? 0.35 : 0;
  if (c.isGround) {
    if (c.isEntrance) {
      X.wall(-2, 2, 0, 4, -0.4, 0, [{ u: 0, v: 0, w: 1.8, h: 1.8, arch: 'pointed' }]);
      X.P(doorPart('panel', 1.55, 1.8), 0, 0, 0);
      X.P(windowPart({ w: 1.8, h: 0.05, arch: 'pointed', depth: 0.4, sill: false, lintel: 'hood', frame: 0.05 }), 0, 1.8, 0, 0, 0, 0, 0.9);
      for (const s of [-1, 1]) for (const d of [0.04, 0.2]) X.P(columnPart('modern', 1.8, 0.055, 'stone'), s * (0.96 + d), 0, 0.06 - d * 0.3);
    } else {
      const ops = [{ u: -0.95, v: 0.6, w: 1.1, h: 1.6, arch: 'pointed' }, { u: 0.95, v: 0.6, w: 1.1, h: 1.6, arch: 'pointed' }];
      X.wall(-2, 2, 0, 4, -0.4, 0, ops);
      ops.forEach((o, k) => X.P(windowPart({ w: 1.1, h: 1.6, arch: 'pointed', cols: 2, depth: 0.4, frame: 0.05, lintel: 'hood' }), o.u, 0.6, 0, k, 0, 0, 0.85));
    }
    X.P(moldingPart('plinth', 4, 'stone'), 0, 0, 0);
  } else {
    const ops = [{ u: -0.95, v: 0.7, w: 0.95, h: 1.8, arch: 'pointed' }, { u: 0.95, v: 0.7, w: 0.95, h: 1.8, arch: 'pointed' }];
    X.wall(-2, 2, 0, 4, -0.32, 0, ops);
    ops.forEach((o, k) => {
      X.P(windowPart({ w: 0.95, h: 1.8, arch: 'pointed', cols: 2, rows: 3, depth: 0.32, frame: 0.04, lintel: 'hood' }), o.u, 0.7, 0, k);
      X.shape('m', SHAPES.torus, o.u, 0.33, 0.02, 0.16, 0.16, 1.6, S.trim);
      X.shape('m', SHAPES.torus, o.u, 0.33, 0.02, 0.08, 0.08, 1.6, S.trim);
    });
    X.box('m', -0.07, 0.07, 0, 4, 0, 0.16, X.W, 0.02);
  }
  for (const [side, e] of [[-1, eL], [1, eR]]) {
    const u0 = side < 0 ? -2 - e : 1.75, u1 = side < 0 ? -1.75 : 2 + e;
    if (e) {
      X.box('m', u0, u1, 0, 4, -0.3, 0.5, X.W, 0.02);
      X.shape('m', SHAPES.box, (u0 + u1) / 2, 3.7, 0.55, u1 - u0 + 0.02, 0.1, 0.4, [S.trim, 0], 0, 0.8);
    } else X.box('m', u0 + (side < 0 ? 0.05 : 0), u1 - (side > 0 ? 0.05 : 0), 0, 4, 0, 0.16, X.W, 0.02);
  }
  if (c.isTop) {
    X.box('m', -2, 2, 4, 4.6, -0.3, 0.12, X.W, 0.02);
    X.P(moldingPart('string', 4, 'stone'), 0, 4.0, 0.14);
    for (const u of [-1.5, -0.5, 0.5, 1.5]) X.box('m', u - 0.25, u + 0.25, 4.6, 5.0, -0.3, 0.12, X.W, 0.015);
    const spire = lathe('goth-pin', [[0.2, 0], [0.17, 0.12], [0.001, 1.6]], 8);
    for (const [side, e] of [[-1, eL], [1, eR]]) {
      if (!e) continue;
      const u = side * (2 + e / 2 - 0.12);
      X.box('m', u - 0.24, u + 0.24, 4.0, 5.6, -0.28, 0.4, X.W, 0.02);
      X.geo('m', spire, u, 5.6, 0.06, [S.trim, 0]);
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) X.shape('m', SHAPES.ico, u + s * (0.13 - i * 0.03), 5.8 + i * 0.33, 0.06, 0.05, 0.07, 0.05, S.trim);
      X.shape('m', SHAPES.ico, u, 7.25, 0.06, 0.08, 0.12, 0.08, S.trim);
    }
  }
}

// ---------------------------------------------------------------- Brutalist
function brutalist(X) {
  const { c, S } = X;
  const eL = c.cornerL ? 0.5 : 0, eR = c.cornerR ? 0.5 : 0;
  const con = [S.wall, PAT.CONCRETE], con2 = [S.trim, PAT.CONCRETE];
  if (c.isGround) {
    X.P(storefrontPart({ w: 4, h: 3.2, doors: c.isEntrance, frameMat: 't', mullions: 3 }), 0, 0, -0.75, 0, 0, 0, 0.85);
    X.box('m', -2 - eL, 2 + eR, 3.2, 4, -0.95, 0.55, con, 0.05);
    for (const u of [-1.0, 1.0]) X.box('m', u - 0.25, u + 0.25, 0, 3.2, -0.4, 0.2, con, 0.06);
  } else {
    const out = c.level % 2 === 0 ? 0.65 : 0.45;
    X.box('m', -2, 2, 0, 1.25, -0.3, out, con, 0.05);
    X.shape('m', SHAPES.box, 0, 1.32, out - 0.22, 4, 0.12, 0.45, con2, 0, 0.5);
    for (const [u, k] of [[-0.95, 0], [0.95, 1]]) X.P(windowPart({ w: 1.7, h: 2.45, cols: 2, depth: 0.55, frame: 0.05, frameMat: 't', sill: false }), u, 1.35, 0, k);
    X.box('m', -2, 2, 3.8, 4, -0.3, 0.12, con, 0.02);
    X.box('m', -0.1, 0.1, 1.25, 3.8, -0.55, 0.5, con, 0.03);
  }
  X.box('m', -2 - eL, -1.8, 0, 4, -0.55, 0.52, con, 0.05);
  X.box('m', 1.8, 2 + eR, 0, 4, -0.55, 0.52, con, 0.05);
  if (c.isTop) {
    X.box('m', -2 - eL, 2 + eR, 4, 5.1, -0.3, 0.66, con, 0.06);
    X.box('m', -2 - eL, 2 + eR, 5.1, 5.22, -0.35, 0.72, con2, 0.03);
  }
}

// ---------------------------------------------------------------- Industrial Brick
function brick(X) {
  const { c, S } = X;
  const eL = c.cornerL ? 0.14 : 0, eR = c.cornerR ? 0.14 : 0;
  const br = [S.wall, PAT.BRICK];
  if (c.isGround) {
    X.wall(-2, 2, 0, 4, -0.28, 0, [{ u: 0, v: 0, w: 3.3, h: 3.05 }], br);
    X.P(storefrontPart({ w: 3.3, h: 3.05, doors: c.isEntrance, frameMat: 't', mullions: 2 }), 0, 0, 0, 0, 0, 0, 0.85);
    X.box('t', -2, 2, 3.05, 3.38, -0.28, 0.12, [S.trim, PAT.PANEL], 0.015);
    X.P(awningPart(3.4, 1.2, 0.8, true), 0, 3.0, 0.1);
    for (const s of [-1, 1]) X.P(columnPart('castiron', 3.05, 0.085, 'iron'), s * 1.74, 0, 0.14);
  } else {
    X.wall(-2, 2, 0, 4, -0.28, 0, [{ u: 0, v: 0.7, w: 3.0, h: 2.3, arch: 'segment' }], br);
    X.P(windowPart({ w: 3.0, h: 2.3, arch: 'segment', cols: 4, rows: 3, depth: 0.28, frame: 0.04, frameMat: 't', lintel: 'voussoir' }), 0, 0.7, 0, 0);
    X.box('m', -2 - eL, -1.72, 0, 4, 0, 0.12, br, 0.01);
    X.box('m', 1.72, 2 + eR, 0, 4, 0, 0.12, br, 0.01);
  }
  if (c.isTop) {
    for (let u = -1.6; u < 1.7; u += 0.4) X.box('m', u - 0.12, u + 0.12, 3.75, 3.95, 0, 0.16, br, 0.01);
    X.box('m', -2 - eL, 2 + eR, 3.95, 4.7, -0.28, 0.16, br, 0.01);
    X.P(moldingPart('coping', 4 + eL + eR, 'stone'), (eR - eL) / 2, 4.7, 0.02);
  }
}

export const FACADES = { deco, nouveau, glass, beaux, gothic, brutalist, brick };

export function retainingWall(G, F) {
  F.rect(G.m, -2, 2, 0, 4, -0.35, 0, [0x77736c, PAT.CONCRETE]);
  F.rect(G.m, -2, 2, 3.4, 4, 0, 0.04, [0x2b2b2b, PAT.GRAVEL]);
  F.bev(G.m, -2, 2, 0, 0.35, 0, 0.18, [0x6d6a66, PAT.CONCRETE], 0.03);
}
