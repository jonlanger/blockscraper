// Structures & sculpture: skybridges, pillared loggias, statues, abstract sculpture and monument columns
// (open blocks), plus crowning statues, roof urns and obelisks (toppers). All read the block's style.
import * as THREE from 'three';
import { PAT, SHAPES, lathe, extrudeShape, tube, hash, Frame } from './geo.js';
import { part, mtx, columnPart, moldingPart, windowPart, balustradePart, archPts } from './kit.js';
import { bollardPart } from './props.js';
import { facadeContext, META } from './facades.js';
import { figurePart, family } from './ornaments.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const addPart = (L, p, m) => { const mm = m.clone(); for (const l of p.layers) L(l.mat, l.slot).g.addGeometry(l.geo, mm, 0xffffff); };
const frontRy = (sd) => (sd < 0 ? 0 : Math.atan2(DIRS[sd][0], DIRS[sd][1]));
const nbKey = (nb) => nb.map((v) => (v ? 1 : 0)).join('');
function latheSq(pts) {
  const g = new THREE.LatheGeometry(pts.map(([hw, y]) => new THREE.Vector2(Math.max(hw * Math.SQRT2, 1e-4), y)), 4).toNonIndexed();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}
const R45 = () => mtx(0, 0, 0, 0, Math.PI / 4, 0);
const URN = () => lathe('st-urn', [[0.001, 0], [0.13, 0], [0.11, 0.05], [0.07, 0.1], [0.2, 0.3], [0.22, 0.45], [0.14, 0.6], [0.16, 0.65], [0.001, 0.68]], 14);

// ---------------------------------------------------------------- skybridge
// The walkway is a 3 m core with arms out to every linked side (a solid building or another skybridge).
const BRIDGE = { beaux: 'arch', gothic: 'arch', deco: 'arch', nouveau: 'arch', mediterranean: 'arch', chicago: 'arch', brutalist: 'slab', moderne: 'slab' };

function spandrelGeo(len, arch) {
  return extrudeShape(`st:span:${len.toFixed(2)}:${arch}`, () => {
    const hw = len / 2, inner = hw - 0.28, spring = -0.85, rise = arch === 'segment' ? 0.4 : 0.62;
    const pts = [[-hw, 0.1], [hw, 0.1], [hw, -1.2], [inner, -1.2]];
    for (const [x, y] of archPts(arch, inner, rise).reverse()) pts.push([x, spring + y]);
    pts.push([-inner, -1.2], [-hw, -1.2]);
    return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  }, 0.24);
}

function bridgeWall(X, ua, ub, kind, gk) {
  const { S, F, g } = X, len = ub - ua, uc = (ua + ub) / 2, trim = [S.trim, PAT.PANEL];
  if (kind === 'truss') {
    const steel = X.style === 'solarpunk' ? 0x8a6a4a : X.style === 'castiron' ? X.colors.iron : X.style === 'brick' ? 0x3a3d40 : S.accent;
    X.box('m', ua, ub, 0.1, 0.62, -0.12, 0.05, trim, 0.02);
    X.box(gk, ua, ub, 0.62, 3.3, -0.06, -0.03, S.glass);
    const n = Math.max(1, Math.round(len / 0.75));
    for (let i = 0; i <= n; i++) { const u = ua + (i * len) / n; X.box('t', u - 0.025, u + 0.025, 0.62, 3.3, -0.08, 0.02, X.colors.frame, 0.008); }
    X.box('t', ua, ub, 1.08, 1.12, -0.08, 0, X.colors.frame);
    X.box('m', ua, ub, 3.3, 3.66, -0.12, 0.05, trim, 0.02);
    // Warren truss below the deck
    X.box('t', ua, ub, -0.9, -0.78, -0.1, 0.02, steel, 0.01);
    const m = Math.max(1, Math.round(len)), step = len / m, h = 0.88;
    for (let i = 0; i <= m; i++) X.box('t', ua + i * step - 0.03, ua + i * step + 0.03, -0.78, 0.1, -0.08, 0, steel);
    for (let i = 0; i < m; i++) g.t.addGeometry(SHAPES.box, F.matrix(ua + (i + 0.5) * step, -0.34, -0.04, (i % 2 ? 1 : -1) * Math.atan2(step, h), 0, 0.06, Math.hypot(step, h), 0.06), steel);
    if (X.style === 'solarpunk') for (let i = 0; i < n; i++) X.box('m', ua + (i + 0.2) * (len / n), ua + (i + 0.8) * (len / n), 3.66, 3.9, -0.1, 0.12, [0x4f7f3a, PAT.GRASS], 0.03);
  } else if (kind === 'arch') {
    const fam = family(X.style), arch = fam === 'gothic' ? 'pointed' : fam === 'deco' ? 'none' : 'round';
    const n = Math.max(1, Math.round(len / 1.15)), step = len / n, ow = Math.min(0.72, step - 0.34), surf = [S.wall, X.meta.pat];
    if (ow > 0.3) {
      const h = arch === 'none' ? 2.0 : arch === 'pointed' ? 1.3 : 1.55;
      const ops = Array.from({ length: n }, (_, i) => ({ u: ua + (i + 0.5) * step, v: 1.05, w: ow, h, arch }));
      X.wall(ua, ub, 0.1, 3.45, -0.24, 0, ops, surf);
      ops.forEach((o, i) => X.P(windowPart({ w: ow, h, arch, rows: 2, depth: 0.24, frame: 0.04, lintel: fam === 'gothic' ? 'hood' : arch === 'none' ? 'flat' : 'keystone' }), o.u, o.v, 0, i));
      if (fam === 'deco') for (let i = 1; i < n; i++) X.box('t', ua + i * step - 0.05, ua + i * step + 0.05, 0.3, 3.6, -0.05, 0.12, S.accent, 0.01);
    } else X.box('m', ua, ub, 0.1, 3.45, -0.24, 0, surf);
    X.box('m', ua, ub, 3.45, 3.72, -0.24, 0.12, [S.trim, PAT.ASHLAR], 0.02);
    X.P(moldingPart('crown', len + 0.02, 'stone'), uc, 3.9, 0.04);
    if (len > 1.5) X.geo('m', spandrelGeo(len, arch === 'none' ? 'segment' : arch), uc, 0, -0.12, [S.trim, PAT.ASHLAR]);
    else X.box('m', ua, ub, -0.5, 0.1, -0.24, 0, [S.trim, PAT.ASHLAR]);
    X.P(moldingPart('string', len + 0.02, 'stone'), uc, 0.1, 0.02);
  } else {
    const surf = [S.wall, X.style === 'brutalist' ? PAT.CONCRETE : PAT.STUCCO];
    X.box('m', ua, ub, -0.7, 1.15, -0.25, 0.12, surf, 0.04);
    X.box(gk, ua, ub, 1.15, 2.95, -0.1, -0.07, S.glass);
    const n = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i <= n; i++) { const u = ua + (i * len) / n; X.box('t', u - 0.03, u + 0.03, 1.15, 2.95, -0.12, -0.04, X.colors.frame); }
    X.box('m', ua, ub, 2.95, 3.75, -0.25, 0.12, surf, 0.04);
    if (X.style === 'moderne') for (const v of [0.2, 0.42, 0.64]) X.box('t', ua, ub, v, v + 0.06, 0.12, 0.16, S.trim);
  }
}

function skybridge(T, o) {
  const { x0, y0, z0, S, exposed, same, seed, styleId } = o;
  const g = T.g, cx = x0 + 2, cz = z0 + 2, H = 1.5, armC = (H + 2) / 2, ah = (2 - H) / 2;
  const kind = BRIDGE[styleId] || 'truss', gk = hash((seed * 7717) | 0, 3, 9) < 0.45 ? 'wl' : 'wd';
  const link = DIRS.map((_, d) => !exposed[d] || same[d]);
  const F = new Frame();
  const ctx = { level: Math.round(y0 / 4), isTop: false, isGround: false, street: false, isEntrance: false, seed, col: seed, cornerL: false, cornerR: false };
  const place = (p, m, colors, glass) => T.PM(p, m, colors, glass);
  const wallAt = (px, pz, nx, nz, ua, ub) => bridgeWall(facadeContext(F.set(px, y0, pz, nx, nz), S, styleId, ctx, g, place), ua, ub, kind, gk);

  const rects = [[cx - H, cx + H, cz - H, cz + H]];
  DIRS.forEach(([dx, dz], d) => {
    if (!link[d]) return wallAt(cx + dx * H, cz + dz * H, dx, dz, -H, H);
    rects.push(dx ? (dx > 0 ? [cx + H, x0 + 4, cz - H, cz + H] : [x0, cx - H, cz - H, cz + H]) : dz > 0 ? [cx - H, cx + H, cz + H, z0 + 4] : [cx - H, cx + H, z0, cz - H]);
    for (const s of [-1, 1]) wallAt(cx + dx * armC + s * dz * H, cz + dz * armC - s * dx * H, s * dz, -s * dx, -ah, ah);
    if (!exposed[d]) {
      // Portal where the walkway enters the neighboring building's wall.
      F.set(cx + dx * 2, y0, cz + dz * 2, -dx, -dz);
      F.bev(g.m, -H - 0.2, -H + 0.02, -0.2, 3.85, 0, 0.38, [S.trim, PAT.ASHLAR], 0.03);
      F.bev(g.m, H - 0.02, H + 0.2, -0.2, 3.85, 0, 0.38, [S.trim, PAT.ASHLAR], 0.03);
      F.bev(g.m, -H - 0.2, H + 0.2, 3.7, 4.0, 0, 0.42, [S.trim, PAT.ASHLAR], 0.03);
      F.rect(g[gk], -H + 0.02, H - 0.02, 0.62, 3.4, 0.3, 0.32, S.glass);
    }
  });
  for (const [a, b, c0, c1] of rects) {
    const mx = (a + b) / 2, mz = (c0 + c1) / 2, sx = b - a, sz = c1 - c0;
    g.m.box(mx, y0 + 0.36, mz, sx, 0.5, sz, [S.trim, PAT.CONCRETE]);
    g.m.box(mx, y0 + 0.625, mz, sx - 0.02, 0.03, sz - 0.02, [0x9a8a78, PAT.TILE]);
    g.m.box(mx, y0 + 3.55, mz, sx, 0.3, sz, [S.trim, PAT.CONCRETE]);
    g.m.box(mx, y0 + 3.72, mz, sx - 0.04, 0.04, sz - 0.04, [S.roof, PAT.GRAVEL]);
    g.l.box(mx, y0 + 3.39, mz, sx > sz ? sx * 0.8 : 0.2, 0.02, sz > sx ? sz * 0.8 : 0.2, 0xfff4dc);
  }
}

// ---------------------------------------------------------------- pillared loggia
// [pillar kind, arch between pillars on open sides]
const PILLAR = {
  beaux: ['corinthian', 'flat'], castiron: ['castiron', 'segment'], mediterranean: ['ionic', 'round'], nouveau: ['ionic', 'round'],
  gothic: ['clustered', 'pointed'], chicago: ['doric', 'round'], brick: ['doric', 'segment'], deco: ['deco', 'flat'],
  brutalist: ['pilotis', 'flat'], glass: ['steel', 'flat'], midcentury: ['steel', 'flat'], moderne: ['drum', 'flat'], futurist: ['vstrut', 'flat'], solarpunk: ['tree', 'flat'],
};

function pillarPart(kind, h) {
  if (['corinthian', 'ionic', 'doric', 'castiron'].includes(kind)) return columnPart(kind, h, kind === 'castiron' ? 0.12 : 0.2, kind === 'castiron' ? 'iron' : 'trim');
  return part(`st:pillar:${kind}:${h.toFixed(2)}`, (L) => {
    if (kind === 'clustered') {
      const s = L('m', 'trim', PAT.ASHLAR);
      s.bv(-0.3, 0, -0.3, 0.3, 0.3, 0.3, 0.02);
      s.put(SHAPES.cyl, 0, h / 2, 0, 0.15, h, 0.15);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; s.put(SHAPES.cyl8, Math.cos(a) * 0.16, h / 2, Math.sin(a) * 0.16, 0.07, h, 0.07); }
      s.bv(-0.3, h - 0.24, -0.3, 0.3, h, 0.3, 0.02);
      L('m', 'trim').put(SHAPES.cyl8, 0, h - 0.34, 0, 0.26, 0.08, 0.26);
    } else if (kind === 'deco') {
      const s = L('m', 'wall', PAT.ASHLAR), acc = L('t', 'accent');
      s.bv(-0.22, 0, -0.22, 0.22, h - 0.3, 0.22, 0.02);
      for (const [hw, y] of [[0.27, h - 0.3], [0.32, h - 0.15]]) s.bv(-hw, y, -hw, hw, y + 0.15, hw, 0.015);
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; for (const d of [-0.08, 0.08]) acc.put(SHAPES.box, Math.sin(a) * 0.225 + Math.cos(a) * d, h * 0.5, Math.cos(a) * 0.225 - Math.sin(a) * d, 0.025, h - 0.8, 0.02, 0, a, 0); }
    } else if (kind === 'pilotis') {
      L('m', 'wall', PAT.CONCRETE).geo(lathe(`st-pilotis:${h.toFixed(2)}`, [[0.001, 0], [0.2, 0], [0.22, h * 0.4], [0.32, h * 0.88], [0.5, h], [0.001, h]], 18), mtx());
    } else if (kind === 'steel') {
      const s = L('t', 'trim');
      s.put(SHAPES.cyl, 0, h / 2, 0, 0.1, h, 0.1);
      s.bv(-0.18, 0, -0.18, 0.18, 0.04, 0.18, 0.01);
      s.bv(-0.18, h - 0.04, -0.18, 0.18, h, 0.18, 0.01);
    } else if (kind === 'drum') {
      L('m', 'wall', PAT.STUCCO).put(SHAPES.cyl, 0, h / 2, 0, 0.28, h, 0.28);
      for (const y of [0.4, 0.58, 0.76]) L('m', 'trim').put(SHAPES.cyl, 0, y, 0, 0.3, 0.06, 0.3);
    } else if (kind === 'vstrut') {
      const s = L('m', 'wall', PAT.PANEL), led = L('l', 'accent'), len = Math.hypot(0.9, h), ang = Math.atan2(0.9, h);
      for (const sx of [-1, 1]) {
        s.put(SHAPES.box, sx * 0.45, h / 2, 0, 0.16, len, 0.3, 0, 0, -sx * ang);
        led.put(SHAPES.box, sx * 0.45, h / 2, 0.155, 0.04, len, 0.01, 0, 0, -sx * ang);
      }
      s.bv(-0.25, 0, -0.18, 0.25, 0.12, 0.18, 0.02);
    } else if (kind === 'tree') {
      const wood = L('m', 0x8a6a4a, PAT.WOOD);
      wood.geo(lathe(`st-trunk:${h.toFixed(2)}`, [[0.001, 0], [0.22, 0], [0.16, 0.4], [0.14, h * 0.6], [0.001, h * 0.6]], 12), mtx());
      const len = Math.hypot(h * 0.4, 0.8), ang = Math.atan2(0.8, h * 0.4);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4, m = new THREE.Matrix4().makeRotationY(-a).multiply(new THREE.Matrix4().makeRotationZ(-ang)).multiply(new THREE.Matrix4().makeScale(0.07, len, 0.07));
        m.setPosition(Math.cos(a) * 0.4, h * 0.8, Math.sin(a) * 0.4);
        wood.geo(SHAPES.cyl8, m);
      }
      L('m', 0x4f7f3a, PAT.GRASS).geo(lathe('st-tree-planter', [[0.001, 0.24], [0.42, 0.24], [0.42, 0], [0.3, 0], [0.001, 0]], 14), mtx());
    }
  });
}

function archBeamGeo(arch, spring) {
  return extrudeShape(`st:archbeam:${arch}:${spring}`, () => {
    const pts = [[-2, 3.98], [2, 3.98], [2, spring]];
    for (const [x, y] of archPts(arch, 1.5, arch === 'segment' ? 0.55 : 1.45).reverse()) pts.push([x, spring + y]);
    pts.push([-2, spring]);
    return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  }, 0.5);
}

const pendantPart = () => part('st:pendant', (L) => {
  L('t', 0x2b2b2b).put(SHAPES.cyl8, 0, -0.2, 0, 0.01, 0.4, 0.01);
  L('t', 0xc9a14a).geo(lathe('st-pend', [[0.001, 0.22], [0.12, 0.2], [0.16, 0.05], [0.001, 0]], 12), mtx(0, -0.62, 0));
  L('l', 0xffe2a8).put(SHAPES.sphere, 0, -0.66, 0, 0.12, 0.1, 0.12);
});

function loggia(T, o) {
  const { x0, y0, z0, S, exposed, same, styleId, above } = o;
  const g = T.g, cx = x0 + 2, cz = z0 + 2, [kind, arch] = PILLAR[styleId] || ['doric', 'flat'];
  const spring = arch === 'segment' ? 3.0 : arch === 'flat' ? 3.35 : 2.3, pat = META[styleId]?.pat ?? PAT.ASHLAR;
  const open = DIRS.map((_, d) => exposed[d] && !same[d]);
  g.m.box(cx, y0 + 0.05, cz, 4, 0.1, 4, [styleId === 'brutalist' ? S.wall : 0xc9bfae, PAT.TILE]);
  g.m.box(cx, y0 + 3.9, cz, 4, 0.16, 4, [S.trim, PAT.STUCCO]);
  for (let i = 0; i <= 4; i++) { g.m.box(x0 + i, y0 + 3.72, cz, 0.12, 0.22, 4, S.trim); g.m.box(cx, y0 + 3.72, z0 + i, 4, 0.22, 0.12, S.trim); }
  if (!above) g.m.box(cx, y0 + 4.04, cz, 4, 0.12, 4, [S.roof, PAT.GRAVEL]);
  T.P(pendantPart(), cx, y0 + 3.62, cz);
  // Pillars sit on the corners: inset from open or walled sides, exactly on edges shared with another loggia.
  for (const [sx, sz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const dX = sx ? 0 : 1, dZ = sz ? 2 : 3;
    if (!exposed[dX] && !exposed[dZ]) continue;
    const ix = same[dX] ? 0 : 0.3, iz = same[dZ] ? 0 : 0.3;
    T.P(pillarPart(kind, spring - 0.1), sx ? x0 + 4 - ix : x0 + ix, y0 + 0.1, sz ? z0 + 4 - iz : z0 + iz);
  }
  const F = new Frame();
  DIRS.forEach(([dx, dz], d) => {
    if (!open[d]) return;
    F.set(cx + dx * 2, y0, cz + dz * 2, dx, dz);
    if (arch === 'flat') {
      F.bev(g.m, -2, 2, 3.35, 3.98, -0.55, -0.02, [S.trim, pat], 0.02);
      T.PM(moldingPart('string', 4, 'stone'), F.matrix(0, 3.42, -0.02));
      if (styleId === 'deco') F.rect(g.t, -1.8, 1.8, 3.6, 3.66, -0.01, 0.0, S.accent);
    } else {
      F.geo(g.m, archBeamGeo(arch, spring), 0, 0, -0.3, [S.trim, pat]);
      if (arch === 'round') F.bev(g.m, -0.13, 0.13, spring + 1.33, spring + 1.62, -0.58, 0.0, [S.trim, PAT.ASHLAR], 0.015);
      T.PM(moldingPart('string', 4, 'stone'), F.matrix(0, 3.9, -0.04));
    }
  });
}

// ---------------------------------------------------------------- sculpture
function plinthBase(g, cx, y0, cz) {
  g.m.box(cx, y0 + 0.04, cz, 4, 0.08, 4, [0xbdb3a0, PAT.TILE]);
}

function statue(T, o) {
  const { x0, y0, z0, S, seed, sd, styleId } = o, g = T.g, cx = x0 + 2, cz = z0 + 2, fam = family(styleId);
  const granite = [0x8f8a82, PAT.ASHLAR], marble = [S.trim, PAT.MARBLE];
  plinthBase(g, cx, y0, cz);
  g.m.bevel(cx, y0 + 0.2, cz, 2.7, 0.24, 2.7, granite, 0.03);
  g.m.bevel(cx, y0 + 0.44, cz, 2.2, 0.24, 2.2, granite, 0.03);
  g.m.bevel(cx, y0 + 0.66, cz, 1.6, 0.2, 1.6, marble, 0.03);
  g.m.bevel(cx, y0 + 1.36, cz, 1.3, 1.2, 1.3, marble, 0.04);
  g.m.bevel(cx, y0 + 2.04, cz, 1.6, 0.16, 1.6, marble, 0.03);
  const [fx, fz] = sd >= 0 ? DIRS[sd] : [0, 1];
  g.t.box(cx + fx * 0.655, y0 + 1.4, cz + fz * 0.655, fx ? 0.02 : 0.64, 0.42, fz ? 0.02 : 0.64, 0xb08d57);
  const look = { classic: ['torch', 'm', 0x5f9f8a], deco: ['winged', 't', 0xd4af37], gothic: ['book', 'm', 0xe8e4da], organic: ['wreath', 't', 0x8a6a4a], modern: ['torch', 't', 0xc8ccd0] }[fam];
  const r = hash((seed * 4973) | 0, 7, 3), pose = r < 0.4 ? look[0] : ['torch', 'wreath', 'book', 'winged'][Math.floor(r * 4)];
  T.P(figurePart(pose, look[1], 'fig', look[1] === 'm' ? PAT.MARBLE : 0), cx, y0 + 2.12, cz, frontRy(sd), 'wd', 1.3, { fig: look[2] });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T.P(bollardPart(), cx + sx * 1.6, y0 + 0.08, cz + sz * 1.6);
}

const RING = new THREE.TorusGeometry(1, 0.09, 10, 48);
const abstractPart = (k) => part(`st:abstract:${k}`, (L) => {
  if (k === 0) {
    const pts = Array.from({ length: 48 }, (_, i) => { const t = (i / 48) * Math.PI * 2; return [(Math.sin(t) + 2 * Math.sin(2 * t)) * 0.42, (Math.cos(t) - 2 * Math.cos(2 * t)) * 0.42, -Math.sin(3 * t) * 0.42]; });
    L('t', 0xdfe4ea).geo(tube('st-trefoil', pts, 0.13, 180, 10, true), mtx(0, 1.95, 0));
    L('t', 0x8a9096).put(SHAPES.cyl8, 0, 0.4, 0, 0.07, 0.8, 0.07);
  } else if (k === 1) {
    L('m', 'accent').geo(RING, mtx(0, 1.6, 0));
    L('m', 0xe63946).geo(RING, mtx(0, 1.6, 0, 0, Math.PI / 2, 0.5, 0.85, 0.85, 0.85));
    L('m', 0x2a9d8f).geo(RING, mtx(0, 1.6, 0, Math.PI / 2, 0.4, 0, 0.7, 0.7, 0.7));
    L('t', 0x2b2b2b).put(SHAPES.cyl8, 0, 0.3, 0, 0.06, 0.6, 0.06);
  } else if (k === 2) {
    const stone = L('m', 0x8c8984, PAT.CONCRETE);
    let y = 0;
    [[0.8, 0.34, 0.62, 0, 0], [0.62, 0.3, 0.5, 0.14, 0.8], [0.5, 0.28, 0.42, -0.1, 1.6], [0.38, 0.22, 0.32, 0.08, 2.3], [0.24, 0.16, 0.2, 0, 2.9]].forEach(([sx, sy, sz, dx, rot]) => {
      stone.put(SHAPES.ico, dx, y + sy, 0, sx, sy, sz, 0, rot, 0.08);
      y += sy * 1.8;
    });
  } else {
    L('t', 0xeef1f4).put(SHAPES.sphere, 0, 1.2, 0, 1.45, 0.85, 1.0);
  }
});

function sculpture(T, o) {
  const { x0, y0, z0, S, seed, sd } = o, g = T.g, cx = x0 + 2, cz = z0 + 2;
  plinthBase(g, cx, y0, cz);
  g.m.bevel(cx, y0 + 0.2, cz, 2.6, 0.24, 2.6, [0x55585c, PAT.CONCRETE], 0.03);
  T.P(abstractPart(Math.floor(hash((seed * 6007) | 0, 11, 5) * 4)), cx, y0 + 0.32, cz, frontRy(sd), 'wd', 1, { accent: S.accent });
}

const monumentPart = () => part('st:monument', (L) => {
  addPart(L, columnPart('doric', 9.5, 0.42, 0xe6e0d2), mtx());
  L('m', 0xd8d0c0).geo(tube('st-helix', Array.from({ length: 60 }, (_, i) => { const t = i / 59, a = t * Math.PI * 16; return [Math.cos(a) * 0.43, 0.5 + t * 8.2, Math.sin(a) * 0.43]; }), 0.035, 240, 5), mtx());
  L('m', 0xe6e0d2).geo(lathe('st-mon-drum', [[0.5, 0], [0.5, 0.45], [0.58, 0.52], [0.58, 0.6], [0.001, 0.6]], 20), mtx(0, 9.5, 0));
  addPart(L, figurePart('winged', 't', 0xd4af37, 0), mtx(0, 10.1, 0, 0, 0, 0, 1.4, 1.4, 1.4));
});

function monument(T, o) {
  const { x0, y0, z0, sd } = o, g = T.g, cx = x0 + 2, cz = z0 + 2;
  const granite = [0x8f8a82, PAT.ASHLAR], stone = [0xe2dccd, PAT.MARBLE];
  plinthBase(g, cx, y0, cz);
  [3.4, 2.9, 2.4].forEach((s, i) => g.m.bevel(cx, y0 + 0.19 + i * 0.22, cz, s, 0.22, s, granite, 0.03));
  g.m.bevel(cx, y0 + 1.5, cz, 1.7, 1.56, 1.7, stone, 0.04);
  g.m.bevel(cx, y0 + 2.38, cz, 2.0, 0.2, 2.0, stone, 0.03);
  for (const [dx, dz] of DIRS) g.t.box(cx + dx * 0.86, y0 + 1.5, cz + dz * 0.86, dx ? 0.02 : 1.1, 0.9, dz ? 0.02 : 1.1, 0xb08d57);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T.PM(urnPart(), mtx(cx + sx * 1.25, y0 + 0.74, cz + sz * 1.25));
  T.P(monumentPart(), cx, y0 + 2.48, cz, frontRy(sd));
}
const urnPart = () => part('st:urn', (L) => L('m', 0xe2dccd, PAT.MARBLE).geo(URN(), mtx()));

export const STRUCT_OPEN = { skybridge, pillars: loggia, statue, sculpture, monument };

// ---------------------------------------------------------------- toppers
export const STRUCT_TOPPERS = {
  roofstatue: () => part('top:roofstatue', (L) => {
    const wall = L('m', 'wall', PAT.ASHLAR), trim = L('m', 'trim');
    wall.geo(lathe('rs-base', [[1.75, 0], [1.75, 0.35], [1.5, 0.42], [1.5, 0.6], [0.001, 0.6]], 32), mtx());
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; addPart(L, columnPart('ionic', 1.6, 0.08, 'trim'), mtx(Math.sin(a) * 1.28, 0.6, Math.cos(a) * 1.28)); }
    wall.put(SHAPES.cyl, 0, 1.4, 0, 0.95, 1.6, 0.95);
    trim.geo(lathe('rs-entab', [[1.45, 0], [1.45, 0.22], [1.55, 0.3], [1.55, 0.38], [0.001, 0.38]], 32), mtx(0, 2.2, 0));
    L('m', 'roof', PAT.PANEL).geo(lathe('rs-dome', Array.from({ length: 9 }, (_, i) => { const t = (i / 8) * (Math.PI / 2); return [Math.cos(t) * 1.3, Math.sin(t) * 0.9]; }), 32), mtx(0, 2.58, 0));
    trim.geo(lathe('rs-ped', [[0.36, 0], [0.36, 0.5], [0.44, 0.56], [0.44, 0.64], [0.001, 0.64]], 16), mtx(0, 3.4, 0));
    addPart(L, figurePart('winged', 't', 0xd4af37, 0), mtx(0, 4.04, 0, 0, 0, 0, 1.5, 1.5, 1.5));
  }),
  urns: (seed, nb) => part(`top:urns:${nbKey(nb)}`, (L) => {
    const post = L('m', 'trim', PAT.ASHLAR), urn = L('m', 'trim'), gold = L('t', 0xd4af37);
    const EDGE = [[1.82, 0, Math.PI / 2], [-1.82, 0, Math.PI / 2], [0, 1.82, 0], [0, -1.82, 0]];
    const posts = [];
    nb.forEach((joined, d) => {
      if (joined) return;
      const [x, z, ry] = EDGE[d];
      addPart(L, balustradePart(4, 0.9, 'trim'), mtx(x, 0, z, 0, ry, 0));
      posts.push([x, z]);
    });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (!nb[sx > 0 ? 0 : 1] && !nb[sz > 0 ? 2 : 3]) posts.push([sx * 1.82, sz * 1.82]);
    for (const [x, z] of posts) {
      post.bv(x - 0.2, 0, z - 0.2, x + 0.2, 1.05, z + 0.2, 0.02);
      urn.geo(URN(), mtx(x, 1.05, z));
      gold.put(SHAPES.cone8, x, 1.8, z, 0.05, 0.16, 0.05);
    }
  }),
  obelisk: () => part('top:obelisk', (L) => {
    const base = L('m', 'trim', PAT.ASHLAR), shaft = L('m', 'wall', PAT.MARBLE), gold = L('t', 0xd4af37);
    base.bv(-1.2, 0, -1.2, 1.2, 0.3, 1.2, 0.03);
    base.bv(-0.95, 0.3, -0.95, 0.95, 0.6, 0.95, 0.03);
    base.bv(-0.7, 0.6, -0.7, 0.7, 1.5, 0.7, 0.03);
    base.bv(-0.82, 1.5, -0.82, 0.82, 1.62, 0.82, 0.02);
    shaft.geo(latheSq([[0.5, 0], [0.34, 6.4], [0.001, 6.4]]), R45().setPosition(0, 1.62, 0));
    gold.geo(latheSq([[0.34, 0], [0.001, 0.5]]), R45().setPosition(0, 8.02, 0));
    gold.bv(-0.52, 1.62, -0.52, 0.52, 1.7, 0.52, 0.01);
    for (const [nx, nz] of DIRS) for (let i = 0; i < 5; i++) gold.put(SHAPES.box, nx * (0.49 - i * 0.03), 2.4 + i * 1.0, nz * (0.49 - i * 0.03), nx ? 0.01 : 0.12, 0.3, nz ? 0.01 : 0.12);
  }),
};
