// City data: every block in one global grid. Buildings (and parks) are connected groups of
// blocks, so they can span plots freely and grow to any size or depth.
import { CELL, MAX_LEVEL, MODULES, STYLES, TERRAIN, DECOR, levelName, DEEP, isHollow } from './catalog.js';
import { tk, chunkKey } from './terrain.js';
import { hash } from './geo.js';

export const CHUNK = 8;
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
const PREFIX = ['Aurora', 'Grand', 'Liberty', 'Harbor', 'Crown', 'Summit', 'Union', 'Beacon', 'Madison', 'Regent', 'Empire', 'Meridian', 'Lexington', 'Hudson', 'Sterling', 'Atlas', 'Paragon', 'Orchid', 'Carlyle', 'Belmont', 'Juniper', 'Wren', 'Marlowe', 'Halcyon'];
const PARK_SUFFIX = { plaza: 'Plaza', fountainplaza: 'Square', formalgarden: 'Gardens', zengarden: 'Garden', communitygarden: 'Community Garden', amphitheater: 'Bowl', foodcourt: 'Market Yard', skatepark: 'Skate Park', court: 'Courts', pond: 'Pond Park', dogpark: 'Dog Run', playground: 'Playground', sculpturegarden: 'Sculpture Park', bassin: 'Basin Gardens', parterre: 'Parterre', chahar: 'Water Garden', wavepaving: 'Promenade', starpiazza: 'Piazza', jetgrid: 'Water Mirror', bosque: 'Bosque', cascade: 'Cascade' };
const MODULE_INDEX = new Map(Object.keys(MODULES).map((id, i) => [id, i + 1]));
// Changes whenever a park's blocks or block types change. Park layouts span their whole area, so any
// change redraws every block of the park (not just the chunks around the edit).
const parkSig = (list) => { let h = 0; for (const c of list) h = (h + Math.floor(hash(c.x, c.z, MODULE_INDEX.get(c.m)) * 4294967296)) % 4294967296; return `${list.length}:${h}`; };

const EDIT_KINDS = ['cells', 'terrain', 'land', 'roads'];
const snapshot = (kind, r) => {
  if (!r) return null;
  if (kind === 'cells') return { m: r.m, s: r.s, v: r.v || 0, b: r.b, o: r.o ? [...r.o] : null };
  if (kind === 'terrain') return { t: r.t, h: r.h };
  return kind === 'roads' ? r.t : true;
};

export class City {
  constructor(layout) {
    this.layout = layout;
    this.cells = new Map();
    this.chunkCells = new Map();
    this.names = new Map();
    this.buildings = new Map();
    this.nextId = 1;
    this.dirtyChunks = new Set();
    this.minY = 0;
    this.maxY = 0;
    this.eggs = new Map();
    this.parkRegions = null;
    this.terrain = new Map();     // tk(x, z) -> { x, z, t, h }
    this.terrainDirty = new Set();
    this.terrainVersion = 0;
    this.natureCells = [];
    this.land = new Map();        // expanded ground beyond the grid: tk(x, z) -> { x, z }
    this.roads = new Map();       // map-block roads & paths: tk(x, z) -> { x, z, t }
    layout.attach(this.land, this.roads);
  }

  key(x, y, z) { return `${x},${y},${z}`; }
  get(x, y, z) { return this.cells.get(`${x},${y},${z}`); }
  chunkOf(x, z) { return `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`; }

  markAround(x, z) {
    for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) this.dirtyChunks.add(this.chunkOf(x + dx, z + dz));
  }

  set(x, y, z, m, s, v = 0) {
    const k = this.key(x, y, z);
    this.touch('cells', k, [x, y, z]);
    const prev = this.cells.get(k);
    const c = { x, y, z, m, s, v, b: prev ? prev.b : 0 };
    if (prev?.o && prev.m === m) c.o = prev.o; // restyling keeps the ornaments
    this.cells.set(k, c);
    const ck = this.chunkOf(x, z);
    if (!this.chunkCells.has(ck)) this.chunkCells.set(ck, new Set());
    this.chunkCells.get(ck).add(k);
    this.markAround(x, z);
    return c;
  }

  // Facade ornament on side d (0:+x 1:-x 2:+z 3:-z) of a block; id null clears it.
  setDecor(x, y, z, d, id) {
    const c = this.get(x, y, z);
    if (!c) return;
    this.touch('cells', this.key(x, y, z), [x, y, z]);
    const o = c.o ? [...c.o] : [null, null, null, null];
    o[d] = id || null;
    if (o.some(Boolean)) c.o = o; else delete c.o;
    this.markAround(x, z);
  }

  // Does this skybridge hang from something — a building block beside it, or a chain of skybridges that
  // reaches one (or stands on a block)? skip: a block key to treat as already removed.
  bridgeHeld(x, y, z, skip = null) {
    const seen = new Set([this.key(x, y, z)]), stack = [[x, z]];
    while (stack.length) {
      const [cx, cz] = stack.pop();
      if (this.cells.has(this.key(cx, y - 1, cz))) return true;
      for (const [dx, , dz] of N6.slice(0, 4)) {
        const k = this.key(cx + dx, y, cz + dz);
        if (k === skip || seen.has(k)) continue;
        const n = this.cells.get(k);
        if (!n) continue;
        const m = MODULES[n.m];
        if (!m.bridge) { if (!m.park && !m.topper) return true; continue; }
        seen.add(k);
        stack.push([n.x, n.z]);
      }
    }
    return false;
  }

  remove(x, y, z) {
    const k = this.key(x, y, z);
    this.touch('cells', k, [x, y, z]);
    if (!this.cells.delete(k)) return;
    this.chunkCells.get(this.chunkOf(x, z))?.delete(k);
    this.markAround(x, z);
  }

  // Map blocks. rec = { t, h } or null to clear. Heights blend two blocks out, so redraw around it.
  setTerrain(x, z, rec) {
    const k = tk(x, z);
    this.touch('terrain', k, [x, z]);
    if (rec) this.terrain.set(k, { x, z, t: rec.t, h: rec.h || 0 });
    else if (!this.terrain.delete(k)) return;
    for (let dx = -2; dx <= 2; dx += 2) for (let dz = -2; dz <= 2; dz += 2) this.terrainDirty.add(chunkKey(x + dx, z + dz));
    this.terrainVersion++;
  }

  setLand(x, z, on) {
    const k = tk(x, z);
    this.touch('land', k, [x, z]);
    if (on) { if (this.land.has(k)) return; this.land.set(k, { x, z }); } else if (!this.land.delete(k)) return;
    this.layout.recalcExt();
    this.terrainVersion++;
  }

  // Roads join their neighbors and buildings open onto them, so redraw both around it.
  setRoad(x, z, t) {
    const k = tk(x, z);
    this.touch('roads', k, [x, z]);
    if (t) this.roads.set(k, { x, z, t }); else if (!this.roads.delete(k)) return;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.terrainDirty.add(chunkKey(x + dx, z + dz));
    this.markAround(x, z);
    this.terrainVersion++;
  }

  // ---------- undo history ----------
  // Between beginEdit() and endEdit(), the first change to each block or map cell keeps its prior state.
  // endEdit() pairs those with the current states into a reversible edit, or null if nothing changed.
  beginEdit() {
    this.rec = { cells: new Map(), terrain: new Map(), land: new Map(), roads: new Map(), names: new Map(this.names) };
  }

  touch(kind, k, pos) {
    const r = this.rec;
    if (r && !r[kind].has(k)) r[kind].set(k, { pos, before: snapshot(kind, this[kind].get(k)) });
  }

  endEdit() {
    const r = this.rec;
    this.rec = null;
    if (!r) return null;
    const edit = { names: [r.names, new Map(this.names)] };
    let changes = 0;
    for (const kind of EDIT_KINDS) {
      edit[kind] = [];
      for (const [k, { pos, before }] of r[kind]) {
        const after = snapshot(kind, this[kind].get(k));
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        edit[kind].push([pos, before, after]);
        changes++;
      }
    }
    return changes ? edit : null;
  }

  // Put an edit's blocks and map cells back to their states before (side 0) or after (side 1) it.
  applyEdit(edit, side) {
    for (const [[x, y, z], ...states] of edit.cells) {
      const st = states[side];
      if (!st) { this.remove(x, y, z); continue; }
      const c = this.set(x, y, z, st.m, st.s, st.v);
      c.b = st.b;
      if (st.o) c.o = [...st.o]; else delete c.o;
    }
    for (const [[x, z], ...states] of edit.land) this.setLand(x, z, !!states[side]);
    for (const [[x, z], ...states] of edit.roads) this.setRoad(x, z, states[side]);
    for (const [[x, z], ...states] of edit.terrain) this.setTerrain(x, z, states[side]);
    this.recompute();
    for (const [id, name] of edit.names[side]) if (this.buildings.has(id)) this.names.set(id, name);
  }

  clear() {
    for (const ck of this.chunkCells.keys()) this.dirtyChunks.add(ck);
    for (const r of this.terrain.values()) this.terrainDirty.add(chunkKey(r.x, r.z));
    this.terrain.clear();
    for (const r of this.roads.values()) this.terrainDirty.add(chunkKey(r.x, r.z));
    this.roads.clear();
    this.land.clear();
    this.layout.recalcExt();
    this.terrainVersion++;
    this.cells.clear();
    this.chunkCells.clear();
    this.names.clear();
    this.buildings.clear();
    this.nextId = 1;
  }

  markBuilding(id) {
    const B = this.buildings.get(id);
    if (B) for (const c of B.cells) this.markAround(c.x, c.z);
  }

  // ---------- connected components (stable ids) ----------
  recompute() {
    const seen = new Set();
    const comps = [];
    let minY = 0, maxY = 0;
    this.parkRegions = null;
    for (const [k, c] of this.cells) {
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
      if (seen.has(k)) continue;
      const park = !!MODULES[c.m].park;
      const list = [];
      const stack = [c];
      seen.add(k);
      while (stack.length) {
        const cur = stack.pop();
        list.push(cur);
        for (const [dx, dy, dz] of N6) {
          const nk = this.key(cur.x + dx, cur.y + dy, cur.z + dz);
          if (seen.has(nk)) continue;
          const n = this.cells.get(nk);
          if (!n || !!MODULES[n.m].park !== park) continue;
          seen.add(nk);
          stack.push(n);
        }
      }
      comps.push({ list, park });
    }
    this.minY = minY;
    this.maxY = maxY;

    comps.sort((a, b) => b.list.length - a.list.length);
    const claimed = new Set();
    const old = this.buildings;
    this.buildings = new Map();
    for (const comp of comps) {
      const counts = new Map();
      for (const c of comp.list) if (c.b) counts.set(c.b, (counts.get(c.b) || 0) + 1);
      let id = 0, best = 0;
      for (const [bid, n] of counts) if (!claimed.has(bid) && n > best) { id = bid; best = n; }
      if (!id) id = this.nextId++;
      claimed.add(id);
      for (const c of comp.list) { if (c.b !== id) this.markAround(c.x, c.z); c.b = id; }
      const B = { id, cells: comp.list, park: comp.park, prevStats: old.get(id)?.stats };
      B.bbox = bbox(comp.list);
      if (comp.park) {
        B.sig = parkSig(comp.list);
        if (old.get(id)?.sig !== B.sig) for (const c of comp.list) this.markAround(c.x, c.z);
      }
      if (!this.names.has(id)) this.names.set(id, this.makeName(B));
      this.buildings.set(id, B);
    }
    for (const id of [...this.names.keys()]) if (!this.buildings.has(id)) this.names.delete(id);

    this.parkCells = [];
    for (const B of this.buildings.values()) if (B.park) this.parkCells.push(...B.cells);
    this.natureCells = [...this.terrain.values()].filter((r) => TERRAIN[r.t].scenic);
    for (const r of this.roads.values()) if (r.t === 'boulevard') this.natureCells.push(r);
    for (const B of this.buildings.values()) B.stats = this.statsFor(B);
  }

  makeName(B) {
    const c = B.cells[0];
    const r = hash(c.x, c.y + 3, c.z, B.cells.length);
    const pre = PREFIX[Math.floor(r * PREFIX.length)];
    if (B.park) return `${pre} ${PARK_SUFFIX[c.m] || 'Park'}`;
    const h = B.bbox.y1 + 1;
    const suffix = h >= 15 ? 'Tower' : h >= 8 ? ['Building', 'Center', 'House'][Math.floor(r * 30) % 3] : ['Hall', 'Lofts', 'Court', 'Block'][Math.floor(r * 40) % 4];
    return `The ${pre} ${suffix}`;
  }

  buildingAt(x, y, z) { const c = this.get(x, y, z); return c ? this.buildings.get(c.b) : null; }

  // ---------- rules ----------
  canPlace(x, y, z, mid) {
    const L = this.layout, mod = MODULES[mid];
    if (!L.inMap(x, z)) return 'Outside the map';
    if (L.isStreet(x, z)) return "That's a street — build on the plots";
    const land = this.terrain.get(tk(x, z));
    if (land && TERRAIN[land.t].group === 'water') return "That's water — use Clear Terrain in Map blocks first";
    if (land && land.h !== 0) return 'The land is sloped here — Level it in Map blocks first';
    if (y > MAX_LEVEL) return `Floor ${MAX_LEVEL} is the top of the sky`;
    if (this.get(x, y, z)) return 'Space occupied';
    if (y < mod.min || y > mod.max) {
      if (mod.min === mod.max) return `${mod.name} only fits on ${levelName(mod.min)}`;
      return `${mod.name} fits ${mod.min <= DEEP ? 'any depth' : levelName(mod.min)} – ${levelName(mod.max)}`;
    }
    if (mod.street) {
      const t = L.touchingHBand(x, z);
      if (mod.street === 'any' && L.streetDir(x, z) < 0) return `${mod.name} must touch a street`;
      if (mod.street === 'h' && !t) return `${mod.name} must touch an east–west street`;
      if (mod.street === 'rail' && (!t || t.band !== L.railBand)) return `${mod.name} must touch the rail street (red tunnel)`;
    }
    const below = this.get(x, y - 1, z);
    if (y > 0 && !below) {
      if (!mod.bridge) return 'Needs a block underneath';
      if (!this.bridgeHeld(x, y, z)) return 'A skybridge must reach out from a building beside it (or another skybridge)';
    } else if (y > 0) {
      const bm = MODULES[below.m];
      if (bm.topper) return "Can't build on top of a roof or crown";
      if (bm.park) return "Can't build on top of a park";
      if (mod.topper && bm.open) return 'Roofs need a solid block below';
      if (!mod.topper) {
        const B = this.buildings.get(below.b);
        if (B && B.stats && y > B.stats.heightLimit) return `Height limit is Floor ${B.stats.heightLimit} — add Foundation Piles underground`;
      }
    }
    if (y === 0 && mod.park) {
      const under = this.get(x, -1, z);
      if (under && !MODULES[under.m].park) { /* parks over basements are fine */ }
    }
    return null;
  }

  canRemove(x, y, z) {
    const c = this.get(x, y, z);
    if (!c) return 'Nothing here';
    if (y >= 0 && this.get(x, y + 1, z)) return 'Remove the blocks above first';
    const key = this.key(x, y, z);
    for (const [dx, , dz] of N6.slice(0, 4)) {
      const n = this.get(x + dx, y, z + dz);
      if (n && MODULES[n.m].bridge && !this.bridgeHeld(n.x, n.y, n.z, key)) return 'A skybridge hangs from this block — remove the bridge first';
    }
    if (c.m === 'foundation') {
      const B = this.buildings.get(c.b);
      if (B && B.stats) {
        const lim = Math.min(MAX_LEVEL, 5 + 3 * (B.stats.piles - 1));
        if (B.stats.topFloor > lim) return 'These piles are holding the tower up';
      }
    }
    return null;
  }

  // ---------- stats ----------
  statsFor(B) {
    const L = this.layout;
    let piles = 0, topFloor = -1, lobby = false, toppers = 0, hasRamp = false, bottom = 0;
    const modes = { subway: false, rail: false, bus: false };
    const styles = new Map();
    for (const c of B.cells) {
      const m = MODULES[c.m];
      styles.set(c.s, (styles.get(c.s) || 0) + 1);
      if (c.m === 'foundation') piles++;
      if (c.m === 'lobby') lobby = true;
      if (c.m === 'busramp') hasRamp = true;
      if (c.y < bottom) bottom = c.y;
      if (m.transit && this.streetOk(c, m)) modes[m.transit] = true;
      if (m.topper) toppers++;
      else if (c.y > topFloor) topFloor = c.y;
    }
    const heightLimit = Math.min(MAX_LEVEL, 5 + 3 * piles);
    const modeCount = (modes.subway ? 1 : 0) + (modes.rail ? 1 : 0) + (modes.bus ? 1 : 0);
    const bb = B.bbox;
    const near = (p) => p.x >= bb.x0 - 4 && p.x <= bb.x1 + 4 && p.z >= bb.z0 - 4 && p.z <= bb.z1 + 4;
    const nearPark = !B.park && (this.parkCells.some(near) || this.natureCells.some(near));
    const bonus = 1 + 0.15 * modeCount + (modeCount >= 2 ? 0.2 : 0) + (nearPark ? 0.1 : 0);

    const served = new Set();
    if (lobby) {
      served.add(0);
      for (const c of B.cells) {
        if (c.m !== 'core' || c.y !== 0) continue;
        for (let y = 1; this.get(c.x, y, c.z)?.m === 'core'; y++) served.add(y);
        for (let y = -1; this.get(c.x, y, c.z)?.m === 'core'; y--) served.add(y);
      }
    }

    let income = 0, pop = 0, unserved = 0, badStreet = 0, noTransit = 0;
    const has = {};
    for (const c of B.cells) {
      const m = MODULES[c.m];
      let ok = B.park || !(m.needsCore && c.y !== 0 && !served.has(c.y));
      if (!ok) unserved++;
      if (m.street && !this.streetOk(c, m)) { ok = false; badStreet++; }
      if (m.needs) {
        const met = m.needs === 'any' ? modeCount > 0 : m.needs === 'busramp' ? hasRamp : modes[m.needs];
        if (!met) { ok = false; noTransit++; }
      }
      c.ok = ok;
      if (ok) {
        income += (m.income || 0) * (m.commercial || m.residential ? bonus : 1);
        pop += m.pop || 0;
        has[c.m] = true;
      }
    }

    const style = [...styles].sort((a, b) => b[1] - a[1])[0]?.[0] || 'deco';
    if (B.park) {
      return { park: true, pop, income: 0, blocks: B.cells.length, stars: 0, next: `${B.cells.length} park block${B.cells.length > 1 ? 's' : ''} · nearby buildings earn +10%`, warnings: [], piles: 0, heightLimit: 0, topFloor: 0, bottom: 0, modes, modeCount: 0, bonus: 1, nearPark: false, style, has };
    }

    let stars = 1, next = '';
    const need = (list) => list.filter(([cond]) => !cond).map(([, t]) => t);
    const tiers = [
      [[pop >= 200, '200 population']],
      [[pop >= 800, '800 population'], [has.cafe, 'a Café'], [has.utility, 'a Mechanical Plant']],
      [[pop >= 2500, '2,500 population'], [has.hotel, 'Hotel Suites'], [modeCount > 0, 'a transit connection']],
      [[pop >= 5000, '5,000 population'], [has.observation, 'an Observation Deck'], [toppers > 0, 'a roof crown'], [topFloor >= 40, 'Floor 40']],
    ];
    for (const tier of tiers) {
      const miss = need(tier);
      if (miss.length) { next = `${stars + 1}★ needs ${miss.join(', ')}`; break; }
      stars++;
    }
    if (stars === 5) next = 'Five stars — a true landmark!';

    const warnings = [];
    if (topFloor > 0 && !lobby) warnings.push('No Grand Lobby on the street level — upper floors are unreachable.');
    else if (unserved) warnings.push(`${unserved} block${unserved > 1 ? 's' : ''} unreachable. Stack Elevator Cores up from a street-level core.`);
    if (badStreet) warnings.push('Platforms, bus bays and taxi stands must touch the right street.');
    if (noTransit) warnings.push(`${noTransit} transit block${noTransit > 1 ? 's need' : ' needs'} a connected line (or a Bus Ramp for Bus Decks).`);
    if (topFloor >= heightLimit && heightLimit < MAX_LEVEL) warnings.push(`At the height limit (Floor ${heightLimit}). Add Foundation Piles underground.`);

    return { park: false, piles, heightLimit, topFloor, bottom, lobby, income, pop, stars, next, warnings, modes, modeCount, bonus, nearPark, blocks: B.cells.length, style, has };
  }

  streetOk(c, m) {
    const L = this.layout;
    if (m.street === 'any') return L.streetDir(c.x, c.z) >= 0;
    const t = L.touchingHBand(c.x, c.z);
    if (!t) return false;
    if (m.street === 'rail') return t.band === L.railBand && c.y === -4;
    return true;
  }

  // ---------- persistence ----------
  serialize() {
    const names = [];
    for (const B of this.buildings.values()) { const c = B.cells[0]; names.push([c.x, c.y, c.z, this.names.get(B.id)]); }
    return { cells: [...this.cells.values()].map((c) => (c.o ? [c.x, c.y, c.z, c.m, c.s, c.v || 0, c.o] : [c.x, c.y, c.z, c.m, c.s, c.v || 0])), names, terrain: [...this.terrain.values()].map((r) => [r.x, r.z, r.t, r.h]),
      land: [...this.land.values()].map((r) => [r.x, r.z]), roads: [...this.roads.values()].map((r) => [r.x, r.z, r.t]) };
  }

  load(data) {
    this.clear();
    for (const [x, z] of data.land || []) if (!this.layout.inGrid(x, z)) this.setLand(x, z, true);
    for (const [x, z, t] of data.roads || []) if (TERRAIN[t]?.group === 'streets' && this.layout.inMap(x, z) && !this.layout.isGridStreet(x, z)) this.setRoad(x, z, t);
    for (const [x, y, z, m, s, v, o] of data.cells) {
      if (!MODULES[m] || !STYLES[s] || !this.layout.buildable(x, z)) continue;
      const c = this.set(x, y, z, m, s, v || 0);
      if (Array.isArray(o) && o.length === 4 && o.some((id) => DECOR[id])) c.o = o.map((id) => (DECOR[id] && !DECOR[id].remove ? id : null));
    }
    for (const [x, z, t, h] of data.terrain || []) if (['cover', 'water'].includes(TERRAIN[t]?.group) && this.layout.buildable(x, z)) this.setTerrain(x, z, { t, h });
    this.recompute();
    this.applyNames(data.names || []);
  }

  applyNames(list) {
    for (const [x, y, z, name] of list) {
      const c = this.get(x, y, z);
      if (c && name) this.names.set(c.b, name);
    }
  }
}

function bbox(list) {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const c of list) {
    if (c.x < b.x0) b.x0 = c.x; if (c.x > b.x1) b.x1 = c.x;
    if (c.y < b.y0) b.y0 = c.y; if (c.y > b.y1) b.y1 = c.y;
    if (c.z < b.z0) b.z0 = c.z; if (c.z > b.z1) b.z1 = c.z;
  }
  return b;
}

export { CELL, isHollow };
