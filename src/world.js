// The city diorama: sky + day/night lighting, layered earth sized to the deepest basement,
// a full street grid with sidewalks, crosswalks and furniture, subway/rail tunnels with trains,
// buses, mixed traffic and pedestrians.
import * as THREE from 'three';
import { CELL } from './catalog.js';
import { GeoBuilder, PAT, SHAPES, hash, put } from './geo.js';
import { PartBatcher } from './batch.js';
import { applyPatterns } from './patterns.js';
import { mtx, part } from './kit.js';
import { lampPostPart, benchPart, hydrantPart, trashCanPart, bollardPart, shrubPart, carParts, busParts, trainCarParts } from './props.js';
import { anyTreePart, vanParts, truckParts, trafficLightPart, bikeRackPart, newsstandPart, mailboxPart, parkingMeterPart, planterBoxPart } from './props2.js';
import { grandFountainPart } from './parks.js';
import { Crowd } from './people.js';
import { tk } from './terrain.js';
import { STREET, CAR_FREE } from './layout.js';

const col = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// City streets are 20 m bands: a 14 m roadway between 3 m sidewalks. Lanes are [offset from the center
// line, direction] per street axis; one-way stretches override the direction.
const ASPHALT = [0x3b3d42, PAT.GRAVEL], WALK = [0xb8b3a8, PAT.TILE], CURB = [0x9a968e, PAT.ASHLAR], PAVERS = [0xc9bfae, PAT.TILE], SETTS = [0xa89c88, PAT.ASHLAR];
const PAINT = 0xe8e8e0, YELLOW = 0xe0b440, CURB_LANE = [0x5a3a36, PAT.GRAVEL], GRASS = [0x5e8c41, PAT.GRASS], BIKE_GREEN = [0x2e8b57, PAT.CONCRETE];

// Cross-section of a street hw metres either side of its center line: sidewalk width, roadway half width
// (the curb face), the lanes' offset and the half width of a planted median. City streets are hw 10.
function profile(hw) {
  const walk = hw >= 10 ? 3 : hw >= 6 ? 1.5 : hw >= 4 ? 1.2 : 0.5, rw = hw - walk;
  return { hw, walk, rw, lane: rw >= 3 ? 1.9 : rw / 2, median: Math.min(1.8, rw - 2.9) };
}
const LANES = { x: [[-1.9, 1], [1.9, -1]], z: [[1.9, 1], [-1.9, -1]] };
const DRIVE = { oneway: 1, onewayrev: -1 };
const NO_TRAFFIC = new Set(['removed', 'pedestrian', 'edge']); // what an intersection side can't take traffic from
const CORNERS = [[1, 1, Math.PI], [-1, -1, 0], [1, -1, -Math.PI / 2], [-1, 1, Math.PI / 2]];

// Map-block road kinds by who uses them.
const CAR_ROADS = new Set(['road', 'lane']), BIKE_ROADS = new Set(['bikelane']), WALK_ROADS = new Set(['lane']), PATH_ROADS = new Set(['lane', 'bikelane']);
const BIKE_TYPE = 5; // index of the cyclist among the vehicle types

// A cyclist facing +x; the jersey and helmet take the paint color.
function bikeParts() {
  const paint = part('bike-paint', (L) => {
    const p = L('m', 'paint');
    p.put(SHAPES.box, 0, 1.18, 0, 0.24, 0.56, 0.32, 0, 0, -0.45);
    p.put(SHAPES.sphere, 0.22, 1.56, 0, 0.12, 0.08, 0.12);
  });
  const rest = part('bike-rest', (L) => {
    const tire = L('m', 0x151515), frame = L('t', 0x3a3f44), skin = L('m', 0xe0b090), pants = L('m', 0x2b2b2b);
    for (const x of [-0.55, 0.55]) tire.put(SHAPES.torus, x, 0.34, 0, 0.34, 0.34, 1.2);
    frame.put(SHAPES.box, 0, 0.62, 0, 0.9, 0.04, 0.04, 0, 0, 0.1);
    frame.put(SHAPES.box, -0.28, 0.48, 0, 0.04, 0.5, 0.04, 0, 0, 0.5);
    frame.put(SHAPES.box, 0.5, 0.6, 0, 0.04, 0.55, 0.04, 0, 0, -0.35);
    frame.put(SHAPES.box, 0.52, 0.92, 0, 0.04, 0.04, 0.5);
    skin.put(SHAPES.sphere, 0.2, 1.46, 0, 0.1, 0.12, 0.1);
    for (const z of [-0.13, 0.13]) {
      pants.put(SHAPES.cyl8, -0.05, 0.66, z, 0.06, 0.62, 0.06, 0, 0, 0.3);
      skin.put(SHAPES.cyl8, 0.3, 1.08, z * 1.4, 0.035, 0.5, 0.035, 0, 0, -1.0);
    }
  });
  return { paint, rest };
}

const stopSignPart = () => part('stopsign', (L) => {
  L('t', 0x9aa1a6).put(SHAPES.cyl8, 0, 1.25, 0, 0.04, 2.5, 0.04);
  L('m', 0xf4f4f0).put(SHAPES.cyl8, 0, 2.45, 0.05, 0.4, 0.03, 0.4, Math.PI / 2, Math.PI / 8, 0);
  L('m', 0xc0392b).put(SHAPES.cyl8, 0, 2.45, 0.07, 0.35, 0.02, 0.35, Math.PI / 2, Math.PI / 8, 0);
  L('m', 0xf4f4f0).bx(-0.2, 2.42, 0.08, 0.2, 2.48, 0.085);
});

// Boxes in a street's own frame: u along it, v across it from the center line. North–south streets turn a
// quarter (v points to -x) so rotated parts keep their handedness.
function streetFrame(g, axis, c) {
  const X = axis === 'x';
  return {
    X,
    box(u0, u1, y0, y1, v0, v1, color, bev = 0) {
      const ua = Math.min(u0, u1), ub = Math.max(u0, u1), va = Math.min(v0, v1), vb = Math.max(v0, v1);
      const [cx, cz, sx, sz] = X ? [(ua + ub) / 2, c + (va + vb) / 2, ub - ua, vb - va] : [c - (va + vb) / 2, (ua + ub) / 2, vb - va, ub - ua];
      if (bev) g.bevel(cx, (y0 + y1) / 2, cz, sx, y1 - y0, sz, color, bev); else g.box(cx, (y0 + y1) / 2, cz, sx, y1 - y0, sz, color);
    },
    at: (u, v) => (X ? [u, c + v] : [c - v, u]),
    ry: (r) => (X ? r : r - Math.PI / 2),
  };
}

export function bakePart(p, colors = {}) {
  const out = new Map();
  for (const l of p.layers) {
    const mat = l.mat === 'glass' ? 'wd' : l.mat;
    if (!out.has(mat)) out.set(mat, new GeoBuilder());
    out.get(mat).addGeometry(l.geo, new THREE.Matrix4(), typeof l.slot === 'number' ? 0xffffff : (colors[l.slot] ?? 0xffffff));
  }
  return new Map([...out].map(([k, g]) => [k, g.build()]));
}

function advance(t, stops, dt, vmax, acc, lim, dwell, blockedGap = Infinity) {
  if (t.dwell > 0) { t.dwell -= dt; return; }
  let dist = Infinity, sx = null;
  for (const s of stops) {
    const dd = (s - t.pos) * t.dir;
    if (dd > -0.01 && dd < dist && s !== t.last) { dist = dd; sx = s; }
  }
  let target = sx === null ? vmax : Math.max(1, Math.min(vmax, Math.sqrt(2 * acc * dist)));
  if (blockedGap < 16) target = Math.min(target, Math.max(0, (blockedGap - 14) * 2));
  t.v = t.v < target ? Math.min(target, t.v + acc * dt) : target;
  t.pos += t.v * t.dir * dt;
  if (sx !== null && dist < 0.15) { t.dwell = dwell; t.last = sx; t.v = 0; }
  if (t.dir > 0 && t.pos > lim) { t.pos = -lim; t.last = null; }
  if (t.dir < 0 && t.pos < -lim) { t.pos = lim; t.last = null; }
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.stops = { subway: new Map(), rail: [], bus: new Map() };
    this.night = 0;
    this.lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.mats = {
      m: applyPatterns(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })),
      t: applyPatterns(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.7 }), 0.15),
      wd: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.6 }),
      wl: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.5, emissive: 0xfff2c8, emissiveIntensity: 0 }),
      wc: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.5 }),
      l: this.lampMat,
    };
    this.earthMat = applyPatterns(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    this.groundMat = applyPatterns(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    this.buildSky();
    this.buildLights();
  }

  buildSky() {
    this.skyU = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP;\nvoid main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top;\nuniform vec3 bottom;\nvarying vec3 vP;\nvoid main(){\n  float h = clamp(vP.y * 1.6 + 0.25, 0.0, 1.0);\n  gl_FragColor = vec4(mix(bottom, top, h), 1.0);\n  #include <colorspace_fragment>\n}',
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    const sp = [];
    for (let i = 0; i < 1800; i++) {
      const u = Math.random() * Math.PI * 2, y = Math.random() * 0.95, s = Math.sqrt(1 - y * y);
      sp.push(Math.cos(u) * s * 2900, y * 2900, Math.sin(u) * s * 2900);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    this.scene.add(this.stars);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x6b5a48, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
  }

  setLayout(layout) {
    if (this.group) {
      this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isBatchedMesh) o.dispose(); });
      this.scene.remove(this.group);
    }
    this.layout = layout;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    const ext = Math.max(layout.width, layout.depth) / 2 + 20;
    Object.assign(this.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 2000 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.depth = null;
    this.earth = null;
    this.slab = null;
    this.topsoil = null;
    this.edgeGroup = null;
    this.terrainCity = undefined;
    this.setDepth(0);
    this.buildSlab(null);
    // The old groups went with the old world group (already disposed), so don't dispose them again.
    this.streetGroup = this.roadGroup = this.trafficGroup = null;
    this.buildStreets();
    this.streetLayout = layout;
    this.streetVersion = 0;
    this.roadVersion = 0;
    for (const band of layout.hStreets) {
      this.buildTunnel(band.zc, 0, 0x2f6fd0);
      if (band.j === layout.railBand) this.buildTunnel(band.zc, -8, 0xc0392b);
    }
    this.subways = [];
    for (const band of layout.hStreets) this.subways.push(...this.makeTrains(-5.8, 12, 4, 0xc9ced3, 0x2f6fd0, [[band.zc + 1.7, 1, -40 + band.j * 20], [band.zc - 1.7, -1, 30 - band.j * 15]], band.j));
    const rb = layout.hStreets[layout.railBand];
    this.rails = rb ? this.makeTrains(-13.8, 16, 5, 0xe3e6ea, 0xc0392b, [[rb.zc + 1.7, -1, 60], [rb.zc - 1.7, 1, -20]], rb.j) : [];
    this.buildBuses();
    this.setUnderground(this.underground);
  }

  setDepth(minY) {
    const L = this.layout;
    const D = Math.max(24, (-minY + 2) * CELL + 8);
    if (D === this.depth) return;
    this.depth = D;
    if (this.earth) { this.earth.geometry.dispose(); this.group.remove(this.earth); }
    const W = L.width + 16, Dz = L.depth + 16;
    const e = new GeoBuilder();
    e.box(0, -6.5, 0, W, 7, Dz, [0x8a6a45, PAT.STUCCO]);
    const rest = D - 10;
    const bands = Math.max(1, Math.round(rest / 16));
    for (let i = 0; i < bands; i++) {
      const top = -10 - (rest * i) / bands, h = rest / bands;
      e.box(0, top - h / 2, 0, W, h, Dz, [[0x56534e, 0x4a4744, 0x625a50, 0x3f3d3a][i % 4], i % 2 ? PAT.CONCRETE : PAT.ASHLAR]);
    }
    this.earth = new THREE.Mesh(e.build(), this.earthMat);
    this.earth.receiveShadow = true;
    this.group.add(this.earth);
    if (this.slab) this.buildSlab(this.terrainCity || null);
  }

  // Rebuild the plot slab and topsoil with openings under map-block terrain (so lakes can sink).
  setTerrain(city) {
    this.syncStreets(city);
    if (this.terrainCity === city && this.terrainVersion === city?.terrainVersion) return;
    this.terrainCity = city;
    this.terrainVersion = city?.terrainVersion;
    this.buildSlab(city || null);
  }

  // Ground that changes with map blocks: the plot slab and topsoil (open under terrain), the grass
  // margin ring around the grid, expanded land with bedrock beneath it, and the edge trees.
  buildSlab(city) {
    for (const m of [this.slab, this.topsoil]) if (m) { m.geometry.dispose(); this.group.remove(m); }
    if (this.edgeGroup) { this.edgeGroup.traverse((o) => { if (o.isBatchedMesh) o.dispose(); }); this.group.remove(this.edgeGroup); }
    const L = this.layout, terrain = city?.terrain, land = city?.land;
    const g = new GeoBuilder(), e = new GeoBuilder(), b = new PartBatcher();
    // The slab opens under terrain (so lakes sink) and streets (drawn at street level); topsoil only under terrain.
    const hole = (x, z) => !!terrain && terrain.has(tk(x, z));
    const open = (x, z) => hole(x, z) || city?.roads.get(tk(x, z))?.t === 'road';
    const isLand = (x, z) => !!land && land.has(tk(x, z));
    const ring = (x, z) => L.inEdge(x, z);
    // Runs of matching cells along one axis, emitted as one box each.
    const runs = (a0, a1, ok, emit) => { let s = null; for (let i = a0; i <= a1 + 1; i++) { if (i <= a1 && ok(i)) { if (s === null) s = i; } else if (s !== null) { emit(s, i - 1); s = null; } } };
    for (let j = 0; j < L.blocksZ; j++) for (let i = 0; i < L.blocksX; i++) {
      const bx0 = 5 + i * L.P, bz0 = 5 + j * L.Q, bx1 = bx0 + L.bw - 1, bz1 = bz0 + L.bd - 1;
      for (let z = bz0; z <= bz1; z++) runs(bx0, bx1, (x) => !open(x, z), (a, c) => g.box(L.wx(a) + (c - a + 1) * 2, -0.14, L.wz(z) + 2, (c - a + 1) * CELL, 0.32, CELL, [0x8d8779, PAT.CONCRETE]));
      for (let k = 1; k < L.lotsPerRow; k++) {
        const x = bx0 + k * L.plotW;
        runs(bz0, bz1, (z) => !open(x - 1, z) && !open(x, z), (a, c) => g.box(L.wx(x), 0.024, L.wz(a) + (c - a + 1) * 2, 0.14, 0.01, (c - a + 1) * CELL, 0x6d6a62));
      }
      const zm = bz0 + L.plotD;
      runs(bx0, bx1, (x) => !open(x, zm - 1) && !open(x, zm), (a, c) => g.box(L.wx(a) + (c - a + 1) * 2, 0.024, L.wz(zm), (c - a + 1) * CELL, 0.01, 0.14, 0x6d6a62));
    }
    // Removed streets are plain plot ground.
    for (const [k, t] of L.streets || []) {
      if (t !== 'removed') continue;
      const r = L.pieceBounds(k);
      for (let z = r.z0; z <= r.z1; z++) runs(r.x0, r.x1, (x) => !open(x, z), (a, c) => g.box(L.wx(a) + (c - a + 1) * 2, -0.14, L.wz(z) + 2, (c - a + 1) * CELL, 0.32, CELL, [0x8d8779, PAT.CONCRETE]));
    }
    const E = L.ext, deep = this.depth || 24;
    const X0 = Math.min(E.x0, -2), X1 = Math.max(E.x1, L.sizeX + 1), Z0 = Math.min(E.z0, -2), Z1 = Math.max(E.z1, L.sizeZ + 1);
    for (let z = Z0; z <= Z1; z++) {
      const at = (m, a, c, y, h, col) => m.box(L.wx(a) + (c - a + 1) * 2, y, L.wz(z) + 2, (c - a + 1) * CELL, h, CELL, col);
      runs(X0, X1, (x) => (ring(x, z) || isLand(x, z)) && !hole(x, z), (a, c) => at(e, a, c, -1.65, 2.7, [0x6b4f33, PAT.GRAVEL]));
      runs(X0, X1, (x) => ring(x, z) && !L.inGrid(x, z) && !isLand(x, z) && !open(x, z), (a, c) => at(g, a, c, -0.14, 0.32, [0x6f8f4f, PAT.GRASS]));
      runs(X0, X1, (x) => !L.inGrid(x, z) && isLand(x, z) && !open(x, z), (a, c) => at(g, a, c, -0.14, 0.32, [0x8d8779, PAT.CONCRETE]));
      runs(X0, X1, (x) => isLand(x, z) && !ring(x, z), (a, c) => at(e, a, c, -3 - (deep - 3) / 2, deep - 3, [0x56534e, PAT.CONCRETE]));
    }
    // Edge trees make way for anything built, painted or paved on the edge.
    const tree = (x, z, k, s) => {
      const gx = L.gx(x), gz = L.gz(z), key = tk(gx, gz);
      if (isLand(gx, gz) || open(gx, gz) || city?.roads.has(key) || city?.closed.has(key)) return;
      b.place(anyTreePart(hash(k | 0, s, 9), 1.0 + hash(k | 0, s, 2) * 0.4, [0, 1, 1, 2][Math.floor(hash(k | 0, s, 5) * 4)]), mtx(x, 0, z, 0, k, 0), {}, 'always', 'wd', true);
    };
    for (const s of [-1, 1]) {
      for (let x = L.ox - 4; x < L.ox + L.width + 4; x += 7) tree(x, s * (L.depth / 2 + 3), x, s);
      for (let z = L.oz; z < L.oz + L.depth; z += 7) tree(s * (L.width / 2 + 3), z, z, s + 3);
    }
    this.edgeGroup = new THREE.Group();
    b.build(this.edgeGroup, this.mats);
    this.slab = new THREE.Mesh(g.build(), this.groundMat);
    this.topsoil = new THREE.Mesh(e.build(), this.earthMat);
    this.slab.receiveShadow = this.topsoil.receiveShadow = true;
    this.group.add(this.slab, this.topsoil, this.edgeGroup);
    const reach = Math.max(-L.wx(X0), L.wx(X1 + 1), -L.wz(Z0), L.wz(Z1 + 1)) + 20;
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach });
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  // Is the street at this world point closed by a building?
  shutAt(x, z) {
    const L = this.layout;
    return !!L.closed?.size && L.closed.has(tk(L.gx(x), L.gz(z)));
  }
  // Street furniture stays off closed and removed streets.
  propBlocked(x, z) { const L = this.layout; return this.shutAt(x, z) || L.removed.has(tk(L.gx(x), L.gz(z))); }
  // Is there no driving at this world point (closed, pedestrianized or removed)?
  carsBlocked(x, z) { const L = this.layout; return this.shutAt(x, z) || L.carFree(L.gx(x), L.gz(z)); }

  // Street changes rebuild the streets (and their traffic); map-road changes reroute only the traffic.
  syncStreets(city) {
    const v = city?.streetVersion ?? 0, rv = city?.roadVersion ?? 0;
    if (this.streetLayout !== this.layout || this.streetVersion !== v) {
      this.streetLayout = this.layout;
      this.streetVersion = v;
      this.roadVersion = rv;
      this.buildStreets();
    } else if (this.roadVersion !== rv) {
      this.roadVersion = rv;
      this.buildRoadNet();
      this.buildTraffic();
    }
  }

  // Everything that follows the street configuration and the buildings that close streets: the street
  // surfaces, furniture, and traffic and pedestrians, which turn back where a street is closed or car-free.
  buildStreets() {
    if (this.streetGroup) {
      this.streetGroup.traverse((o) => { if (o.isBatchedMesh) o.dispose(); else if (o.geometry) o.geometry.dispose(); });
      this.group.remove(this.streetGroup);
    }
    const L = this.layout, g = new GeoBuilder();
    this.streetGroup = new THREE.Group();
    this.group.add(this.streetGroup);
    for (const p of L.pieces()) {
      const t = L.streets?.get(p.k) || null;
      if (p.kind === 'x') this.buildCrossing(g, this.crossGeom(p.i, p.j, t)); else this.buildSegment(g, this.pieceGeom(p), t);
    }
    // Paving over closed street blocks sits just above the road, sidewalks and curbs (top 0.02) so they vanish under it.
    if (L.closed?.size) for (const { x, z } of L.closed.values()) if (L.isGridStreet(x, z)) g.box(L.wx(x) + 2, -0.1375, L.wz(z) + 2, CELL, 0.325, CELL, [0x8d8779, PAT.CONCRETE]);
    const m = new THREE.Mesh(g.build(), this.groundMat);
    m.receiveShadow = true;
    this.streetGroup.add(m);
    this.buildProps(this.streetGroup);
    this.buildRoadNet();
    this.buildTraffic();
  }

  // World extent of a city street stretch: its axis, center line c, ends a..b along the axis and half width.
  pieceGeom(p) {
    const L = this.layout;
    if (p.kind === 'h') return { axis: 'x', c: L.hStreets[p.j].zc, a: L.vStreets[p.i].xc + 10, b: L.vStreets[p.i + 1].xc - 10, hw: 10 };
    return { axis: 'z', c: L.vStreets[p.i].xc, a: L.hStreets[p.j].zc + 10, b: L.hStreets[p.j + 1].zc - 10, hw: 10 };
  }
  crossGeom(i, j, t) {
    const L = this.layout;
    return { xc: L.vStreets[i].xc, zc: L.hStreets[j].zc, hx: 10, hz: 10, t, adj: this.approaches(i, j), seed: [i, j] };
  }

  // The same for a painted street stretch. Ends that meet no street close with a sidewalk (caps).
  segGeom(p) {
    const L = this.layout, b = p.band, X = b.axis === 'x', along = (i) => (X ? L.wx(i) : L.wz(i)), across = (i) => (X ? L.wz(i) : L.wx(i));
    const meets = (i) => { for (let r = b.r0; r < b.r0 + b.w; r++) { const [x, z] = X ? [i, r] : [r, i]; if (L.roads.get(tk(x, z))?.t === 'road' || L.isOpenGridStreet(x, z)) return true; } return false; };
    const a = along(p.a0), e = along(p.a1 + 1), caps = [];
    if (!meets(p.a0 - 1)) caps.push([a, 1]);
    if (!meets(p.a1 + 1)) caps.push([e, -1]);
    return { axis: b.axis, c: (across(b.r0) + across(b.r0 + b.w)) / 2, a, b: e, hw: b.w * 2, caps };
  }
  // A painted junction. Each side meets a stretch (its type), 'join' where the street runs on into another
  // junction or a city street, or 'edge' where nothing carries on.
  junctionGeom(p, t) {
    const L = this.layout, net = L.roadNet();
    const side = (cells) => {
      let kind = 'edge';
      for (const [x, z] of cells) {
        const q = net.pieceOf.get(tk(x, z));
        if (q?.kind === 'seg') return L.roadType(q) || 'avenue';
        if (q || L.isOpenGridStreet(x, z)) kind = 'join';
      }
      return kind;
    };
    const col = (x) => Array.from({ length: p.z1 - p.z0 + 1 }, (_, i) => [x, p.z0 + i]), row = (z) => Array.from({ length: p.x1 - p.x0 + 1 }, (_, i) => [p.x0 + i, z]);
    return {
      xc: (L.wx(p.x0) + L.wx(p.x1 + 1)) / 2, zc: (L.wz(p.z0) + L.wz(p.z1 + 1)) / 2, hx: (p.x1 - p.x0 + 1) * 2, hz: (p.z1 - p.z0 + 1) * 2, t,
      adj: [side(col(p.x1 + 1)), side(col(p.x0 - 1)), side(row(p.z1 + 1)), side(row(p.z0 - 1))], seed: [p.x0, p.z0],
    };
  }

  // Painted streets, drawn and furnished with the same stretch and intersection pieces as the city grid,
  // plus any loose road blocks that don't form a band. Rebuilt whenever the roads change.
  buildRoadNet() {
    if (this.roadGroup) {
      this.roadGroup.traverse((o) => { if (o.isBatchedMesh) o.dispose(); else if (o.geometry) o.geometry.dispose(); });
      this.roadGroup.parent?.remove(this.roadGroup);
    }
    this.roadGroup = new THREE.Group();
    this.group.add(this.roadGroup);
    const L = this.layout, net = L.roadNet(), g = new GeoBuilder(), b = new PartBatcher();
    const P = (p, x, z, ry = 0, s = 1, y = 0) => b.place(p, mtx(x, y, z, 0, ry, 0, s, s, s), {}, 'always', 'wd', true);
    for (const p of net.pieces) {
      const t = L.roadType(p);
      if (p.kind === 'x') { const X = this.junctionGeom(p, t); this.buildCrossing(g, X); this.crossingProps(P, X); }
      else { const G = this.segGeom(p); this.buildSegment(g, G, t); this.segmentProps(P, G, t); }
    }
    for (const r of net.loose) {
      const x0 = L.wx(r.x), z0 = L.wz(r.z);
      if (r.s === 'pedestrian') { g.box(x0 + 2, -0.15, z0 + 2, CELL, 0.3, CELL, PAVERS); continue; }
      g.box(x0 + 2, -0.18, z0 + 2, CELL, 0.24, CELL, ASPHALT);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (L.roads.get(tk(r.x + dx, r.z + dz))?.t === 'road' || L.isOpenGridStreet(r.x + dx, r.z + dz)) continue;
        g.box(x0 + 2 + dx * 1.6, -0.15, z0 + 2 + dz * 1.6, dx ? 0.8 : CELL, 0.3, dz ? 0.8 : CELL, WALK);
      }
    }
    if (!g.empty) { const m = new THREE.Mesh(g.build(), this.groundMat); m.receiveShadow = true; this.roadGroup.add(m); }
    b.build(this.roadGroup, this.mats);
  }

  // What meets each side of an intersection (0:+x 1:-x 2:+z 3:-z): a street type, or 'edge' past the grid.
  approaches(i, j) {
    const L = this.layout, S = L.streets;
    return [[`h:${i}:${j}`, i < L.blocksX], [`h:${i - 1}:${j}`, i > 0], [`v:${i}:${j}`, j < L.blocksZ], [`v:${i}:${j - 1}`, j > 0]]
      .map(([k, ok]) => (ok ? S?.get(k) || 'avenue' : 'edge'));
  }

  // One stretch of street between junctions, hw metres either side of its center line (city streets: 10),
  // with markings for its type sized to the roadway. caps: [[u, dir]] ends that meet no street, closed with a
  // sidewalk running dir from u.
  buildSegment(g, { axis, c, a, b, hw = 10, caps = [] }, t) {
    if (t === 'removed') return; // plot ground, drawn with the slab
    const F = streetFrame(g, axis, c), { walk, rw, lane, median } = profile(hw);
    if (t === 'pedestrian') {
      const mid = Math.min(2.2, hw * 0.3);
      F.box(a, b, -0.3, 0, -mid, mid, SETTS);
      for (const s of [-1, 1]) { F.box(a, b, -0.3, 0, s * mid, s * hw, PAVERS); if (rw - 0.1 > mid) F.box(a, b, 0, 0.004, s * (rw - 0.1), s * (rw + 0.1), 0x8f877a); }
      return;
    }
    F.box(a, b, -0.3, -0.06, -rw, rw, ASPHALT);
    for (const s of [-1, 1]) { F.box(a, b, -0.3, 0, s * rw, s * hw, WALK); F.box(a, b, -0.2, 0.02, s * (rw - 0.15), s * (rw + 0.15), CURB, 0.03); }
    for (const [u, d] of caps) {
      const cw = Math.min(Math.max(walk, 1), (b - a) / 3);
      F.box(u, u + d * cw, -0.3, 0, -rw, rw, WALK);
      F.box(u + d * (cw - 0.15), u + d * (cw + 0.15), -0.2, 0.02, -rw, rw, CURB, 0.03);
    }
    const paint = (u0, u1, v0, v1, color = PAINT, top = -0.04) => F.box(u0, u1, -0.06, top, v0, v1, color);
    const solid = (v, w, color = PAINT) => paint(a, b, v - w / 2, v + w / 2, color);
    const dashes = (v, color = PAINT) => { for (let u = a + 3; u < b - 3; u += 6) paint(u - 1.25, u + 1.25, v - 0.075, v + 0.075, color); };
    const arrow = (u, v, d) => { for (const [p0, p1, w] of [[-1.2, 0.4, 0.2], [0.4, 0.7, 0.9], [0.7, 1.0, 0.55], [1.0, 1.25, 0.22]]) paint(u + d * p0, u + d * p1, v - w / 2, v + w / 2, PAINT, -0.035); };
    if (t === 'median' && median >= 1) {
      F.box(a, b, -0.2, 0.12, -median, median, CURB, 0.04);
      F.box(a + 0.3, b - 0.3, 0.12, 0.14, 0.25 - median, median - 0.25, GRASS);
      if (rw >= 6) for (const s of [-1, 1]) { paint(a, b, s * 4.3, s * (rw - 0.3), CURB_LANE); solid(s * 4.15, 0.15); }
      return;
    }
    if (t === 'bikeway' && rw >= 4) {
      for (const s of [-1, 1]) { paint(a, b, s * (rw - 1.35), s * (rw - 0.15), BIKE_GREEN); solid(s * (rw - 1.55), 0.15); }
      for (const dv of [-0.15, 0.15]) solid(dv, 0.1, YELLOW);
    } else {
      if (rw >= 6) for (const s of [-1, 1]) paint(a, b, s * 4.1, s * (rw - 0.3), CURB_LANE);
      if (rw >= 5.5) for (const s of [-1, 1]) dashes(s * 3.6);
      if (DRIVE[t]) {
        if (rw >= 2.5) dashes(0);
        const us = b - a >= 24 ? Array.from({ length: Math.floor((b - a - 6) / 18) }, (_, i) => a + 9 + i * 18) : [(a + b) / 2];
        for (const u of us) for (const v of [-lane, lane]) arrow(u, v, DRIVE[t]);
      } else if (rw >= 2.5) for (const dv of [-0.15, 0.15]) solid(dv, 0.1, YELLOW);
      else dashes(0, YELLOW);
    }
    if (rw >= 5) for (let u = a + 6; u < b - 6; u += 23) { const m = u + hash(u | 0, c | 0, 3) * 5, v = hash(u | 0, 1, 1) < 0.5 ? -1.9 : 1.9; paint(m - 0.35, m + 0.35, v - 0.35, v + 0.35, [0x2b2b2b, PAT.PANEL], -0.03); }
  }

  // An intersection hx by hz metres either side of its center, where the street along x (half width hz)
  // meets the street along z (half width hx); city intersections are 10 by 10. adj: what meets each side.
  buildCrossing(g, { xc, zc, hx, hz, t, adj }) {
    if (t === 'removed') return;
    const F = streetFrame(g, 'x', zc), rh = profile(hz).rw, rv = profile(hx).rw;
    const B = (x0, x1, y0, y1, z0, z1, color, bev) => F.box(xc + x0, xc + x1, y0, y1, z0, z1, color, bev);
    if (t === 'plaza') {
      const r = Math.min(hx, hz) * 0.65;
      B(-hx, hx, -0.3, 0, -hz, hz, PAVERS);
      put(g, SHAPES.cyl, xc, 0.004, zc, r, 0.008, r, SETTS);
      return;
    }
    B(-hx, hx, -0.3, -0.06, -rh, rh, ASPHALT);
    for (const s of [-1, 1]) B(-rv, rv, -0.3, -0.06, s * rh, s * hz, ASPHALT);
    for (const [sx, sz] of CORNERS) {
      B(sx * rv, sx * hx, -0.3, 0, sz * rh, sz * hz, WALK);
      B(sx * (rv - 0.15), sx * hx, -0.2, 0.02, sz * (rh - 0.15), sz * (rh + 0.15), CURB, 0.03);
      B(sx * (rv - 0.15), sx * (rv + 0.15), -0.2, 0.02, sz * (rh + 0.15), sz * hz, CURB, 0.03);
    }
    adj.forEach((a, d) => {
      // p runs out from the center toward that side (across its sidewalk band pLo..pHi), q across it.
      const s = d % 2 ? -1 : 1, ax = d < 2, pLo = ax ? rv : rh, pHi = ax ? hx : hz, qh = ax ? rh : rv;
      const R = ax ? (p0, p1, y0, y1, q0, q1, color, bev) => B(s * p0, s * p1, y0, y1, q0, q1, color, bev) : (p0, p1, y0, y1, q0, q1, color, bev) => B(q0, q1, y0, y1, s * p0, s * p1, color, bev);
      if (a === 'join') return;
      if (NO_TRAFFIC.has(a)) {
        R(pLo, pHi, -0.3, 0, -qh, qh, a === 'pedestrian' ? PAVERS : WALK);
        R(pLo - 0.15, pLo + 0.15, -0.2, 0.02, -qh, qh, CURB, 0.03);
        return;
      }
      const c0 = Math.max(pLo + 0.2, pHi - 2.8);
      for (let q = -qh + 0.7; q <= qh - 0.6; q += 1.2) R(c0, pHi - 0.2, -0.05, -0.03, q - 0.3, q + 0.3, PAINT);
      if (t !== 'stop' && t !== 'roundabout') return;
      // Stop lines, or yield dashes at a roundabout, across the lanes coming in.
      for (const [o, dir] of LANES[ax ? 'x' : 'z']) {
        if ((DRIVE[a] ?? dir) !== -s) continue;
        const q0 = o > 0 ? 0.25 : 0.3 - qh, q1 = o > 0 ? qh - 0.3 : -0.25;
        if (t === 'stop') R(pHi, pHi + 0.45, -0.05, -0.03, q0, q1, PAINT);
        else for (let q = q0; q < q1 - 0.3; q += 1) R(pLo - 0.7, pLo - 0.4, -0.05, -0.03, q, q + 0.55, PAINT);
      }
    });
    if (t === 'scramble') {
      const k1 = Math.min(rh, rv) * 1.2;
      for (const r of [1, -1]) for (let k = -k1; k <= k1 + 0.1; k += 1.2) {
        if (r < 0 && Math.abs(k) < 1) continue;
        put(g, SHAPES.box, xc + k * Math.SQRT1_2, r > 0 ? -0.035 : -0.034, zc + r * k * Math.SQRT1_2, 0.6, 0.02, 2.4, PAINT, 0, -r * Math.PI / 4, 0);
      }
    }
    if (t === 'roundabout') {
      const ring = Math.min(rh, rv) - 1.9, isl = ring - 1.5;
      if (isl < 0.6) return;
      put(g, SHAPES.cyl, xc, 0.02, zc, isl, 0.24, isl, CURB);
      put(g, SHAPES.cyl, xc, 0.06, zc, isl - 0.3, 0.2, isl - 0.3, GRASS);
      const n = Math.max(12, Math.round(ring * 5.5));
      for (let k = 0; k < n; k++) { const an = (k / n) * Math.PI * 2; put(g, SHAPES.box, xc + Math.cos(an) * (ring + 0.9), -0.04, zc + Math.sin(an) * (ring + 0.9), 0.15, 0.02, 0.7, PAINT, 0, -an, 0); }
    }
  }

  buildProps(target) {
    const L = this.layout, b = new PartBatcher();
    const P = (p, x, z, ry = 0, s = 1, y = 0) => { if (!this.propBlocked(x, z)) b.place(p, mtx(x, y, z, 0, ry, 0, s, s, s), {}, 'always', 'wd', true); };
    for (const p of L.pieces()) {
      const t = L.streets?.get(p.k) || null;
      if (t === 'removed') continue;
      if (p.kind === 'x') this.crossingProps(P, this.crossGeom(p.i, p.j, t)); else this.segmentProps(P, this.pieceGeom(p), t);
    }
    b.build(target, this.mats);
  }

  // Furniture along a stretch: trees, lamps and street furniture on sidewalks wide enough for them, plus
  // what its type adds (median trees, bike lane posts, a pedestrian street's trees, benches and planters).
  segmentProps(P, { axis, c, a, b: e, hw = 10 }, t) {
    const L = this.layout, F = streetFrame(null, axis, c), X = F.X, o = X ? L.ox : L.oz, { walk, rw, median } = profile(hw);
    const U = (part, u, v, ry = 0, s = 1, y = 0) => { const [x, z] = F.at(u, v); P(part, x, z, F.ry(ry), s, y); };
    const speciesFor = (x, z) => [0, 0, 0, 1, 2, 5][Math.floor(hash(x | 0, z | 0, 17) * 6)];
    const furniture = [benchPart, hydrantPart, trashCanPart, bikeRackPart, newsstandPart, mailboxPart, parkingMeterPart];
    for (let u = o + 6 + Math.ceil((a + 3 - o - 6) / 3) * 3; u <= e - 3; u += 3) {
      const k = Math.round((u - o) / 3), species = speciesFor(...F.at(u, hw - 1.4));
      for (const s of [-1, 1]) {
        if (walk >= 2.5 && k % 4 === (X ? 0 : 1)) U(anyTreePart(hash(k, c | 0, s), X ? 1.25 : 1.2, speciesFor(...F.at(u, s * (hw - 1.4)))), u, s * (hw - 0.7), k);
        else if (k % 6 === (X ? 2 : 3)) U(lampPostPart(), u, s * (walk >= 1.2 ? rw + 0.6 : hw - 0.25), s > 0 ? Math.PI / 2 : -Math.PI / 2);
        else if (walk >= 2.5 && X && k % 7 === 5) U(furniture[Math.floor(hash(k, s, c | 0) * furniture.length)](), u, s * (hw - 0.4), s > 0 ? Math.PI : 0);
        if (t === 'bikeway' && rw >= 4) U(bollardPart(), u, s * (rw - 1.55), 0, 0.6, -0.06);
      }
      if (t === 'median' && median >= 1) {
        if (k % 3 === 0) U(anyTreePart(hash(k, c | 0, 5), median >= 1.8 ? 1.1 : 0.8, species), u, 0, k, 1, 0.14);
        else if (k % 6 === 4) U(lampPostPart(), u, 0, Math.PI / 2, 1, 0.14);
      } else if (t === 'pedestrian' && k % 2 === 0) {
        const n = (k / 2) % 4;
        if (n === 0) U(anyTreePart(hash(k, c | 0, 7), Math.min(1.3, hw * 0.3), species), u, 0, k);
        else if (n === 1 && hw >= 4) { U(benchPart(), u, 1.1, 0); U(benchPart(), u, -1.1, Math.PI); }
        else if (n === 2) U(lampPostPart(), u, 0, Math.PI / 2);
        else if (hw >= 4) U(planterBoxPart(hash(k, c | 0, 2)), u, 0);
      }
    }
  }

  // Furniture at an intersection: signals (or stop signs where the sidewalks are too narrow for them), a
  // roundabout's planted island, or a plaza's fountain, trees, benches and bollards.
  crossingProps(P, { xc, zc, hx, hz, t, adj, seed: [i, j] }) {
    const rh = profile(hz).rw, rv = profile(hx).rw, m = Math.min(hx, hz), walkX = hx - rv, walkZ = hz - rh;
    const lanes = adj.filter((a) => !NO_TRAFFIC.has(a)).length;
    if (t === 'plaza') {
      P(grandFountainPart(), xc, zc, 0, Math.min(1.2, m / 8));
      if (m >= 8) {
        for (const [sx, sz, ry] of CORNERS) P(anyTreePart(hash(i, j, sx + 2 * sz + 3), 1.2, 4), xc + sx * m * 0.62, zc + sz * m * 0.62, ry);
        for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [-1, 0, -Math.PI / 2], [1, 0, Math.PI / 2]]) P(benchPart(), xc + dx * m * 0.48, zc + dz * m * 0.48, ry);
      }
      // Bollards keep cars out on every side traffic arrives from.
      adj.forEach((a, d) => {
        if (NO_TRAFFIC.has(a) || a === 'join') return;
        const s = d % 2 ? -1 : 1, pHi = d < 2 ? hx : hz, qh = d < 2 ? rh : rv;
        for (let q = 1 - qh; q <= qh - 1; q += 2) if (d < 2) P(bollardPart(), xc + s * (pHi - 0.4), zc + q); else P(bollardPart(), xc + q, zc + s * (pHi - 0.4));
      });
      return;
    }
    if (t === 'roundabout') {
      const isl = Math.min(rh, rv) - 3.4;
      if (isl >= 0.6) {
        P(anyTreePart(hash(i, j, 3), Math.min(1.5, isl * 0.42), [0, 2, 5][Math.abs(i + j) % 3]), xc, zc, i + j, 1, 0.16);
        if (isl >= 2) for (let k = 0; k < 7; k++) { const an = (k / 7) * Math.PI * 2; P(shrubPart(hash(i, j, k), 0.9), xc + Math.cos(an) * (isl - 1.3), zc + Math.sin(an) * (isl - 1.3), an, 1, 0.16); }
      }
    }
    for (const [sx, sz, ry] of CORNERS) {
      if (lanes >= 2 && t !== 'roundabout' && Math.min(walkX, walkZ) >= 0.5) {
        if (t === 'stop' || Math.min(walkX, walkZ) < 1.5) P(stopSignPart(), xc + sx * (rv + Math.min(0.6, walkX / 2)), zc + sz * (rh + Math.min(0.6, walkZ / 2)), ry);
        else P(trafficLightPart(), xc + sx * (rv + 1.2), zc + sz * (rh + 1.2), ry);
      }
      if (walkX >= 1.5) P(bollardPart(), xc + sx * (rv + 0.3), zc + sz * (hz + 0.2));
    }
  }

  buildTunnel(zc, yo, stripe) {
    const L = this.layout, W = L.width;
    const t = new GeoBuilder(), tl = new GeoBuilder();
    t.box(0, yo - 8.15, zc, W, 0.3, 8.6, [0x5f5c57, PAT.CONCRETE]);
    for (const s of [-1, 1]) {
      t.box(0, yo - 5.85, zc + s * 4.15, W, 4.3, 0.3, [0xd8d4c8, PAT.TILE]);
      t.box(0, yo - 6.6, zc + s * 3.99, W, 0.25, 0.02, stripe);
      t.bevel(0, yo - 7.75, zc + s * 3.6, W, 0.5, 0.8, [0x77736c, PAT.CONCRETE], 0.03);
      t.box(0, yo - 4.6, zc + s * 3.8, W, 0.12, 0.4, 0x5a5f66);
      tl.box(0, yo - 4.1, zc + s * 3.95, W, 0.08, 0.1, 0xfff2cc);
      t.box(s * (W / 2 + 0.03), yo - 5.85, zc, 0.06, 4.3, 8.0, 0x0b0b0c);
    }
    t.box(0, yo - 3.55, zc, W, 0.3, 8.6, [0x6a6660, PAT.CONCRETE]);
    for (const zt of [-1.7, 1.7]) {
      t.box(0, yo - 7.9, zc + zt, W, 0.2, 2.4, [0x3a3633, PAT.GRAVEL]);
      for (let x = -W / 2 + 0.5; x < W / 2; x += 0.8) t.bevel(x, yo - 7.76, zc + zt, 0.24, 0.08, 2.2, [0x6b5a48, PAT.WOOD], 0.015);
      for (const r of [-0.72, 0.72]) { t.box(0, yo - 7.66, zc + zt + r, W, 0.1, 0.06, 0x8a9096); t.box(0, yo - 7.6, zc + zt + r, W, 0.04, 0.1, 0xb8bec4); }
    }
    for (let x = -W / 2 + 6; x < W / 2; x += 12) tl.box(x, yo - 3.72, zc, 1.2, 0.05, 0.25, 0xfff2cc);
    this.group.add(new THREE.Mesh(t.build(), this.mats.m), new THREE.Mesh(tl.build(), this.glowMat));
  }

  makeTrains(y, len, n, body, stripe, specs, band) {
    const geos = bakePart(trainCarParts(len, body, stripe));
    return specs.map(([z, dir, pos]) => {
      const cars = [];
      for (let k = 0; k < n; k++) {
        const g = new THREE.Group();
        for (const [mat, geo] of geos) g.add(new THREE.Mesh(geo, mat === 'l' ? this.glowMat : this.mats[mat]));
        g.position.set(0, y, z);
        this.group.add(g);
        cars.push(g);
      }
      return { dir, pos, v: 12, dwell: 0, last: null, cars, len: len + 0.5, band };
    });
  }

  // A street's lane offset from its center line (lat0 on straight road), sampled every metre from lo: lanes
  // ease out around planted medians (p.medLat) and circle roundabout islands (p.ring). Null where they run straight.
  laneProfile(pieces, lo, hi, lat0) {
    const medians = pieces.filter((p) => !p.cross && p.t === 'median' && p.medLat), rings = pieces.filter((p) => p.cross && p.t === 'roundabout' && p.ring > 2.4);
    if (!medians.length && !rings.length) return null;
    const n = Math.ceil(hi - lo) + 2, prof = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = lo + i;
      let v = lat0;
      for (const p of medians) v = Math.max(v, lat0 + (p.medLat - lat0) * smooth(p.a - 9, p.a - 1, u) * (1 - smooth(p.b + 1, p.b + 9, u)));
      for (const p of rings) { const du = u - (p.a + p.b) / 2; if (Math.abs(du) < p.ring) v = Math.max(v, Math.sqrt(p.ring ** 2 - du * du)); }
      prof[i] = v;
    }
    for (let pass = 0; pass < 2; pass++) {
      const src = prof.slice();
      for (let i = 0; i < n; i++) {
        let sum = 0, cnt = 0;
        for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) { sum += src[k]; cnt++; }
        prof[i] = sum / cnt;
      }
    }
    return prof;
  }

  // Map-block roads of the given kinds as straight bands: rows (or columns) of 3+ cells with the same
  // extent, at least as long as they are wide. { axis, r0, w (rows across), a0, a1 (cells along) }.
  mapBands(types) {
    const L = this.layout, R = L.roads, out = [];
    if (!R?.size) return out;
    const is = (x, z) => types.has(R.get(tk(x, z))?.t);
    for (const axis of ['x', 'z']) {
      const X = axis === 'x', rows = new Map();
      for (const r of R.values()) {
        if (!types.has(r.t) || (X ? is(r.x - 1, r.z) : is(r.x, r.z - 1))) continue; // only run starts
        const row = X ? r.z : r.x, a0 = X ? r.x : r.z;
        let a1 = a0;
        while (X ? is(a1 + 1, r.z) : is(r.x, a1 + 1)) a1++;
        if (a1 - a0 < 2) continue;
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push([a0, a1]);
      }
      const used = new Set();
      for (const row of [...rows.keys()].sort((a, b) => a - b)) for (const [a0, a1] of rows.get(row)) {
        if (used.has(`${row}:${a0}:${a1}`)) continue;
        let w = 0;
        while (rows.get(row + w)?.some(([b0, b1]) => b0 === a0 && b1 === a1)) used.add(`${row + w++}:${a0}:${a1}`);
        if (a1 - a0 + 1 >= w) out.push({ axis, r0: row, w, a0, a1 });
      }
    }
    return out;
  }

  // Traffic runs on a lane graph: city street lanes, protected bike lanes, and lanes on map-block roads and
  // bike paths that reach into the city streets they meet. Where lanes cross, traffic may turn; where one
  // ends at another's start it carries on; map lanes turn around at a dead end.
  buildTraffic() {
    if (this.trafficGroup) {
      this.trafficGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      this.trafficGroup.parent?.remove(this.trafficGroup);
    }
    this.trafficGroup = new THREE.Group();
    this.streetGroup.add(this.trafficGroup);
    const L = this.layout, S = L.streets, R = L.roads, simple = !L.closed?.size && !S?.size;
    const shut = (x, z) => !!L.closed?.size && L.closed.has(tk(x, z));
    const noFeet = (x, z) => shut(x, z) || L.removed.has(tk(x, z));
    // Cut a lane or sidewalk run (a strip hw either side of its center line) wherever a street block under it
    // is blocked (closed by a building, car-free or removed); each open stretch becomes its own run.
    const split = (run, hw, blocked) => {
      if (simple) return [run];
      const alongX = run.axis === 'x';
      const cell = alongX ? (v) => L.gx(v) : (v) => L.gz(v), edge = alongX ? (i) => L.wx(i) : (i) => L.wz(i);
      const across = [...new Set([run.c - hw, run.c + hw].map(alongX ? (v) => L.gz(v) : (v) => L.gx(v)))];
      const out = [];
      let s = run.lo;
      for (let i = cell(run.lo + 1e-3); i <= cell(run.hi - 1e-3); i++) {
        if (!across.some((k) => (alongX ? blocked(i, k) : blocked(k, i)))) continue;
        if (edge(i) - s > 10) out.push({ ...run, lo: s, hi: edge(i) });
        s = edge(i + 1);
      }
      if (run.hi - s > 10) out.push({ ...run, lo: s });
      return out;
    };
    const lanes = [];
    // A street's lanes from its pieces in order along it ([{ cross, a, b, t, ring?, medLat? }], world metres),
    // the same for city and painted streets: car-free pieces cut them, one-way stretches turn a lane's traffic
    // (it splits at the junction center where its direction changes), medians and roundabouts bend them out.
    const streetLanes = (axis, sc, pieces, lat0, extra = {}) => {
      const lo = pieces[0].a, hi = pieces.at(-1).b, prof = this.laneProfile(pieces, lo, hi, lat0);
      for (const [off, def] of LANES[axis]) {
        const sign = Math.sign(off), runs = [];
        let run = null;
        const close = (at) => { if (run?.dir && at - run.lo > 4) runs.push({ ...run, hi: at }); run = null; };
        pieces.forEach((p, n) => {
          if (CAR_FREE.has(p.t)) return close(p.a);
          if (p.cross) { run = run || { lo: p.a, dir: null }; return; }
          const d = DRIVE[p.t] ?? def;
          if (run?.dir && run.dir !== d) { const prev = pieces[n - 1], at = prev?.cross ? (prev.a + prev.b) / 2 : p.a; close(at); run = { lo: at, dir: d }; }
          else if (run) run.dir = d;
          else run = { lo: p.a, dir: d };
        });
        close(hi);
        for (const r of runs) lanes.push(...split({ axis, c: sc + sign * lat0, sc, sign, lat0, dir: r.dir, lo: r.lo, hi: r.hi, prof, p0: lo, kind: 'car', ...extra }, 1.1, shut));
      }
    };
    // Protected bike lanes ride straight through the junctions along a run of bikeway stretches, and out past
    // the last one far enough to turn onto the cross street.
    const bikeLanes = (axis, sc, pieces, rw, extra = {}) => {
      for (let n = 0; n < pieces.length; n++) {
        if (pieces[n].cross || pieces[n].t !== 'bikeway') continue;
        let m = n;
        while (m + 2 < pieces.length && pieces[m + 2].t === 'bikeway' && pieces[m + 1].cross && !CAR_FREE.has(pieces[m + 1].t)) m += 2;
        const before = pieces[n - 1], after = pieces[m + 1];
        const lo = before?.cross ? (before.a + before.b) / 2 - 4 : pieces[n].a, hi = after?.cross ? (after.a + after.b) / 2 + 4 : pieces[m].b;
        for (const [off, dir] of LANES[axis]) {
          const o = Math.sign(off) * (rw - 0.75);
          lanes.push(...split({ axis, c: sc + o, sc, sign: Math.sign(o), lat0: rw - 0.75, dir, lo, hi, kind: 'bike', stubLo: !!before?.cross, stubHi: !!after?.cross, ...extra }, 0.6, shut));
        }
        n = m;
      }
    };
    const gridPieces = (centers, segKey, crossKey) => centers.flatMap((cc, n) => [
      { cross: true, a: cc - 10, b: cc + 10, t: S?.get(crossKey(n)) || null, ring: 5.1 },
      ...(n < centers.length - 1 ? [{ cross: false, a: cc + 10, b: centers[n + 1] - 10, t: S?.get(segKey(n)) || null, medLat: 3.2 }] : []),
    ]);
    for (const s of L.hStreets) { const pc = gridPieces(L.vStreets.map((v) => v.xc), (n) => `h:${n}:${s.j}`, (n) => `x:${n}:${s.j}`); streetLanes('x', s.zc, pc, 1.9); bikeLanes('x', s.zc, pc, 7); }
    for (const s of L.vStreets) { const pc = gridPieces(L.hStreets.map((h) => h.zc), (n) => `v:${s.i}:${n}`, (n) => `x:${s.i}:${n}`); streetLanes('z', s.xc, pc, 1.9); bikeLanes('z', s.xc, pc, 7); }

    // Painted streets: the same lanes, reaching into any open city street at their ends so traffic turns in and out.
    const reach = (b, start, step) => {
      const X = b.axis === 'x';
      const open = (a) => { for (let r = 0; r < b.w; r++) { const [x, z] = X ? [a, b.r0 + r] : [b.r0 + r, a]; if (!L.isOpenGridStreet(x, z) || L.carFree(x, z)) return false; } return true; };
      let k = 0;
      while (k < STREET && open(start + step * k)) k++;
      return k ? k * CELL - 1.5 : 0;
    };
    const net = L.roadNet();
    for (const b of net.bands) {
      const X = b.axis === 'x', along = (i) => (X ? L.wx(i) : L.wz(i)), across = (i) => (X ? L.wz(i) : L.wx(i));
      const P = profile(b.w * 2), sc = (across(b.r0) + across(b.r0 + b.w)) / 2;
      const pieces = b.pieces.map((p) => (p.kind === 'x'
        ? { cross: true, a: along(X ? p.x0 : p.z0), b: along((X ? p.x1 : p.z1) + 1), t: L.roadType(p), ring: Math.min(profile((p.x1 - p.x0 + 1) * 2).rw, profile((p.z1 - p.z0 + 1) * 2).rw) - 1.9 }
        : { cross: false, a: along(p.a0), b: along(p.a1 + 1), t: L.roadType(p), medLat: P.median >= 1 ? P.median + 1.4 : 0 }));
      const eLo = reach(b, b.a0 - 1, -1), eHi = reach(b, b.a1 + 1, 1);
      pieces[0].a -= eLo;
      pieces.at(-1).b += eHi;
      streetLanes(b.axis, sc, pieces, P.lane, { map: true, band: b.id, stubLo: eLo > 0, stubHi: eHi > 0, scale: b.w === 1 ? 0.8 : 1 });
      if (P.rw >= 4) bikeLanes(b.axis, sc, pieces, P.rw, { map: true });
    }
    // Painted streets turn traffic around at a dead end, onto the lane beside it going the other way.
    for (const A of lanes) {
      if (A.band === undefined) continue;
      const end = A.dir > 0 ? A.hi - 0.5 : A.lo + 0.5;
      A.twin = lanes.find((B) => B.band === A.band && B.kind === A.kind && B.dir === -A.dir && B.lo <= end && B.hi >= end) || null;
    }

    // Map-block roads and bike paths: a lane each way down each band, reaching into any open city street
    // at its ends so traffic can turn in and out.
    const mapLanes = (types, kind) => {
      for (const b of this.mapBands(types)) {
        const X = b.axis === 'x', along = (i) => (X ? L.wx(i) : L.wz(i)), across = (i) => (X ? L.wz(i) : L.wx(i));
        const reach = (start, step) => {
          let k = 0;
          const open = (a) => { for (let r = 0; r < b.w; r++) { const [x, z] = X ? [a, b.r0 + r] : [b.r0 + r, a]; if (!L.isOpenGridStreet(x, z) || L.carFree(x, z)) return false; } return true; };
          while (k < STREET && open(start + step * k)) k++;
          return k ? k * CELL - 1.5 : 0;
        };
        const eLo = reach(b.a0 - 1, -1), eHi = reach(b.a1 + 1, 1), sc = (across(b.r0) + across(b.r0 + b.w)) / 2;
        const off = b.w > 1 ? 1.9 : kind === 'bike' ? 0.8 : 1.0, pair = [];
        for (const [o, dir] of LANES[b.axis]) {
          const ln = { axis: b.axis, c: sc + Math.sign(o) * off, sc, sign: Math.sign(o), lat0: off, dir, lo: along(b.a0) - eLo, hi: along(b.a1 + 1) + eHi, kind, map: true, stubLo: eLo > 0, stubHi: eHi > 0, scale: b.w === 1 && kind === 'car' ? 0.85 : 1 };
          pair.push(ln);
          lanes.push(ln);
        }
        [pair[0].twin, pair[1].twin] = [pair[1], pair[0]];
      }
    };
    mapLanes(WALK_ROADS, 'car'); // cobbled lanes are shared: cars crawl along them among the people
    mapLanes(BIKE_ROADS, 'bike');

    // Turns where lanes cross (cars keep off bike lanes; cyclists may take any lane). A stub reaching into a
    // street always turns at its last crossing.
    const latAt = (ln, p) => {
      if (!ln.prof) return ln.sc + ln.sign * ln.lat0;
      const f = Math.min(ln.prof.length - 2, Math.max(0, p - ln.p0)), k = f | 0;
      return ln.sc + ln.sign * (ln.prof[k] + (ln.prof[k + 1] - ln.prof[k]) * (f - k));
    };
    for (const A of lanes) {
      A.exits = [];
      for (const B of lanes) {
        if (B === A || B.axis === A.axis || (A.kind === 'car' && B.kind === 'bike')) continue;
        let pa = B.c, pb = latAt(A, pa);
        pa = latAt(B, pb); pb = latAt(A, pa);
        if (pa < A.lo + 0.5 || pa > A.hi - 0.5 || pb < B.lo + 0.5 || pb > B.hi - 0.5) continue;
        if ((B.dir > 0 ? B.hi - pb : pb - B.lo) < 6) continue; // B's traffic is about to leave there, not enter
        A.exits.push({ at: pa, to: B, pos: pb, p: B.map ? 0.4 : A.map || A.kind === 'bike' ? 0.3 : 0.12 });
      }
      A.exits.sort((a, b) => (a.at - b.at) * A.dir);
      const last = A.exits.at(-1);
      if (last && (A.dir > 0 ? A.stubHi : A.stubLo)) last.p = 1;
    }
    // Straight on where one lane ends within a few metres of another's start.
    for (const A of lanes) {
      const end = A.dir > 0 ? A.hi : A.lo;
      let best = null, bd = 3;
      for (const B of lanes) {
        if (B === A || B.axis !== A.axis || B.dir !== A.dir || (A.kind === 'car' && B.kind === 'bike')) continue;
        const start = B.dir > 0 ? B.lo : B.hi, dd = Math.abs(start - end) + Math.abs(latAt(B, start) - latAt(A, end));
        if (dd < bd) { bd = dd; best = B; }
      }
      if (best) A.next = { to: best, pos: best.dir > 0 ? best.lo : best.hi };
    }

    // Curb cuts where roads and bike paths cross a city sidewalk.
    if (R?.size) {
      const g = new GeoBuilder();
      for (const r of R.values()) {
        if (!CAR_ROADS.has(r.t) && !BIKE_ROADS.has(r.t)) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = r.x + dx, z = r.z + dz;
          if (!L.isOpenGridStreet(x, z) || L.carFree(x, z)) continue;
          g.box(L.wx(x) + (dx ? (dx > 0 ? 1.575 : 2.425) : 2), -0.04, L.wz(z) + (dz ? (dz > 0 ? 1.575 : 2.425) : 2), dx ? 3.15 : CELL, 0.124, dz ? 3.15 : CELL, ASPHALT);
        }
      }
      if (!g.empty) { const m = new THREE.Mesh(g.build(), this.groundMat); m.receiveShadow = true; this.trafficGroup.add(m); }
    }

    const types = [carParts(), carParts(), vanParts(), truckParts(), carParts(), bikeParts()];
    const palette = [0xc0392b, 0x2c3e50, 0xecf0f1, 0x27ae60, 0xf1c40f, 0x7f8c8d, 0x2980b9, 0x111111, 0xe67e22, 0xf2c14e];
    const jerseys = [0xe63946, 0x2a9d8f, 0xf4a261, 0x3a6ea5, 0xffd166, 0x8e44ad];
    this.vehicles = [];
    const perType = types.map(() => []);
    for (const lane of lanes) {
      const bike = lane.kind === 'bike', len = lane.hi - lane.lo, seed = (lane.c * 7 + lane.lo) | 0;
      const n = Math.max(len >= 12 ? 1 : 0, Math.round(len / (bike ? 22 : lane.map ? 28 : 34)));
      for (let i = 0; i < n; i++) {
        const type = bike ? BIKE_TYPE : Math.floor(hash(seed, i, 7) * BIKE_TYPE);
        const v = { lane, pos: lane.lo + ((i + hash(i, seed, 3)) / n) * len, v: bike ? 4 + hash(i, seed, 9) * 2 : 8 + hash(i, seed, 9) * 5, type, cool: 0,
          color: bike ? jerseys[Math.floor(hash(i, seed, 11) * jerseys.length)] : palette[Math.floor(hash(i, seed, 11) * palette.length)] };
        if (type === 4) v.color = 0xf2c14e;
        perType[type].push(v);
        this.vehicles.push(v);
      }
    }
    this.vehicleMeshes = types.map((tp, ti) => {
      const list = perType[ti];
      const meshes = [];
      for (const [p, colored] of [[tp.paint, true], [tp.rest, false]]) {
        for (const [mat, geo] of bakePart(p)) {
          const im = new THREE.InstancedMesh(geo, mat === 'l' ? this.glowMat : this.mats[mat], Math.max(1, list.length));
          im.count = list.length;
          im.castShadow = mat !== 'l';
          im.frustumCulled = false;
          list.forEach((v, i) => im.setColorAt(i, new THREE.Color(colored ? v.color : 0xffffff)));
          this.trafficGroup.add(im);
          meshes.push(im);
        }
      }
      return { list, meshes };
    });

    this.peds = new Crowd(this.trafficGroup, 400, this.mats.m);
    this.pedList = [];
    const walks = [];
    // Boulevards and cobbled lanes fill with people, two walks down each block of width.
    for (const b of this.mapBands(WALK_ROADS)) {
      const X = b.axis === 'x', lo = X ? L.wx(b.a0) : L.wz(b.a0), hi = X ? L.wx(b.a1 + 1) : L.wz(b.a1 + 1);
      for (let r = 0; r < b.w; r++) for (const o of [1, 3]) walks.push({ axis: b.axis, c: (X ? L.wz(b.r0 + r) : L.wx(b.r0 + r)) + o, lo, hi, y: 0.1 });
    }
    // Painted streets: people on sidewalks wide enough to walk, and across pedestrian stretches.
    for (const b of net.bands) {
      const X = b.axis === 'x', P = profile(b.w * 2);
      if (P.walk < 1.2) continue;
      const lo = X ? L.wx(b.a0) : L.wz(b.a0), hi = X ? L.wx(b.a1 + 1) : L.wz(b.a1 + 1), sc = ((X ? L.wz(b.r0) : L.wx(b.r0)) + (X ? L.wz(b.r0 + b.w) : L.wx(b.r0 + b.w))) / 2;
      for (const s of [-1, 1]) walks.push({ axis: b.axis, c: sc + s * (P.hw - P.walk / 2), lo, hi });
    }
    for (const p of net.pieces) {
      if (p.kind !== 'seg' || L.roadType(p) !== 'pedestrian') continue;
      const G = this.segGeom(p);
      for (const o of G.hw >= 6 ? [-G.hw * 0.4, 0, G.hw * 0.4] : [0]) walks.push({ axis: G.axis, c: G.c + o, lo: G.a, hi: G.b });
    }
    // Pedestrian streets fill with people from curb to curb.
    for (const p of L.pieces()) {
      if (S?.get(p.k) !== 'pedestrian') continue;
      const { axis, c, a, b } = this.pieceGeom(p);
      for (const o of [-4, 0, 4]) walks.push(...split({ axis, c: c + o, lo: a, hi: b }, 0.9, shut));
    }
    for (const s of L.hStreets) for (const o of [-8.9, 8.9]) if (s.zc + o > L.oz && s.zc + o < L.oz + L.depth) walks.push(...split({ axis: 'x', c: s.zc + o, lo: L.ox, hi: L.ox + L.width }, 0.9, noFeet));
    for (const s of L.vStreets) for (const o of [-8.9, 8.9]) if (s.xc + o > L.ox && s.xc + o < L.ox + L.width) walks.push(...split({ axis: 'z', c: s.xc + o, lo: L.oz, hi: L.oz + L.depth }, 0.9, noFeet));
    for (const w of walks) {
      const n = Math.min(40, Math.round((w.hi - w.lo) / 9));
      for (let i = 0; i < n && this.pedList.length < 400; i++) {
        this.pedList.push({ w, pos: w.lo + Math.random() * (w.hi - w.lo), off: (Math.random() - 0.5) * 1.6, dir: Math.random() < 0.5 ? 1 : -1, v: 1 + Math.random() * 0.6, ph: Math.random() * 6, look: [Math.floor(Math.random() * 12), Math.floor(Math.random() * 6), Math.floor(Math.random() * 6), Math.floor(Math.random() * 6)] });
      }
    }
    this._d = new THREE.Object3D();
  }

  buildBuses() {
    const L = this.layout;
    const parts = busParts(11);
    const colors = [0x2a9d8f, 0xe76f51, 0x3a6ea5, 0x2a9d8f];
    this.buses = [];
    L.hStreets.forEach((s) => {
      for (const [off, dir] of [[-5.2, 1], [5.2, -1]]) {
        const g = new THREE.Group();
        for (const p of [parts.paint, parts.rest]) for (const [mat, geo] of bakePart(p, { paint: 0xecf0f1, stripe: colors[(s.j + (dir > 0 ? 0 : 1)) % 4] })) {
          const m = new THREE.Mesh(geo, mat === 'l' ? this.glowMat : this.mats[mat]);
          m.castShadow = mat !== 'l';
          g.add(m);
        }
        const pos = (Math.random() - 0.5) * L.width;
        g.position.set(pos, -0.06, s.zc + off);
        g.rotation.y = dir > 0 ? 0 : Math.PI;
        this.group.add(g);
        this.buses.push({ mesh: g, dir, pos, v: 8, dwell: 0, last: null, key: `${s.j}:${dir}`, zc: s.zc, side: Math.sign(off), lat: 5.2 });
      }
    });
  }

  setUnderground(on) {
    this.underground = !!on;
    for (const [m, op] of [[this.earthMat, 0.12], [this.groundMat, 0.3]]) {
      m.transparent = this.underground; m.opacity = this.underground ? op : 1; m.depthWrite = !this.underground; m.needsUpdate = true;
    }
  }

  update(dt, simDt, dayT, camera) {
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    const ang = (dayT - 0.25) * Math.PI * 2, elev = Math.sin(ang);
    const day = smooth(-0.15, 0.2, elev), dusk = Math.max(0, 1 - Math.abs(elev) / 0.35);
    this.night = 1 - day;
    this.skyU.top.value.copy(col(0x070b18, 0x4f8fd0, day).lerp(new THREE.Color(0x3c4a80), dusk * 0.6));
    this.skyU.bottom.value.copy(col(0x151c30, 0xd4e4ee, day).lerp(new THREE.Color(0xf0a36b), dusk * 0.7));
    this.stars.material.opacity = Math.max(0, 1 - day * 1.6);
    const dir = new THREE.Vector3(Math.cos(ang) * 0.9, Math.max(Math.abs(elev), 0.18), 0.5).normalize();
    this.sun.position.copy(dir).multiplyScalar(900);
    this.sun.color.copy(col(0x8aa0d8, 0xfff1dc, day).lerp(new THREE.Color(0xffb070), dusk * 0.6 * day));
    this.sun.intensity = 0.35 + 2.4 * day;
    this.hemi.intensity = 0.35 + 0.75 * day;
    this.hemi.color.copy(col(0x5a6a9a, 0xdfeaff, day));
    this.scene.environmentIntensity = 0.12 + 0.5 * day;
    this.lampMat.color.setScalar(0.25 + 0.75 * this.night);
    if (!this.layout) return;

    const d = this._d, L = this.layout;
    for (const v of this.vehicles) this.drive(v, simDt);
    for (const { list, meshes } of this.vehicleMeshes) {
      list.forEach((v, i) => {
        // Lanes that wrap around fade their traffic in and out at the ends; connected lanes don't.
        const ln = v.lane, wraps = !ln.next && !ln.twin;
        const s = (wraps ? Math.min(1, Math.max(0, Math.min(v.pos - ln.lo, ln.hi - v.pos) / 3)) : 1) * (ln.scale || 1);
        let lat = ln.lat0, slope = 0;
        if (ln.prof) { const f = Math.min(ln.prof.length - 2, Math.max(0, v.pos - ln.p0)), k = f | 0; slope = ln.prof[k + 1] - ln.prof[k]; lat = ln.prof[k] + slope * (f - k); }
        const c = ln.sc + ln.sign * lat, sl = ln.sign * slope * ln.dir;
        const [x, z] = ln.axis === 'x' ? [v.pos, c] : [c, v.pos];
        const yaw = ln.axis === 'x' ? Math.atan2(-sl, ln.dir) : Math.atan2(-ln.dir, sl);
        // Ease the heading round after a turn.
        if (v.yaw === undefined || v.snap) { v.yaw = yaw; v.snap = false; } else v.yaw += Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw)) * Math.min(1, dt * 9);
        d.position.set(x, ln.map && PATH_ROADS.has(L.roads?.get(tk(L.gx(x), L.gz(z)))?.t) ? 0.04 : -0.06, z);
        d.rotation.set(0, v.yaw, 0);
        d.scale.setScalar(s); d.updateMatrix();
        for (const im of meshes) im.setMatrixAt(i, d.matrix);
      });
      for (const im of meshes) im.instanceMatrix.needsUpdate = true;
    }
    this.peds.begin();
    for (const p of this.pedList) {
      p.pos += p.dir * p.v * simDt; p.ph += simDt * 8;
      if (p.pos > p.w.hi - 1) p.pos = p.w.lo + 1; else if (p.pos < p.w.lo + 1) p.pos = p.w.hi - 1;
      const x = p.w.axis === 'x' ? p.pos : p.w.c + p.off, z = p.w.axis === 'x' ? p.w.c + p.off : p.pos;
      const rot = p.w.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
      this.peds.push(x, (p.w.y || 0) + Math.abs(Math.sin(p.ph)) * 0.03, z, rot, p.ph, true, p.look);
    }
    this.peds.end();

    const lim = L.width / 2;
    for (const t of this.subways) { advance(t, this.stops.subway.get(t.band) || [], simDt, 16, 5, lim + 60, 3); this.placeTrain(t); }
    for (const t of this.rails) { advance(t, this.stops.rail, simDt, 22, 4, lim + 90, 4); this.placeTrain(t); }
    for (const bus of this.buses) {
      let gap = Infinity;
      for (const o of this.buses) { if (o === bus || o.key !== bus.key) continue; const g = (o.pos - bus.pos) * bus.dir; if (g > 0 && g < gap) gap = g; }
      advance(bus, this.stops.bus.get(bus.key) || [], simDt, 10, 3, lim + 8, 4, gap);
      // Buses pull in from the curb lane past bike lanes, and out past a median.
      const t = L.pieceType(L.gx(bus.pos), L.gz(bus.zc)), want = t === 'bikeway' ? 4.1 : t === 'median' ? 5.4 : 5.2;
      bus.lat += Math.max(-1.5 * simDt, Math.min(1.5 * simDt, want - bus.lat));
      bus.mesh.position.set(bus.pos, -0.06, bus.zc + bus.side * bus.lat);
      bus.mesh.visible = Math.abs(bus.pos) < lim - 5.5 && ![-5, 0, 5].some((o) => this.carsBlocked(bus.pos + o, bus.mesh.position.z));
    }
  }

  // Move a vehicle along its lane: maybe turn at a crossing it passes, and at the lane's end carry on into
  // the next lane, turn around (map roads) or wrap back to the start. Cobbled lanes slow cars to a crawl.
  drive(v, dt) {
    const L = this.layout, ln = v.lane;
    const slow = ln.map && ln.kind === 'car' && L.roads?.get(tk(L.gx(ln.axis === 'x' ? v.pos : ln.c), L.gz(ln.axis === 'x' ? ln.c : v.pos)))?.t === 'lane';
    const p0 = v.pos, p1 = p0 + ln.dir * (slow ? Math.min(v.v, 4) : v.v) * dt;
    v.cool = Math.max(0, v.cool - dt);
    if (!v.cool) for (const ex of ln.exits) {
      if (ln.dir > 0 ? ex.at <= p0 || ex.at > p1 : ex.at >= p0 || ex.at < p1) continue;
      if (ex.to.kind === 'bike' && v.type !== BIKE_TYPE) continue;
      if (ex.p < 1 && Math.random() > ex.p) continue;
      v.lane = ex.to;
      v.pos = ex.pos + ex.to.dir * Math.abs(p1 - ex.at);
      v.cool = 0.6; // don't turn straight back at the crossing just joined
      return;
    }
    v.pos = p1;
    if (p1 >= ln.lo && p1 <= ln.hi) return;
    const over = ln.dir > 0 ? p1 - ln.hi : ln.lo - p1;
    if (ln.next) { v.lane = ln.next.to; v.pos = ln.next.pos + v.lane.dir * over; }
    else if (ln.twin) { v.lane = ln.twin; v.pos = Math.min(ln.twin.hi, Math.max(ln.twin.lo, ln.dir > 0 ? ln.hi : ln.lo)); v.cool = 0.6; }
    else { v.pos = ln.dir > 0 ? ln.lo : ln.hi; v.snap = true; }
  }

  placeTrain(t) {
    const n = t.cars.length, lim = this.layout.width / 2;
    t.cars.forEach((m, k) => {
      m.position.x = t.pos - t.dir * (k - (n - 1) / 2) * t.len;
      m.visible = Math.abs(m.position.x) < lim - t.len / 2;
    });
  }
}
