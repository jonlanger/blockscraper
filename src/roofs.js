// Additional roofs. Pitched roofs (mansard, hipped, gable) read their neighbors so rows of the
// same roof join into one continuous roofline across any number of blocks.
import * as THREE from 'three';
import { PAT, SHAPES, lathe, tube, foliage, extrudeShape } from './geo.js';
import { part, mtx, windowPart, ironRailingPart, glassRailingPart, columnPart } from './kit.js';
import { rbox, shrubPart, pottedPlantPart } from './props.js';
import { poolPart, loungerPart, barCounterPart, stoolPart } from './furniture.js';

const addPart = (L, p, m) => { const mm = m.clone(); for (const l of p.layers) L(l.mat, l.slot).g.addGeometry(l.geo, mm, 0xffffff); };
const WHITE = (pat = 0) => [0xffffff, pat];

// Planar-faced roof between a bottom rectangle at y0 and a top rectangle at y1.
// rect = [x0, x1, z0, z1]; sides with nb[d] true (0:+x 1:-x 2:+z 3:-z) are skipped (joined to neighbor).
function frustum(g, b, t, y0, y1, nb, color, opts = {}) {
  const cy = (y0 + y1) / 2;
  const quad = (a, bb, c, d) => {
    const n = new THREE.Vector3().subVectors(new THREE.Vector3(...bb), new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a)));
    const cen = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
    const out = n.x * cen[0] + n.y * (cen[1] - cy) + n.z * cen[2];
    if (out < 0) { g.tri(...a, ...c, ...bb, color); g.tri(...a, ...d, ...c, color); }
    else { g.tri(...a, ...bb, ...c, color); g.tri(...a, ...c, ...d, color); }
  };
  const B = (x, z) => [x, y0, z], U = (x, z) => [x, y1, z];
  if (!nb[0] || opts.all) quad(B(b[1], b[2]), B(b[1], b[3]), U(t[1], t[3]), U(t[1], t[2]));
  if (!nb[1] || opts.all) quad(B(b[0], b[2]), B(b[0], b[3]), U(t[0], t[3]), U(t[0], t[2]));
  if (!nb[2] || opts.all) quad(B(b[0], b[3]), B(b[1], b[3]), U(t[1], t[3]), U(t[0], t[3]));
  if (!nb[3] || opts.all) quad(B(b[0], b[2]), B(b[1], b[2]), U(t[1], t[2]), U(t[0], t[2]));
  if (opts.cap !== false) quad(U(t[0], t[2]), U(t[1], t[2]), U(t[1], t[3]), U(t[0], t[3]));
}
const inset = (nb, e, i) => [nb[1] ? -e : -e + i, nb[0] ? e : e - i, nb[3] ? -e : -e + i, nb[2] ? e : e - i];
const nbKey = (nb) => nb.map((v) => (v ? 1 : 0)).join('');

export const ROOFS2 = {
  mansard: (seed, nb) => part(`r:mansard:${nbKey(nb)}`, (L) => {
    const slate = L('m', 'roof', PAT.SHINGLE), trim = L('m', 'trim'), iron = L('t', 0x23272b);
    const e = 2.05;
    const b0 = inset(nb, e, 0), t0 = inset(nb, e, 0.45), t1 = inset(nb, e, 1.1);
    frustum(slate.g, b0, t0, 0, 1.7, nb, WHITE(PAT.SHINGLE), { cap: false });
    frustum(slate.g, t0, t1, 1.7, 2.25, nb, WHITE(PAT.SHINGLE));
    for (const [d, [nx, nz, ry]] of [[0, [1, 0, Math.PI / 2]], [1, [-1, 0, -Math.PI / 2]], [2, [0, 1, 0]], [3, [0, -1, Math.PI]]].map(([d, v]) => [d, v])) {
      if (nb[d]) continue;
      addPart(L, part('r:dormer', (D) => {
        const w = D('m', 'wall', PAT.STUCCO), r = D('m', 'roof', PAT.SHINGLE);
        w.bv(-0.5, 0, -0.6, 0.5, 1.0, 0.2, 0.02);
        addPart(D, windowPart({ w: 0.6, h: 0.7, arch: 'round', cols: 2, depth: 0.1, frame: 0.04, sill: false }), mtx(0, 0.12, 0.21));
        r.geo(extrudeShape('dormer-roof', () => new THREE.Shape([[-0.62, 0], [0.62, 0], [0, 0.45]].map(([x, y]) => new THREE.Vector2(x, y))), 0.85), mtx(0, 1.0, -0.2));
      }), mtx(nx * 1.72, 0.45, nz * 1.72, 0, ry, 0));
    }
    const top = inset(nb, e, 1.1);
    iron.bx(top[0], 2.25, (top[2] + top[3]) / 2 - 0.01, top[1], 2.28, (top[2] + top[3]) / 2 + 0.01);
    for (let x = top[0]; x <= top[1]; x += 0.25) iron.put(SHAPES.cone4, x, 2.4, (top[2] + top[3]) / 2, 0.03, 0.3, 0.03);
    trim.bv(b0[0], -0.05, b0[2], b0[1], 0.08, b0[3], 0.02);
  }),
  hipped: (seed, nb) => part(`r:hipped:${nbKey(nb)}`, (L) => {
    const tile = L('m', 0xb5543a, PAT.ROOFTILE), ridge = L('m', 0x8a3a24), eave = L('m', 'trim');
    const e = 2.3;
    const b0 = inset(nb, e, 0), t0 = inset(nb, e, 2.28);
    frustum(tile.g, b0, t0, 0, 1.8, nb, [0xb5543a, PAT.ROOFTILE]);
    const tx = (t0[0] + t0[1]) / 2, tz = (t0[2] + t0[3]) / 2, lx = t0[1] - t0[0], lz = t0[3] - t0[2];
    if (lx > 0.1) ridge.put(SHAPES.cyl8, tx, 1.82, tz, 0.07, lx, 0.07, 0, 0, Math.PI / 2);
    if (lz > 0.1) ridge.put(SHAPES.cyl8, tx, 1.82, tz, 0.07, lz, 0.07, Math.PI / 2, 0, 0);
    eave.bx(b0[0] + 0.25, -0.12, b0[2] + 0.25, b0[1] - 0.25, 0.02, b0[3] - 0.25);
  }),
  gable: (seed, nb) => part(`r:gable:${nbKey(nb)}`, (L) => {
    const tile = L('m', 'roof', PAT.SHINGLE), wall = L('m', 'wall', PAT.STUCCO), trim = L('m', 'trim');
    const ex = 2.0, ez = 2.3;
    const b = [nb[1] ? -ex : -ex - 0.15, nb[0] ? ex : ex + 0.15, -ez, ez], t = [b[0], b[1], -0.02, 0.02];
    frustum(tile.g, b, t, 0, 2.0, [true, true, false, false], [0xffffff, PAT.SHINGLE]);
    for (const [d, sx] of [[0, 1], [1, -1]]) {
      if (nb[d]) continue;
      wall.geo(extrudeShape('gable-end', () => new THREE.Shape([[-2.0, 0], [2.0, 0], [0, 1.95]].map(([x, y]) => new THREE.Vector2(x, y))), 0.2), mtx(sx * 1.9, 0, 0, 0, Math.PI / 2, 0));
      trim.put(SHAPES.torus, sx * 2.01, 1.0, 0, 0.28, 0.28, 0.6, 0, Math.PI / 2, 0);
      L('m', 0x2b2b2b).put(SHAPES.cyl, sx * 2.0, 1.0, 0, 0.26, 0.04, 0.26, 0, 0, Math.PI / 2);
    }
    trim.put(SHAPES.cyl8, (b[0] + b[1]) / 2, 2.02, 0, 0.07, b[1] - b[0], 0.07, 0, 0, Math.PI / 2);
  }),
  pagoda: () => part('r:pagoda', (L) => {
    const roof = L('m', 'roof', PAT.ROOFTILE), wall = L('m', 'wall'), red = L('m', 0x9a2a1e), gold = L('t', 0xd4af37);
    let y = 0;
    [[2.2, 1.5], [1.6, 1.3], [1.1, 1.2]].forEach(([hw, h], i) => {
      wall.bv(-hw * 0.62, y, -hw * 0.62, hw * 0.62, y + h * 0.55, hw * 0.62, 0.02);
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let s = -1; s <= 1; s += 2) red.put(SHAPES.cyl8, nx * hw * 0.62 + nz * s * hw * 0.5, y + h * 0.27, nz * hw * 0.62 - nx * s * hw * 0.5, 0.06, h * 0.55, 0.06);
      const g = new THREE.LatheGeometry([[hw, 0.25], [hw * 0.9, 0.08], [hw * 0.55, 0.3], [0.001, 0.7]].map(([r, yy]) => new THREE.Vector2(r * Math.SQRT2, yy)), 4).toNonIndexed();
      g.computeVertexNormals();
      roof.geo(g, mtx(0, y + h * 0.55, 0, 0, Math.PI / 4, 0));
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) gold.put(SHAPES.cone4, sx * hw * 0.98, y + h * 0.55 + 0.35, sz * hw * 0.98, 0.05, 0.3, 0.05, sz * 0.6, 0, -sx * 0.6);
      y += h;
    });
    gold.geo(lathe('pagoda-fin', [[0.1, 0], [0.06, 0.4], [0.12, 0.45], [0.05, 0.55], [0.1, 0.65], [0.03, 0.75], [0.001, 1.4]], 10), mtx(0, y - 0.3, 0));
  }),
  glasspyramid: () => part('r:glasspyr', (L) => {
    const glass = L('glass', 0xbfe3f2), steel = L('t', 0xc0c6cc);
    const g = new THREE.ConeGeometry(1.8 * Math.SQRT2, 3.0, 4, 1).toNonIndexed(); g.computeVertexNormals();
    glass.geo(g, mtx(0, 1.7, 0, 0, Math.PI / 4, 0));
    steel.bv(-1.9, 0, -1.9, 1.9, 0.2, 1.9, 0.02);
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) steel.geo(tube(`pyredge:${sx}${sz}`, [[sx * 1.8, 0.2, sz * 1.8], [0, 3.2, 0]], 0.03, 2, 6), mtx());
    for (const t of [0.25, 0.5, 0.75]) { const hw = 1.8 * (1 - t); steel.geo(lathe(`pyr-ring:${t}`, [[hw * Math.SQRT2 + 0.02, 0], [hw * Math.SQRT2 + 0.02, 0.04]], 4), mtx(0, 0.2 + 3 * t, 0, 0, Math.PI / 4, 0)); }
    for (let k = -2; k <= 2; k++) for (const [nx, nz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) steel.put(SHAPES.box, nx * 0.9 + nz * k * 0.36, 1.7, nz * 0.9 - nx * k * 0.36, 0.025, 3.25 * (1 - Math.abs(k) * 0.18), 0.025, 0, ry, 0);
  }),
  onion: () => part('r:onion', (L) => {
    const wall = L('m', 'wall', PAT.STUCCO), bulb = L('t', 'accent'), gold = L('t', 0xd4af37), trim = L('m', 'trim');
    wall.geo(lathe('on-drum', [[1.3, 0], [1.3, 1.4], [1.45, 1.5], [1.45, 1.6], [0.001, 1.6]], 28), mtx());
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; addPart(L, windowPart({ w: 0.45, h: 0.8, arch: 'round', depth: 0.1, frame: 0.03, sill: false }), mtx(Math.sin(a) * 1.35, 0.3, Math.cos(a) * 1.35, 0, a, 0)); }
    bulb.geo(lathe('on-bulb', [[1.0, 0], [1.35, 0.5], [1.4, 0.95], [1.1, 1.55], [0.55, 2.1], [0.2, 2.5], [0.06, 2.8], [0.001, 2.9]], 32), mtx(0, 1.6, 0));
    for (let k = 0; k < 12; k++) trim.geo(lathe('on-rib', [[0.03, 0], [0.03, 0.01]], 4), mtx());
    gold.geo(lathe('on-cross', [[0.08, 0], [0.12, 0.08], [0.04, 0.2], [0.04, 1.0], [0.001, 1.05]], 10), mtx(0, 4.45, 0));
    gold.bx(-0.28, 5.05, -0.03, 0.28, 5.12, 0.03);
  }),
  observatory: () => part('r:observatory', (L) => {
    const base = L('m', 'wall', PAT.STUCCO), dome = L('t', 0xe8ecef, PAT.PANEL), dark = L('m', 0x151515), scope = L('t', 0xd0d4d8);
    base.geo(lathe('obs-base', [[1.7, 0], [1.7, 1.6], [1.8, 1.7], [0.001, 1.7]], 32), mtx());
    for (const s of [-1, 1]) dome.geo(new THREE.SphereGeometry(1.75, 24, 12, s > 0 ? 0.15 : Math.PI + 0.15, Math.PI - 0.3, 0, Math.PI / 2), mtx(0, 1.7, 0));
    dark.geo(new THREE.SphereGeometry(1.7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mtx(0, 1.7, 0));
    scope.geo(lathe('obs-scope', [[0.2, 0], [0.26, 0.2], [0.24, 2.0], [0.3, 2.1], [0.001, 2.1]], 16), mtx(0, 2.2, 0, 0.7, 0, 0));
    base.bv(-0.5, 0, 1.65, 0.5, 1.2, 1.75, 0.02);
    L('glass', 0x9cc9e8).bx(-0.35, 0.2, 1.75, 0.35, 1.0, 1.77);
  }),
  greenhouse: () => part('r:greenhouse', (L) => {
    const glass = L('glass', 0xcfe9f0), frame = L('t', 0xf4f6f8), soil = L('m', 0x3b2a1e), wood = L('m', 0x8a6a4a, PAT.WOOD);
    glass.bx(-1.8, 0.3, -1.4, 1.8, 1.8, -1.38); glass.bx(-1.8, 0.3, 1.38, 1.8, 1.8, 1.4);
    glass.bx(-1.82, 0.3, -1.4, -1.8, 1.8, 1.4); glass.bx(1.8, 0.3, -1.4, 1.82, 1.8, 1.4);
    for (const s of [-1, 1]) glass.put(SHAPES.box, 0, 2.3, s * 0.72, 3.6, 0.02, 1.7, s * -0.62, 0, 0);
    glass.geo(extrudeShape('gh-end', () => new THREE.Shape([[-1.4, 0], [1.4, 0], [0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y))), 0.02), mtx(1.81, 1.8, 0, 0, Math.PI / 2, 0));
    glass.geo(extrudeShape('gh-end', () => new THREE.Shape([[-1.4, 0], [1.4, 0], [0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y))), 0.02), mtx(-1.81, 1.8, 0, 0, Math.PI / 2, 0));
    frame.bv(-1.9, 0, -1.5, 1.9, 0.3, 1.5, 0.02);
    for (let x = -1.8; x <= 1.81; x += 0.6) { for (const z of [-1.4, 1.4]) frame.bx(x - 0.025, 0.3, z - 0.025, x + 0.025, 1.8, z + 0.025); for (const s of [-1, 1]) frame.put(SHAPES.box, x, 2.3, s * 0.72, 0.04, 0.04, 1.72, s * -0.62, 0, 0); }
    frame.bx(-1.85, 2.78, -0.04, 1.85, 2.84, 0.04);
    for (const z of [-0.8, 0.8]) { wood.bv(-1.5, 0.3, z - 0.35, 1.5, 0.95, z + 0.35, 0.02); soil.bx(-1.45, 0.9, z - 0.3, 1.45, 0.93, z + 0.3); for (let i = 0; i < 6; i++) addPart(L, pottedPlantPart(i * 0.17 + z, 0.9), mtx(-1.25 + i * 0.5, 0.93, z)); }
  }),
  roofpool: (seed, nb, egg) => part(`r:roofpool:${egg ? 1 : 0}`, (L) => {
    const deck = L('m', 0x9a7a55, PAT.WOOD);
    deck.bv(-2, 0, -2, 2, 0.1, 2, 0.01);
    addPart(L, poolPart(2.8, 1.8), mtx(0, 0.1, -0.7));
    for (const x of [-1.1, 0.5]) addPart(L, loungerPart(), mtx(x, 0.1, 1.3, 0, Math.PI / 2, 0));
    addPart(L, part('r:umbrella', (U) => {
      U('t', 0xdddddd).put(SHAPES.cyl, 0, 1.1, 0, 0.025, 2.2, 0.025);
      for (let i = 0; i < 8; i++) U('m', i % 2 ? 0xf4f1ea : 0xe76f51).geo(new THREE.CylinderGeometry(0.02, 1.0, 0.35, 1, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4), mtx(0, 2.1, 0));
    }), mtx(1.5, 0.1, 1.4));
    for (const [x, z, ry] of [[0, 1.95, 0], [0, -1.95, 0], [1.95, 0, Math.PI / 2], [-1.95, 0, Math.PI / 2]]) addPart(L, glassRailingPart(3.9, 1.05), mtx(x, 0.1, z, 0, ry, 0));
    if (egg) {
      const pink = L('m', 0xff6fb5), beak = L('m', 0xf4f1ea);
      pink.put(SHAPES.torus, 0.3, 0.32, -0.7, 0.35, 0.35, 2.2, Math.PI / 2);
      pink.geo(tube('flamingo-neck', [[0.62, 0.3, -0.7], [0.75, 0.75, -0.7], [0.65, 1.05, -0.7], [0.85, 1.1, -0.7]], 0.07, 12, 8), mtx());
      pink.put(SHAPES.sphere, 0.88, 1.1, -0.7, 0.12, 0.1, 0.1);
      beak.put(SHAPES.cone4, 1.02, 1.05, -0.7, 0.04, 0.12, 0.04, 0, 0, -2.2);
    }
  }),
  roofbar: (seed) => part('r:roofbar', (L) => {
    const deck = L('m', 0x7a5236, PAT.WOOD), post = L('t', 0x2b2b2b), bulb = L('l', 0xffe2a0), wire = L('m', 0x111111);
    deck.bv(-2, 0, -2, 2, 0.1, 2, 0.01);
    addPart(L, barCounterPart(2.4), mtx(0, 0.1, -1.5, 0, 0, 0));
    for (let i = 0; i < 3; i++) addPart(L, stoolPart(), mtx(-0.8 + i * 0.8, 0.1, -0.95));
    for (const [x, z] of [[-1, 0.8], [1, 0.9]]) {
      deck.geo(lathe('rb-table', [[0.35, 0.95], [0.36, 1.0], [0.05, 1.0], [0.04, 0.1], [0.25, 0.08], [0.25, 0]], 16), mtx(x, 0.1, z));
      for (const s of [-1, 1]) addPart(L, stoolPart(), mtx(x + s * 0.55, 0.1, z));
    }
    for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [1.9, 1.9], [-1.9, 1.9]]) post.geo(lathe('rbpost', [[0.05, 0], [0.04, 2.6]], 8), mtx(x, 0.1, z));
    for (const [a, b, si] of [[[-1.9, 1.9], [1.9, -1.9], 0], [[-1.9, -1.9], [1.9, 1.9], 1]]) {
      const pts = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [a[0] + (b[0] - a[0]) * t, 2.6 - Math.sin(t * Math.PI) * 0.45, a[1] + (b[1] - a[1]) * t]; });
      wire.geo(tube(`rbw:${si}`, pts, 0.008, 16, 4), mtx());
      for (const [x, y, z] of pts) bulb.put(SHAPES.sphere, x, y - 0.06, z, 0.045, 0.06, 0.045);
    }
    for (const [x, z] of [[1.7, -1.7], [-1.7, 1.7]]) addPart(L, shrubPart(seed + x, 0.8), mtx(x, 0.1, z));
  }),
  meadow: (seed) => part(`r:meadow:${Math.floor(seed * 3)}`, (L) => {
    const grass = L('m', 0x7a9a4a, PAT.GRASS), wood = L('m', 0x8a6a4a, PAT.WOOD), hive = L('m', 0xf2d06a, PAT.WOOD), white = L('m', 0xf4f1ea);
    grass.bv(-1.95, 0, -1.95, 1.95, 0.25, 1.95, 0.03);
    for (let i = 0; i < 70; i++) {
      const a = i * 2.39996, r = Math.sqrt(i / 70) * 1.8;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(z) < 0.3) continue;
      L('m', [0xffd166, 0xffffff, 0xc77dff, 0xe63946, 0x6ad8ff][i % 5]).put(SHAPES.ico, x, 0.45 + (i % 3) * 0.06, z, 0.05, 0.04, 0.05);
      grass.put(SHAPES.cyl8, x, 0.35, z, 0.008, 0.25, 0.008);
    }
    for (let x = -1.8; x < 1.9; x += 0.45) wood.bv(x, 0.25, -0.22, x + 0.4, 0.3, 0.22, 0.01);
    for (const x of [1.2, 1.55]) { for (let i = 0; i < 3; i++) hive.bv(x - 0.16, 0.25 + i * 0.2, -1.2, x + 0.16, 0.44 + i * 0.2, -0.85, 0.01); white.bv(x - 0.19, 0.85, -1.23, x + 0.19, 0.9, -0.82, 0.01); }
  }),
  tennis: () => part('r:tennis', (L) => {
    const court = L('m', 0x3a7a5a, PAT.PANEL), line = L('m', 0xffffff), net = L('m', 0x1a1a1a), steel = L('t', 0x9aa1a6);
    court.bv(-2, 0, -2, 2, 0.1, 2, 0.01);
    L('m', 0x3a6ea5, PAT.PANEL).bx(-1.6, 0.1, -1.7, 1.6, 0.11, 1.7);
    for (const [x0, z0, x1, z1] of [[-1.6, -1.7, 1.6, -1.66], [-1.6, 1.66, 1.6, 1.7], [-1.6, -1.7, -1.56, 1.7], [1.56, -1.7, 1.6, 1.7], [-1.2, -1.0, 1.2, -0.96], [-1.2, 0.96, 1.2, 1.0], [-0.02, -1.0, 0.02, 1.0]]) line.bx(x0, 0.111, z0, x1, 0.115, z1);
    net.bx(-1.9, 0.1, -0.01, 1.9, 0.95, 0.01);
    L('m', 0xffffff).bx(-1.9, 0.92, -0.02, 1.9, 0.98, 0.02);
    for (const x of [-1.95, 1.95]) steel.put(SHAPES.cyl8, x, 0.55, 0, 0.035, 0.9, 0.035);
    for (const [x, z, ry] of [[0, 1.98, 0], [0, -1.98, 0], [1.98, 0, Math.PI / 2], [-1.98, 0, Math.PI / 2]]) {
      for (let s = -1.9; s <= 1.91; s += 0.95) steel.put(SHAPES.cyl8, x + (ry ? 0 : s), 1.6, z + (ry ? s : 0), 0.03, 3.0, 0.03);
      steel.put(SHAPES.box, x, 3.05, z, ry ? 0.03 : 3.9, 0.03, ry ? 3.9 : 0.03);
      for (let h = 0.3; h < 3.0; h += 0.2) steel.put(SHAPES.box, x, h, z, ry ? 0.004 : 3.9, 0.004, ry ? 3.9 : 0.004);
    }
    L('m', 0xd8f050).put(SHAPES.sphere, 0.6, 0.15, 0.8, 0.035, 0.035, 0.035);
  }),
  beacon: () => part('r:beacon', (L) => {
    const wall = L('m', 'wall', PAT.STUCCO), red = L('m', 0xc0392b), glass = L('glass', 0xfff2c0), iron = L('t', 0x23272b), glow = L('l', 0xfff0a0);
    wall.geo(lathe('bea-tower', [[1.3, 0], [0.95, 3.2], [1.3, 3.3], [1.3, 3.45], [0.001, 3.45]], 24), mtx());
    for (const y of [0.9, 2.1]) red.geo(lathe(`bea-band:${y}`, [[1.3 - (y / 3.2) * 0.35 + 0.01, 0], [1.3 - ((y + 0.5) / 3.2) * 0.35 + 0.01, 0.5]], 24), mtx(0, y, 0));
    addPart(L, part('bea-rail', (R) => { for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; R('t', 0x23272b).put(SHAPES.cyl8, Math.cos(a) * 1.25, 3.85, Math.sin(a) * 1.25, 0.02, 0.8, 0.02); } R('t', 0x23272b).put(SHAPES.torus, 0, 4.25, 0, 1.25, 1.25, 0.5, Math.PI / 2); }), mtx());
    glass.geo(lathe('bea-lamp', [[0.7, 0], [0.7, 1.2], [0.001, 1.2]], 16), mtx(0, 3.45, 0));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; iron.put(SHAPES.box, Math.cos(a) * 0.71, 4.05, Math.sin(a) * 0.71, 0.04, 1.2, 0.04); }
    glow.put(SHAPES.sphere, 0, 4.05, 0, 0.35, 0.35, 0.35);
    red.geo(lathe('bea-cap', [[0.85, 0], [0.8, 0.1], [0.001, 0.75]], 16), mtx(0, 4.65, 0));
    iron.geo(lathe('bea-vane', [[0.04, 0], [0.02, 0.6], [0.001, 0.62]], 8), mtx(0, 5.4, 0));
  }),
  coolingtower: () => part('r:cooling', (L) => {
    const body = L('t', 0x9aa1a6, PAT.PANEL), dark = L('m', 0x2b2b2b), fan = L('t', 0x6d7278);
    for (const x of [-1.0, 1.0]) {
      body.bv(x - 0.95, 0, -1.6, x + 0.95, 2.0, 1.6, 0.04);
      for (let y = 0.3; y < 1.8; y += 0.14) body.put(SHAPES.box, x, y, 1.62, 1.8, 0.08, 0.04, -0.6, 0, 0, 0.8);
      for (const z of [-0.8, 0.8]) {
        fan.geo(lathe(`ct-shroud`, [[0.72, 0], [0.75, 0], [0.62, 0.7], [0.66, 0.75], [0.6, 0.72], [0.57, 0.02]], 24), mtx(x, 2.0, z));
        dark.put(SHAPES.cyl, x, 2.02, z, 0.62, 0.02, 0.62);
        for (let b = 0; b < 6; b++) fan.put(SHAPES.box, x, 2.3, z, 0.55, 0.015, 0.14, 0, (b * Math.PI) / 3, 0.3);
      }
    }
  }),
};
