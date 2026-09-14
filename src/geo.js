// Geometry accumulator + shape helpers. Everything is non-indexed with position, normal,
// color and a per-vertex `pattern` id (procedural surface relief, see patterns.js).
// Colors may be a hex number or [hex, patternId].
import * as THREE from 'three';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _s = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _nm = new THREE.Matrix3();
const nonIndexed = new WeakMap();

export const PAT = {
  NONE: 0, BRICK: 1, ASHLAR: 2, CONCRETE: 3, STUCCO: 4, WOOD: 5, TILE: 6, CARPET: 7, ROOFTILE: 8,
  PANEL: 9, MARBLE: 10, GRAVEL: 11, TERRACOTTA: 12, SHINGLE: 13, GRASS: 14, RUSTIC: 15, TIMBER: 16,
};

export const SHAPES = {
  box: new THREE.BoxGeometry(1, 1, 1),
  halfDisc: new THREE.CircleGeometry(1, 20, 0, Math.PI),
  disc: new THREE.CircleGeometry(1, 24),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone8: new THREE.ConeGeometry(1, 1, 12),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  ico: new THREE.IcosahedronGeometry(1, 1),
  hemi: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  torusHalf: new THREE.TorusGeometry(1, 0.07, 6, 18, Math.PI),
  torus: new THREE.TorusGeometry(1, 0.06, 6, 28),
};

const resolve = (color) => (Array.isArray(color) ? color : [color, 0]);

export class GeoBuilder {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.pat = []; }
  get empty() { return this.pos.length === 0; }
  get vertexCount() { return this.pos.length / 3; }

  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color, flat = true) {
    const [hex, p] = resolve(color);
    _c.set(hex);
    _a.set(bx - ax, by - ay, bz - az);
    _b.set(cx - ax, cy - ay, cz - az);
    _v.crossVectors(_a, _b).normalize();
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let i = 0; i < 3; i++) { this.nrm.push(_v.x, _v.y, _v.z); this.col.push(_c.r, _c.g, _c.b); this.pat.push(p); }
  }

  box(cx, cy, cz, sx, sy, sz, color) {
    const [hex, p] = resolve(color);
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    _c.set(hex);
    const r = _c.r, g = _c.g, b = _c.b, P = this.pos, N = this.nrm, C = this.col, T = this.pat;
    const face = (ax, ay, az, bx, by, bz, qx, qy, qz, dx, dy, dz, nx, ny, nz) => {
      P.push(ax, ay, az, bx, by, bz, qx, qy, qz, ax, ay, az, qx, qy, qz, dx, dy, dz);
      for (let i = 0; i < 6; i++) { N.push(nx, ny, nz); C.push(r, g, b); T.push(p); }
    };
    face(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0);
    face(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0);
    face(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0);
    face(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0);
    face(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1);
    face(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1);
  }

  // Box with chamfered edges (26-sided polyhedron) — edges catch light like real masonry/joinery.
  bevel(cx, cy, cz, sx, sy, sz, color, ch = 0.03) {
    const X = sx / 2, Y = sy / 2, Z = sz / 2;
    const c = Math.min(ch, X * 0.45, Y * 0.45, Z * 0.45);
    if (c < 0.004) return this.box(cx, cy, cz, sx, sy, sz, color);
    const P = (sx_, sy_, sz_, axis) => [
      cx + sx_ * (axis === 0 ? X : X - c),
      cy + sy_ * (axis === 1 ? Y : Y - c),
      cz + sz_ * (axis === 2 ? Z : Z - c),
    ];
    const add = (a, b, d) => {
      // orient outward from the box center
      _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      _b.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
      _v.crossVectors(_a, _b);
      const out = _v.x * (a[0] - cx) + _v.y * (a[1] - cy) + _v.z * (a[2] - cz);
      if (out < 0) this.tri(...a, ...d, ...b, color); else this.tri(...a, ...b, ...d, color);
    };
    const quad = (a, b, d, e) => { add(a, b, d); add(a, d, e); };
    const S = [-1, 1];
    // faces
    for (const s of S) {
      quad(P(s, -1, -1, 0), P(s, 1, -1, 0), P(s, 1, 1, 0), P(s, -1, 1, 0));
      quad(P(-1, s, -1, 1), P(1, s, -1, 1), P(1, s, 1, 1), P(-1, s, 1, 1));
      quad(P(-1, -1, s, 2), P(1, -1, s, 2), P(1, 1, s, 2), P(-1, 1, s, 2));
    }
    // edges
    for (const a of S) for (const b of S) {
      quad(P(a, b, -1, 0), P(a, b, 1, 0), P(a, b, 1, 1), P(a, b, -1, 1)); // along z
      quad(P(a, -1, b, 0), P(a, 1, b, 0), P(a, 1, b, 2), P(a, -1, b, 2)); // along y
      quad(P(-1, a, b, 1), P(1, a, b, 1), P(1, a, b, 2), P(-1, a, b, 2)); // along x
    }
    // corners
    for (const a of S) for (const b of S) for (const d of S) add(P(a, b, d, 0), P(a, b, d, 1), P(a, b, d, 2));
  }

  addGeometry(geom, matrix, color) {
    const [hex, pat] = resolve(color);
    let ni = nonIndexed.get(geom);
    if (!ni) { ni = geom.index ? geom.toNonIndexed() : geom; nonIndexed.set(geom, ni); }
    const p = ni.attributes.position.array, n = ni.attributes.normal.array;
    const vc = ni.attributes.color ? ni.attributes.color.array : null;
    _nm.getNormalMatrix(matrix);
    _c.set(hex);
    const e = matrix.elements, ne = _nm.elements;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      this.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      _v.set(ne[0] * n[i] + ne[3] * n[i + 1] + ne[6] * n[i + 2], ne[1] * n[i] + ne[4] * n[i + 1] + ne[7] * n[i + 2], ne[2] * n[i] + ne[5] * n[i + 1] + ne[8] * n[i + 2]).normalize();
      this.nrm.push(_v.x, _v.y, _v.z);
      if (vc) this.col.push(_c.r * vc[i], _c.g * vc[i + 1], _c.b * vc[i + 2]);
      else this.col.push(_c.r, _c.g, _c.b);
      this.pat.push(pat);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('pattern', new THREE.Float32BufferAttribute(this.pat, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// Place a unit shape in world space: center, scale, euler rotation.
export function put(g, geom, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) {
  _m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  _m.scale(_v.set(sx, sy, sz));
  _m.setPosition(x, y, z);
  g.addGeometry(geom, _m, color);
}

// ---------- profile + lathe helpers (cached) ----------
const shapeCache = new Map();
function cached(key, fn) {
  let g = shapeCache.get(key);
  if (!g) { g = fn(); shapeCache.set(key, g); }
  return g;
}

// Extrude a 2D profile given as [[w, v], ...] (w outward, v up) along x for `length`,
// centered on x = 0. Result: x = along, y = v, z = w.
export function extrudeProfile(key, pts, length, segs = 6) {
  return cached(`ex:${key}:${length.toFixed(3)}`, () => {
    const shape = new THREE.Shape(pts.map(([w, v]) => new THREE.Vector2(w, v)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: segs });
    g.rotateY(-Math.PI / 2);
    g.translate(length / 2, 0, 0);
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g;
  });
}

// Extrude an arbitrary THREE.Shape (in x/y) by depth along z, centered on z.
export function extrudeShape(key, makeShape, depth, segs = 12) {
  return cached(`es:${key}:${depth.toFixed(3)}`, () => {
    const g = new THREE.ExtrudeGeometry(makeShape(), { depth, bevelEnabled: false, curveSegments: segs });
    g.translate(0, 0, -depth / 2);
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g;
  });
}

// Lathe a profile [[radius, y], ...] around the y axis.
export function lathe(key, pts, segs = 16) {
  return cached(`la:${key}:${segs}`, () => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segs);
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g;
  });
}

// Tube along a list of points.
export function tube(key, pts, radius, segs = 24, radial = 8, closed = false) {
  return cached(`tu:${key}`, () => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), closed);
    const g = new THREE.TubeGeometry(curve, segs, radius, radial, closed);
    g.deleteAttribute('uv');
    return g;
  });
}

// Organic foliage blob: icosphere with noise-displaced vertices and baked shade variation.
export function foliage(seed = 0) {
  const k = Math.floor(seed * 8) % 8;
  return cached(`fol:${k}`, () => {
    const g = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
    const p = g.attributes.position;
    const col = [];
    const rnd = rng(0.13 + k * 0.11);
    const bumps = Array.from({ length: 7 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, 0.15 + rnd() * 0.25]);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).normalize();
      let d = 1;
      for (const [bx, by, bz, a] of bumps) d += a * Math.max(0, _v.x * bx + _v.y * by + _v.z * bz);
      d += Math.sin(_v.x * 9 + k) * Math.sin(_v.y * 11) * Math.sin(_v.z * 7) * 0.08;
      p.setXYZ(i, _v.x * d, _v.y * d * 0.9, _v.z * d);
      const shade = 0.72 + 0.28 * (0.5 + 0.5 * _v.y);
      col.push(shade, shade, shade);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g;
  });
}

// A wall frame: origin at the bottom-center of a cell face, u = along wall (viewer's right),
// v = up from floor, w = outward from the face.
export class Frame {
  set(ox, oy, oz, nx, nz) {
    this.ox = ox; this.oy = oy; this.oz = oz;
    this.nx = nx; this.nz = nz;
    this.rx = nz; this.rz = -nx;
    return this;
  }
  rect(g, u0, u1, v0, v1, w0, w1, color) {
    const u = (u0 + u1) / 2, w = (w0 + w1) / 2, su = u1 - u0, sw = w1 - w0;
    g.box(
      this.ox + this.rx * u + this.nx * w, this.oy + (v0 + v1) / 2, this.oz + this.rz * u + this.nz * w,
      Math.abs(this.rx) * su + Math.abs(this.nx) * sw, v1 - v0, Math.abs(this.rz) * su + Math.abs(this.nz) * sw,
      color,
    );
  }
  bev(g, u0, u1, v0, v1, w0, w1, color, ch = 0.03) {
    const u = (u0 + u1) / 2, w = (w0 + w1) / 2, su = u1 - u0, sw = w1 - w0;
    g.bevel(
      this.ox + this.rx * u + this.nx * w, this.oy + (v0 + v1) / 2, this.oz + this.rz * u + this.nz * w,
      Math.abs(this.rx) * su + Math.abs(this.nx) * sw, v1 - v0, Math.abs(this.rz) * su + Math.abs(this.nz) * sw,
      color, ch,
    );
  }
  // Matrix for wall-space placement: x = u, y = v, z = w (outward).
  matrix(u, v, w, rotZ = 0, rotX = 0, sx = 1, sy = 1, sz = 1, out = new THREE.Matrix4()) {
    out.makeBasis(_a.set(this.rx, 0, this.rz), _b.set(0, 1, 0), _v.set(this.nx, 0, this.nz));
    out.setPosition(this.ox + this.rx * u + this.nx * w, this.oy + v, this.oz + this.rz * u + this.nz * w);
    if (rotX) { _r.makeRotationX(rotX); out.multiply(_r); }
    if (rotZ) { _r.makeRotationZ(rotZ); out.multiply(_r); }
    if (sx !== 1 || sy !== 1 || sz !== 1) { _s.makeScale(sx, sy, sz); out.multiply(_s); }
    return out;
  }
  // Arbitrary shape in wall space (scale applied after rotZ, matching the original behavior).
  shape(g, geom, u, v, w, su, sv, sw, color, rotZ = 0, rotX = 0) {
    _m.makeBasis(_a.set(this.rx, 0, this.rz), _b.set(0, 1, 0), _v.set(this.nx, 0, this.nz));
    _m.setPosition(this.ox + this.rx * u + this.nx * w, this.oy + v, this.oz + this.rz * u + this.nz * w);
    _r.makeRotationX(rotX); _m.multiply(_r);
    _s.makeScale(su, sv, sw); _m.multiply(_s);
    _r.makeRotationZ(rotZ); _m.multiply(_r);
    g.addGeometry(geom, _m, color);
  }
  // Unscaled geometry in wall space (for pre-built profiles / parts).
  geo(g, geom, u, v, w, color, rotZ = 0, rotX = 0) {
    g.addGeometry(geom, this.matrix(u, v, w, rotZ, rotX, 1, 1, 1, _m), color);
  }
}

export function hash(a, b, c, d = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647 + d * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function rng(seed) {
  let s = Math.floor(seed * 4294967296) || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
