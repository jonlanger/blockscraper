// Parks & plazas: ground-level open blocks that tile seamlessly into parks of any size.
// Edges (fences, hedges, curbs) only appear where the park meets something else.
import * as THREE from 'three';
import { PAT, SHAPES, lathe, tube, foliage, extrudeShape, extrudeProfile, rng } from './geo.js';
import { part, mtx, ironRailingPart, columnPart } from './kit.js';
import { treePart, shrubPart, pottedPlantPart, lampPostPart, benchPart, trashCanPart, hydrantPart, bollardPart, rbox, GREENS } from './props.js';
import { anyTreePart, dogPart, duckPart, planterBoxPart, bikeRackPart } from './props2.js';
import { fountainPart, sculpturePart } from './furniture.js';
import { WORLD_PARKS, buildWorldPark } from './worldparks.js';

const EDGE = [[3.9, 2, Math.PI / 2], [0.1, 2, Math.PI / 2], [2, 3.9, 0], [2, 0.1, 0]];
const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const FLOWERS = [0xe63946, 0xf4a261, 0xffffff, 0xc77dff, 0xff6fb5, 0xffd166];

// ---------- edges ----------
const curbPart = () => part('pk-curb', (L) => L('m', 0x9a968e, PAT.ASHLAR).bv(-2, 0, -0.12, 2, 0.32, 0.12, 0.03));
const hedgePart = (h = 0.9) => part(`pk-hedge:${h}`, (L) => {
  const g = L('m', 0x3f6f35, PAT.GRASS);
  g.geo(rbox(4, h, 0.6, 0.18), mtx(0, h / 2, 0));
  for (let i = 0; i < 6; i++) g.geo(foliage(i * 0.13), mtx(-1.7 + i * 0.68, h, 0, 0, i, 0, 0.36, 0.14, 0.3));
});
const chainFencePart = (h = 2.4) => part(`pk-chain:${h}`, (L) => {
  const s = L('t', 0x9aa1a6);
  for (const x of [-2, 0, 2]) s.geo(lathe(`cfpost:${h}`, [[0.04, 0], [0.04, h], [0.05, h + 0.03], [0.001, h + 0.06]], 8), mtx(x, 0, 0));
  s.put(SHAPES.cyl8, 0, h - 0.05, 0, 0.025, 4, 0.025, 0, 0, Math.PI / 2);
  for (let x = -1.95; x < 2; x += 0.12) s.put(SHAPES.box, x, h / 2, 0, 0.006, h - 0.1, 0.006, 0, 0, 0.5);
  for (let x = -1.95; x < 2; x += 0.12) s.put(SHAPES.box, x, h / 2, 0.005, 0.006, h - 0.1, 0.006, 0, 0, -0.5);
});
const picketPart = () => part('pk-picket', (L) => {
  const w = L('m', 0xf4f1ea, PAT.WOOD);
  w.bx(-2, 0.35, -0.02, 2, 0.43, 0.02); w.bx(-2, 0.8, -0.02, 2, 0.88, 0.02);
  for (let x = -1.94; x < 2; x += 0.16) { w.bx(x - 0.04, 0, 0.02, x + 0.04, 1.0, 0.05); w.put(SHAPES.cone4, x, 1.06, 0.035, 0.057, 0.12, 0.02, 0, Math.PI / 4, 0); }
});
const bambooPart = () => part('pk-bamboo', (L) => {
  const b = L('m', 0xc9b27a), tie = L('m', 0x3a2a1e);
  for (let x = -1.95; x < 2; x += 0.09) b.geo(lathe('bamboo', [[0.04, 0], [0.04, 1.45], [0.045, 1.5], [0.035, 1.5]], 6), mtx(x, 0, 0));
  for (const y of [0.5, 1.2]) tie.put(SHAPES.cyl8, 0, y, 0, 0.03, 4, 0.03, 0, 0, Math.PI / 2);
});

// ---------- playground & sport ----------
const swingPart = () => part('pk-swing', (L) => {
  const f = L('t', 0x2a9d8f), seat = L('m', 0xe63946), chain = L('t', 0x9aa1a6);
  for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) f.put(SHAPES.cyl8, s * 1.1, 1.1, z * 0.6, 0.05, 2.35, 0.05, z * 0.45, 0, 0);
  f.put(SHAPES.cyl8, 0, 2.2, 0, 0.06, 2.3, 0.06, 0, 0, Math.PI / 2);
  for (const x of [-0.5, 0.5]) { for (const dz of [-0.14, 0.14]) chain.put(SHAPES.cyl8, x, 1.4, dz, 0.01, 1.6, 0.01); seat.geo(rbox(0.45, 0.05, 0.3, 0.02), mtx(x, 0.6, 0)); }
});
const slidePart = () => part('pk-slide', (L) => {
  const d = L('t', 0x3a6ea5), s = L('t', 0xf2c14e);
  for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) d.put(SHAPES.cyl8, x, 0.8, z, 0.04, 1.6, 0.04);
  d.bv(-0.4, 1.55, -0.4, 0.4, 1.62, 0.4, 0.01);
  for (let i = 0; i < 5; i++) d.bx(-0.25, 0.3 + i * 0.3, -0.75 + i * 0.06, 0.25, 0.34 + i * 0.3, -0.55 + i * 0.06);
  const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push([0.4 + t * 1.8, 1.6 - 1.45 * (t < 0.85 ? t / 0.85 : 1) + 0.0]); }
  s.geo(tube('slide-path', prof.map(([z, y]) => [0, y, z]), 0.28, 16, 8), mtx(0, 0, 0, 0, 0, 0, 1, 1, 1));
});
const domePart = () => part('pk-dome', (L) => {
  const s = L('t', 0xe76f51);
  for (let k = 0; k < 8; k++) s.put(new THREE.TorusGeometry(1.0, 0.03, 6, 24, Math.PI), 0, 0, 0, 1, 1, 1, 0, (k / 8) * Math.PI, 0);
  for (const y of [0.35, 0.7]) { const r = Math.sqrt(1 - y * y); s.put(SHAPES.torus, 0, y, 0, r, r, 0.5, Math.PI / 2); }
});
const hoopPart = () => part('pk-hoop', (L) => {
  const p = L('t', 0x2b2e33), bb = L('m', 0xffffff), rim = L('t', 0xe76f51);
  p.geo(lathe('hooppole', [[0.1, 0], [0.08, 3.2]], 10), mtx());
  p.put(SHAPES.box, 0, 3.1, 0.3, 0.06, 0.06, 0.7);
  bb.bv(-0.6, 2.8, 0.62, 0.6, 3.5, 0.66, 0.01);
  L('m', 0xe76f51).bx(-0.2, 3.0, 0.665, 0.2, 3.25, 0.67);
  rim.put(SHAPES.torus, 0, 3.05, 0.9, 0.22, 0.22, 0.4, Math.PI / 2);
  L('m', 0xf4f1ea).geo(lathe('net', [[0.22, 0], [0.15, -0.35]], 10), mtx(0, 3.05, 0.9));
});

// ---------- water & garden ----------
const pondPart = (seed) => part(`pk-pond:${Math.floor(seed * 3)}`, (L) => {
  const k = Math.floor(seed * 3), R = rng(0.3 + k * 0.2);
  const rock = L('m', 0x8a8580, PAT.ASHLAR), water = L('glass', 0x3f7fa0), bed = L('m', 0x3a4a3a), pad = L('m', 0x4f8a3a), reed = L('m', 0xa89a60), bloom = L('m', 0xffc8e0);
  bed.put(SHAPES.cyl, 0, 0.02, 0, 1.75, 0.02, 1.55);
  water.put(SHAPES.cyl, 0, 0.14, 0, 1.7, 0.02, 1.5);
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; rock.geo(foliage(i * 0.07), mtx(Math.cos(a) * 1.8, 0.14, Math.sin(a) * 1.6, 0, i, 0, 0.18 + R() * 0.1, 0.12, 0.16)); }
  for (let i = 0; i < 6; i++) { const x = (R() - 0.5) * 2.2, z = (R() - 0.5) * 1.8; pad.put(SHAPES.cyl, x, 0.16, z, 0.16, 0.01, 0.16); if (i % 2) bloom.put(SHAPES.ico, x, 0.2, z, 0.05, 0.04, 0.05); }
  for (let c = 0; c < 3; c++) { const a = R() * 6.28; for (let i = 0; i < 8; i++) reed.put(SHAPES.cyl8, Math.cos(a) * 1.55 + (R() - 0.5) * 0.3, 0.55, Math.sin(a) * 1.35 + (R() - 0.5) * 0.3, 0.012, 0.9 + R() * 0.4, 0.012, (R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.2); }
});
const bridgePart = () => part('pk-bridge', (L) => {
  const w = L('m', 0x8a5a34, PAT.WOOD), rail = L('m', 0x6b4a33, PAT.WOOD);
  const arc = (t) => Math.sin(t * Math.PI) * 0.6;
  for (let i = 0; i < 14; i++) { const t = i / 13; w.put(SHAPES.box, -2 + t * 4, 0.2 + arc(t), 0, 0.28, 0.06, 1.0, 0, 0, Math.cos(t * Math.PI) * -0.45); }
  for (const z of [-0.5, 0.5]) {
    rail.geo(tube(`brrail:${z}`, Array.from({ length: 9 }, (_, i) => [-2 + (i / 8) * 4, 1.05 + arc(i / 8), z]), 0.035, 16, 6), mtx());
    for (let i = 0; i < 7; i++) { const t = i / 6; rail.put(SHAPES.cyl8, -2 + t * 4, 0.62 + arc(t), z, 0.03, 0.85, 0.03); }
  }
});
const raisedBedPart = (seed) => part(`pk-bed:${Math.floor(seed * 4)}`, (L) => {
  const k = Math.floor(seed * 4), wood = L('m', 0x8a6a4a, PAT.WOOD), soil = L('m', 0x3b2a1e, PAT.GRAVEL);
  wood.bv(-0.7, 0, -0.35, 0.7, 0.4, 0.35, 0.02);
  soil.bx(-0.64, 0.36, -0.29, 0.64, 0.39, 0.29);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const x = -0.48 + i * 0.32, z = -0.13 + j * 0.26;
    if (k === 0) L('m', 0x7cb342, PAT.GRASS).geo(foliage(i * 0.1 + j), mtx(x, 0.46, z, 0, i, 0, 0.12, 0.09, 0.12));
    else if (k === 1) { L('m', 0x3f7a2e).put(SHAPES.cyl8, x, 0.7, z, 0.01, 0.6, 0.01); L('m', 0xe63946).put(SHAPES.sphere, x + 0.04, 0.6, z, 0.045, 0.045, 0.045); L('m', 0x4f7f3a, PAT.GRASS).geo(foliage(i), mtx(x, 0.8, z, 0, 0, 0, 0.1, 0.18, 0.1)); }
    else if (k === 2) { L('m', 0xf4a261).put(SHAPES.cone8, x, 0.38, z, 0.03, 0.14, 0.03, Math.PI); L('m', 0x5e8c41).put(SHAPES.cone4, x, 0.55, z, 0.04, 0.22, 0.04); }
    else { L('m', 0x3f7a2e).put(SHAPES.cyl8, x, 0.9, z, 0.018, 1.0, 0.018); L('m', 0xffd166).put(SHAPES.cyl, x, 1.42, z + 0.03, 0.14, 0.03, 0.14, 1.2); L('m', 0x3a2418).put(SHAPES.cyl, x, 1.42, z + 0.05, 0.06, 0.03, 0.06, 1.2); }
  }
});
const shedPart = () => part('pk-shed', (L) => {
  const w = L('m', 0x7a9a8a, PAT.TIMBER), roof = L('m', 0x5a3a2a, PAT.SHINGLE), door = L('m', 0xf4f1ea, PAT.WOOD);
  w.bv(-0.7, 0, -0.55, 0.7, 1.9, 0.55, 0.02);
  roof.put(SHAPES.box, 0, 2.05, -0.3, 1.7, 0.08, 0.8, 0.5, 0, 0);
  roof.put(SHAPES.box, 0, 2.05, 0.3, 1.7, 0.08, 0.8, -0.5, 0, 0);
  w.geo(extrudeShape('shedgable', () => shape([[-0.55, 0], [0.55, 0], [0, 0.35]]), 1.4), mtx(0, 1.9, 0, 0, Math.PI / 2, 0));
  door.bv(-0.3, 0, 0.55, 0.3, 1.6, 0.58, 0.01);
});

// ---------- dogs, amphitheater, food, skate, zen ----------
const agilityPart = () => part('pk-agility', (L) => {
  const r = L('m', 0xe76f51), b = L('m', 0x3a6ea5), y = L('m', 0xf2c14e);
  r.put(SHAPES.box, -0.45, 0.55, 0, 1.2, 0.04, 0.8, 0, 0, 0.95);
  r.put(SHAPES.box, 0.45, 0.55, 0, 1.2, 0.04, 0.8, 0, 0, -0.95);
  b.geo(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 16, 1, true), mtx(0, 0.3, 1.4, 0, 0, Math.PI / 2));
  for (let i = 0; i < 6; i++) y.put(SHAPES.cyl8, -1.2 + i * 0.35, 0.45, -1.3, 0.02, 0.9, 0.02);
});
const amphiPart = () => part('pk-amphi', (L) => {
  const st = L('m', 0xc9c0b0, PAT.ASHLAR), stage = L('m', 0x8a5a34, PAT.WOOD);
  for (let t = 0; t < 4; t++) {
    const r0 = 1.9 + t * 0.55, r1 = r0 + 0.55;
    st.geo(extrudeShape(`amph:${t}`, () => { const s = new THREE.Shape(); s.absarc(0, 0, r1, Math.PI * 0.05, Math.PI * 0.95, false); s.absarc(0, 0, r0, Math.PI * 0.95, Math.PI * 0.05, true); return s; }, 0.25 + t * 0.25), mtx(0, (0.25 + t * 0.25) / 2, 0, -Math.PI / 2, 0, 0));
  }
  stage.bv(-1.4, 0, -0.6, 1.4, 0.35, 0.8, 0.02);
  L('m', 0xe8e4da).geo(new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI, 0, Math.PI / 2), mtx(0, 0.35, 0.1, 0, Math.PI, 0, 1, 1.3, 0.7));
});
const foodTruckPart = (seed) => part(`pk-ftruck:${Math.floor(seed * 4)}`, (L) => {
  const k = Math.floor(seed * 4), paint = L('t', [0xe76f51, 0x2a9d8f, 0xf2c14e, 0xc77dff][k], PAT.PANEL), dark = L('m', 0x151515), steel = L('t', 0xc0c6cc), glow = L('l', 0xfff0c8), awn = L('m', 0xf4f1ea);
  paint.geo(rbox(3.4, 2.2, 1.9, 0.2), mtx(0, 1.5, 0));
  dark.bx(-1.1, 1.3, 0.94, 0.9, 2.1, 0.96);
  glow.bx(-1.0, 1.35, 0.955, 0.8, 2.0, 0.96);
  steel.bv(-1.15, 1.2, 0.95, 0.95, 1.28, 1.3, 0.01);
  awn.put(SHAPES.box, -0.1, 2.35, 1.3, 2.3, 0.04, 0.8, -0.35, 0, 0);
  for (const x of [1.1, -1.1]) for (const z of [-0.85, 0.85]) { dark.put(SHAPES.cyl, x, 0.38, z, 0.36, 0.22, 0.36, Math.PI / 2); steel.put(SHAPES.cyl, x, 0.38, z + Math.sign(z) * 0.08, 0.2, 0.1, 0.2, Math.PI / 2); }
  L('l', [0xffd166, 0x7cff9a, 0xff6fb5, 0x6ad8ff][k]).bv(-0.8, 2.6, 0.4, 0.8, 2.95, 0.5, 0.01);
});
const picnicPart = () => part('pk-picnic', (L) => {
  const w = L('m', 0x8a5a34, PAT.WOOD);
  w.bv(-0.9, 0.72, -0.4, 0.9, 0.78, 0.4, 0.01);
  for (const z of [-0.7, 0.7]) w.bv(-0.9, 0.42, z - 0.14, 0.9, 0.47, z + 0.14, 0.01);
  for (const x of [-0.6, 0.6]) { w.put(SHAPES.box, x, 0.38, 0.35, 0.08, 0.9, 0.08, 0.7, 0, 0); w.put(SHAPES.box, x, 0.38, -0.35, 0.08, 0.9, 0.08, -0.7, 0, 0); }
});
const stringLightsPart = () => part('pk-strings', (L) => {
  const p = L('t', 0x2b2b2b), bulb = L('l', 0xffe2a0), wire = L('m', 0x111111);
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [1.8, 1.8], [-1.8, 1.8]]) p.geo(lathe('slpost', [[0.06, 0], [0.05, 3.2]], 8), mtx(x, 0, z));
  const spans = [[[-1.8, -1.8], [1.8, 1.8]], [[1.8, -1.8], [-1.8, 1.8]], [[-1.8, -1.8], [1.8, -1.8]], [[-1.8, 1.8], [1.8, 1.8]]];
  spans.forEach(([[ax, az], [bx, bz]], si) => {
    const pts = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [ax + (bx - ax) * t, 3.1 - Math.sin(t * Math.PI) * 0.5, az + (bz - az) * t]; });
    wire.geo(tube(`slw:${si}`, pts, 0.008, 16, 4), mtx());
    pts.forEach(([x, y, z], i) => { if (i % 1 === 0) bulb.put(SHAPES.sphere, x, y - 0.07, z, 0.045, 0.06, 0.045); });
  });
});
const quarterPipePart = () => part('pk-qpipe', (L) => {
  const c = L('m', 0xb8b4ac, PAT.CONCRETE), coping = L('t', 0x9aa1a6);
  const prof = [[0, 0]]; for (let i = 0; i <= 10; i++) { const a = (i / 10) * (Math.PI / 2); prof.push([1.4 - Math.sin(a) * 1.4, 1.4 - Math.cos(a) * 1.4]); } prof.push([0, 1.4]);
  c.geo(extrudeShape('qpipe', () => shape(prof.map(([x, y]) => [x, y])), 3.8), mtx(0, 0, 0, 0, Math.PI / 2, 0));
  coping.put(SHAPES.cyl8, 0, 1.4, 0, 0.04, 3.8, 0.04, Math.PI / 2, 0, 0);
});
const skateGearPart = () => part('pk-skate', (L) => {
  const c = L('m', 0xa8a49c, PAT.CONCRETE), s = L('t', 0xc0c6cc), tag = L('m', 0xff3ea5);
  c.bv(-0.8, 0, -0.6, 0.8, 0.45, 0.6, 0.03);
  c.put(SHAPES.box, -1.15, 0.22, 0, 0.8, 0.05, 1.2, 0, 0, 0.55);
  c.put(SHAPES.box, 1.15, 0.22, 0, 0.8, 0.05, 1.2, 0, 0, -0.55);
  s.put(SHAPES.cyl8, 0, 0.5, 1.4, 0.035, 3.0, 0.035, 0, 0, Math.PI / 2);
  for (const x of [-1.3, 1.3]) s.bx(x - 0.02, 0, 1.38, x + 0.02, 0.5, 1.42);
  tag.bx(-0.5, 0.15, 0.605, 0.3, 0.35, 0.61);
});
const lanternPart = () => part('pk-lantern', (L) => {
  const s = L('m', 0x9a968e, PAT.ASHLAR), glow = L('l', 0xffd8a0);
  s.geo(lathe('zen-l', [[0.25, 0], [0.22, 0.08], [0.08, 0.12], [0.07, 0.6], [0.2, 0.66], [0.2, 0.72]], 6), mtx());
  glow.bx(-0.14, 0.72, -0.14, 0.14, 0.98, 0.14);
  for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) s.bx(x - 0.03, 0.72, z - 0.03, x + 0.03, 0.98, z + 0.03);
  s.geo(lathe('zen-roof', [[0.38, 0], [0.36, 0.05], [0.12, 0.2], [0.05, 0.3], [0.08, 0.36], [0.001, 0.42]], 6), mtx(0, 0.98, 0));
});
const rakedPart = () => part('pk-raked', (L) => {
  const g = L('m', 0xd8d2c2);
  for (let z = -1.9; z < 2; z += 0.16) g.put(SHAPES.cyl8, 0, 0.005, z, 0.02, 4, 0.02, 0, 0, Math.PI / 2);
  for (const r of [0.55, 0.72, 0.89]) g.put(SHAPES.torus, 0.6, 0.02, -0.4, r, r, 0.3, Math.PI / 2);
});
const rockPart = (seed) => part(`pk-rock:${Math.floor(seed * 4)}`, (L) => {
  const r = L('m', 0x6d6a66, PAT.ASHLAR), moss = L('m', 0x5e8c41, PAT.GRASS);
  r.geo(foliage(seed + 0.5), mtx(0, 0.25, 0, 0.3, seed * 6, 0.2, 0.55, 0.4, 0.4));
  moss.geo(foliage(seed + 0.9), mtx(0.05, 0.5, 0, 0, 0, 0, 0.3, 0.08, 0.25));
});
const topiaryPart = (kind) => part(`pk-topiary:${kind}`, (L) => {
  const pot = L('m', 0xb0714a), g = L('m', 0x3f6f35, PAT.GRASS);
  pot.geo(lathe('tpot', [[0.18, 0], [0.24, 0.35], [0.26, 0.4], [0.2, 0.4]], 12), mtx());
  if (kind === 0) g.put(SHAPES.cone8, 0, 1.1, 0, 0.35, 1.4, 0.35);
  else { g.put(SHAPES.sphere, 0, 0.75, 0, 0.35, 0.35, 0.35); g.put(SHAPES.cyl8, 0, 1.15, 0, 0.04, 0.4, 0.04); g.put(SHAPES.sphere, 0, 1.45, 0, 0.22, 0.22, 0.22); }
});
export const grandFountainPart = () => part('pk-grandfountain', (L) => {
  const st = L('m', 0xd8d2c8, PAT.MARBLE), water = L('glass', 0x5fb8e0), jet = L('l', 0xcfefff), gold = L('t', 0xd4af37);
  st.geo(lathe('gf-basin', [[1.95, 0], [2.0, 0.08], [2.0, 0.5], [1.9, 0.55], [1.85, 0.15], [0.001, 0.15]], 40), mtx());
  water.put(SHAPES.cyl, 0, 0.42, 0, 1.86, 0.02, 1.86);
  st.geo(lathe('gf-tier', [[0.45, 0], [0.25, 0.3], [0.2, 1.0], [0.95, 1.15], [1.0, 1.25], [0.9, 1.28], [0.2, 1.24], [0.15, 1.8], [0.55, 1.95], [0.58, 2.02], [0.5, 2.04], [0.12, 2.0], [0.1, 2.3]], 28), mtx(0, 0.15, 0));
  water.put(SHAPES.cyl, 0, 1.38, 0, 0.9, 0.02, 0.9);
  water.put(SHAPES.cyl, 0, 2.15, 0, 0.5, 0.02, 0.5);
  gold.geo(lathe('gf-statue', [[0.14, 0], [0.12, 0.25], [0.18, 0.5], [0.1, 0.7], [0.12, 0.8], [0.001, 0.92]], 12), mtx(0, 2.45, 0));
  gold.put(SHAPES.cyl8, 0.12, 3.25, 0, 0.02, 0.5, 0.02, 0, 0, -0.5);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; jet.geo(tube(`gfjet:${k}`, [[Math.cos(a) * 1.9, 0.5, Math.sin(a) * 1.9], [Math.cos(a) * 1.5, 1.0, Math.sin(a) * 1.5], [Math.cos(a) * 1.15, 0.45, Math.sin(a) * 1.15]], 0.025, 10, 4), mtx()); }
  jet.geo(lathe('gf-jet', [[0.04, 0], [0.02, 0.8], [0.001, 0.9]], 8), mtx(0, 3.35, 0));
});
export const foodCartPart = (seed) => part(`pk-cart:${Math.floor(seed * 3)}`, (L) => {
  const k = Math.floor(seed * 3), steel = L('t', 0xc0c6cc, PAT.PANEL), tire = L('m', 0x151515), umb = L('m', [0xe63946, 0xf2c14e, 0x2a9d8f][k]), umb2 = L('m', 0xf4f1ea);
  steel.geo(rbox(1.4, 0.8, 0.7, 0.05), mtx(0, 0.7, 0));
  for (const x of [-0.5, 0.5]) tire.put(SHAPES.torus, x, 0.25, 0.38, 0.2, 0.2, 0.8, 0, 0, 0);
  steel.put(SHAPES.cyl8, 0, 1.6, 0, 0.02, 1.8, 0.02);
  for (let i = 0; i < 8; i++) (i % 2 ? umb : umb2).geo(lathe(`cartumb:${i}`, [[0.9, 0], [0.001, 0.35]], 1), mtx(0, 2.3, 0, 0, (i / 8) * Math.PI * 2, 0));
  umb.geo(lathe('cartumb-full', [[0.9, 0], [0.001, 0.35]], 16), mtx(0, 2.3, 0));
  L('l', 0xffd166).bx(-0.6, 1.02, 0.36, 0.6, 1.1, 0.37);
});

// ---------- builder ----------
export function buildPark(T, id, x0, y0, z0, seed, exposed, egg, ctx) {
  const cx = x0 + 2, cz = z0 + 2, top = y0 + 0.2;
  if (WORLD_PARKS.has(id)) {
    buildWorldPark(T, id, x0, y0, z0, seed, exposed, ctx.city, ctx.c);
    if (egg?.type === 'foodcart') T.P(foodCartPart(seed), x0 + 2.6, top, z0 + 2.6, seed * 6, 'wd');
    return;
  }
  const R = rng(seed + 0.17);
  const base = (col, pat) => T.g.m.box(cx, y0 + 0.1, cz, 4, 0.2, 4, [col, pat]);
  const edges = (fn) => exposed.forEach((e, d) => { if (e) { const [ex, ez, ry] = EDGE[d]; T.P(fn(d), x0 + ex, top, z0 + ez, ry); } });
  const P = (p, x, z, ry = 0, s = 1, col, y = top) => T.P(p, x0 + x, y, z0 + z, ry, 'wd', s, col);
  const strip = (along, col, pat, w = 1.0, off = 2) => T.g.m.box(along ? cx : x0 + off, top + 0.012, along ? z0 + off : cz, along ? 4 : w, 0.02, along ? w : 4, [col, pat]);
  const species = Math.floor(R() * 6);

  switch (id) {
    case 'lawnpark': {
      base(0x6f9a4f, PAT.GRASS);
      const along = R() < 0.5;
      strip(along, 0xcfc4a8, PAT.GRAVEL, 1.2);
      P(anyTreePart(R(), 1.1 + R() * 0.5, species), along ? 1.0 : 0.9, along ? 0.9 : 1.0, R() * 6);
      if (R() < 0.6) P(anyTreePart(R(), 0.9 + R() * 0.4, Math.floor(R() * 6)), 3.1, 3.1, R() * 6);
      P(benchPart(), along ? 2.6 : 1.35, along ? 1.35 : 2.6, along ? 0 : Math.PI / 2);
      if (R() < 0.35) P(lampPostPart(), along ? 3.6 : 1.3, along ? 1.3 : 0.4, 0);
      if (R() < 0.4) P(shrubPart(R(), 1.1), 3.2, along ? 3.4 : 0.8);
      edges(() => curbPart());
      break;
    }
    case 'formalgarden':
      base(0xd8cfb8, PAT.GRAVEL);
      for (const [x, z, ry] of [[2, 0.85, 0], [2, 3.15, 0], [0.85, 2, Math.PI / 2], [3.15, 2, Math.PI / 2]]) P(part('pk-minihedge', (L) => L('m', 0x3f6f35, PAT.GRASS).geo(rbox(1.6, 0.55, 0.35, 0.12), mtx(0, 0.28, 0))), x, z, ry);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; T.g.m.box(cx + Math.cos(a) * 0.6, top + 0.1, cz + Math.sin(a) * 0.6, 0.16, 0.2, 0.16, [FLOWERS[i % 6], 0]); }
      P(topiaryPart(1), 2, 2);
      for (const [x, z] of [[0.6, 0.6], [3.4, 0.6], [0.6, 3.4], [3.4, 3.4]]) P(topiaryPart(0), x, z);
      edges(() => hedgePart(1.0));
      break;
    case 'plaza':
      base(0xc9c0b0, PAT.ASHLAR);
      P(planterBoxPart(R()), 1.2, 1.2, R() < 0.5 ? 0 : Math.PI / 2);
      if (R() < 0.6) P(anyTreePart(R(), 0.9, species === 3 ? 3 : 0), 3.0, 3.0);
      else P(pottedPlantPart(R(), 1.8), 3.0, 3.0);
      P(benchPart(), 2.7, 1.1, Math.PI);
      if (R() < 0.4) P(bollardPart(), 0.4, 3.6);
      if (R() < 0.3) P(bikeRackPart(), 1.2, 3.2);
      if (R() < 0.3) P(lampPostPart(), 0.4, 0.4, R() * 6);
      break;
    case 'fountainplaza':
      base(0xc9c0b0, PAT.ASHLAR);
      T.g.m.box(cx, top + 0.01, cz, 3.8, 0.02, 3.8, [0xb0a898, PAT.TILE]);
      if (egg?.type === 'grandfountain') P(grandFountainPart(), 2, 2);
      else { P(fountainPart(), 2, 2, 0, 1.1); P(benchPart(), 2, 0.35, 0); P(benchPart(), 2, 3.65, Math.PI); }
      break;
    case 'playground':
      base(0xc86a3a, PAT.CARPET);
      P(swingPart(), 1.2, 1.1, 0);
      P(slidePart(), 3.0, 1.0, R() < 0.5 ? 0 : Math.PI / 2);
      P(domePart(), 1.4, 3.0);
      P(part('pk-spring', (L) => { L('t', 0x9aa1a6).put(SHAPES.torus, 0, 0.25, 0, 0.12, 0.12, 2.5, Math.PI / 2); L('m', 0xf2c14e).geo(rbox(0.6, 0.35, 0.25, 0.1), mtx(0, 0.62, 0)); L('m', 0xf2c14e).put(SHAPES.sphere, 0.3, 0.85, 0, 0.13, 0.13, 0.13); }), 3.2, 3.0);
      edges(() => ironRailingPart(4, 0.8, true));
      break;
    case 'court':
      base(0x3a6ea5, PAT.PANEL);
      T.g.m.box(cx, top + 0.01, cz, 3.6, 0.02, 3.6, [0x2f8a5a, PAT.PANEL]);
      for (const [x, z, sx, sz] of [[cx, z0 + 0.2, 3.6, 0.06], [cx, z0 + 3.8, 3.6, 0.06], [x0 + 0.2, cz, 0.06, 3.6], [x0 + 3.8, cz, 0.06, 3.6], [cx, cz, 3.6, 0.05]]) T.g.m.box(x, top + 0.025, z, sx, 0.01, sz, 0xffffff);
      P(part('pk-circle', (L) => L('m', 0xffffff).put(SHAPES.torus, 0, 0, 0, 0.9, 0.9, 0.15, Math.PI / 2)), 2, 2, 0, 1, null, top + 0.03);
      P(hoopPart(), 2, exposed[3] ? 0.3 : 3.7, exposed[3] ? 0 : Math.PI);
      edges(() => chainFencePart(2.4));
      break;
    case 'pond':
      base(0x6f9a4f, PAT.GRASS);
      P(pondPart(R()), 2, 2);
      if (R() < 0.35) P(bridgePart(), 2, 2, R() < 0.5 ? 0 : Math.PI / 2);
      for (let i = 0; i < 3; i++) P(duckPart(R()), 1 + R() * 2, 1 + R() * 2, R() * 6, 1, null, top + 0.16);
      if (R() < 0.5) P(anyTreePart(R(), 1.2, R() < 0.5 ? 2 : 0), 0.4, 0.4);
      edges(() => curbPart());
      break;
    case 'communitygarden':
      base(0x6a5040, PAT.GRAVEL);
      for (const [x, z] of [[1.0, 1.0], [3.0, 1.0], [1.0, 2.6], [3.0, 2.6]]) P(raisedBedPart(R()), x, z, 0);
      if (R() < 0.35) P(shedPart(), 3.2, 3.6, Math.PI);
      else P(part('pk-barrel', (L) => { L('m', 0x3a6ea5).geo(lathe('barrel', [[0.3, 0], [0.34, 0.45], [0.3, 0.9]], 14), mtx()); L('t', 0x9aa1a6).put(SHAPES.torus, 0, 0.3, 0, 0.33, 0.33, 0.3, Math.PI / 2); }), 2, 3.6);
      edges(() => picketPart());
      break;
    case 'dogpark':
      base(0x8a9a5a, PAT.GRASS);
      P(agilityPart(), 2, 2, R() * 0.4);
      for (let i = 0; i < 2; i++) P(dogPart(R()), 0.8 + R() * 2.4, 0.8 + R() * 2.4, R() * 6);
      P(hydrantPart(), 3.5, 0.5);
      if (R() < 0.5) P(benchPart(), 0.6, 3.4, Math.PI / 2);
      edges(() => chainFencePart(1.2));
      break;
    case 'sculpturegarden':
      base(0x6f9a4f, PAT.GRASS);
      strip(true, 0xd8d0c0, PAT.GRAVEL, 0.7); strip(false, 0xd8d0c0, PAT.GRAVEL, 0.7);
      P(sculpturePart(R()), 2, 2, R() * 6, 1.3);
      P(shrubPart(R(), 0.9), 0.7, 0.7); P(shrubPart(R(), 0.9), 3.3, 3.3);
      edges(() => hedgePart(0.6));
      break;
    case 'amphitheater':
      base(0xb8b0a0, PAT.ASHLAR);
      P(amphiPart(), 2, 1.0, exposed[3] ? Math.PI : 0, 0.72);
      break;
    case 'foodcourt':
      base(0xc0b8a8, PAT.ASHLAR);
      P(foodTruckPart(R()), 2, 0.9, 0);
      P(picnicPart(), 1.1, 2.9, 0); P(picnicPart(), 3.0, 2.9, 0);
      P(stringLightsPart(), 2, 2);
      P(trashCanPart(), 3.7, 1.9);
      break;
    case 'skatepark':
      base(0xb8b4ac, PAT.CONCRETE);
      exposed.forEach((e, d) => { if (e && (d === 2 || d === 3)) { const [ex, ez, ry] = EDGE[d]; P(quarterPipePart(), ex, ez + (d === 2 ? -0.7 : 0.7), d === 2 ? Math.PI / 2 : -Math.PI / 2); } });
      P(skateGearPart(), 2, 2, R() < 0.5 ? 0 : Math.PI / 2);
      break;
    case 'zengarden':
      base(0xe0dccf, PAT.GRAVEL);
      P(rakedPart(), 2, 2);
      P(rockPart(R()), 2.6, 1.6, R() * 6, 1.4); P(rockPart(R()), 1.0, 2.8, R() * 6, 0.9); P(rockPart(R()), 3.2, 3.2, R() * 6, 0.7);
      P(lanternPart(), 0.7, 0.8);
      if (R() < 0.6) P(anyTreePart(R(), 0.9, 4), 3.3, 0.7);
      edges(() => bambooPart());
      break;
  }
  if (egg?.type === 'foodcart') P(foodCartPart(seed), 2.6, 2.6, R() * 6);
}
