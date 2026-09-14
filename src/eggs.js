// Easter eggs: special combinations of blocks transform rooms and add animated effects.
import * as THREE from 'three';
import { MODULES, CELL } from './catalog.js';
import { SHAPES, PAT, lathe, tube, foliage, extrudeShape, hash } from './geo.js';
import { part, mtx } from './kit.js';
import { rbox } from './props.js';
import * as FU from './furniture.js';

export const EGG_INFO = {
  collection: { name: 'Curated Collection', hint: 'Connect two art galleries.' },
  museum: { name: 'Natural History Museum', hint: 'Connect four or more galleries.' },
  grandmuseum: { name: 'Museum of Antiquities', hint: 'Connect six or more galleries.' },
  aquarium: { name: 'City Aquarium', hint: 'A gallery touching a natatorium.' },
  bookcafe: { name: 'Book Café', hint: 'A café touching a library.' },
  disco: { name: 'Disco Inferno', hint: 'A speakeasy club directly below a ballroom.' },
  imax: { name: 'IMAX Theater', hint: 'Two cinemas side by side.' },
  hologram: { name: 'AI Lab', hint: 'A research lab touching a data center.' },
  forest: { name: 'Vertical Forest', hint: 'Stack three sky gardens.' },
  foodcart: { name: 'Street Food', hint: 'A park next to a café or market.' },
  grandfountain: { name: 'Grand Fountain', hint: 'Surround a fountain plaza with plazas.' },
  flamingo: { name: 'Pink Flamingo', hint: 'A rooftop pool deck above a penthouse.' },
  heli: { name: 'Air Taxi', hint: 'A helipad on a building with an observation deck.' },
  fireworks: { name: 'Nightly Fireworks', hint: 'A sky bar and observation deck in a 20+ floor tower.' },
};

const N6 = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
const N4 = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

export function detectEggs(city) {
  const eggs = new Map(), found = new Set(), effects = [];
  const K = (c) => `${c.x},${c.y},${c.z}`;
  const nb = (c, dirs) => dirs.map(([dx, dy, dz]) => city.get(c.x + dx, c.y + dy, c.z + dz)).filter(Boolean);
  const put = (c, data) => eggs.set(K(c), { ...(eggs.get(K(c)) || {}), ...data });

  const seen = new Set();
  for (const c of city.cells.values()) {
    if (c.m !== 'gallery' || seen.has(K(c))) continue;
    const list = [], stack = [c];
    seen.add(K(c));
    while (stack.length) {
      const cur = stack.pop();
      list.push(cur);
      for (const n of nb(cur, N6)) if (n.m === 'gallery' && !seen.has(K(n))) { seen.add(K(n)); stack.push(n); }
    }
    if (list.length < 2) continue;
    list.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
    found.add('collection');
    if (list.length >= 4) found.add('museum');
    if (list.length >= 6) found.add('grandmuseum');
    list.forEach((g, i) => put(g, { type: 'gallery', n: list.length, i }));
  }

  for (const c of city.cells.values()) {
    const m = c.m;
    if (m === 'pool' || m === 'gallery') {
      const other = m === 'pool' ? 'gallery' : 'pool';
      if (nb(c, N6).some((n) => n.m === other)) { put(c, m === 'pool' ? { type: 'aquarium' } : { type: eggs.get(K(c))?.type || 'gallery', n: eggs.get(K(c))?.n || 1, i: eggs.get(K(c))?.i ?? 9, tank: true }); found.add('aquarium'); if (m === 'pool') effects.push({ type: 'fish', c }); }
    }
    if (m === 'cafe' && nb(c, N6).some((n) => n.m === 'library')) { put(c, { type: 'bookcafe' }); found.add('bookcafe'); }
    if (m === 'ballroom' && city.get(c.x, c.y - 1, c.z)?.m === 'nightclub') { put(c, { type: 'disco' }); found.add('disco'); effects.push({ type: 'disco', c }); }
    if (m === 'cinema' && nb(c, N4).some((n) => n.m === 'cinema')) { put(c, { type: 'imax' }); found.add('imax'); }
    if (m === 'lab' && nb(c, N6).some((n) => n.m === 'datacenter')) { put(c, { type: 'hologram' }); found.add('hologram'); effects.push({ type: 'holo', c }); }
    if (m === 'skygarden') {
      let n = 1;
      for (let y = c.y + 1; city.get(c.x, y, c.z)?.m === 'skygarden'; y++) n++;
      for (let y = c.y - 1; city.get(c.x, y, c.z)?.m === 'skygarden'; y--) n++;
      if (n >= 3) { put(c, { type: 'forest' }); found.add('forest'); }
    }
    if (MODULES[m].park && nb(c, N4).some((n) => n.m === 'cafe' || n.m === 'market')) { put(c, { type: 'foodcart' }); found.add('foodcart'); }
    if (m === 'fountainplaza' && nb(c, N4).filter((n) => n.m === 'plaza' || n.m === 'fountainplaza').length === 4) { put(c, { type: 'grandfountain' }); found.add('grandfountain'); }
    if (m === 'roofpool' && city.get(c.x, c.y - 1, c.z)?.m === 'penthouse') { put(c, { type: 'flamingo' }); found.add('flamingo'); }
  }

  for (const B of city.buildings.values()) {
    if (B.park) continue;
    const pad = B.cells.find((c) => c.m === 'helipad');
    const has = (id) => B.cells.some((c) => c.m === id);
    if (pad && has('observation')) { found.add('heli'); effects.push({ type: 'heli', c: pad, b: B.id }); }
    if (has('skybar') && has('observation') && B.stats.topFloor >= 20) { found.add('fireworks'); effects.push({ type: 'fireworks', b: B.id, bbox: B.bbox }); }
  }
  return { eggs, found, effects };
}

// ---------------------------------------------------------------- egg parts
const BONE = 0xe8dcc0;
export function dinosaurPart() {
  return part('egg:trex', (L) => {
    const b = L('m', BONE), steel = L('t', 0x3a3d40), plinth = L('m', 0x2b2b2b, PAT.MARBLE), brass = L('t', 0xc9a14a);
    plinth.bv(-1.8, 0, -0.7, 1.8, 0.3, 0.7, 0.03);
    brass.bx(-0.3, 0.1, 0.7, 0.3, 0.25, 0.72);
    const spine = [[-1.7, 0.9], [-1.35, 1.05], [-1.0, 1.25], [-0.65, 1.45], [-0.3, 1.62], [0.05, 1.72], [0.4, 1.78], [0.72, 1.85], [0.95, 2.05], [1.12, 2.28]];
    spine.forEach(([x, y], i) => { const s = 0.07 + Math.sin((i / 9) * Math.PI) * 0.06; b.put(SHAPES.ico, x, y + 0.3, 0, s * 1.3, s, s); b.put(SHAPES.box, x, y + 0.3 + s + 0.05, 0, 0.03, 0.12, 0.02, 0, 0, 0.3); });
    b.geo(tube('trex-spine', spine.map(([x, y]) => [x, y + 0.3, 0]), 0.035, 30, 6), mtx());
    for (let i = 0; i < 7; i++) {
      const x = -0.3 + i * 0.16, h = 0.45 - Math.abs(i - 3) * 0.05;
      for (const s of [-1, 1]) b.geo(tube(`trex-rib:${i}:${s}`, [[x, 2.0, 0], [x + 0.03, 1.85, s * 0.28], [x + 0.05, 2.0 - h, s * 0.2], [x + 0.06, 2.0 - h - 0.1, s * 0.05]], 0.018, 10, 4), mtx(0, -0.05 + i * 0.01, 0));
    }
    b.geo(rbox(0.55, 0.32, 0.26, 0.08), mtx(1.38, 2.62, 0, 0, 0, -0.25));
    b.geo(rbox(0.45, 0.08, 0.2, 0.03), mtx(1.42, 2.35, 0, 0, 0, -0.45));
    L('m', 0x1a1a1a).put(SHAPES.sphere, 1.3, 2.7, 0.12, 0.05, 0.05, 0.02);
    for (let t = 0; t < 7; t++) b.put(SHAPES.cone4, 1.2 + t * 0.07, 2.47 - t * 0.02, 0.1, 0.012, 0.06, 0.012, Math.PI);
    for (const s of [-1, 1]) {
      b.geo(rbox(0.35, 0.3, 0.12, 0.05), mtx(-0.35, 1.72, s * 0.15));
      b.geo(tube(`trex-leg:${s}`, [[-0.35, 1.65, s * 0.18], [-0.1, 1.05, s * 0.22], [-0.45, 0.65, s * 0.22], [-0.25, 0.33, s * 0.24]], 0.05, 12, 6), mtx());
      b.geo(rbox(0.35, 0.05, 0.14, 0.02), mtx(-0.12, 0.33, s * 0.24));
      b.geo(tube(`trex-arm:${s}`, [[0.75, 1.95, s * 0.15], [0.9, 1.75, s * 0.2], [1.0, 1.72, s * 0.22]], 0.02, 6, 4), mtx());
    }
    for (const x of [-0.35, 0.7]) steel.put(SHAPES.cyl8, x, 1.0, 0, 0.02, 1.5, 0.02);
  });
}

export function whalePart() {
  return part('egg:whale', (L) => {
    const b = L('m', BONE), wire = L('t', 0x9aa1a6);
    const spine = Array.from({ length: 14 }, (_, i) => { const t = i / 13; return [-1.9 + t * 3.8, Math.sin(t * Math.PI) * 0.25, 0]; });
    spine.forEach(([x, y], i) => b.put(SHAPES.ico, x, y, 0, 0.11 - Math.abs(i - 5) * 0.006, 0.08, 0.08));
    b.geo(tube('whale-spine', spine, 0.04, 30, 6), mtx());
    for (let i = 3; i < 10; i++) for (const s of [-1, 1]) b.geo(tube(`whale-rib:${i}:${s}`, [[spine[i][0], spine[i][1], 0], [spine[i][0], spine[i][1] - 0.2, s * 0.4], [spine[i][0] + 0.05, spine[i][1] - 0.55, s * 0.3]], 0.02, 8, 4), mtx());
    b.put(SHAPES.sphere, -2.15, 0.02, 0, 0.45, 0.14, 0.32);
    for (const s of [-1, 1]) b.geo(tube(`whale-fin:${s}`, [[-1.1, -0.1, s * 0.3], [-0.8, -0.35, s * 0.7], [-0.5, -0.45, s * 0.85]], 0.03, 8, 4), mtx());
    for (const x of [-1.5, 0.5]) wire.put(SHAPES.cyl8, x, 0.6, 0, 0.005, 1.1, 0.005);
  });
}

export function egyptianPart() {
  return part('egg:egypt', (L) => {
    const gold = L('t', 0xd4af37), lapis = L('m', 0x1f3a7a), sand = L('m', 0xd8b878, PAT.ASHLAR), glass = L('glass', 0xcfe6ee), plinth = L('m', 0x2b2b2b);
    plinth.bv(-0.5, 0, -1.1, 0.5, 0.7, 1.1, 0.02);
    gold.geo(rbox(0.6, 0.35, 1.9, 0.15), mtx(0, 0.88, 0));
    for (let i = 0; i < 6; i++) lapis.bx(-0.305, 0.8, -0.8 + i * 0.3, 0.305, 0.86, -0.72 + i * 0.3);
    gold.put(SHAPES.sphere, 0, 1.05, -0.72, 0.22, 0.12, 0.2);
    lapis.put(SHAPES.box, 0, 1.08, -0.55, 0.36, 0.04, 0.3);
    glass.bx(-0.55, 0.7, -1.15, 0.55, 1.5, -1.13); glass.bx(-0.55, 0.7, 1.13, 0.55, 1.5, 1.15);
    glass.bx(-0.57, 0.7, -1.15, -0.55, 1.5, 1.15); glass.bx(0.55, 0.7, -1.15, 0.57, 1.5, 1.15); glass.bx(-0.57, 1.5, -1.15, 0.57, 1.52, 1.15);
    const pyr = new THREE.ConeGeometry(0.7, 1.0, 4).toNonIndexed(); pyr.computeVertexNormals();
    sand.geo(pyr, mtx(1.3, 0.5, 1.2, 0, Math.PI / 4, 0));
    gold.geo(lathe('egg-anubis', [[0.2, 0], [0.18, 0.1], [0.12, 0.5], [0.15, 0.7], [0.08, 0.9], [0.1, 1.05], [0.001, 1.1]], 12), mtx(1.3, 0, -1.2));
    gold.put(SHAPES.cone4, 1.25, 1.2, -1.2, 0.03, 0.2, 0.03); gold.put(SHAPES.cone4, 1.35, 1.2, -1.2, 0.03, 0.2, 0.03);
  });
}

export function aquariumTankPart() {
  return part('egg:tank', (L) => {
    const glass = L('glass', 0x6ab8d8), sand = L('m', 0xe8d8a8, PAT.GRAVEL), frame = L('t', 0x2b2b2b), glow = L('l', 0x9ad8ff);
    frame.bv(-1.8, 0, -0.45, 1.8, 0.5, 0.45, 0.02);
    glass.bx(-1.75, 0.5, -0.4, 1.75, 2.6, 0.4);
    sand.bx(-1.74, 0.5, -0.39, 1.74, 0.65, 0.39);
    frame.bv(-1.8, 2.6, -0.45, 1.8, 2.75, 0.45, 0.02);
    glow.bx(-1.7, 2.58, -0.3, 1.7, 2.6, 0.3);
    for (let i = 0; i < 7; i++) {
      const x = -1.5 + i * 0.5;
      L('m', [0xff6f61, 0xffb347, 0xc77dff, 0x7cff9a][i % 4]).geo(foliage(i * 0.13), mtx(x, 0.75, (i % 2) * 0.2 - 0.1, 0, i, 0, 0.15, 0.2 + (i % 3) * 0.08, 0.12));
      L('m', 0x3f8a4a, PAT.GRASS).put(SHAPES.cyl8, x + 0.2, 1.1, -0.2, 0.02, 0.9 + (i % 2) * 0.4, 0.02, 0, 0, Math.sin(i) * 0.2);
    }
    L('m', 0x6d6a66).geo(foliage(0.5), mtx(0.4, 0.75, 0.1, 0, 0, 0, 0.4, 0.25, 0.25));
  });
}

const THEMES = {
  deco: [0xd4af37, 0x1a1a1a, 0xe8dcc0, 0x2a5a5a],
  gothic: 'stained', futurist: 'neon', glass: 'neon', nouveau: [0x5e8c41, 0xe8a0b8, 0xd4af37, 0x3f7d68],
  beaux: [0x8c2f2f, 0xd8b878, 0x2f4a3a, 0x6b4a33], brutalist: [0x5a5a5a, 0xe76f51, 0x1a1a1a, 0xd8d2c8],
  mediterranean: [0x2a66b0, 0xf4a261, 0xf4f1ea, 0x3f6b3a], midcentury: [0x2a9d8f, 0xe9c46a, 0xe76f51, 0x264653],
};

function stainedGlassPart() {
  return part('egg:stained', (L) => {
    const lead = L('m', 0x1a1a1a), cols = [0xe63946, 0x2f6fd0, 0xf2c14e, 0x3a9a5a, 0x9b5de5];
    lead.put(SHAPES.torus, 0, 0, 0, 0.55, 0.55, 0.6);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + r * 0.2, rr = 0.12 + r * 0.16;
      L('l', cols[(k + r) % 5]).put(SHAPES.cyl8, Math.cos(a) * rr, Math.sin(a) * rr, 0, 0.08, 0.02, 0.08, Math.PI / 2);
    }
    L('l', 0xffd166).put(SHAPES.cyl, 0, 0, 0, 0.09, 0.025, 0.09, Math.PI / 2);
  });
}
function neonArtPart(k) {
  return part(`egg:neon:${k}`, (L) => {
    const frame = L('m', 0x111111), cols = [0xff3ea5, 0x3ef0ff, 0xffe03e, 0x7cff6b];
    frame.bv(-0.5, -0.4, -0.02, 0.5, 0.4, 0.02, 0.01);
    for (let i = 0; i < 4; i++) L('l', cols[(i + k) % 4]).geo(tube(`neonart:${k}:${i}`, Array.from({ length: 6 }, (_, j) => [-0.4 + j * 0.16, Math.sin(j * 1.3 + i + k) * 0.25, 0.03]), 0.012, 16, 4), mtx(0, (i - 1.5) * 0.08, 0));
  });
}

// Returns true when the egg fully replaces the room's normal contents.
export function eggInterior(ctx) {
  const { P, B, Bv, G, R, egg, style } = ctx;
  switch (egg.type) {
    case 'gallery': {
      if (egg.n >= 4 && egg.i === 0) {
        P(dinosaurPart(), 2, 2, 0.4);
        P(FU.benchPartAlias ? FU.benchPartAlias() : FU.chairPart(), 0.5, 3.5, Math.PI);
        return true;
      }
      if (egg.n >= 4 && egg.i === 1) { P(whalePart(), 2, 2, 0.2, null, 2.9); return true; }
      if (egg.n >= 6 && egg.i === 2) { P(egyptianPart(), 2, 2, 0); return true; }
      if (egg.tank) { P(aquariumTankPart(), 2, 3.4, Math.PI); }
      const theme = THEMES[style] || [0xe63946, 0x264653, 0xe9c46a, 0x2a9d8f];
      Bv(G.m, 1.9, 0.25, 0.4, 0.2, 2.8, egg.tank ? 1.8 : 2.4, [0xfafafa, PAT.STUCCO], 0.01);
      [[-1, 1.0], [-1, 2.2], [1, 1.0], [1, 2.2]].forEach(([s, z], i) => {
        if (egg.tank && z > 2) return;
        if (theme === 'stained') P(stainedGlassPart(), 2.0 + s * 0.13, z, s * Math.PI / 2, null, 1.7);
        else if (theme === 'neon') P(neonArtPart(i), 2.0 + s * 0.13, z, s * Math.PI / 2, null, 1.6);
        else P(FU.framedArtPart(0.9, 0.75, theme[i % theme.length]), 2.0 + s * 0.11, z, s * Math.PI / 2, null, 1.25);
      });
      if (!egg.tank) P(FU.sculpturePart(hash(egg.i, egg.n, 3)), 0.8, 3.2);
      return true;
    }
    case 'aquarium':
      P(aquariumTankPart(), 2, 3.55, Math.PI);
      return false;
    case 'bookcafe':
      P(FU.bookshelfPart(2.6, 2.4, 0.3, R()), 0.2, 2.0, Math.PI / 2);
      for (const [x, z] of [[1.1, 1.1], [1.1, 2.9]]) {
        P(part('egg:bookstack', (Lb) => { for (let i = 0; i < 4; i++) Lb('m', [0x8c2f2f, 0x2f4a7a, 0x3b7a5e, 0xb07a2a][i]).geo(rbox(0.22, 0.05, 0.16, 0.01), mtx(0, 0.025 + i * 0.05, 0, 0, i * 0.3, 0)); }), x + 0.15, z, 0, null, 0.25 + 0.6);
      }
      return false;
    case 'disco':
      P(FU.danceFloorPart(6, 0.55, R()), 2, 1.9, 0, null, 0.27);
      return false;
    case 'imax':
      P(part('egg:imax', (Li) => {
        Li('t', 0xd4af37).bv(-2.0, 0.6, -0.1, 2.0, 3.7, -0.02, 0.03);
        Li('l', 0xeaf2ff).bx(-1.9, 0.7, -0.02, 1.9, 3.6, 0.0);
        Li('m', 0x111111).bx(-0.6, 3.3, 0.0, 0.6, 3.5, 0.01);
        Li('l', 0x6ad8ff).bx(-0.5, 3.33, 0.01, 0.5, 3.47, 0.02);
      }), 2, 0.15);
      return false;
    case 'hologram':
      P(part('egg:holopad', (Lh) => {
        Lh('t', 0x2b2e33).geo(lathe('holo-base', [[0.5, 0], [0.5, 0.2], [0.38, 0.28], [0.001, 0.28]], 24), mtx());
        Lh('l', 0x3ef0ff).put(SHAPES.torus, 0, 0.27, 0, 0.42, 0.42, 0.4, Math.PI / 2);
      }), 2, 2.3);
      return false;
  }
  return false;
}

// ---------------------------------------------------------------- animated effects
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.t = 0;
  }

  set(effects, layout, city) {
    for (const it of this.items) this.group.remove(it.obj);
    this.items = [];
    const wx = (c) => layout.wx(c.x) + 2, wz = (c) => layout.wz(c.z) + 2;
    for (const e of effects) {
      if (e.type === 'heli') {
        const g = new THREE.Group();
        const body = new THREE.Mesh(rbox(3.2, 1.3, 1.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x1f3a5f, metalness: 0.5, roughness: 0.3 }));
        const glass = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshStandardMaterial({ color: 0x223040, metalness: 0.7, roughness: 0.1 }));
        glass.position.set(1.2, 0.15, 0); glass.scale.set(1, 0.8, 0.9);
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 3, 8), body.material);
        tail.rotation.z = Math.PI / 2; tail.position.set(-2.8, 0.25, 0);
        const rotor = new THREE.Group();
        for (let k = 0; k < 4; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: 0x222222 })); bl.rotation.y = (k * Math.PI) / 4; rotor.add(bl); }
        rotor.position.y = 0.95;
        const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        skid.position.set(0, -0.85, 0.55);
        const skid2 = skid.clone(); skid2.position.z = -0.55;
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
        light.position.set(-4.2, 0.4, 0);
        g.add(body, glass, tail, rotor, skid, skid2, light);
        this.group.add(g);
        this.items.push({ type: 'heli', obj: g, rotor, cx: wx(e.c), cy: e.c.y * CELL + 18, cz: wz(e.c), phase: Math.random() * 6 });
      } else if (e.type === 'fireworks') {
        const N = 500;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        pts.frustumCulled = false;
        this.group.add(pts);
        const bb = e.bbox;
        this.items.push({ type: 'fireworks', obj: pts, N, vel: new Float32Array(N * 3), life: new Float32Array(N), next: 0, cx: layout.wx((bb.x0 + bb.x1 + 1) / 2), cy: (bb.y1 + 1) * CELL + 25, cz: layout.wz((bb.z0 + bb.z1 + 1) / 2), b: e.b });
      } else if (e.type === 'holo') {
        const g = new THREE.Group();
        const m = new THREE.MeshBasicMaterial({ color: 0x3ef0ff, wireframe: true, transparent: true, opacity: 0.85 });
        const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), m);
        const b = new THREE.Mesh(new THREE.TorusKnotGeometry(0.22, 0.05, 48, 6), new THREE.MeshBasicMaterial({ color: 0x9b5de5, transparent: true, opacity: 0.9 }));
        g.add(a, b);
        g.position.set(layout.wx(e.c.x) + 2, e.c.y * CELL + 1.5, layout.wz(e.c.z) + 2.3);
        this.group.add(g);
        this.items.push({ type: 'holo', obj: g, a, b, bId: e.c.b });
      } else if (e.type === 'fish') {
        const N = 14;
        const geo = new THREE.ConeGeometry(0.06, 0.22, 6); geo.rotateZ(-Math.PI / 2);
        const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
        const cols = [0xff6f61, 0xffb347, 0x6ad8ff, 0xffe03e, 0xc77dff];
        for (let i = 0; i < N; i++) im.setColorAt(i, new THREE.Color(cols[i % 5]));
        im.frustumCulled = false;
        this.group.add(im);
        this.items.push({ type: 'fish', obj: im, N, x: layout.wx(e.c.x) + 2, y: e.c.y * CELL + 1.6, z: layout.wz(e.c.z) + 3.55, bId: e.c.b, d: new THREE.Object3D() });
      } else if (e.type === 'disco') {
        const g = new THREE.Group();
        const cols = [0xff3ea5, 0x3ef0ff, 0xffe03e, 0x7cff6b];
        for (let k = 0; k < 4; k++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: cols[k], transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
          cone.position.y = -1.6;
          const pivot = new THREE.Group(); pivot.add(cone); pivot.rotation.z = 0.5; pivot.rotation.y = (k * Math.PI) / 2;
          g.add(pivot);
        }
        g.position.set(layout.wx(e.c.x) + 2, e.c.y * CELL + 3.7, layout.wz(e.c.z) + 2);
        this.group.add(g);
        this.items.push({ type: 'disco', obj: g, bId: e.c.b });
      }
    }
  }

  // view: { activeId, interior }
  update(dt, night, view) {
    this.t += dt;
    for (const it of this.items) {
      if (it.type === 'heli') {
        const a = this.t * 0.35 + it.phase;
        it.obj.position.set(it.cx + Math.cos(a) * 26, it.cy + Math.sin(a * 2) * 3, it.cz + Math.sin(a) * 26);
        it.obj.rotation.y = -a - Math.PI / 2 + Math.PI;
        it.rotor.rotation.y += dt * 30;
      } else if (it.type === 'holo' || it.type === 'disco' || it.type === 'fish') {
        const vis = view.interior && view.activeId === it.bId;
        it.obj.visible = vis;
        if (!vis) continue;
        if (it.type === 'holo') { it.a.rotation.y += dt * 0.8; it.a.rotation.x += dt * 0.3; it.b.rotation.y -= dt * 1.4; it.obj.position.y += Math.sin(this.t * 2) * 0.002; }
        if (it.type === 'disco') it.obj.rotation.y += dt * 1.2;
        if (it.type === 'fish') {
          for (let i = 0; i < it.N; i++) {
            const s = this.t * (0.3 + (i % 4) * 0.1) + i * 1.7;
            const x = Math.sin(s) * 1.5, y = Math.sin(s * 0.7 + i) * 0.7, dx = Math.cos(s);
            it.d.position.set(it.x + x, it.y + y, it.z + Math.sin(i * 2.1) * 0.25);
            it.d.rotation.set(0, dx > 0 ? 0 : Math.PI, 0);
            it.d.updateMatrix();
            it.obj.setMatrixAt(i, it.d.matrix);
          }
          it.obj.instanceMatrix.needsUpdate = true;
        }
      } else if (it.type === 'fireworks') {
        it.obj.visible = night > 0.5;
        if (!it.obj.visible) continue;
        const pos = it.obj.geometry.attributes.position, col = it.obj.geometry.attributes.color;
        it.next -= dt;
        if (it.next <= 0) {
          it.next = 0.7 + Math.random() * 1.2;
          const ox = it.cx + (Math.random() - 0.5) * 30, oy = it.cy + Math.random() * 15, oz = it.cz + (Math.random() - 0.5) * 30;
          const c = new THREE.Color().setHSL(Math.random(), 1, 0.6);
          let spawned = 0;
          for (let i = 0; i < it.N && spawned < 110; i++) {
            if (it.life[i] > 0) continue;
            const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 9 + Math.random() * 4;
            pos.setXYZ(i, ox, oy, oz);
            it.vel[i * 3] = r * Math.cos(th) * sp; it.vel[i * 3 + 1] = u * sp; it.vel[i * 3 + 2] = r * Math.sin(th) * sp;
            it.life[i] = 1.6 + Math.random() * 0.6;
            col.setXYZ(i, c.r, c.g, c.b);
            spawned++;
          }
        }
        for (let i = 0; i < it.N; i++) {
          if (it.life[i] <= 0) { pos.setXYZ(i, 0, -9999, 0); continue; }
          it.life[i] -= dt;
          it.vel[i * 3 + 1] -= 6 * dt;
          for (let a = 0; a < 3; a++) it.vel[i * 3 + a] *= 1 - dt * 0.8;
          pos.setXYZ(i, pos.getX(i) + it.vel[i * 3] * dt, pos.getY(i) + it.vel[i * 3 + 1] * dt, pos.getZ(i) + it.vel[i * 3 + 2] * dt);
          const f = Math.max(0, Math.min(1, it.life[i]));
          col.setXYZ(i, col.getX(i) * (0.985 + f * 0.015), col.getY(i) * (0.985 + f * 0.015), col.getZ(i) * (0.985 + f * 0.015));
        }
        pos.needsUpdate = true;
        col.needsUpdate = true;
      }
    }
  }
}
