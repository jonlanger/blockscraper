// Architectural parts kit: windows, storefronts, doors, moldings, columns, railings, balconies,
// awnings, shutters and small facade fixtures. Each part is built once (cached) as layers
// { mat, slot, geo }; slots are recolored per instance, numeric slots keep a fixed color.
import * as THREE from 'three';
import { GeoBuilder, extrudeProfile, extrudeShape, lathe, foliage, SHAPES, put } from './geo.js';

const cache = new Map();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const f2 = (n) => (+n).toFixed(2);

export function mtx(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

const grey = (s) => { const v = Math.max(0, Math.min(255, Math.round(255 * s))); return (v << 16) | (v << 8) | v; };
const scaleHex = (h, s) => (Math.min(255, Math.round(((h >> 16) & 255) * s)) << 16) | (Math.min(255, Math.round(((h >> 8) & 255) * s)) << 8) | Math.min(255, Math.round((h & 255) * s));

// Build (or fetch) a part. build receives L(mat, slot, pattern) -> layer drawing API.
export function part(key, build) {
  let p = cache.get(key);
  if (p) return p;
  const layers = new Map();
  const L = (mat, slot, pat = 0) => {
    const k = `${mat}|${slot}|${pat}`;
    let l = layers.get(k);
    if (l) return l;
    const g = new GeoBuilder();
    const c = (sh = 1) => [typeof slot === 'number' ? scaleHex(slot, sh) : grey(sh), pat];
    l = {
      mat, slot, g,
      box: (cx, cy, cz, sx, sy, sz, sh) => g.box(cx, cy, cz, sx, sy, sz, c(sh)),
      bx: (x0, y0, z0, x1, y1, z1, sh) => g.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c(sh)),
      bv: (x0, y0, z0, x1, y1, z1, ch = 0.02, sh) => g.bevel((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c(sh), ch),
      geo: (geom, m, sh) => g.addGeometry(geom, m, c(sh)),
      put: (geom, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, sh) => put(g, geom, x, y, z, sx, sy, sz, c(sh), rx, ry, rz),
    };
    layers.set(k, l);
    return l;
  };
  build(L);
  p = { key, layers: [...layers.values()].filter((l) => !l.g.empty).map((l) => ({ mat: l.mat, slot: l.slot, geo: l.g.build() })) };
  cache.set(key, p);
  return p;
}

// ---------- profiles (w outward, v up) ----------
export const PROFILES = {
  cornice: [[-0.1, -0.45], [0.05, -0.45], [0.05, -0.38], [0.11, -0.36], [0.15, -0.31], [0.17, -0.25], [0.44, -0.23], [0.47, -0.2], [0.49, -0.13], [0.54, -0.06], [0.62, -0.01], [0.64, 0.08], [-0.1, 0.08]],
  crown: [[-0.05, -0.22], [0.04, -0.22], [0.07, -0.18], [0.1, -0.12], [0.17, -0.06], [0.24, -0.02], [0.26, 0.05], [-0.05, 0.05]],
  string: [[-0.02, -0.09], [0.05, -0.09], [0.09, -0.06], [0.1, 0.0], [0.09, 0.04], [0.05, 0.06], [-0.02, 0.06]],
  plinth: [[-0.02, 0], [0.2, 0], [0.2, 0.28], [0.15, 0.33], [0.12, 0.4], [0.1, 0.46], [-0.02, 0.46]],
  coping: [[-0.34, -0.06], [-0.34, 0.05], [-0.3, 0.1], [0.0, 0.15], [0.12, 0.1], [0.14, 0.04], [0.14, -0.05], [0.1, -0.07], [-0.3, -0.07]],
  decocap: [[-0.2, 0], [0.14, 0], [0.14, 0.08], [0.08, 0.08], [0.08, 0.16], [0.03, 0.16], [0.03, 0.26], [-0.2, 0.26]],
  soffit: [[-0.1, -0.07], [0.5, -0.07], [0.56, -0.02], [0.56, 0.05], [-0.1, 0.05]],
  eave: [[-0.2, -0.12], [0.1, -0.12], [0.55, -0.04], [0.62, 0.0], [0.6, 0.06], [-0.2, 0.14]],
  sill: [[-0.06, -0.12], [0.12, -0.12], [0.15, -0.09], [0.16, -0.02], [0.13, 0.01], [-0.06, 0.03]],
  rail: [[-0.045, 0], [0.045, 0], [0.055, 0.03], [0.045, 0.06], [0.0, 0.075], [-0.045, 0.06], [-0.055, 0.03]],
  slabEdge: [[-0.1, -0.12], [0.02, -0.12], [0.05, -0.08], [0.05, 0.02], [0.02, 0.05], [-0.1, 0.05]],
  band: [[-0.02, -0.12], [0.08, -0.12], [0.08, 0.12], [-0.02, 0.12]],
};

export function moldingPart(name, length, slot = 'trim', mat = 'm', pat = 0) {
  return part(`mold:${name}:${f2(length)}:${slot}:${mat}:${pat}`, (L) => {
    L(mat, slot, pat).geo(extrudeProfile(name, PROFILES[name], length), mtx());
  });
}

export function dentilPart(length, slot = 'trim', size = 0.1) {
  return part(`dent:${f2(length)}:${slot}:${size}`, (L) => {
    const l = L('m', slot);
    const n = Math.max(1, Math.floor(length / (size * 1.8)));
    const step = length / n;
    for (let i = 0; i < n; i++) l.bv(-length / 2 + i * step + step * 0.2, -size * 1.2, 0, -length / 2 + i * step + step * 0.2 + size, 0, size * 1.1, 0.01);
  });
}

// Scroll brackets under a cornice.
export function modillionPart(length, slot = 'trim') {
  return part(`modil:${f2(length)}:${slot}`, (L) => {
    const l = L('m', slot);
    const geo = extrudeShape('modillion', () => {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(0.42, 0); s.quadraticCurveTo(0.46, -0.08, 0.38, -0.12);
      s.quadraticCurveTo(0.22, -0.12, 0.12, -0.2); s.quadraticCurveTo(0.04, -0.28, 0, -0.26); s.lineTo(0, 0);
      return s;
    }, 0.12);
    const n = Math.max(1, Math.round(length / 0.6));
    for (let i = 0; i < n; i++) l.geo(geo, mtx(-length / 2 + (i + 0.5) * (length / n), 0, 0, 0, -Math.PI / 2, 0));
  });
}

// ---------- arches ----------
export function archPts(kind, hw, rise, n = 14) {
  const pts = [];
  if (kind === 'round') {
    for (let i = 0; i <= n; i++) { const a = Math.PI - (i / n) * Math.PI; pts.push([Math.cos(a) * hw, Math.sin(a) * rise]); }
  } else if (kind === 'segment') {
    const R = (hw * hw + rise * rise) / (2 * rise), cy = rise - R;
    const a0 = Math.atan2(-cy, -hw), a1 = Math.atan2(-cy, hw);
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([Math.cos(a) * R, cy + Math.sin(a) * R]); }
  } else {
    const c = (rise * rise - hw * hw) / (2 * hw), R = c + hw;
    const aEnd = Math.atan2(rise, -c);
    const half = Math.ceil(n / 2);
    for (let i = 0; i <= half; i++) { const a = Math.PI + (aEnd - Math.PI) * (i / half); pts.push([c + Math.cos(a) * R, Math.sin(a) * R]); }
    for (let i = half - 1; i >= 0; i--) { const [x, y] = pts[i]; pts.push([-x, y]); }
  }
  return pts;
}

function archBandGeo(kind, hw, rise, t, depth) {
  return extrudeShape(`arcband:${kind}:${f2(hw)}:${f2(rise)}:${f2(t)}`, () => {
    const outer = archPts(kind, hw + t, rise + t * (kind === 'pointed' ? 1.3 : 1));
    const inner = archPts(kind, hw, rise).reverse();
    return new THREE.Shape([...outer, ...inner].map(([x, y]) => new THREE.Vector2(x, y)));
  }, depth);
}

function archFillGeo(kind, hw, rise, depth) {
  return extrudeShape(`arcfill:${kind}:${f2(hw)}:${f2(rise)}`, () => new THREE.Shape(archPts(kind, hw, rise).map(([x, y]) => new THREE.Vector2(x, y))), depth);
}

// ---------- windows ----------
// Opening spans x ∈ [-w/2, w/2], y ∈ [0, h] (+ arch rise), at the wall plane z = 0.
export function windowPart(o) {
  const w = o.w, h = o.h, cols = o.cols || 1, rows = o.rows || 1, d = o.depth ?? 0.22, fr = o.frame ?? 0.06;
  const arch = o.arch || 'none', sash = !!o.sash, lintel = o.lintel || 'none', sill = o.sill ?? true;
  const fm = o.frameMat || 'm', pat = o.pat || 0, blind = o.blind || 0;
  const key = `win:${f2(w)}:${f2(h)}:${cols}:${rows}:${d}:${fr}:${arch}:${sash}:${lintel}:${sill}:${fm}:${pat}:${blind}`;
  const p = part(key, (L) => {
    if (blind) {
      // Interior window coverings seen through the glass: roller blinds, venetians or curtains.
      const zB = -(o.depth ?? 0.22) + 0.075, hw0 = w / 2 - (o.frame ?? 0.06);
      const cloth = L('m', [0xf2ede2, 0xd8d2c4, 0xe8e0cc, 0x9aa0a6, 0xc9b28a, 0x7a8a9a][(blind * 7) % 6]);
      if (blind <= 3) {
        const drop = h * [0.28, 0.55, 0.85][blind - 1];
        cloth.bx(-hw0, h - drop, zB - 0.004, hw0, h, zB + 0.004);
        cloth.bv(-hw0, h - drop - 0.04, zB - 0.012, hw0, h - drop, zB + 0.012, 0.006, 0.8);
      } else if (blind === 4) {
        for (let y = h * 0.35; y < h - 0.02; y += 0.07) cloth.put(SHAPES.box, 0, y, zB, hw0 * 2, 0.05, 0.012, -0.5, 0, 0, 0.92);
      } else {
        const wave = Array.from({ length: 9 }, (_, i) => [0.025 * Math.sin(i * 1.7), -0.5 + i / 8]);
        const prof = [...wave, ...wave.slice().reverse().map(([a, b]) => [a - 0.015, b])];
        for (const s of [-1, 1]) cloth.geo(extrudeProfile('curtain-win', prof, h), mtx(s * (hw0 - hw0 * 0.18), h / 2, zB, 0, 0, Math.PI / 2, 1, hw0 * 0.36, 1));
      }
    }
    const rev = L('m', 'wall', pat), frame = L(fm, 'frame'), glass = L('glass', 'glass'), stone = L('m', 'stone');
    const hw = w / 2, x0 = -hw, x1 = hw, zG = -d + 0.05;
    const rise = arch === 'round' ? hw : arch === 'pointed' ? w * 0.8 : arch === 'segment' ? w * 0.18 : 0;
    // reveals give the opening real depth
    rev.bx(x0 - 0.06, -0.02, -d, x0, h, 0.0, 0.78);
    rev.bx(x1, -0.02, -d, x1 + 0.06, h, 0.0, 0.78);
    rev.bx(x0, -0.06, -d, x1, 0, 0.0, 0.9);
    if (!rise) rev.bx(x0 - 0.06, h, -d, x1 + 0.06, h + 0.06, 0.0, 0.62);
    else rev.geo(archBandGeo(arch, hw, rise, 0.06, d), mtx(0, h, -d / 2), 0.68);
    // glass
    glass.bx(x0, 0, zG - 0.01, x1, h, zG + 0.01);
    if (rise) glass.geo(archFillGeo(arch, hw, rise, 0.02), mtx(0, h, zG));
    // frame
    const z0 = zG - 0.045, z1 = zG + 0.05;
    frame.bv(x0, 0, z0, x0 + fr, h, z1, 0.01);
    frame.bv(x1 - fr, 0, z0, x1, h, z1, 0.01);
    frame.bv(x0, 0, z0, x1, fr * 1.4, z1, 0.01);
    if (!rise) frame.bv(x0, h - fr, z0, x1, h, z1, 0.01);
    else {
      frame.bv(x0, h - fr * 0.5, z0, x1, h + fr * 0.5, z1, 0.01);
      frame.geo(archBandGeo(arch, hw - fr, rise - fr, fr, z1 - z0), mtx(0, h, (z0 + z1) / 2));
      if (arch === 'round') for (const a of [Math.PI / 3, (2 * Math.PI) / 3, Math.PI / 2]) frame.put(SHAPES.box, Math.cos(a) * hw * 0.5, h + Math.sin(a) * rise * 0.5, zG, hw, fr * 0.45, 0.05, 0, 0, a);
      if (arch === 'pointed') {
        frame.bx(-fr * 0.25, h, zG - 0.025, fr * 0.25, h + rise * 0.55, zG + 0.025);
        frame.put(SHAPES.box, -hw * 0.3, h + rise * 0.6, zG, hw * 0.75, fr * 0.4, 0.05, 0, 0, -0.9);
        frame.put(SHAPES.box, hw * 0.3, h + rise * 0.6, zG, hw * 0.75, fr * 0.4, 0.05, 0, 0, 0.9);
      }
    }
    for (let i = 1; i < cols; i++) { const x = x0 + (w * i) / cols; frame.bv(x - fr * 0.32, 0, zG - 0.03, x + fr * 0.32, h, zG + 0.035, 0.006); }
    for (let j = 1; j < rows; j++) { const y = (h * j) / rows; frame.bv(x0, y - fr * 0.32, zG - 0.03, x1, y + fr * 0.32, zG + 0.035, 0.006); }
    if (sash) frame.bv(x0, h * 0.5, zG - 0.04, x1, h * 0.5 + fr * 1.3, zG + 0.08, 0.01);
    if (sill) stone.geo(extrudeProfile('sill', PROFILES.sill, w + 0.3), mtx(0, 0, 0));
    const top = h + rise;
    if (lintel === 'flat' || lintel === 'keystone') {
      stone.bv(x0 - 0.14, top + 0.02, -0.03, x1 + 0.14, top + 0.24, 0.07, 0.015);
      if (lintel === 'keystone') {
        stone.geo(extrudeShape('keystone', () => new THREE.Shape([[-0.1, 0], [0.1, 0], [0.14, 0.36], [-0.14, 0.36]].map(([x, y]) => new THREE.Vector2(x, y))), 0.14), mtx(0, top - 0.04, 0.08));
      }
    } else if (lintel === 'hood') {
      stone.geo(extrudeProfile('crown', PROFILES.crown, w + 0.5), mtx(0, top + 0.3, 0));
      for (const x of [x0 - 0.12, x1 + 0.12]) stone.bv(x - 0.07, top - 0.12, -0.02, x + 0.07, top + 0.1, 0.18, 0.02);
    } else if (lintel === 'pediment') {
      stone.geo(extrudeProfile('string', PROFILES.string, w + 0.4), mtx(0, top + 0.12, 0));
      const len = (w + 0.4) / 2 / Math.cos(0.38);
      stone.put(SHAPES.box, -(w + 0.4) / 4, top + 0.2 + Math.tan(0.38) * (w + 0.4) / 4, 0.06, len, 0.1, 0.16, 0, 0, 0.38);
      stone.put(SHAPES.box, (w + 0.4) / 4, top + 0.2 + Math.tan(0.38) * (w + 0.4) / 4, 0.06, len, 0.1, 0.16, 0, 0, -0.38);
    } else if (lintel === 'voussoir' && rise) {
      stone.geo(archBandGeo(arch, hw + 0.06, rise + 0.06, 0.22, 0.12), mtx(0, h, 0.03));
      stone.bv(-0.12, top + 0.02, -0.02, 0.12, top + 0.38, 0.12, 0.015);
    }
  });
  p.opts = o;
  return p;
}

// Steel fire escape: grated landing, railings and a ladder dropping to the floor below.
export function fireEscapePart(w = 2.8, top = false) {
  return part(`fire:${f2(w)}:${top}`, (L) => {
    const s = L('t', 'iron');
    s.bx(-w / 2, 0.0, 0, w / 2, 0.04, 0.9);
    for (let x = -w / 2 + 0.1; x < w / 2; x += 0.1) s.bx(x - 0.008, 0.04, 0.02, x + 0.008, 0.05, 0.88, 0.7);
    s.geo(extrudeProfile('rail', PROFILES.rail, w), mtx(0, 1.0, 0.88));
    s.bx(-w / 2, 0.5, 0.86, w / 2, 0.53, 0.89);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.14) s.bx(x - 0.008, 0.05, 0.866, x + 0.008, 1.0, 0.884);
    for (const x of [-w / 2, w / 2]) {
      s.bx(x - 0.015, 0.05, 0, x + 0.015, 1.0, 0.03);
      s.bx(x - 0.015, 0.97, 0, x + 0.015, 1.0, 0.9);
      s.put(SHAPES.box, x, -0.25, 0.45, 0.03, 0.7, 0.03, 0.9, 0, 0);
    }
    if (!top) {
      const ang = Math.atan2(4, 1.8);
      for (const zz of [0.25, 0.65]) s.put(SHAPES.box, -0.3, -2, zz, 0.035, Math.hypot(4, 1.8), 0.035, 0, 0, -(Math.PI / 2 - ang));
      for (let i = 1; i < 11; i++) s.put(SHAPES.box, -0.3 - 0.9 + (i / 11) * 1.8, -4 + (i / 11) * 4, 0.45, 0.16, 0.02, 0.42);
    }
  });
}

// Storefront: kickplate, mullions, transom, recessed double doors.
export function storefrontPart(o) {
  const w = o.w, h = o.h, doors = o.doors ?? true, fm = o.frameMat || 't', mull = o.mullions ?? 2;
  return part(`shop:${f2(w)}:${f2(h)}:${doors}:${fm}:${mull}`, (L) => {
    const frame = L(fm, 'frame'), glass = L('glass', 'glass'), stone = L('m', 0x77736c);
    const hw = w / 2, kick = 0.45, tr = h - 0.55;
    frame.bv(-hw, 0, -0.2, hw, kick, -0.08, 0.015, 0.85);
    for (let i = 0; i < 3; i++) frame.bv(-hw + 0.12 + i * (w - 0.24) / 3, 0.09, -0.08, -hw + (i + 1) * (w - 0.24) / 3 + 0.04, kick - 0.09, -0.06, 0.012, 1.05);
    glass.bx(-hw, kick, -0.16, hw, h, -0.14);
    for (const x of [-hw, hw]) frame.bv(x - 0.05, 0, -0.2, x + 0.05, h, -0.06, 0.012);
    frame.bv(-hw, h - 0.06, -0.2, hw, h + 0.04, -0.06, 0.012);
    frame.bv(-hw, tr - 0.05, -0.2, hw, tr + 0.05, -0.04, 0.012);
    for (let i = 1; i <= mull; i++) { const x = -hw + (w * i) / (mull + 1); if (doors && Math.abs(x) < 0.7) continue; frame.bv(x - 0.035, kick, -0.19, x + 0.035, h, -0.08, 0.008); }
    if (doors) {
      glass.bx(-0.65, 0, -0.62, 0.65, tr - 0.05, -0.6);
      for (const s of [-1, 1]) {
        frame.bv(s * 0.65 - 0.05, 0, -0.66, s * 0.65 + 0.05, tr, -0.56, 0.01);
        frame.bv(s > 0 ? 0.02 : -0.63, 0.02, -0.64, s > 0 ? 0.63 : -0.02, 0.18, -0.58, 0.01);
        frame.put(SHAPES.cyl, s * 0.34, 1.05, -0.54, 0.02, 0.45, 0.02, Math.PI / 2, 0, Math.PI / 2);
      }
      frame.bv(-0.7, tr - 0.05, -0.66, 0.7, tr + 0.02, -0.14, 0.01);
      for (const s of [-1, 1]) frame.bx(s * 0.68 - 0.02, 0, -0.62, s * 0.68 + 0.02, tr, -0.16);
      stone.bx(-0.7, -0.02, -0.66, 0.7, 0.03, 0.02);
    }
  });
}

export function doorPart(type, w = 1.2, h = 2.5) {
  return part(`door:${type}:${f2(w)}:${f2(h)}`, (L) => {
    const hw = w / 2;
    if (type === 'panel' || type === 'arched') {
      const wood = L('m', 'door', 0), brass = L('t', 0xc9a14a), casing = L('m', 'stone'), glass = L('glass', 'glass');
      casing.bv(-hw - 0.14, 0, -0.02, -hw, h, 0.06, 0.015);
      casing.bv(hw, 0, -0.02, hw + 0.14, h, 0.06, 0.015);
      casing.bv(-hw - 0.2, h, -0.02, hw + 0.2, h + 0.18, 0.1, 0.02);
      for (const s of [-1, 1]) {
        const xa = s < 0 ? -hw : 0.01, xb = s < 0 ? -0.01 : hw;
        wood.bx(xa, 0, -0.26, xb, h - 0.02, -0.2, 0.9);
        for (let j = 0; j < 3; j++) {
          const y0 = 0.15 + j * ((h - 0.35) / 3), y1 = y0 + (h - 0.35) / 3 - 0.12;
          wood.bv(xa + 0.07, y0, -0.2, xb - 0.07, y1, -0.17, 0.02, 1.08);
        }
      }
      brass.put(SHAPES.sphere, -0.08, 1.05, -0.15, 0.04, 0.04, 0.04);
      brass.put(SHAPES.sphere, 0.08, 1.05, -0.15, 0.04, 0.04, 0.04);
      if (type === 'arched') glass.geo(archFillGeo('round', hw + 0.14, hw * 0.7, 0.02), mtx(0, h + 0.18, -0.02));
      L('m', 'wall').bx(-hw - 0.14, -0.02, -0.28, hw + 0.14, 0, 0.0, 0.8);
    } else if (type === 'revolving') {
      const metal = L('t', 'frame'), glass = L('glass', 0xcfe6ee);
      const r = Math.min(hw, 1.0);
      metal.geo(lathe('rev-canopy', [[0.01, 0], [r + 0.08, 0], [r + 0.1, 0.12], [r + 0.08, 0.25], [0.01, 0.25]], 28), mtx(0, h, -r * 0.45));
      metal.geo(lathe('rev-floor', [[0.01, 0], [r + 0.06, 0], [r + 0.06, 0.03], [0.01, 0.03]], 28), mtx(0, 0, -r * 0.45));
      metal.put(SHAPES.cyl, 0, h / 2, -r * 0.45, 0.05, h, 0.05);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + 0.4;
        glass.put(SHAPES.box, Math.cos(a) * r * 0.48, h / 2, -r * 0.45 + Math.sin(a) * r * 0.48, r * 0.96, h - 0.1, 0.02, 0, -a, 0);
      }
      for (const s of [-1, 1]) {
        const g = new THREE.CylinderGeometry(r, r, h, 20, 1, true, s > 0 ? 0.35 : Math.PI + 0.35, Math.PI - 0.7);
        glass.put(g, 0, h / 2, -r * 0.45, 1, 1, 1);
      }
    } else {
      const frame = L('t', 'frame'), glass = L('glass', 'glass');
      glass.bx(-hw, 0, -0.18, hw, h, -0.16);
      frame.bv(-hw - 0.06, 0, -0.22, -hw, h + 0.06, -0.1, 0.01);
      frame.bv(hw, 0, -0.22, hw + 0.06, h + 0.06, -0.1, 0.01);
      frame.bv(-hw, h, -0.22, hw, h + 0.06, -0.1, 0.01);
      frame.bv(-0.03, 0, -0.2, 0.03, h, -0.12, 0.008);
      frame.bv(-hw, 0, -0.2, hw, 0.14, -0.12, 0.01);
      for (const s of [-1, 1]) frame.put(SHAPES.cyl, s * hw * 0.5, 1.05, -0.08, 0.022, hw * 0.8, 0.022, 0, 0, Math.PI / 2);
    }
  });
}

// ---------- columns & pilasters ----------
export function columnPart(order, h, r = 0.18, slot = 'trim') {
  return part(`col:${order}:${f2(h)}:${f2(r)}:${slot}`, (L) => {
    const s = L(order === 'castiron' ? 't' : 'm', slot);
    const baseH = order === 'castiron' ? 0.25 : 0.3, capH = order === 'modern' ? 0.02 : order === 'doric' ? 0.28 : 0.4;
    const shaftH = h - baseH - capH;
    if (order !== 'modern') {
      s.bv(-r * 1.45, 0, -r * 1.45, r * 1.45, baseH * 0.4, r * 1.45, 0.02);
      s.geo(lathe(`cbase:${f2(r)}`, [[r * 1.3, 0], [r * 1.32, 0.05], [r * 1.15, 0.1], [r * 1.05, 0.12], [r * 1.18, 0.16], [r * 1.02, baseH * 0.6], [0.001, baseH * 0.6]], 20), mtx(0, baseH * 0.4, 0));
    }
    // shaft with entasis and flutes
    const flutes = order === 'doric' || order === 'ionic' || order === 'corinthian' || order === 'castiron';
    const shaft = new THREE.LatheGeometry(
      Array.from({ length: 9 }, (_, i) => { const t = i / 8; return new THREE.Vector2(r * (1 - 0.12 * Math.pow(t, 1.6)), t * shaftH); }), 24,
    );
    if (flutes) {
      const p = shaft.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
        const k = 1 - 0.06 * Math.max(0, Math.cos(a * 12));
        p.setX(i, x * k); p.setZ(i, z * k);
      }
      shaft.computeVertexNormals();
    }
    s.geo(shaft, mtx(0, order === 'modern' ? 0 : baseH, 0));
    const y = baseH + shaftH, rt = r * 0.88;
    if (order === 'castiron') {
      for (const yy of [baseH + 0.1, baseH + shaftH * 0.35]) s.geo(lathe(`cring:${f2(r)}`, [[r * 0.9, 0], [r * 1.15, 0.03], [r * 1.15, 0.07], [r * 0.9, 0.1]], 16), mtx(0, yy, 0));
      s.geo(lathe(`ccap:${f2(r)}`, [[rt, 0], [rt * 1.3, 0.1], [rt * 1.8, 0.28], [rt * 1.8, 0.34], [0.001, 0.34]], 16), mtx(0, y, 0));
    } else if (order === 'doric') {
      s.geo(lathe(`dor:${f2(r)}`, [[rt, 0], [rt * 1.02, 0.04], [rt * 1.35, 0.14], [0.001, 0.14]], 20), mtx(0, y, 0));
      s.bv(-rt * 1.45, y + 0.14, -rt * 1.45, rt * 1.45, y + capH, rt * 1.45, 0.015);
    } else if (order === 'ionic') {
      s.geo(lathe(`ion:${f2(r)}`, [[rt, 0], [rt * 1.15, 0.12], [0.001, 0.12]], 20), mtx(0, y, 0));
      s.bv(-rt * 1.6, y + 0.12, -rt * 1.1, rt * 1.6, y + 0.24, rt * 1.1, 0.02);
      for (const sx of [-1, 1]) s.put(SHAPES.torus, sx * rt * 1.35, y + 0.12, 0, rt * 0.35, rt * 0.35, rt * 8, 0, Math.PI / 2, 0);
      s.bv(-rt * 1.7, y + 0.24, -rt * 1.7, rt * 1.7, y + capH, rt * 1.7, 0.015);
    } else if (order === 'corinthian') {
      s.geo(lathe(`cor:${f2(r)}`, [[rt, 0], [rt * 1.05, 0.15], [rt * 1.3, 0.3], [0.001, 0.3]], 20), mtx(0, y, 0));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        s.put(SHAPES.ico, Math.cos(a) * rt * 1.02, y + 0.1, Math.sin(a) * rt * 1.02, rt * 0.3, rt * 0.55, rt * 0.3);
        s.put(SHAPES.ico, Math.cos(a + 0.4) * rt * 1.15, y + 0.24, Math.sin(a + 0.4) * rt * 1.15, rt * 0.26, rt * 0.4, rt * 0.26);
      }
      s.bv(-rt * 1.6, y + 0.3, -rt * 1.6, rt * 1.6, y + capH, rt * 1.6, 0.015);
    }
  });
}

export function pilasterPart(h, w = 0.4, d = 0.12, slot = 'trim', fluted = false) {
  return part(`pil:${f2(h)}:${f2(w)}:${f2(d)}:${slot}:${fluted}`, (L) => {
    const s = L('m', slot);
    s.bv(-w / 2 - 0.05, 0, 0, w / 2 + 0.05, 0.3, d + 0.05, 0.02);
    s.bv(-w / 2, 0.3, 0, w / 2, h - 0.35, d, 0.015);
    if (fluted) for (let i = 1; i < 5; i++) s.bx(-w / 2 + (w * i) / 5 - 0.012, 0.45, d - 0.005, -w / 2 + (w * i) / 5 + 0.012, h - 0.5, d + 0.004, 0.7);
    s.bv(-w / 2 - 0.04, h - 0.35, 0, w / 2 + 0.04, h - 0.15, d + 0.04, 0.02);
    s.bv(-w / 2 - 0.08, h - 0.15, 0, w / 2 + 0.08, h, d + 0.08, 0.02);
  });
}

// ---------- railings, balustrades, balconies ----------
export function balusterGeo(h) {
  return lathe(`bal:${f2(h)}`, [[0.06, 0], [0.06, 0.05], [0.035, 0.08], [0.05, h * 0.3], [0.065, h * 0.45], [0.04, h * 0.62], [0.028, h * 0.8], [0.04, h * 0.88], [0.05, h * 0.9], [0.05, h]], 10);
}

export function balustradePart(length, h = 0.9, slot = 'trim') {
  return part(`balus:${f2(length)}:${f2(h)}:${slot}`, (L) => {
    const s = L('m', slot);
    s.bv(-length / 2, 0, -0.14, length / 2, 0.14, 0.14, 0.02);
    s.geo(extrudeProfile('rail-stone', [[-0.16, 0], [0.16, 0], [0.16, 0.07], [0.12, 0.1], [0.1, 0.14], [-0.1, 0.14], [-0.12, 0.1], [-0.16, 0.07]], length), mtx(0, h - 0.14, 0));
    const n = Math.max(2, Math.floor(length / 0.24));
    const geo = balusterGeo(h - 0.28);
    for (let i = 0; i < n; i++) s.geo(geo, mtx(-length / 2 + (i + 0.5) * (length / n), 0.14, 0));
  });
}

export function ironRailingPart(length, h = 1.0, fancy = true) {
  return part(`iron:${f2(length)}:${f2(h)}:${fancy}`, (L) => {
    const s = L('t', 'iron');
    s.geo(extrudeProfile('rail', PROFILES.rail, length), mtx(0, h - 0.04, 0));
    s.bx(-length / 2, 0.1, -0.015, length / 2, 0.13, 0.015);
    const n = Math.max(2, Math.floor(length / 0.12));
    for (let i = 0; i <= n; i++) {
      const x = -length / 2 + (i * length) / n;
      s.put(SHAPES.cyl8, x, (h + 0.1) / 2, 0, 0.011, h - 0.1, 0.011);
    }
    if (fancy) {
      const m = Math.max(1, Math.round(length / 0.6));
      for (let i = 0; i < m; i++) {
        const x = -length / 2 + (i + 0.5) * (length / m);
        s.put(SHAPES.torus, x, h * 0.55, 0, 0.14, 0.14, 0.3);
        s.put(SHAPES.torus, x - 0.1, h * 0.28, 0, 0.08, 0.08, 0.3);
        s.put(SHAPES.torus, x + 0.1, h * 0.28, 0, 0.08, 0.08, 0.3);
      }
    }
    for (const x of [-length / 2, length / 2]) { s.put(SHAPES.cyl8, x, h / 2, 0, 0.025, h, 0.025); s.put(SHAPES.sphere, x, h + 0.04, 0, 0.04, 0.05, 0.04); }
  });
}

export function glassRailingPart(length, h = 1.05) {
  return part(`glrail:${f2(length)}:${f2(h)}`, (L) => {
    const steel = L('t', 0xc0c6cc), glass = L('glass', 0xbfe0ee);
    glass.bx(-length / 2 + 0.02, 0.06, -0.01, length / 2 - 0.02, h - 0.08, 0.01);
    steel.put(SHAPES.cyl, 0, h, 0, 0.03, length, 0.03, 0, 0, Math.PI / 2);
    for (let x = -length / 2; x <= length / 2 + 0.01; x += length / Math.max(1, Math.round(length / 1.3))) {
      steel.bv(x - 0.025, 0, -0.03, x + 0.025, h, 0.03, 0.006);
      for (const y of [0.3, h - 0.25]) steel.put(SHAPES.cyl, x, y, 0.025, 0.02, 0.02, 0.02, Math.PI / 2);
    }
  });
}

export function balconyPart(length, depth, kind = 'iron', slot = 'stone') {
  return part(`balc:${f2(length)}:${f2(depth)}:${kind}:${slot}`, (L) => {
    const s = L('m', kind === 'concrete' ? 'wall' : slot, kind === 'concrete' ? 3 : 0);
    s.bv(-length / 2, -0.12, 0, length / 2, 0.02, depth, 0.02);
    s.geo(extrudeProfile('slabEdge', PROFILES.slabEdge, length + 0.04), mtx(0, 0, depth - 0.02));
    if (kind !== 'glass' && kind !== 'concrete') {
      const corbel = extrudeShape('corbel', () => {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.lineTo(0.5, 0); sh.quadraticCurveTo(0.48, -0.12, 0.3, -0.16);
        sh.quadraticCurveTo(0.1, -0.2, 0.08, -0.45); sh.lineTo(0, -0.5); sh.lineTo(0, 0);
        return sh;
      }, 0.14);
      const n = Math.max(2, Math.round(length / 1.2));
      for (let i = 0; i <= n; i++) s.geo(corbel, mtx(-length / 2 + 0.12 + (i * (length - 0.24)) / n, -0.12, 0, 0, -Math.PI / 2, 0));
    }
    const put = (p, m) => { const mm = m.clone(); for (const l of p.layers) L(l.mat, l.slot).g.addGeometry(l.geo, mm, 0xffffff); };
    if (kind === 'iron') {
      put(ironRailingPart(length, 0.95), mtx(0, 0.02, depth - 0.06));
      for (const sx of [-1, 1]) put(ironRailingPart(depth - 0.06, 0.95, false), mtx(sx * (length / 2 - 0.03), 0.02, (depth - 0.06) / 2, 0, Math.PI / 2, 0));
    } else if (kind === 'glass') {
      put(glassRailingPart(length), mtx(0, 0.02, depth - 0.05));
      for (const sx of [-1, 1]) put(glassRailingPart(depth - 0.05), mtx(sx * (length / 2 - 0.03), 0.02, (depth - 0.05) / 2, 0, Math.PI / 2, 0));
    } else if (kind === 'stone') {
      put(balustradePart(length, 0.9), mtx(0, 0.02, depth - 0.14));
    } else {
      s.bv(-length / 2, 0.02, depth - 0.14, length / 2, 1.0, depth, 0.03);
    }
  });
}

// ---------- awnings, shutters, fixtures ----------
export function awningPart(length, depth = 1.3, drop = 0.9, stripes = true) {
  return part(`awn:${f2(length)}:${f2(depth)}:${f2(drop)}:${stripes}`, (L) => {
    const a = L('m', 'awning'), b = L('m', stripes ? 0xf2efe6 : 'awning'), iron = L('t', 0x2b2b2b);
    const prof = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push([depth * Math.sin((t * Math.PI) / 2), -drop * (1 - Math.cos((t * Math.PI) / 2)) * 0.8 - t * drop * 0.2]); }
    const shell = [...prof.map(([w, v]) => [w, v]), ...prof.slice().reverse().map(([w, v]) => [w - 0.03, v + 0.03])];
    const n = stripes ? Math.max(4, Math.round(length / 0.35)) : 1;
    const seg = length / n;
    for (let i = 0; i < n; i++) {
      const l = i % 2 ? b : a;
      l.geo(extrudeProfile(`awn-shell:${f2(depth)}:${f2(drop)}`, shell, seg), mtx(-length / 2 + (i + 0.5) * seg, 0, 0));
      l.put(SHAPES.halfDisc, -length / 2 + (i + 0.5) * seg, -drop, depth + 0.001, seg / 2, 0.14, 1, 0, 0, Math.PI);
    }
    for (const sx of [-1, 1]) {
      iron.put(SHAPES.cyl8, sx * (length / 2 - 0.05), -drop * 0.35, depth * 0.55, 0.015, depth * 1.2, 0.015, -0.95, 0, 0);
    }
  });
}

export function canopyPart(length, depth = 1.8, slot = 'frame') {
  return part(`canopy:${f2(length)}:${f2(depth)}:${slot}`, (L) => {
    const m = L('t', slot), glass = L('glass', 0xbfe0ee), light = L('l', 0xfff0c8);
    m.bv(-length / 2, -0.12, 0, length / 2, 0.06, depth, 0.02);
    glass.bx(-length / 2 + 0.1, 0.06, 0.1, length / 2 - 0.1, 0.08, depth - 0.1);
    m.geo(extrudeProfile('soffit', PROFILES.soffit, length + 0.04), mtx(0, -0.02, depth - 0.5));
    for (const sx of [-1, 1]) m.put(SHAPES.cyl8, sx * (length / 2 - 0.15), 0.6, depth * 0.45, 0.02, depth * 1.2, 0.02, -1.0, 0, 0);
    for (let x = -length / 2 + 0.4; x < length / 2; x += 0.8) light.put(SHAPES.cyl, x, -0.13, depth * 0.55, 0.08, 0.02, 0.08);
  });
}

export function shutterPart(w, h) {
  return part(`shut:${f2(w)}:${f2(h)}`, (L) => {
    const s = L('m', 'shutter');
    s.bv(-w / 2, 0, 0, -w / 2 + 0.05, h, 0.05, 0.01);
    s.bv(w / 2 - 0.05, 0, 0, w / 2, h, 0.05, 0.01);
    s.bv(-w / 2, 0, 0, w / 2, 0.06, 0.05, 0.01);
    s.bv(-w / 2, h - 0.06, 0, w / 2, h, 0.05, 0.01);
    s.bv(-w / 2, h * 0.48, 0, w / 2, h * 0.52, 0.05, 0.01);
    for (let y = 0.1; y < h - 0.08; y += 0.08) { if (Math.abs(y - h * 0.5) < 0.05) continue; s.put(SHAPES.box, 0, y, 0.025, w - 0.1, 0.06, 0.012, -0.6, 0, 0, 0.85); }
  });
}

export function acUnitPart() {
  return part('ac', (L) => {
    const body = L('t', 0xd5d9dc), dark = L('m', 0x3a3d40), steel = L('t', 0x8a9096);
    body.bv(-0.34, 0, 0, 0.34, 0.42, 0.42, 0.03);
    dark.put(SHAPES.cyl, 0.08, 0.21, 0.422, 0.15, 0.01, 0.15, Math.PI / 2);
    for (let y = 0.07; y < 0.38; y += 0.05) steel.bx(-0.3, y, 0.42, -0.1, y + 0.015, 0.43);
    for (const x of [-0.26, 0.26]) steel.bx(x - 0.015, -0.12, 0, x + 0.015, 0.0, 0.46);
    steel.bx(-0.3, -0.12, 0.44, 0.3, -0.1, 0.47);
  });
}

export function flowerBoxPart(length, seed = 0) {
  return part(`flow:${f2(length)}:${Math.floor(seed * 4)}`, (L) => {
    const box = L('m', 0x7a5236, 5), soil = L('m', 0x3b2a1e), leaf = L('m', [0x4f7f3a, 0x3f6f35, 0x5e8c41][Math.floor(seed * 3) % 3]);
    const flowerCols = [0xe63946, 0xf4a261, 0xffffff, 0xc77dff, 0xff6fb5];
    box.bv(-length / 2, 0, 0, length / 2, 0.22, 0.26, 0.015);
    soil.bx(-length / 2 + 0.03, 0.2, 0.03, length / 2 - 0.03, 0.215, 0.23);
    const n = Math.max(2, Math.round(length / 0.2));
    for (let i = 0; i < n; i++) {
      const x = -length / 2 + (i + 0.5) * (length / n);
      leaf.geo(foliage(seed + i * 0.13), mtx(x, 0.3, 0.13, 0, i, 0, 0.13, 0.12, 0.12));
      const f = L('m', flowerCols[(i + Math.floor(seed * 5)) % flowerCols.length]);
      f.put(SHAPES.ico, x + 0.03, 0.4, 0.18, 0.04, 0.035, 0.04);
    }
    const t = L('t', 0x2b2b2b);
    for (const x of [-length / 2 + 0.08, length / 2 - 0.08]) t.bx(x - 0.015, -0.12, 0, x + 0.015, 0.02, 0.2);
  });
}

// Projecting blade sign with a lit face.
export function bladeSignPart(color) {
  return part(`blade:${color}`, (L) => {
    const frame = L('t', 0x2b2b2b), face = L('l', color);
    frame.put(SHAPES.cyl8, 0, 0.9, 0.3, 0.02, 0.6, 0.02, Math.PI / 2);
    frame.bv(-0.05, -0.1, 0.35, 0.05, 0.95, 1.1, 0.01);
    face.bx(-0.06, 0.0, 0.42, 0.06, 0.85, 1.02);
    for (let i = 0; i < 4; i++) frame.bx(-0.07, 0.1 + i * 0.19, 0.5, 0.07, 0.2 + i * 0.19, 0.94);
  });
}
