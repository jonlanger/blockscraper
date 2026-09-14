// City layout: a global cell grid of city blocks (two back-to-back rows of plots) separated
// by streets. Buildings may span any plots inside a city block; streets stay open.
import { CELL } from './catalog.js';
import { tk } from './terrain.js';

export const STREET = 5; // cells (20 m): 14 m roadway + 3 m sidewalks

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
    this.ext = { x0: 0, z0: 0, x1: this.sizeX - 1, z1: this.sizeZ - 1 };
  }

  attach(extra, roads) { this.extra = extra; this.roads = roads; this.recalcExt(); }
  // Bounds of all ground (grid + expanded land), in cells.
  recalcExt() {
    const e = { x0: 0, z0: 0, x1: this.sizeX - 1, z1: this.sizeZ - 1 };
    if (this.extra) for (const { x, z } of this.extra.values()) { e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); e.z0 = Math.min(e.z0, z); e.z1 = Math.max(e.z1, z); }
    this.ext = e;
  }

  inGrid(gx, gz) { return gx >= 0 && gz >= 0 && gx < this.sizeX && gz < this.sizeZ; }
  inMap(gx, gz) { return this.inGrid(gx, gz) || !!this.extra?.has(tk(gx, gz)); }
  isStreetX(gx) { return ((gx % this.P) + this.P) % this.P < STREET; }
  isStreetZ(gz) { return ((gz % this.Q) + this.Q) % this.Q < STREET; }
  isGridStreet(gx, gz) { return this.inGrid(gx, gz) && (this.isStreetX(gx) || this.isStreetZ(gz)); }
  // City streets plus map-block roads, paths and lots: anything buildings open onto.
  isStreet(gx, gz) { return this.isGridStreet(gx, gz) || !!this.roads?.has(tk(gx, gz)); }
  buildable(gx, gz) { return this.inMap(gx, gz) && !this.isStreet(gx, gz); }
  hBand(gz) { return this.inGrid(0, gz) && this.isStreetZ(gz) ? Math.floor(gz / this.Q) : -1; }
  wx(gx) { return this.ox + gx * CELL; }
  wz(gz) { return this.oz + gz * CELL; }
  gx(x) { return Math.floor((x - this.ox) / CELL); }
  gz(z) { return Math.floor((z - this.oz) / CELL); }

  lotAt(gx, gz) {
    if (!this.inGrid(gx, gz) || !this.buildable(gx, gz)) return null;
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
    for (const [d, dx, dz] of [[2, 0, 1], [3, 0, -1], [0, 1, 0], [1, -1, 0]]) if (this.isStreet(gx + dx, gz + dz)) return d;
    return -1;
  }
  // East–west street band index touching this cell (or -1), with the side it's on (+1 south / -1 north).
  touchingHBand(gx, gz) {
    if (this.isStreet(gx, gz)) return null;
    if (this.inGrid(gx, gz + 1) && this.isStreetZ(gz + 1)) return { band: this.hBand(gz + 1), side: 1 };
    if (this.inGrid(gx, gz - 1) && this.isStreetZ(gz - 1)) return { band: this.hBand(gz - 1), side: -1 };
    return null;
  }
}
