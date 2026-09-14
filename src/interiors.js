// Interior dressing per module (visible in cutaway), built from detailed furniture parts.
// Local coordinates: x, z ∈ [0, 4] from the block's min corner, floor slab top at y = 0.25.
import * as THREE from 'three';
import { SHAPES, PAT, lathe, tube, extrudeShape } from './geo.js';
import { MODULES } from './catalog.js';
import { part, mtx, columnPart } from './kit.js';
import { rbox, carParts, busParts, pottedPlantPart, benchPart, trashCanPart, bollardPart } from './props.js';
import * as FU from './furniture.js';
import { eggInterior } from './eggs.js';

const FABRIC = [0x3b5b8c, 0x8c3b3b, 0x3b7a5e, 0x7a5e3b, 0x5e3b7a, 0x2f6f7a, 0xa0763b, 0x6d6a66];
const WOODS = [0x8a5a34, 0x5a3a24, 0xb08058, 0x3a2418, 0xc9a57a];
const CARS = [0xc0392b, 0x2c3e50, 0xecf0f1, 0x27ae60, 0xf39c12, 0x7f8c8d, 0x2980b9, 0x111111];
const ART = [0xe63946, 0x264653, 0xe9c46a, 0x2a9d8f, 0xf4a261, 0x6d597a];
const DARK_ROOMS = new Set(['core', 'foundation', 'observation', 'skybar', 'nightclub', 'cinema', 'datacenter', 'busramp', 'station', 'railplatform']);

const FLOOR_PAT = {
  office: PAT.CARPET, condo: PAT.WOOD, hotel: PAT.CARPET, shop: PAT.TILE, cafe: PAT.WOOD, lobby: PAT.MARBLE, gym: PAT.CARPET,
  utility: PAT.CONCRETE, parking: PAT.CONCRETE, station: PAT.TILE, vault: PAT.CONCRETE, mall: PAT.MARBLE, penthouse: PAT.WOOD,
  observation: PAT.WOOD, skybar: PAT.WOOD, foundation: PAT.GRAVEL, datacenter: PAT.TILE, nightclub: PAT.TILE, pool: PAT.TILE,
  market: PAT.TILE, cinema: PAT.CARPET, library: PAT.WOOD, gallery: PAT.WOOD, clinic: PAT.TILE, lab: PAT.TILE, classroom: PAT.WOOD,
  ballroom: PAT.WOOD, skylobby: PAT.MARBLE, skydining: PAT.WOOD, subwayconcourse: PAT.TILE, railplatform: PAT.ASHLAR,
  trainhall: PAT.MARBLE, ticketing: PAT.MARBLE, waitingroom: PAT.WOOD, baggage: PAT.TILE, busdeck: PAT.CONCRETE, busramp: PAT.CONCRETE, bikehub: PAT.CONCRETE,
};

// ---------- small room-specific parts ----------
const ceilingLight = () => part('ceil-light', (L) => {
  L('t', 0xd0d4d8).bv(-1.1, 0, -0.12, 1.1, 0.06, 0.12, 0.01);
  L('l', 0xfff4dc).bx(-1.05, -0.006, -0.09, 1.05, 0.0, 0.09);
  for (const x of [-0.9, 0.9]) L('t', 0x9aa0a6).bx(x - 0.005, 0.06, -0.005, x + 0.005, 0.2, 0.005);
});

const clothesRack = (seed) => part(`crack:${Math.floor(seed * 4)}`, (L) => {
  const m = L('t', 0xc0c6cc);
  m.put(SHAPES.cyl, 0, 1.45, 0, 0.018, 1.4, 0.018, 0, 0, Math.PI / 2);
  for (const x of [-0.68, 0.68]) { m.put(SHAPES.cyl, x, 0.73, 0, 0.018, 1.45, 0.018); m.bx(x - 0.02, 0, -0.25, x + 0.02, 0.03, 0.25); }
  for (let i = 0; i < 9; i++) {
    const c = FABRIC[(i * 3 + Math.floor(seed * 7)) % FABRIC.length];
    L('m', c, PAT.CARPET).geo(rbox(0.09, 0.8 + ((i * 7) % 3) * 0.1, 0.42, 0.04), mtx(-0.55 + i * 0.14, 0.98 - ((i * 7) % 3) * 0.05, 0));
    m.put(SHAPES.torus, -0.55 + i * 0.14, 1.42, 0, 0.03, 0.03, 0.3, 0, Math.PI / 2, 0);
  }
});

const goodsShelf = (len, seed) => part(`goods:${len}:${Math.floor(seed * 4)}`, (L) => {
  const w = L('m', 0xe7e1d6, PAT.PANEL);
  w.bv(-len / 2, 0, -0.22, len / 2, 1.9, -0.18, 0.005);
  for (const x of [-len / 2, len / 2]) w.bx(x - 0.02, 0, -0.22, x + 0.02, 1.9, 0.22);
  for (let s = 0; s < 4; s++) {
    const y = 0.12 + s * 0.45;
    w.bx(-len / 2, y, -0.2, len / 2, y + 0.03, 0.22);
    for (let x = -len / 2 + 0.08; x < len / 2 - 0.08; x += 0.13) {
      const c = FABRIC[Math.floor(Math.abs(Math.sin(x * 17 + s * 3 + seed * 11)) * FABRIC.length)];
      const h = 0.14 + Math.abs(Math.sin(x * 31 + s)) * 0.18;
      L('m', c).geo(rbox(0.11, h, 0.26, 0.015), mtx(x, y + 0.03 + h / 2, 0.02));
    }
  }
});

const mannequin = () => part('mannequin', (L) => {
  const w = L('m', 0xf4f1ea), f = L('m', 'fabric', PAT.CARPET);
  w.geo(lathe('man-base', [[0.18, 0], [0.18, 0.03], [0.02, 0.05], [0.02, 0.9]], 12), mtx());
  f.geo(lathe('man-body', [[0.001, 0.9], [0.16, 0.95], [0.13, 1.25], [0.17, 1.45], [0.1, 1.55], [0.001, 1.56]], 14), mtx());
  w.put(SHAPES.sphere, 0, 1.72, 0, 0.1, 0.12, 0.1);
});

const espresso = () => part('espresso', (L) => {
  const s = L('t', 0xc0c6cc), d = L('m', 0x1a1a1a), cup = L('m', 0xffffff);
  s.geo(rbox(0.6, 0.45, 0.45, 0.05), mtx(0, 0.225, 0));
  d.bx(-0.25, 0.08, 0.2, 0.25, 0.12, 0.24);
  for (const x of [-0.15, 0.15]) { s.put(SHAPES.cyl, x, 0.3, 0.26, 0.04, 0.08, 0.04); cup.geo(lathe('cup', [[0.03, 0], [0.04, 0.06], [0.035, 0.06], [0.025, 0.005]], 10), mtx(x, 0.12, 0.28)); }
  for (let i = 0; i < 5; i++) cup.geo(lathe('cup', [[0.03, 0], [0.04, 0.06], [0.035, 0.06], [0.025, 0.005]], 10), mtx(-0.2 + i * 0.1, 0.45, -0.1));
});

const menuBoard = () => part('menuboard', (L) => {
  L('m', 0x3a2418, PAT.WOOD).bv(-0.65, 0, -0.03, 0.65, 0.9, 0.0, 0.01);
  L('m', 0x1a1a1a).bx(-0.6, 0.05, 0.0, 0.6, 0.85, 0.005);
  for (let i = 0; i < 6; i++) L('m', 0xf4f1ea).bx(-0.5, 0.7 - i * 0.11, 0.006, -0.5 + 0.5 + (i % 3) * 0.12, 0.72 - i * 0.11, 0.008);
});

const telescope = () => part('telescope', (L) => {
  const d = L('t', 0x3a3d40), b = L('t', 0x9aa0a6);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; d.put(SHAPES.cyl8, Math.sin(a) * 0.18, 0.5, Math.cos(a) * 0.18, 0.015, 1.05, 0.015, Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35); }
  b.geo(lathe('scope', [[0.06, 0], [0.08, 0.1], [0.07, 0.8], [0.09, 0.85], [0.001, 0.86]], 14), mtx(0, 1.05, -0.3, 1.1, 0, 0));
});

const coinBinoc = () => part('binoc', (L) => {
  const g = L('t', 0x2f6fd0), d = L('m', 0x1a1a1a);
  g.geo(lathe('binpost', [[0.14, 0], [0.12, 0.05], [0.06, 0.1], [0.05, 1.0], [0.001, 1.0]], 12), mtx());
  g.geo(rbox(0.36, 0.28, 0.3, 0.1), mtx(0, 1.18, 0));
  for (const x of [-0.08, 0.08]) d.put(SHAPES.cyl, x, 1.2, 0.2, 0.06, 0.12, 0.06, Math.PI / 2);
});

const kiosk = (seed) => part(`kiosk:${Math.floor(seed * 4)}`, (L) => {
  const w = L('m', 0xece6da, PAT.PANEL), top = L('m', 'accent', PAT.CARPET), glow = L('l', 0xfff0c8), glass = L('glass', 0xcfe6ee);
  w.geo(rbox(1.1, 1.0, 0.9, 0.08), mtx(0, 0.5, 0));
  glass.bx(-0.5, 1.0, -0.4, 0.5, 1.35, 0.4);
  for (const [x, z] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]]) w.bx(x - 0.03, 1.0, z - 0.03, x + 0.03, 1.9, z + 0.03);
  top.geo(lathe('kiosk-roof', [[0.001, 0], [0.9, 0], [0.001, 0.45]], 4), mtx(0, 1.9, 0, 0, Math.PI / 4, 0));
  glow.bx(-0.45, 1.6, 0.44, 0.45, 1.8, 0.46);
});

const stanchions = () => part('stanchions', (L) => {
  const b = L('t', 0xc9a14a), rope = L('m', 0x8c1c2c);
  for (let i = 0; i < 4; i++) b.geo(lathe('stan', [[0.14, 0], [0.12, 0.03], [0.025, 0.06], [0.025, 0.9], [0.05, 0.95], [0.001, 1.0]], 12), mtx(-0.9 + i * 0.6, 0, 0));
  for (let i = 0; i < 3; i++) rope.geo(tube(`rope:${i}`, [[-0.9 + i * 0.6, 0.88, 0], [-0.6 + i * 0.6, 0.72, 0], [-0.3 + i * 0.6, 0.88, 0]], 0.02, 10, 6), mtx());
});

const serverTray = () => part('cabletray', (L) => {
  const t = L('t', 0x777777);
  t.bx(-1.9, 0, -0.18, 1.9, 0.02, 0.18);
  for (const z of [-0.18, 0.18]) t.bx(-1.9, 0, z - 0.01, 1.9, 0.08, z + 0.01);
  for (let i = 0; i < 8; i++) L('m', [0x2f6fd0, 0xf2c14e, 0x39a845][i % 3]).put(SHAPES.cyl8, 0, 0.04, -0.14 + i * 0.04, 0.015, 3.8, 0.015, 0, 0, Math.PI / 2);
});

const pile = () => part('pile', (L) => {
  const c = L('m', 0x8d877e, PAT.CONCRETE), r = L('t', 0x6d4a3a);
  c.geo(lathe('pile', [[0.45, 0], [0.45, 3.5], [0.6, 3.6], [0.6, 4.0], [0.001, 4.0]], 20), mtx());
  for (const y of [0.8, 1.6, 2.4, 3.2]) r.put(SHAPES.torus, 0, y, 0, 0.47, 0.47, 0.4, Math.PI / 2);
});

const djBooth = () => part('dj', (L) => {
  const d = L('m', 0x111111), m = L('t', 0x9aa0a6), glow = L('l', 0xc77dff);
  d.geo(rbox(1.4, 1.0, 0.6, 0.05), mtx(0, 0.5, 0));
  glow.bx(-0.7, 0.2, 0.3, 0.7, 0.24, 0.31);
  for (const x of [-0.35, 0.35]) { m.put(SHAPES.cyl, x, 1.02, 0, 0.16, 0.03, 0.16); d.put(SHAPES.cyl, x, 1.04, 0, 0.14, 0.02, 0.14); }
  m.bv(-0.1, 1.0, -0.15, 0.1, 1.05, 0.15, 0.005);
});

const busRampGeo = () => part('busramp', (L) => {
  const c = L('m', 0x77736c, PAT.CONCRETE), y = L('m', 0xf2c14e), steel = L('t', 0x9aa0a6);
  const t = 0.32;
  c.put(SHAPES.box, -1.0, 0.55, 0, 1.8, 0.2, 3.6, t, 0, 0);
  c.put(SHAPES.box, 0, 1.45, 1.0, 3.6, 0.2, 1.8, 0, 0, -t);
  c.put(SHAPES.box, 1.0, 2.35, 0, 1.8, 0.2, 3.6, -t, 0, 0);
  c.put(SHAPES.box, 0, 3.25, -1.0, 3.6, 0.2, 1.8, 0, 0, t);
  c.geo(lathe('rampcore', [[0.4, 0], [0.4, 4.0]], 20), mtx(0, -0.25, 0));
  for (const [x, z] of [[-1.85, -1.85], [1.85, -1.85], [-1.85, 1.85], [1.85, 1.85]]) c.bv(x - 0.12, -0.25, z - 0.12, x + 0.12, 3.75, z + 0.12, 0.02);
  y.put(SHAPES.box, -1.0, 0.66, 0, 0.12, 0.01, 3.4, t, 0, 0);
  y.put(SHAPES.box, 1.0, 2.46, 0, 0.12, 0.01, 3.4, -t, 0, 0);
  for (const s of [-1, 1]) steel.put(SHAPES.box, s * 1.9, 1.5, 0, 0.06, 0.06, 3.6, 0, 0, 0);
});

// ---------------------------------------------------------------- main entry
// I = { g: builders, place(part, matrix, colors) }
export function buildInterior(I, id, x0, y0, z0, R, served, front = 2, egg = null, style = 'deco') {
  const G = I.g;
  const B = (g, x, y, z, sx, sy, sz, c) => g.box(x0 + x + sx / 2, y0 + y + sy / 2, z0 + z + sz / 2, sx, sy, sz, c);
  const Bv = (g, x, y, z, sx, sy, sz, c, ch = 0.02) => g.bevel(x0 + x + sx / 2, y0 + y + sy / 2, z0 + z + sz / 2, sx, sy, sz, c, ch);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const mod = MODULES[id];
  const F = 0.25;
  const base = { wood: pick(WOODS), fabric: pick(FABRIC), fabric2: pick(FABRIC), metal: 0x9aa0a6, counter: 0xe8e4dc, accent: pick(ART), neon: 0xff5fc8, paint: pick(CARS), frame: 0x5a6168, glass: 0xcfe6ee, wall: 0xe6e1d8, stone: 0xd8d2c8, iron: 0x23272b, door: 0x5a3a24 };
  const P = (p, x, z, ry = 0, col, y = F, s = 1) => I.place(p, mtx(x0 + x, y0 + y, z0 + z, 0, ry, 0, s, s, s), col ? { ...base, ...col } : base);
  const ry0 = front === 2 ? 0 : Math.PI; // facing the street

  if (id !== 'core') B(G.m, 0, 0, 0, 4, F, 4, [served ? mod.floor : 0x9a4a42, FLOOR_PAT[id] || 0]);
  if (!DARK_ROOMS.has(id)) for (const z of [1.3, 2.7]) P(ceilingLight(), 2, z, 0, null, 3.72);
  if (egg && eggInterior({ P, B, Bv, G, R, egg, style })) return;

  switch (id) {
    case 'office':
      for (const [x, z] of [[1.0, 1.0], [3.0, 1.0], [1.0, 2.7], [3.0, 2.7]]) {
        P(FU.deskPart(1.3, 0.7), x, z);
        P(FU.monitorPart(), x, z);
        P(FU.officeChairPart(), x, z + 0.6, 0, { fabric: pick([0x2b4a7a, 0x333333, 0x7a2b2b]) });
      }
      P(pottedPlantPart(R(), 1.2), 3.75, 1.85);
      P(FU.whiteboardPart(1.2), 0.05, 1.85, Math.PI / 2, null, 1.2);
      break;
    case 'condo':
      P(FU.rugPart(2.0, 1.6), 1.25, 1.35);
      P(FU.sofaPart(1.9), 1.2, 0.6);
      P(FU.coffeeTablePart(), 1.2, 1.45);
      P(FU.tvPart(1.2), 1.2, 2.55, Math.PI);
      P(FU.bedPart(1.5), 3.1, 1.2);
      P(FU.nightstandPart(true), 2.15, 0.3);
      P(FU.kitchenPart(2.4), 1.3, 3.65, Math.PI, { counter: pick([0xe8e4dc, 0x2b2b2b, 0xd8cfae]) });
      P(FU.fridgePart(), 3.2, 3.55, Math.PI);
      P(FU.floorLampPart(), 0.25, 0.25);
      break;
    case 'hotel':
      P(FU.rugPart(3.4, 1.4), 2, 2.0, 0, { fabric2: 0x6b1d2a, accent: 0xc9a14a });
      P(FU.bedPart(1.4), 1.05, 1.2, 0, { fabric: 0xf3efe8, fabric2: 0x8a3b3b });
      P(FU.bedPart(1.4), 2.95, 1.2, 0, { fabric: 0xf3efe8, fabric2: 0x8a3b3b });
      P(FU.nightstandPart(true), 2.0, 0.3);
      P(FU.tvPart(1.1), 2.0, 3.65, Math.PI);
      P(FU.wardrobePart(1.0), 0.6, 3.6, Math.PI);
      P(FU.armchairPart(), 3.3, 3.1, -2.4);
      break;
    case 'shop':
      P(goodsShelf(3.4, R()), 0.3, 2, Math.PI / 2);
      P(clothesRack(R()), 2.0, 1.2);
      P(clothesRack(R()), 2.0, 2.4);
      P(mannequin(), 3.5, 0.6, 0, { fabric: pick(FABRIC) });
      P(mannequin(), 3.5, 1.3, 0, { fabric: pick(FABRIC) });
      P(FU.barCounterPart(1.4), 2.9, 3.5, Math.PI, { accent: 0xd8cfae, neon: 0xffe7b0 });
      break;
    case 'cafe':
      P(FU.barCounterPart(3.0), 3.55, 2.0, -Math.PI / 2, { accent: 0xb08d57, neon: 0xffc870 });
      P(espresso(), 3.7, 1.0, -Math.PI / 2, null, 1.12);
      P(menuBoard(), 3.95, 2.4, -Math.PI / 2, null, 2.0);
      P(FU.diningSetPart(true), 1.1, 1.1, 0, null, F, 0.8);
      P(FU.diningSetPart(true), 1.1, 2.9, 0, null, F, 0.8);
      P(pottedPlantPart(R(), 1.0), 2.3, 0.3);
      break;
    case 'lobby':
      P(FU.rugPart(2.6, 2.2), 2, 1.6, 0, { fabric2: 0x6b1d2a, accent: 0xc9a14a });
      P(FU.receptionDeskPart(2.2), 2, 3.3, 0, { wood: 0x3a2418, counter: 0xe8e2d4 });
      P(FU.armchairPart(), 0.7, 1.4, Math.PI / 2, { fabric2: 0x2f3b4a });
      P(FU.armchairPart(), 3.3, 1.4, -Math.PI / 2, { fabric2: 0x2f3b4a });
      P(FU.coffeeTablePart(0.6, 0.6), 2, 1.4);
      P(pottedPlantPart(R(), 1.6), 0.35, 0.35);
      P(pottedPlantPart(R(), 1.6), 3.65, 0.35);
      P(FU.chandelierPart(0.55), 2, 1.6, 0, null, 2.7);
      break;
    case 'gym':
      for (const x of [0.6, 2.0, 3.4]) P(FU.treadmillPart(), x, 1.2);
      P(FU.weightRackPart(), 2, 3.3, Math.PI);
      Bv(G.m, 0.3, F, 2.35, 1.2, 0.04, 0.6, [0x2e7d5b, PAT.CARPET], 0.01);
      break;
    case 'utility':
      P(FU.tankPart(2.4, 0.6), 1.0, 1.1);
      P(FU.tankPart(2.0, 0.5, 0xb04a2e), 2.7, 1.0);
      P(FU.controlPanelPart(2.0), 2.0, 3.6, Math.PI);
      I.place(part('util-pipes', (L) => {
        const p = L('t', 0x5a7fa0), r = L('t', 0xc0392b);
        p.geo(tube('pipeA', [[0.2, 3.3, 0.2], [3.8, 3.3, 0.2], [3.8, 3.3, 3.0]], 0.08, 20, 8), mtx());
        r.geo(tube('pipeB', [[0.4, 0.25, 3.0], [0.4, 3.0, 3.0], [0.4, 3.1, 0.4], [1.0, 3.1, 0.4]], 0.06, 20, 8), mtx());
        for (const x of [1.2, 2.4, 3.4]) p.put(SHAPES.torus, x, 3.3, 0.2, 0.1, 0.1, 0.6, 0, Math.PI / 2, 0);
      }), mtx(x0, y0, z0), base);
      break;
    case 'parking': {
      for (const x of [0.05, 1.97, 3.89]) B(G.m, x, F, 0.2, 0.08, 0.005, 3.6, 0xf0e8c0);
      for (const x of [1.0, 2.95]) Bv(G.m, x - 0.4, F, 3.55, 0.8, 0.12, 0.15, [0xf2c14e, 0], 0.03);
      Bv(G.m, 1.87, F, 3.7, 0.25, 3.5, 0.25, [0x9a968d, PAT.CONCRETE], 0.03);
      for (let k = 0; k < 3; k++) B(G.m, 1.86, F + 0.3 + k * 0.4, 3.69, 0.27, 0.2, 0.27, k % 2 ? 0x1a1a1a : 0xf2c14e);
      const car = carParts();
      for (const x of [1.0, 2.95]) {
        if (R() < 0.2) continue;
        const col = { paint: pick(CARS) };
        P(car.paint, x, 1.9, Math.PI / 2, col, F, 0.82);
        P(car.rest, x, 1.9, Math.PI / 2, col, F, 0.82);
      }
      break;
    }
    case 'vault':
      P(FU.vaultDoorPart(), 2, 3.35, Math.PI);
      P(FU.lockersPart(3.4, 2.6), 0.35, 1.8, Math.PI / 2, { metal: 0x8d8f92 });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) Bv(G.t, 2.3 + j * 0.3 + i * 0.15, F + i * 0.12, 0.8, 0.28, 0.12, 0.14, 0xf2c14e, 0.015);
      P(FU.deskPart(1.2, 0.6), 2.8, 1.8);
      break;
    case 'mall':
      P(FU.fountainPart(), 2, 2, 0, null, F, 0.85);
      P(kiosk(R()), 0.7, 0.7, 0, { accent: pick(ART) });
      P(kiosk(R()), 3.3, 0.7, 0, { accent: pick(ART) });
      P(benchPart(), 0.7, 3.3, 0);
      P(pottedPlantPart(R(), 1.5), 3.5, 3.4);
      break;
    case 'datacenter':
      for (let i = 0; i < 5; i++) { P(FU.serverRackPart(), 0.6 + i * 0.7, 1.0); P(FU.serverRackPart(), 0.6 + i * 0.7, 3.0, Math.PI); }
      P(serverTray(), 2, 1.0, 0, null, 3.3);
      P(serverTray(), 2, 3.0, 0, null, 3.3);
      B(G.l, 0.1, 3.78, 1.9, 3.8, 0.03, 0.2, 0x3ea8ff);
      break;
    case 'nightclub':
      P(FU.danceFloorPart(4, 0.5, R()), 2, 1.6, 0, null, F + 0.001);
      P(FU.barCounterPart(3.0), 2, 3.4, Math.PI, { accent: 0xc9a14a, neon: 0xc77dff });
      P(djBooth(), 0.7, 0.4);
      for (let i = 0; i < 3; i++) P(FU.stoolPart(), 1.0 + i * 1.0, 2.95, 0, { fabric: 0x8c1c2c });
      B(G.l, 0, 3.72, 0.05, 4, 0.04, 0.04, 0xc77dff);
      break;
    case 'pool':
      P(FU.poolPart(3.2, 2.4), 2, 1.6);
      P(FU.loungerPart(), 1.0, 3.4, Math.PI / 2, { fabric: 0xffffff });
      P(FU.loungerPart(), 2.4, 3.4, Math.PI / 2, { fabric: 0xffffff });
      P(FU.lockersPart(0.8, 1.9), 3.7, 3.5, -Math.PI / 2, { metal: 0x3a6ea5 });
      break;
    case 'market':
      P(goodsShelf(2.8, R()), 1.6, 3.55, Math.PI);
      I.place(part('market-bins', (L) => {
        const w = L('m', 0x8a6a4a, PAT.WOOD);
        const fruit = [0xe63946, 0xf4a261, 0x7cb342, 0xffd166, 0x9b5de5, 0x4f7f3a];
        for (let i = 0; i < 3; i++) {
          const x = 0.8 + i * 1.2;
          w.bv(x - 0.5, 0, 0.5, x + 0.5, 0.7, 1.9, 0.02);
          for (let j = 0; j < 3; j++) { const c = L('m', fruit[(i * 2 + j) % 6]); for (let a = 0; a < 5; a++) for (let b = 0; b < 3; b++) c.put(SHAPES.sphere, x - 0.35 + a * 0.18, 0.76 + (b % 2) * 0.04, 0.65 + j * 0.45 + b * 0.12, 0.08, 0.075, 0.08); }
        }
      }), mtx(x0, y0 + F, z0), base);
      P(FU.barCounterPart(1.2), 3.3, 2.6, -Math.PI / 2, { accent: 0x2b2b2b, neon: 0x7fff9f });
      break;
    case 'cinema': {
      P(FU.screenPart(3.4, 1.9), 2, 0.2);
      for (let r = 0; r < 4; r++) {
        const y = F + r * 0.22;
        if (r) Bv(G.m, 0.1, F, 1.35 + r * 0.65, 3.8, r * 0.22, 0.65, [0x2a1418, PAT.CARPET], 0.01);
        P(FU.cinemaRowPart(6, 0.58), 2, 1.55 + r * 0.65, 0, { fabric: 0x9b1d20 }, y);
      }
      for (let r = 0; r < 4; r++) B(G.l, 3.88, F + r * 0.22, 1.35 + r * 0.65, 0.05, 0.03, 0.05, 0xffb347);
      break;
    }
    case 'library':
      P(FU.bookshelfPart(3.4, 2.6, 0.35, R()), 2, 3.75, Math.PI);
      P(FU.bookshelfPart(2.6, 2.6, 0.35, R()), 0.25, 1.8, Math.PI / 2);
      P(FU.libraryTablePart(), 2.3, 1.7);
      for (const x of [1.7, 2.9]) { P(FU.chairPart(), x, 1.0, Math.PI); P(FU.chairPart(), x, 2.4); }
      I.place(part('globe', (L) => {
        L('t', 0xb08d57).geo(lathe('globe-st', [[0.18, 0], [0.16, 0.04], [0.03, 0.08], [0.03, 0.75]], 12), mtx());
        L('t', 0xb08d57).put(SHAPES.torus, 0, 1.0, 0, 0.27, 0.27, 0.4, 0, 0, 0.4);
        L('m', 0x3a7ab0).put(SHAPES.sphere, 0, 1.0, 0, 0.25, 0.25, 0.25);
      }), mtx(x0 + 3.5, y0 + F, z0 + 0.5), base);
      break;
    case 'gallery':
      Bv(G.m, 1.9, F, 0.4, 0.2, 2.8, 2.4, [0xfafafa, PAT.STUCCO], 0.01);
      for (const [s, z] of [[-1, 1.0], [-1, 2.2], [1, 1.0], [1, 2.2]]) P(FU.framedArtPart(0.9, 0.75, pick(ART)), 2.0 + s * 0.11, z, s * Math.PI / 2, null, 1.25);
      P(FU.sculpturePart(R()), 0.8, 3.2);
      P(FU.sculpturePart(R()), 3.2, 3.3);
      P(benchPart(), 0.8, 1.6, Math.PI / 2);
      break;
    case 'clinic':
      P(FU.hospitalBedPart(), 2.9, 1.3);
      P(FU.deskPart(1.3, 0.7), 1.0, 0.8);
      P(FU.monitorPart(), 1.0, 0.8);
      P(FU.officeChairPart(), 1.0, 1.4, 0, { fabric: 0x2f6fb0 });
      for (let k = 0; k < 3; k++) P(FU.chairPart(), 0.5 + k * 0.6, 3.5, Math.PI, { fabric: 0x2f6fb0 });
      I.place(part('curtain-rail', (L) => {
        L('t', 0xc0c6cc).put(SHAPES.cyl, 0, 3.4, 0, 0.015, 2.2, 0.015, 0, 0, Math.PI / 2);
        const w = Array.from({ length: 17 }, (_, i) => [0.04 * Math.sin(i * 1.4), -1.0 + (i / 16) * 2.0]);
        L('m', 0xbfe3f2).geo(extrudeShape('curtain2', () => new THREE.Shape([...w, ...w.slice().reverse().map(([a, b]) => [a - 0.02, b])].map(([a, b]) => new THREE.Vector2(b, a))), 2.4), mtx(0, 2.2, 0, Math.PI / 2, 0, 0));
      }), mtx(x0 + 1.8, y0, z0 + 2.4), base);
      break;
    case 'lab':
      P(FU.labBenchPart(3.4), 2, 0.8);
      P(FU.microscopePart(), 1.2, 0.8, 0, null, F + 0.9);
      P(FU.fumeHoodPart(), 0.8, 3.4, Math.PI);
      P(FU.labBenchPart(1.8), 2.8, 2.6, Math.PI);
      for (const x of [1.4, 2.6]) P(FU.stoolPart(), x, 1.5, 0, { fabric: 0x333333 });
      break;
    case 'classroom':
      P(FU.chalkboardPart(3.0), 2, 0.1, 0, null, 1.1);
      P(FU.deskPart(1.2, 0.6), 2.9, 0.8, Math.PI);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) P(FU.schoolDeskPart(), 0.8 + i * 1.2, 1.7 + j * 1.1, 0, { accent: pick([0xe76f51, 0x2a9d8f, 0xe9c46a]) });
      P(FU.lockersPart(2.4, 1.6), 3.75, 2.4, -Math.PI / 2, { metal: 0x3a6ea5 });
      break;
    case 'ballroom':
      Bv(G.m, 0.8, F, 0.8, 2.4, 0.01, 2.4, [0xa8845a, PAT.WOOD], 0.005);
      Bv(G.m, 0.2, F, 3.0, 3.6, 0.5, 0.9, [0x6b1d2a, PAT.WOOD], 0.02);
      P(FU.screenPart(3.4, 2.2), 2, 3.9, Math.PI, null, 0.3);
      P(FU.diningSetPart(true), 0.8, 0.8, 0, null, F, 0.75);
      P(FU.diningSetPart(true), 3.2, 0.8, 0, null, F, 0.75);
      P(FU.chandelierPart(0.5), 1.2, 1.8, 0, null, 2.7);
      P(FU.chandelierPart(0.5), 2.8, 1.8, 0, null, 2.7);
      break;
    case 'skylobby':
      P(FU.receptionDeskPart(1.8), 1.2, 3.4);
      P(FU.sofaPart(1.6), 1.2, 0.7);
      P(FU.sofaPart(1.4), 3.0, 0.7);
      P(FU.coffeeTablePart(0.8, 0.5), 2.1, 1.5);
      P(pottedPlantPart(R(), 1.6), 3.5, 3.5);
      P(FU.chandelierPart(0.45), 2, 2, 0, null, 2.75);
      break;
    case 'skydining':
      for (const [x, z] of [[0.95, 0.95], [3.05, 0.95], [0.95, 3.05], [3.05, 3.05]]) P(FU.diningSetPart(true), x, z, 0, null, F, 0.72);
      P(FU.chandelierPart(0.4), 2, 2, 0, null, 2.8);
      break;
    case 'penthouse':
      P(FU.rugPart(2.2, 1.8), 1.3, 3.0);
      P(FU.pianoPart(), 1.0, 1.6, Math.PI * 0.85);
      P(FU.sofaPart(2.0), 1.3, 3.55, Math.PI, { fabric: 0xf2ede3, fabric2: 0xc9a14a });
      P(FU.coffeeTablePart(), 1.3, 2.7);
      P(FU.poolPart(1.4, 1.2), 3.2, 3.1);
      P(FU.kitchenPart(1.8), 3.0, 0.35, 0, { counter: 0x2b2b2b, wood: 0xf4f1ea });
      P(FU.framedArtPart(1.2, 0.9, pick(ART)), 3.95, 1.9, -Math.PI / 2, null, 1.3);
      P(FU.chandelierPart(0.4), 1.3, 2.8, 0, null, 2.8);
      break;
    case 'skybar':
      P(FU.barCounterPart(3.4), 2, 2.9, 0, { accent: 0xc9a14a, neon: 0xff5fc8, wood: 0x2a1f1a });
      P(FU.backBarPart(3.4, R()), 2, 3.7, Math.PI, { wood: 0x2a1f1a, neon: 0xff5fc8 });
      for (let i = 0; i < 4; i++) P(FU.stoolPart(), 0.7 + i * 0.9, 2.3, 0, { fabric: 0x5b2a6e });
      P(FU.sofaPart(1.6), 1.1, 0.5, 0, { fabric: 0x5b2a6e, fabric2: 0xc9a14a });
      P(FU.armchairPart(), 3.0, 0.7, -0.6, { fabric2: 0x5b2a6e });
      P(FU.coffeeTablePart(0.7, 0.5), 2.0, 1.2, 0, { wood: 0x111111 });
      break;
    case 'observation':
      for (const [x, z] of [[0.7, 0.7], [3.3, 0.7], [0.7, 3.3], [3.3, 3.3]]) P(coinBinoc(), x, z, Math.atan2(x - 2, z - 2));
      P(telescope(), 2, 0.9, Math.PI);
      P(benchPart(), 2, 2.3, 0);
      B(G.l, 0.05, F, 0.05, 3.9, 0.03, 0.06, 0x6ab0ff);
      break;
    case 'foundation':
      for (const [x, z] of [[1, 1], [3, 1], [1, 3], [3, 3]]) P(pile(), x, z, 0, null, 0);
      for (const [x, z, sx, sz] of [[0.6, 0.8, 2.8, 0.4], [0.6, 2.8, 2.8, 0.4], [0.8, 0.6, 0.4, 2.8], [2.8, 0.6, 0.4, 2.8]]) Bv(G.m, x, 3.5, z, sx, 0.5, sz, [0x9a948a, PAT.CONCRETE], 0.03);
      break;
    case 'core':
      I.place(part('core-shaft', (L) => {
        const s = L('t', 0x3b4048, PAT.PANEL), rail = L('t', 0x8a9099), door = L('t', 0xb8bec4, PAT.PANEL), glow = L('l', 0xffb347), back = L('m', 0x2a2d33, PAT.CONCRETE);
        for (const [x, z] of [[0, 0], [3.75, 0], [0, 3.75], [3.75, 3.75]]) s.bv(x, 0, z, x + 0.25, 4, z + 0.25, 0.02);
        for (const [a, b, c2, d] of [[0, 3.7, 4, 3.95], [0, 3.7, 0.25, 4]]) { s.bv(a, 3.7, b === 3.7 ? 0 : 0, c2, 4, 0.25, 0.02); }
        s.bv(0, 3.7, 3.75, 4, 4, 4, 0.02); s.bv(3.75, 3.7, 0, 4, 4, 4, 0.02); s.bv(0, 3.7, 0, 0.25, 4, 4, 0.02);
        back.bx(0.25, 0, 0.08, 3.75, 4, 0.14);
        for (const x of [0.6, 3.34]) rail.bx(x, 0, 0.3, x + 0.06, 4, 0.36);
        door.bv(0.8, 0, 3.8, 1.98, 2.4, 3.86, 0.01); door.bv(2.02, 0, 3.8, 3.2, 2.4, 3.86, 0.01);
        s.bv(0.65, 2.4, 3.78, 3.35, 2.6, 3.9, 0.01);
        glow.bx(1.7, 2.45, 3.9, 2.3, 2.55, 3.91);
        glow.bx(3.45, 1.1, 3.9, 3.55, 1.3, 3.91);
      }), mtx(x0, y0, z0), base);
      break;
    // ---------------- transit ----------------
    case 'station': {
      const edge = front === 2 ? 3.6 : 0.4;
      B(G.m, 0, F + 0.005, front === 2 ? 3.6 : 0, 4, 0.01, 0.4, [0xffd400, PAT.TILE]);
      for (const x of [0.9, 3.1]) P(columnPart('modern', 3.5, 0.2, 'wall'), x, 2, 0, { wall: 0x2f5d50 });
      P(benchPart(), 2, front === 2 ? 1.0 : 3.0, ry0 + Math.PI);
      P(FU.boardPart(1.4, 0xffb347), 2, 2, ry0, null, 2.6);
      P(FU.ticketMachinePart(0x2f7de0), 0.5, front === 2 ? 0.4 : 3.6, ry0);
      P(trashCanPart(), 3.5, front === 2 ? 0.5 : 3.5);
      void edge;
      break;
    }
    case 'subwayconcourse':
      for (let i = 0; i < 4; i++) P(FU.turnstilePart(), 0.5 + i * 0.95, 1.8);
      P(FU.ticketMachinePart(0x2f7de0), 0.5, 3.5, Math.PI);
      P(FU.ticketMachinePart(0x2f7de0), 1.3, 3.5, Math.PI);
      B(G.m, 2.2, 1.0, 3.9, 1.6, 1.3, 0.05, 0xf4f1ea);
      for (const [c, y] of [[0xe63946, 1.3], [0x2a9d8f, 1.6], [0xf2c14e, 1.9]]) B(G.m, 2.3, y, 3.88, 1.4, 0.05, 0.02, c);
      P(FU.escalatorPart(1.4, 1.3, 0.9), 3.3, 0.8, -Math.PI / 2);
      break;
    case 'railplatform':
      B(G.m, 0, F + 0.005, front === 2 ? 3.5 : 0.1, 4, 0.01, 0.4, 0xffffff);
      for (const x of [1.0, 3.0]) P(columnPart('castiron', 3.3, 0.12, 'iron'), x, 2);
      P(FU.clockPart(0.35), 2, 2, ry0, null, 2.9);
      P(benchPart(), 0.9, front === 2 ? 1.0 : 3.0, ry0 + Math.PI);
      P(benchPart(), 3.1, front === 2 ? 1.0 : 3.0, ry0 + Math.PI);
      P(FU.boardPart(1.6, 0xffb347), 2, front === 2 ? 0.2 : 3.8, ry0, null, 2.3);
      I.place(part('trolley', (L) => {
        L('t', 0x3a6ea5).bv(-0.5, 0.3, -0.3, 0.5, 0.35, 0.3, 0.01);
        for (const [x, z] of [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]]) L('m', 0x151515).put(SHAPES.cyl, x, 0.08, z, 0.08, 0.04, 0.08, Math.PI / 2);
        L('t', 0x3a6ea5).put(SHAPES.box, -0.5, 0.7, 0, 0.04, 0.8, 0.6, 0, 0, -0.2);
        for (let k = 0; k < 3; k++) L('m', [0xe63946, 0x2b2b2b, 0xf2c14e][k]).geo(rbox(0.3, 0.4, 0.45, 0.05), mtx(-0.25 + k * 0.28, 0.56, 0));
      }), mtx(x0 + 2.4, y0 + F, z0 + 2.0, 0, 0.4, 0), base);
      break;
    case 'trainhall':
      I.place(part('hall-vault', (L) => {
        const steel = L('t', 0xc9ced3), glass = L('glass', 0xbfe0ee);
        for (const z of [0.2, 2, 3.8]) steel.put(new THREE.TorusGeometry(1.9, 0.05, 6, 20, Math.PI), 2, 1.9, z, 1, 0.95, 1);
        for (let k = 1; k < 8; k++) { const a = (k / 8) * Math.PI; steel.bx(2 + Math.cos(a) * 1.9 - 0.025, 1.9 + Math.sin(a) * 1.8 - 0.025, 0, 2 + Math.cos(a) * 1.9 + 0.025, 1.9 + Math.sin(a) * 1.8 + 0.025, 4); }
        glass.bx(1.2, 3.62, 0, 2.8, 3.66, 4);
      }), mtx(x0, y0, z0), base);
      I.place(part('info-kiosk', (L) => {
        const wood = L('m', 0x6b4a33, PAT.WOOD), brass = L('t', 0xb08d57);
        wood.geo(lathe('ik', [[0.65, 0], [0.65, 1.0], [0.72, 1.05], [0.001, 1.08]], 24), mtx());
        brass.put(SHAPES.cyl, 0, 1.6, 0, 0.05, 1.0, 0.05);
        brass.geo(lathe('ikcap', [[0.2, 0], [0.3, 0.1], [0.001, 0.2]], 12), mtx(0, 2.1, 0));
      }), mtx(x0 + 2, y0 + F, z0 + 2), base);
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P(FU.clockPart(0.22), 2 + nx * 0.3, 2 + nz * 0.3, Math.atan2(nx, nz), null, 2.15 + 0.35);
      P(FU.boardPart(2.0, 0xffb347), 2, 0.2, 0, null, 2.4);
      P(benchPart(), 0.8, 3.3, Math.PI);
      P(benchPart(), 3.2, 3.3, Math.PI);
      break;
    case 'ticketing':
      P(FU.barCounterPart(3.6), 2, 3.3, Math.PI, { wood: 0x6e4b2e, accent: 0xb08d57, neon: 0xffe7b0 });
      I.place(part('ticket-glass', (L) => {
        for (let k = 0; k < 4; k++) { L('glass', 0xcfe6ee).bx(0.35 + k * 0.95, 1.3, 3.0, 1.2 + k * 0.95, 2.3, 3.03); L('t', 0xb08d57).bx(0.3 + k * 0.95, 2.3, 2.98, 1.25 + k * 0.95, 2.36, 3.05); L('l', 0x2f7de0).bx(0.55 + k * 0.95, 2.4, 3.0, 1.0 + k * 0.95, 2.6, 3.02); }
      }), mtx(x0, y0, z0), base);
      P(FU.ticketMachinePart(0xe76f51), 0.5, 0.4);
      P(FU.ticketMachinePart(0xe76f51), 1.3, 0.4);
      P(stanchions(), 2.8, 1.6);
      break;
    case 'waitingroom':
      for (const z of [0.9, 2.2]) { P(benchPart(), 1.0, z, 0, { wood: 0x8a5a34 }); P(benchPart(), 3.0, z, 0, { wood: 0x8a5a34 }); }
      P(pottedPlantPart(R(), 1.5), 0.4, 3.5);
      P(pottedPlantPart(R(), 1.5), 3.6, 3.5);
      P(FU.clockPart(0.4), 2, 3.9, Math.PI, null, 2.6);
      P(FU.chandelierPart(0.45), 2, 1.6, 0, null, 2.75);
      break;
    case 'baggage':
      P(FU.carouselPart(), 2, 1.3);
      P(FU.lockersPart(3.6, 2.0), 2, 3.6, Math.PI, { metal: 0x3a6ea5 });
      break;
    case 'busdeck': {
      for (const x of [0.1, 3.85]) B(G.m, x, F + 0.005, 0.4, 0.05, 0.005, 3.2, 0xf2c14e);
      const bus = busParts(3.5), col = { paint: pick([0x2a9d8f, 0xe76f51, 0x3a6ea5, 0xf2c14e, 0xecf0f1]), stripe: 0x264653 };
      P(bus.paint, 2, 1.7, 0, col, F, 1);
      P(bus.rest, 2, 1.7, 0, col, F, 1);
      Bv(G.m, 0.3, F, 3.3, 3.4, 0.2, 0.5, [0x9a968d, PAT.CONCRETE]);
      P(benchPart(), 2, 3.5, Math.PI, null, F + 0.2);
      break;
    }
    case 'busramp':
      I.place(busRampGeo(), mtx(x0 + 2, y0 + F, z0 + 2), base);
      break;
    case 'bikehub':
      for (let i = 0; i < 5; i++) {
        P(FU.bicyclePart(), 0.5 + i * 0.7, 1.1, 0, { accent: pick([0xe63946, 0x2a9d8f, 0xf4a261, 0x3a6ea5, 0x80ed99]) });
        P(bollardPart(), 0.5 + i * 0.7, 0.35, 0, null, F, 0.9);
      }
      Bv(G.m, 0.3, F + 0.9, 3.8, 3.4, 1.3, 0.05, [0x8a6a4a, PAT.WOOD]);
      P(FU.weightRackPart(), 2.5, 3.0, Math.PI, null, F, 0.6);
      break;
  }
}
