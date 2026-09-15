// City layout: a global cell grid of city blocks (two back-to-back rows of plots) separated
// by streets. Buildings may span any plots and streets: a building on a street closes that stretch
// (see City.closed), and upper floors may also span over a street that stays open.
import { CELL } from './catalog.js';
import { tk } from './terrain.js';

export const STREET = 5; // cells (20 m): 14 m roadway + 3 m sidewalks
export const EDGE = 2;   // cells of grass edge around the grid, buildable like the plots

export const MAP_SIZES = {
  small: { label: 'Small · 1×2 blocks', blocksX: 1, blocksZ: 2 },
  medium: { label: 'Medium · 2×2 blocks', blocksX: 2, blocksZ: 2 },
  large: { label: 'Large · 3×3 blocks', blocksX: 3, blocksZ: 3 },
  huge: { label: 'Huge · 4×4 blocks', blocksX: 4, blocksZ: 4 },
  vast: { label: 'Vast · 6×5 blocks', blocksX: 6, blocksZ: 5 },
};
export const BLOCK_SIZES = { 2: '2 plots per row', 3: '3 plots per row', 4: '4 plots per row', 6: '6 plots per row', 8: '8 plots per row' };
export const PLOT_SIZES = {
  '4x4': { label: 'Compact · 16×16 m', w: 4, d: 4 },
  '6x5': { label: 'Standard · 24×20 m', w: 6, d: 5 },
  '8x6': { label: 'Wide · 32×24 m', w: 8, d: 6 },
  '10x8': { label: 'Grand · 40×32 m', w: 10, d: 8 },
  '12x10': { label: 'Superblock · 48×40 m', w: 12, d: 10 },
};
export const DEFAULT_LAYOUT = { map: 'medium', lots: 4, plot: '6x5' };

// City street configuration, per piece of the grid: 'x' intersections, and the stretches between them,
// 'h' east–west and 'v' north–south. Pieces without an entry are two-way streets with traffic lights.
export const SEGMENT_TYPES = new Set(['oneway', 'onewayrev', 'median', 'bikeway', 'pedestrian', 'removed']);
export const CROSSING_TYPES = new Set(['stop', 'roundabout', 'scramble', 'plaza', 'removed']);
export const CAR_FREE = new Set(['pedestrian', 'plaza', 'removed']);

export class Layout {
  constructor(cfg = DEFAULT_LAYOUT) {
    this.cfg = { ...DEFAULT_LAYOUT, ...cfg };
    const ms = MAP_SIZES[this.cfg.map] || MAP_SIZES.medium, ps = PLOT_SIZES[this.cfg.plot] || PLOT_SIZES['6x5'];
    this.blocksX = ms.blocksX; this.blocksZ = ms.blocksZ;
    this.lotsPerRow = +this.cfg.lots || 4;
    this.plotW = ps.w; this.plotD = ps.d;
    this.bw = this.lotsPerRow * this.plotW;
    this.bd = 2 * this.plotD;
    this.P = this.bw + STREET;
    this.Q = this.bd + STREET;
    this.sizeX = this.blocksX * this.P + STREET;
    this.sizeZ = this.blocksZ * this.Q + STREET;
    this.ox = -(this.sizeX * CELL) / 2;
    this.oz = -(this.sizeZ * CELL) / 2;

    this.lots = [];
    for (let j = 0; j < this.blocksZ; j++) for (let i = 0; i < this.blocksX; i++) for (let r = 0; r < 2; r++) for (let k = 0; k < this.lotsPerRow; k++) {
      this.lots.push({ gx: STREET + i * this.P + k * this.plotW, gz: STREET + j * this.Q + r * this.plotD, w: this.plotW, d: this.plotD, front: r === 0 ? 3 : 2, block: [i, j], row: r, k, index: this.lots.length });
    }
    this.hStreets = [];
    for (let j = 0; j <= this.blocksZ; j++) this.hStreets.push({ j, gz: j * this.Q, zc: this.oz + (j * this.Q + STREET / 2) * CELL });
    this.vStreets = [];
    for (let i = 0; i <= this.blocksX; i++) this.vStreets.push({ i, gx: i * this.P, xc: this.ox + (i * this.P + STREET / 2) * CELL });
    this.railBand = Math.max(1, Math.round(this.blocksZ / 2)) - (this.blocksZ === 1 ? 1 : 0);
    this.width = this.sizeX * CELL;
    this.depth = this.sizeZ * CELL;
    // Owned by the city: expanded land beyond the grid (tk -> {x, z}) and map-block roads (tk -> {x, z, t}).
    this.extra = null;
    this.roads = null;
    this.closed = null; // street blocks covered by a building: tk -> { x, z, n }
    this.streets = null; // street piece configuration: key -> type
    this.removed = new Set(); // tk of every block of a removed street piece
    this.net = null; // map-block street pieces, derived from the roads (see roadNet)
    this.ext = { x0: -EDGE, z0: -EDGE, x1: this.sizeX - 1 + EDGE, z1: this.sizeZ - 1 + EDGE };
  }

  attach(extra, roads, closed = null, streets = null) { this.extra = extra; this.roads = roads; this.closed = closed; this.streets = streets; this.recalcExt(); this.recalcStreets(); }
  recalcStreets() {
    this.removed = new Set();
    if (this.streets) for (const [k, t] of this.streets) {
      if (t !== 'removed') continue;
      const r = this.pieceBounds(k);
      for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) this.removed.add(tk(x, z));
    }
  }
  // Bounds of all ground (grid, its grass edge and expanded land), in cells.
  recalcExt() {
    const e = { x0: -EDGE, z0: -EDGE, x1: this.sizeX - 1 + EDGE, z1: this.sizeZ - 1 + EDGE };
    if (this.extra) for (const { x, z } of this.extra.values()) { e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); e.z0 = Math.min(e.z0, z); e.z1 = Math.max(e.z1, z); }
    this.ext = e;
  }

  inGrid(gx, gz) { return gx >= 0 && gz >= 0 && gx < this.sizeX && gz < this.sizeZ; }
  // The grid plus its grass edge.
  inEdge(gx, gz) { return gx >= -EDGE && gz >= -EDGE && gx < this.sizeX + EDGE && gz < this.sizeZ + EDGE; }
  inMap(gx, gz) { return this.inEdge(gx, gz) || !!this.extra?.has(tk(gx, gz)); }
  isStreetX(gx) { return ((gx % this.P) + this.P) % this.P < STREET; }
  isStreetZ(gz) { return ((gz % this.Q) + this.Q) % this.Q < STREET; }
  // The grid's street bands, whatever is configured on them (the tunnels run under all of them).
  isGridBand(gx, gz) { return this.inGrid(gx, gz) && (this.isStreetX(gx) || this.isStreetZ(gz)); }
  isGridStreet(gx, gz) { return this.isGridBand(gx, gz) && !this.removed.has(tk(gx, gz)); }
  // City streets plus map-block roads, paths and lots: anything buildings open onto.
  isStreet(gx, gz) { return this.isGridStreet(gx, gz) || !!this.roads?.has(tk(gx, gz)); }
  // Streets (and roads) that no building has closed.
  isOpenStreet(gx, gz) { return this.isStreet(gx, gz) && !this.closed?.has(tk(gx, gz)); }
  isOpenGridStreet(gx, gz) { return this.isGridStreet(gx, gz) && !this.closed?.has(tk(gx, gz)); }
  buildable(gx, gz) { return this.inMap(gx, gz) && !this.isStreet(gx, gz); }
  hBand(gz) { return this.inGrid(0, gz) && this.isStreetZ(gz) ? Math.floor(gz / this.Q) : -1; }
  wx(gx) { return this.ox + gx * CELL; }
  wz(gz) { return this.oz + gz * CELL; }
  gx(x) { return Math.floor((x - this.ox) / CELL); }
  gz(z) { return Math.floor((z - this.oz) / CELL); }

  // ---------- street pieces ----------
  pieceAt(gx, gz) {
    if (!this.isGridBand(gx, gz)) return null;
    const sx = this.isStreetX(gx), sz = this.isStreetZ(gz);
    return `${sx && sz ? 'x' : sz ? 'h' : 'v'}:${Math.floor(gx / this.P)}:${Math.floor(gz / this.Q)}`;
  }
  pieceType(gx, gz) { if (!this.streets?.size) return null; const k = this.pieceAt(gx, gz); return (k && this.streets.get(k)) || null; }
  carFree(gx, gz) { return CAR_FREE.has(this.pieceType(gx, gz)); }
  // Cell bounds of a piece (inclusive).
  pieceBounds(k) {
    const [kind, a, b] = k.split(':'), i = +a, j = +b;
    const x0 = i * this.P + (kind === 'h' ? STREET : 0), z0 = j * this.Q + (kind === 'v' ? STREET : 0);
    return { x0, z0, x1: kind === 'h' ? (i + 1) * this.P - 1 : x0 + STREET - 1, z1: kind === 'v' ? (j + 1) * this.Q - 1 : z0 + STREET - 1 };
  }
  validPiece(k, t) {
    const m = /^([hvx]):(\d+):(\d+)$/.exec(k);
    if (!m) return false;
    const i = +m[2], j = +m[3];
    if (m[1] === 'x') return i <= this.blocksX && j <= this.blocksZ && CROSSING_TYPES.has(t);
    return (m[1] === 'h' ? i < this.blocksX && j <= this.blocksZ : i <= this.blocksX && j < this.blocksZ) && SEGMENT_TYPES.has(t);
  }
  pieces() {
    const out = [];
    for (let j = 0; j <= this.blocksZ; j++) for (let i = 0; i <= this.blocksX; i++) {
      out.push({ kind: 'x', i, j, k: `x:${i}:${j}` });
      if (i < this.blocksX) out.push({ kind: 'h', i, j, k: `h:${i}:${j}` });
      if (j < this.blocksZ) out.push({ kind: 'v', i, j, k: `v:${i}:${j}` });
    }
    return out;
  }

  // ---------- map-block streets ----------
  // Painted 'road' blocks laid out as the same pieces as the city grid: straight bands of blocks run along x
  // or z (longer than they are wide); where an x band and a z band overlap is a junction, and the rest of
  // each band splits into stretches between junctions. A piece's type lives on its blocks (road.s).
  // City.setRoad clears the cache.
  roadNet() {
    if (this.net) return this.net;
    const R = this.roads, is = (x, z) => R?.get(tk(x, z))?.t === 'road', bands = [];
    if (R?.size) for (const axis of ['x', 'z']) {
      const X = axis === 'x', rows = new Map();
      for (const r of R.values()) {
        if (r.t !== 'road' || (X ? is(r.x - 1, r.z) : is(r.x, r.z - 1))) continue; // run starts only
        const row = X ? r.z : r.x, a0 = X ? r.x : r.z;
        let a1 = a0;
        while (X ? is(a1 + 1, r.z) : is(r.x, a1 + 1)) a1++;
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push([a0, a1]);
      }
      const used = new Set();
      for (const row of [...rows.keys()].sort((a, b) => a - b)) for (const [a0, a1] of rows.get(row)) {
        if (used.has(`${row}:${a0}:${a1}`)) continue;
        let w = 0;
        while (rows.get(row + w)?.some(([b0, b1]) => b0 === a0 && b1 === a1)) used.add(`${row + w++}:${a0}:${a1}`);
        const len = a1 - a0 + 1;
        if (len > w || (len === w && len >= 3)) bands.push({ axis, r0: row, w, a0, a1, id: bands.length });
      }
    }
    const pieces = [], pieceOf = new Map();
    const claim = (p, x, z) => { if (!pieceOf.has(tk(x, z))) { pieceOf.set(tk(x, z), p); p.cells.push([x, z]); } };
    const junctions = [];
    for (const xb of bands) if (xb.axis === 'x') for (const zb of bands) if (zb.axis === 'z') {
      const x0 = Math.max(xb.a0, zb.r0), x1 = Math.min(xb.a1, zb.r0 + zb.w - 1), z0 = Math.max(xb.r0, zb.a0), z1 = Math.min(xb.r0 + xb.w - 1, zb.a1);
      if (x0 > x1 || z0 > z1) continue;
      const j = { kind: 'x', x0, x1, z0, z1, xb, zb, cells: [] };
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) claim(j, x, z);
      junctions.push(j);
      pieces.push(j);
    }
    for (const b of bands) {
      const X = b.axis === 'x', spans = junctions.filter((j) => (X ? j.xb : j.zb) === b).map((j) => (X ? [j.x0, j.x1, j] : [j.z0, j.z1, j])).sort((p, q) => p[0] - q[0]);
      b.pieces = [];
      const seg = (a0, a1) => {
        if (a1 < a0) return;
        const p = { kind: 'seg', band: b, a0, a1, cells: [] };
        for (let i = a0; i <= a1; i++) for (let r = b.r0; r < b.r0 + b.w; r++) claim(p, X ? i : r, X ? r : i);
        if (p.cells.length) { pieces.push(p); b.pieces.push(p); }
      };
      let a = b.a0;
      for (const [s0, s1, j] of spans) { seg(a, s0 - 1); b.pieces.push(j); a = s1 + 1; }
      seg(a, b.a1);
    }
    const loose = R?.size ? [...R.values()].filter((r) => r.t === 'road' && !pieceOf.has(tk(r.x, r.z))) : [];
    return (this.net = { bands, pieces, pieceOf, loose });
  }
  // A map piece's type, from its first block, if it suits the piece (null: two-way street or signals).
  roadType(p) {
    const s = this.roads?.get(tk(...p.cells[0]))?.s || null;
    return s && s !== 'removed' && (p.kind === 'x' ? CROSSING_TYPES : SEGMENT_TYPES).has(s) ? s : null;
  }

  lotAt(gx, gz) {
    if (!this.inGrid(gx, gz) || this.isGridBand(gx, gz) || !this.buildable(gx, gz)) return null;
    const i = Math.floor(gx / this.P), j = Math.floor(gz / this.Q);
    const k = Math.floor((gx - STREET - i * this.P) / this.plotW), r = Math.floor((gz - STREET - j * this.Q) / this.plotD);
    return this.lots[((j * this.blocksX + i) * 2 + r) * this.lotsPerRow + k] || null;
  }
  blockBounds(gx, gz) {
    const i = Math.floor(gx / this.P), j = Math.floor(gz / this.Q);
    return { x0: STREET + i * this.P, z0: STREET + j * this.Q, x1: STREET + i * this.P + this.bw - 1, z1: STREET + j * this.Q + this.bd - 1 };
  }

  // Direction index (0:+x 1:-x 2:+z 3:-z) of an adjacent street, preferring east–west streets.
  streetDir(gx, gz) {
    for (const [d, dx, dz] of [[2, 0, 1], [3, 0, -1], [0, 1, 0], [1, -1, 0]]) if (this.isOpenStreet(gx + dx, gz + dz)) return d;
    return -1;
  }
  // East–west street band index touching this cell (or -1), with the side it's on (+1 south / -1 north).
  touchingHBand(gx, gz) {
    if (this.isOpenStreet(gx, gz)) return null;
    if (this.isOpenGridStreet(gx, gz + 1) && this.isStreetZ(gz + 1)) return { band: this.hBand(gz + 1), side: 1 };
    if (this.isOpenGridStreet(gx, gz - 1) && this.isStreetZ(gz - 1)) return { band: this.hBand(gz - 1), side: -1 };
    return null;
  }
}
