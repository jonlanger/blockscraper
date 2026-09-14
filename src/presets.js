// City templates: the classic neighborhood, and a procedurally generated random city.
import { MODULES, STYLE_ORDER } from './catalog.js';
import { rng } from './geo.js';

// ---------------------------------------------------------------- classic
export function applyClassic(city) {
  const L = city.layout, names = [];
  const lot = (i, j, r, k) => L.lots.find((l) => l.block[0] === i && l.block[1] === j && l.row === r && l.k === k);
  const j0 = 0, j1 = Math.min(1, L.blocksZ - 1), r1 = L.blocksZ > 1 ? 0 : 0;
  const targets = [0, 1, 2, 3].map((k) => lot(0, j0, 1, k) || lot(1, j0, 1, k - L.lotsPerRow));
  targets.push(...[0, 1, 2, 3].map((k) => lot(0, j1, r1, k) || lot(1, j1, r1, k - L.lotsPerRow)));
  const B = targets.map((lt) => ({
    set(x, y, z, m, s, v = 0) { if (!lt || x < 0 || z < 0 || x >= lt.w || z >= lt.d) return; city.set(lt.gx + x, y, lt.gz + z, m, s, v); },
    set name(n) { if (lt) names.push([lt.gx + 2, 0, lt.gz + 2, n]); },
  }));
  classicBuildings(B);

  // Parks and plazas across the street grid, many modeled on famous gardens and squares. The
  // world-inspired types lay out a composition across their whole lot, so they fill lots whole.
  const fillLot = (lt, id, s = 'deco') => { if (!lt) return; for (let x = 0; x < lt.w; x++) for (let z = 0; z < lt.d; z++) city.set(lt.gx + x, 0, lt.gz + z, id, s); };
  if (L.blocksX > 1) {
    const a = lot(1, j0, 1, 0), b = lot(1, j0, 1, 1), c = lot(1, j0, 1, 2), d = lot(1, j0, 1, 3);
    fillLot(a, 'plaza'); fillLot(b, 'plaza');
    if (a) city.set(a.gx + a.w - 1, 0, a.gz + 2, 'fountainplaza', 'deco');
    fillLot(c, 'parterre');
    fillLot(d, 'lawnpark');
    if (d) { for (let x = 1; x < 4; x++) for (let z = 1; z < 3; z++) city.set(d.gx + x, 0, d.gz + z, 'pond', 'deco'); names.push([d.gx, 0, d.gz, 'Crown Park']); }
    const e = lot(1, j1, r1, 0), f = lot(1, j1, r1, 1), g = lot(1, j1, r1, 2), h = lot(1, j1, r1, 3);
    fillLot(e, 'playground'); fillLot(f, 'foodcourt'); fillLot(g, 'zengarden'); fillLot(h, 'court');
    if (j1 !== j0) {
      // Behind Crown Park: twin Tuileries basins (one region, two rooms), a Roman piazza, a Lisbon promenade.
      fillLot(lot(1, j0, 0, 0), 'bassin'); fillLot(lot(1, j0, 0, 1), 'bassin');
      fillLot(lot(1, j0, 0, 2), 'starpiazza'); fillLot(lot(1, j0, 0, 3), 'wavepaving');
      // Behind the playground: Alhambra water garden, Palais-Royal bosque, Bordeaux water mirror, Lovejoy steps.
      const w = lot(1, j1, 1, 0);
      fillLot(w, 'chahar'); fillLot(lot(1, j1, 1, 1), 'bosque'); fillLot(lot(1, j1, 1, 2), 'jetgrid'); fillLot(lot(1, j1, 1, 3), 'cascade');
      if (w) names.push([w.gx, 0, w.gz, 'Meridian Commons']);
    }
  }
  // A landscape behind the Aurora: a pine hill, a beach-ringed lake, a meadow and woods.
  const row = [0, 1, 2, 3].map((k) => lot(0, j0, 0, k)).filter(Boolean);
  if (row.length && j1 !== j0) {
    const gx0 = row[0].gx, gz0 = row[0].gz, W = row.reduce((s, l) => s + l.w, 0), D = row[0].d;
    const lx = W * 0.55, lz = (D - 1) / 2, rx = W * 0.2, rz = Math.max(1.2, D * 0.45);
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      const e = ((x - lx) / rx) ** 2 + ((z - lz) / rz) ** 2;
      let t = 'meadow', h = 0;
      if (e < 0.45) t = 'lake';
      else if (e < 1) t = 'shallows';
      else if (e < 1.8) t = 'sand';
      else if (x < W * 0.3) { t = x < W * 0.2 ? 'pines' : 'forest'; h = Math.max(0, Math.round(8 * Math.sin((Math.PI * (x + 0.5)) / (W * 0.3))) - (z === 0 || z === D - 1 ? 2 : 0)); }
      else if (x > W * 0.85) { t = 'forest'; h = 1; }
      city.setTerrain(gx0 + x, gz0 + z, { t, h });
    }
  }
  city.recompute();
  city.applyNames(names);
}

function classicBuildings(B) {
  const fill = (b, x0, x1, z0, z1, y0, y1, m, s) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) b.set(x, y, z, m, s);
  };
  const core = (b, x, z, y0, y1, s) => { for (let y = y0; y <= y1; y++) b.set(x, y, z, 'core', s); };

  { const b = B[1], s = 'deco'; b.name = 'The Aurora';
    fill(b, 0, 5, 0, 4, -5, -3, 'foundation', s);
    fill(b, 0, 5, 0, 1, -2, -2, 'parking', s); fill(b, 0, 5, 2, 4, -2, -2, 'mall', s); fill(b, 1, 4, 4, 4, -2, -2, 'station', s);
    fill(b, 0, 5, 0, 3, -1, -1, 'parking', s); fill(b, 0, 5, 4, 4, -1, -1, 'shop', s);
    fill(b, 0, 5, 0, 1, 0, 0, 'utility', s); fill(b, 0, 5, 2, 2, 0, 0, 'cafe', s); fill(b, 0, 5, 3, 4, 0, 0, 'shop', s); fill(b, 2, 3, 3, 4, 0, 0, 'lobby', s);
    fill(b, 0, 5, 0, 4, 1, 11, 'office', s); fill(b, 0, 5, 0, 0, 6, 6, 'utility', s);
    fill(b, 1, 4, 1, 3, 12, 23, 'hotel', s); fill(b, 2, 3, 1, 3, 24, 33, 'office', s);
    fill(b, 2, 3, 1, 3, 34, 34, 'skybar', s); fill(b, 2, 3, 1, 3, 35, 35, 'observation', s);
    core(b, 2, 2, -3, 35, s); b.set(2, 36, 2, 'spire', s);
    for (const z of [1, 2, 3]) { b.set(0, 12, z, 'roofgarden', s); b.set(5, 12, z, 'roofgarden', s); }
  }
  { const b = B[2], s = 'nouveau'; b.name = 'Maison Verdure';
    fill(b, 0, 5, 1, 4, -1, -1, 'foundation', s);
    fill(b, 0, 5, 1, 4, 0, 0, 'shop', s); fill(b, 0, 1, 4, 4, 0, 0, 'cafe', s); fill(b, 2, 3, 4, 4, 0, 0, 'lobby', s); fill(b, 0, 5, 1, 1, 0, 0, 'utility', s);
    fill(b, 0, 5, 1, 4, 1, 6, 'condo', s); core(b, 2, 2, 0, 6, s);
    fill(b, 0, 5, 1, 4, 7, 7, 'mansard', s);
    b.set(2, 7, 2, 'dome', s); b.set(3, 7, 3, 'dome', s);
  }
  { const b = B[3], s = 'brick'; b.name = 'Foundry Lofts';
    fill(b, 0, 5, 2, 4, -1, -1, 'foundation', s);
    fill(b, 0, 5, 2, 4, 0, 0, 'shop', s); fill(b, 4, 5, 2, 3, 0, 0, 'cafe', s); b.set(2, 0, 4, 'lobby', s);
    fill(b, 0, 5, 2, 4, 1, 2, 'office', s); fill(b, 0, 5, 2, 4, 3, 5, 'condo', s); core(b, 2, 3, 0, 5, s);
    b.set(4, 6, 3, 'watertower', s); fill(b, 0, 1, 2, 4, 6, 6, 'gable', s); b.set(3, 6, 3, 'roofbar', s);
  }
  { const b = B[4], s = 'brutalist'; b.name = 'Civic Transit Center';
    fill(b, 0, 5, 0, 4, -5, -5, 'foundation', s); fill(b, 0, 5, 1, 4, -4, -3, 'foundation', s);
    fill(b, 1, 4, 0, 0, -4, -4, 'railplatform', s); fill(b, 0, 5, 1, 2, -4, -4, 'waitingroom', s);
    fill(b, 1, 4, 1, 2, -3, -3, 'ticketing', s); fill(b, 0, 0, 1, 2, -3, -3, 'baggage', s); fill(b, 0, 5, 0, 0, -3, -3, 'subwayconcourse', s);
    fill(b, 1, 4, 0, 0, -2, -2, 'station', s); fill(b, 0, 5, 1, 2, -2, -2, 'subwayconcourse', s); fill(b, 0, 5, 3, 4, -2, -2, 'mall', s);
    fill(b, 0, 5, 0, 4, -1, -1, 'parking', s); fill(b, 0, 2, 0, 1, -1, -1, 'bikehub', s); fill(b, 3, 5, 0, 2, -1, -1, 'trainhall', s);
    fill(b, 0, 2, 0, 0, 0, 0, 'busbay', s); fill(b, 3, 4, 0, 0, 0, 0, 'lobby', s); b.set(5, 0, 0, 'taxistand', s);
    fill(b, 0, 5, 1, 2, 0, 0, 'trainhall', s); fill(b, 0, 3, 3, 4, 0, 0, 'shop', s); fill(b, 4, 5, 3, 4, 0, 3, 'busramp', s);
    fill(b, 0, 5, 1, 2, 1, 3, 'busdeck', s); fill(b, 0, 3, 3, 4, 1, 3, 'busdeck', s);
    fill(b, 0, 5, 1, 4, 4, 8, 'office', s); fill(b, 0, 5, 4, 4, 4, 4, 'utility', s);
    core(b, 2, 2, -4, 8, s);
    fill(b, 0, 5, 1, 4, 9, 9, 'meadow', s); b.set(2, 9, 2, 'antenna', s); b.set(3, 9, 1, 'clocktower', s);
  }
  { const b = B[5], s = 'glass'; b.name = 'Meridian One';
    fill(b, 0, 5, 0, 4, -4, -3, 'foundation', s); fill(b, 0, 5, 0, 4, -2, -1, 'parking', s); fill(b, 1, 4, 0, 0, -2, -2, 'station', s);
    fill(b, 1, 4, 0, 3, 0, 0, 'shop', s); fill(b, 2, 3, 0, 0, 0, 0, 'lobby', s); b.set(1, 0, 3, 'cafe', s);
    fill(b, 1, 4, 0, 3, 1, 14, 'office', s); fill(b, 1, 4, 0, 3, 15, 15, 'skygarden', s);
    fill(b, 1, 4, 0, 3, 16, 27, 'hotel', s); fill(b, 1, 4, 0, 3, 28, 29, 'penthouse', s); b.set(4, 8, 3, 'utility', s);
    core(b, 2, 2, -2, 29, s); b.set(2, 30, 2, 'lantern', s); b.set(4, 30, 3, 'helipad', s); b.set(1, 30, 0, 'roofpool', s);
  }
  { const b = B[6], s = 'beaux'; b.name = 'The Carlton';
    fill(b, 0, 5, 0, 3, -1, -1, 'foundation', s);
    fill(b, 0, 5, 0, 3, 0, 0, 'shop', s); fill(b, 0, 1, 0, 0, 0, 0, 'cafe', s); fill(b, 2, 3, 0, 0, 0, 0, 'lobby', s); fill(b, 0, 5, 3, 3, 0, 0, 'utility', s);
    fill(b, 0, 5, 0, 3, 1, 1, 'gym', s); fill(b, 0, 5, 0, 3, 2, 8, 'hotel', s); core(b, 2, 2, 0, 8, s);
    b.set(2, 9, 1, 'dome', s); b.set(4, 9, 2, 'roofgarden', s);
  }
  { const b = B[7], s = 'gothic'; b.name = 'St. Clement Tower';
    fill(b, 1, 4, 0, 2, -2, -1, 'foundation', s);
    fill(b, 1, 4, 0, 2, 0, 0, 'shop', s); fill(b, 2, 3, 0, 0, 0, 0, 'lobby', s);
    fill(b, 1, 4, 0, 2, 1, 17, 'office', s); core(b, 2, 1, 0, 17, s);
    for (const [x, z] of [[1, 0], [4, 0], [1, 2], [4, 2]]) b.set(x, 18, z, 'pinnacle', s);
  }
}

// ---------------------------------------------------------------- random city
const CROWNS = {
  deco: ['spire', 'chrysler', 'roofgarden'], nouveau: ['mansard', 'dome'], glass: ['lantern', 'helipad', 'solar'],
  beaux: ['mansard', 'dome', 'clocktower'], gothic: ['pinnacle', 'clocktower', 'gable'], brutalist: ['antenna', 'coolingtower', 'meadow'],
  brick: ['watertower', 'gable', 'roofbar'], moderne: ['neonsign', 'beacon'], chicago: ['hipped', 'watertower'],
  midcentury: ['solar', 'roofpool'], futurist: ['turbine', 'helipad', 'glasspyramid'], mediterranean: ['hipped', 'roofgarden'],
  castiron: ['mansard', 'gable'], solarpunk: ['greenhouse', 'meadow', 'turbine'],
};
const COVER = new Set(['mansard', 'hipped', 'gable', 'meadow', 'solar', 'roofgarden', 'greenhouse']);
const PARKS = ['lawnpark', 'formalgarden', 'plaza', 'playground', 'court', 'pond', 'communitygarden', 'dogpark', 'sculpturegarden', 'amphitheater', 'foodcourt', 'skatepark', 'zengarden',
  'bassin', 'parterre', 'chahar', 'wavepaving', 'starpiazza', 'jetgrid', 'bosque', 'cascade'];

export function applyRandom(city, seed = Math.random()) {
  const L = city.layout, R = rng(seed + 0.123);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const scale = { small: 46, medium: 40, large: 30, huge: 22, vast: 16 }[L.cfg.map] || 30;
  const landscape = (gx0, gz0, w, d) => {
    const kind = pick(['forest', 'pines', 'meadow', 'pond', 'hill', 'farm']);
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
      const e = ((x - (w - 1) / 2) / (w / 2)) ** 2 + ((z - (d - 1) / 2) / (d / 2)) ** 2;
      let t = kind, h = 0;
      if (kind === 'pond') t = e < 0.25 ? 'lake' : e < 0.6 ? 'shallows' : e < 0.85 ? 'sand' : 'grass';
      if (kind === 'hill') { h = Math.max(0, Math.round(9 * (1 - e))); t = h > 4 ? 'pines' : h > 1 ? 'forest' : 'grass'; }
      city.setTerrain(gx0 + x, gz0 + z, { t, h });
    }
  };

  for (let j = 0; j < L.blocksZ; j++) for (let i = 0; i < L.blocksX; i++) for (let r = 0; r < 2; r++) {
    let k = 0;
    while (k < L.lotsPerRow) {
      const span = Math.min(L.lotsPerRow - k, R() < 0.28 ? 2 : R() < 0.08 ? 3 : 1);
      const lots = L.lots.filter((l) => l.block[0] === i && l.block[1] === j && l.row === r && l.k >= k && l.k < k + span);
      k += span;
      const gx0 = lots[0].gx, gz0 = lots[0].gz, w = lots[0].w * span, d = lots[0].d, front = lots[0].front;
      const roll = R();
      if (roll < 0.12) {
        const type = pick(PARKS);
        for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) city.set(gx0 + x, 0, gz0 + z, type, 'deco');
        if (type === 'plaza' && w >= 3) city.set(gx0 + Math.floor(w / 2), 0, gz0 + Math.floor(d / 2), 'fountainplaza', 'deco');
        continue;
      }
      if (roll < 0.17) { if (roll > 0.145) landscape(gx0, gz0, w, d); continue; }

      const cxn = (gx0 + w / 2) / L.sizeX - 0.5, czn = (gz0 + d / 2) / L.sizeZ - 0.5;
      const central = 1 - Math.min(1, Math.hypot(cxn, czn) * 1.8);
      const floors = Math.max(2, Math.floor(3 + R() * R() * scale * (0.35 + central)));
      const style = pick(STYLE_ORDER), v = Math.floor(R() * 5);
      // Leave a one-block gap on the shared plot edges so neighbors stay separate buildings.
      const inset = w > 5 && d > 5 && R() < 0.4 ? 1 : 0;
      const right = k < L.lotsPerRow ? 1 : inset;
      let x0 = gx0 + inset, x1 = gx0 + w - 1 - right, z0 = gz0 + (front === 3 ? 0 : Math.max(inset, 1)), z1 = gz0 + d - 1 - (front === 2 ? 0 : Math.max(inset, 1));
      const cx = Math.floor((x0 + x1) / 2), cz = Math.floor((z0 + z1) / 2);
      const area = (x1 - x0 + 1) * (z1 - z0 + 1);
      const piles = Math.max(0, Math.ceil((floors - 5) / 3));
      const touch = L.touchingHBand(cx, front === 2 ? z1 : z0);
      const rail = touch && touch.band === L.railBand && area >= 8 && R() < 0.5;
      const subway = touch && !rail && area >= 6 && R() < 0.35;
      const basement = Math.max(1, Math.ceil(piles / area) + (floors > 14 ? 1 : 0), rail ? 5 : subway ? 3 : 0);
      const S = (x, y, z, m) => city.set(x, y, z, m, style, v);
      const frontZ = front === 2 ? z1 : z0;

      for (let y = -basement; y <= -1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        let m = y === -basement ? 'foundation' : y === -1 ? 'parking' : 'parking';
        if (y === -2 && subway && z === frontZ) m = 'station';
        else if (y === -2 && (subway || rail) && z !== frontZ) m = 'subwayconcourse';
        if (rail && y === -4 && z === frontZ) m = 'railplatform';
        else if (rail && y === -4) m = 'waitingroom';
        if (rail && y === -2 && z === frontZ) m = 'station';
        if (rail && y === -3) m = z === frontZ ? 'ticketing' : 'foundation';
        S(x, y, z, m);
      }
      const hotelish = R();
      let bx0 = x0, bx1 = x1, bz0 = z0, bz1 = z1;
      const setbackEvery = 8 + Math.floor(R() * 8);
      for (let y = 0; y < floors; y++) {
        if (y > 0 && y % setbackEvery === 0 && bx1 - bx0 >= 3 && bz1 - bz0 >= 3) {
          const nx0 = Math.min(bx0 + 1, cx), nx1 = Math.max(bx1 - 1, cx), nz0 = Math.min(bz0 + 1, cz), nz1 = Math.max(bz1 - 1, cz);
          for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) if (x < nx0 || x > nx1 || z < nz0 || z > nz1) S(x, y, z, R() < 0.5 ? 'roofgarden' : 'solar');
          bx0 = nx0; bx1 = nx1; bz0 = nz0; bz1 = nz1;
        }
        for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) {
          if (city.get(x, y, z)) continue;
          let m;
          if (x === cx && z === cz) m = 'core';
          else if (y === 0) m = z === frontZ ? (Math.abs(x - cx) <= 0 ? 'lobby' : pick(['shop', 'shop', 'cafe', 'market', 'gallery', 'library', 'cinema'])) : pick(['shop', 'utility', 'cafe']);
          else if (y === floors - 1 && floors >= 20) m = pick(['observation', 'skybar', 'penthouse', 'skydining']);
          else if (y === 1 && R() < 0.4) m = pick(['gym', 'cafe', 'clinic', 'ballroom']);
          else if (hotelish < 0.35) m = 'office';
          else if (hotelish < 0.6) m = 'condo';
          else if (hotelish < 0.8) m = y >= 2 ? 'hotel' : 'office';
          else m = y >= 12 && R() < 0.3 ? 'skygarden' : pick(['office', 'condo', 'lab', 'classroom']);
          if (m === 'skygarden' && (x === bx0 || x === bx1)) m = 'office';
          if (MODULES[m].min > y) m = 'office';
          S(x, y, z, m);
        }
        if (!city.get(cx, y, z0 === frontZ ? z0 : z1)) { /* keep */ }
      }
      for (let y = -basement + 1; y < 0; y++) if (!['station', 'railplatform'].includes(city.get(cx, y, cz)?.m)) S(cx, y, cz, 'core');
      if (!city.get(cx, 0, frontZ) || city.get(cx, 0, frontZ).m !== 'lobby') S(cx === x0 ? cx + 1 : cx - 1 >= x0 ? cx - 1 : cx, 0, frontZ, 'lobby');
      const crown = pick(CROWNS[style]);
      if (COVER.has(crown)) { for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) S(x, floors, z, crown); }
      else { S(cx, floors, cz, crown); if (R() < 0.5 && bx1 > bx0) S(bx0, floors, bz0, pick(['watertower', 'solar', 'roofgarden', 'antenna'])); }
    }
  }
  city.recompute();
}
