// The city diorama: sky + day/night lighting, layered earth sized to the deepest basement,
// a full street grid with sidewalks, crosswalks and furniture, subway/rail tunnels with trains,
// buses, mixed traffic and pedestrians.
import * as THREE from 'three';
import { CELL } from './catalog.js';
import { GeoBuilder, PAT, hash } from './geo.js';
import { PartBatcher } from './batch.js';
import { applyPatterns } from './patterns.js';
import { mtx } from './kit.js';
import { lampPostPart, benchPart, hydrantPart, trashCanPart, bollardPart, carParts, busParts, trainCarParts } from './props.js';
import { anyTreePart, vanParts, truckParts, trafficLightPart, bikeRackPart, newsstandPart, mailboxPart, parkingMeterPart, busStopSignPart } from './props2.js';
import { Crowd } from './people.js';
import { tk } from './terrain.js';

const col = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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
    this.buildGround();
    this.streetGroup = null;
    this.buildStreets();
    this.streetLayout = layout;
    this.streetVersion = 0;
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

  buildGround() {
    const L = this.layout, W = L.width, D = L.depth, ox = L.ox, oz = L.oz;
    const g = new GeoBuilder();
    const xs = L.vStreets.map((s) => s.xc), zs = L.hStreets.map((s) => s.zc);
    const segs = (centers, lo, hi, gap) => {
      const out = [];
      let a = lo;
      for (const c of centers) { if (c - gap > a) out.push([a, c - gap]); a = c + gap; }
      if (hi > a) out.push([a, hi]);
      return out;
    };
    const boxX = (x0, x1, y, h, z, d, c) => g.box((x0 + x1) / 2, y, z, x1 - x0, h, d, c);
    const boxZ = (z0, z1, y, h, x, w, c) => g.box(x, y, (z0 + z1) / 2, w, h, z1 - z0, c);
    for (const zc of zs) {
      g.box(0, -0.18, zc, W, 0.24, 14, [0x3b3d42, PAT.GRAVEL]);
      for (const [a, b] of segs(xs, ox, ox + W, 7)) {
        for (const s of [-1, 1]) boxX(a, b, -0.15, 0.3, zc + s * 8.5, 3, [0xb8b3a8, PAT.TILE]);
      }
      for (const [a, b] of segs(xs, ox, ox + W, 10)) {
        for (const s of [-1, 1]) {
          g.bevel((a + b) / 2, -0.09, zc + s * 7.0, b - a, 0.22, 0.3, [0x9a968e, PAT.ASHLAR], 0.03);
          boxX(a, b, -0.05, 0.02, zc + s * 5.4, 2.6, [0x5a3a36, PAT.GRAVEL]);
          for (let x = a + 3; x < b - 3; x += 6) g.box(x, -0.035, zc + s * 3.6, 2.5, 0.02, 0.15, 0xe8e8e0);
        }
        for (const dz of [-0.15, 0.15]) boxX(a, b, -0.05, 0.02, zc + dz, 0.1, 0xe0b440);
        for (let x = a + 6; x < b - 6; x += 23) g.box(x + hash(x | 0, zc | 0, 3) * 5, -0.045, zc + (hash(x | 0, 1, 1) < 0.5 ? -1.9 : 1.9), 0.7, 0.03, 0.7, [0x2b2b2b, PAT.PANEL]);
      }
    }
    for (let j = 0; j < zs.length - 1; j++) {
      const za = zs[j], zb = zs[j + 1];
      for (const xc of xs) {
        boxZ(za + 7, zb - 7, -0.18, 0.24, xc, 14, [0x3b3d42, PAT.GRAVEL]);
        for (const s of [-1, 1]) {
          boxZ(za + 10, zb - 10, -0.15, 0.3, xc + s * 8.5, 3, [0xb8b3a8, PAT.TILE]);
          g.bevel(xc + s * 7.0, -0.09, (za + zb) / 2, 0.3, 0.22, zb - za - 20, [0x9a968e, PAT.ASHLAR], 0.03);
          for (let z = za + 13; z < zb - 13; z += 6) g.box(xc + s * 3.6, -0.035, z, 0.15, 0.02, 2.5, 0xe8e8e0);
        }
        for (const dx of [-0.15, 0.15]) boxZ(za + 10, zb - 10, -0.05, 0.02, xc + dx, 0.1, 0xe0b440);
      }
    }
    // crosswalks at every intersection approach
    for (const zc of zs) for (const xc of xs) {
      for (const s of [-1, 1]) {
        for (let z = zc - 6.3; z <= zc + 6.4; z += 1.2) g.box(xc + s * 8.5, -0.04, z, 2.6, 0.02, 0.6, 0xe8e8e0);
        if (zc + s * 8.5 > oz && zc + s * 8.5 < oz + D) for (let x = xc - 6.3; x <= xc + 6.4; x += 1.2) g.box(x, -0.04, zc + s * 8.5, 0.6, 0.02, 2.6, 0xe8e8e0);
      }
    }
    this.ground = new THREE.Mesh(g.build(), this.groundMat);
    this.ground.receiveShadow = true;
    this.group.add(this.ground);
    this.buildSlab(null);
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
    const open = (x, z) => !!terrain && terrain.has(tk(x, z));
    const isLand = (x, z) => !!land && land.has(tk(x, z));
    const ring = (x, z) => x >= -2 && z >= -2 && x <= L.sizeX + 1 && z <= L.sizeZ + 1;
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
    const E = L.ext, deep = this.depth || 24;
    const X0 = Math.min(E.x0, -2), X1 = Math.max(E.x1, L.sizeX + 1), Z0 = Math.min(E.z0, -2), Z1 = Math.max(E.z1, L.sizeZ + 1);
    for (let z = Z0; z <= Z1; z++) {
      const at = (m, a, c, y, h, col) => m.box(L.wx(a) + (c - a + 1) * 2, y, L.wz(z) + 2, (c - a + 1) * CELL, h, CELL, col);
      runs(X0, X1, (x) => (ring(x, z) || isLand(x, z)) && !open(x, z), (a, c) => at(e, a, c, -1.65, 2.7, [0x6b4f33, PAT.GRAVEL]));
      runs(X0, X1, (x) => ring(x, z) && !L.inGrid(x, z) && !isLand(x, z), (a, c) => at(g, a, c, -0.14, 0.32, [0x6f8f4f, PAT.GRASS]));
      runs(X0, X1, (x) => !L.inGrid(x, z) && isLand(x, z) && !open(x, z), (a, c) => at(g, a, c, -0.14, 0.32, [0x8d8779, PAT.CONCRETE]));
      runs(X0, X1, (x) => isLand(x, z) && !ring(x, z), (a, c) => at(e, a, c, -3 - (deep - 3) / 2, deep - 3, [0x56534e, PAT.CONCRETE]));
    }
    const tree = (x, z, k, s) => {
      if (isLand(L.gx(x), L.gz(z))) return;
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

  syncStreets(city) {
    const v = city?.streetVersion ?? 0;
    if (this.streetLayout === this.layout && this.streetVersion === v) return;
    this.streetLayout = this.layout;
    this.streetVersion = v;
    this.buildStreets();
  }

  // What changes when buildings close streets: paving over the closed street blocks, the street
  // furniture, and traffic and pedestrians, which turn back where a street is closed.
  buildStreets() {
    if (this.streetGroup) {
      this.streetGroup.traverse((o) => { if (o.isBatchedMesh) o.dispose(); else if (o.geometry) o.geometry.dispose(); });
      this.group.remove(this.streetGroup);
    }
    const L = this.layout;
    this.streetGroup = new THREE.Group();
    this.group.add(this.streetGroup);
    if (L.closed?.size) {
      // Sits just above the road, sidewalks and curbs (top 0.02) so they vanish under it.
      const g = new GeoBuilder();
      for (const { x, z } of L.closed.values()) if (L.isGridStreet(x, z)) g.box(L.wx(x) + 2, -0.1375, L.wz(z) + 2, CELL, 0.325, CELL, [0x8d8779, PAT.CONCRETE]);
      if (!g.empty) {
        const m = new THREE.Mesh(g.build(), this.groundMat);
        m.receiveShadow = true;
        this.streetGroup.add(m);
      }
    }
    this.buildProps(this.streetGroup);
    this.buildTraffic();
  }

  buildProps(target) {
    const L = this.layout, b = new PartBatcher();
    const P = (p, x, z, ry = 0, s = 1) => { if (!this.shutAt(x, z)) b.place(p, mtx(x, 0, z, 0, ry, 0, s, s, s), {}, 'always', 'wd', true); };
    const xs = L.vStreets.map((s) => s.xc), zs = L.hStreets.map((s) => s.zc);
    const nearX = (x) => xs.some((c) => Math.abs(x - c) < 13);
    const nearZ = (z) => zs.some((c) => Math.abs(z - c) < 13);
    const speciesFor = (x, z) => [0, 0, 0, 1, 2, 5][Math.floor(hash(x | 0, z | 0, 17) * 6)];
    const furniture = [benchPart, hydrantPart, trashCanPart, bikeRackPart, newsstandPart, mailboxPart, parkingMeterPart];
    for (const zc of zs) for (const s of [-1, 1]) {
      const z = zc + s * 8.6;
      if (z < L.oz || z > L.oz + L.depth) continue;
      for (let x = L.ox + 6; x < L.ox + L.width - 4; x += 3) {
        if (nearX(x)) continue;
        const k = Math.round((x - L.ox) / 3);
        if (k % 4 === 0) P(anyTreePart(hash(k, zc | 0, s), 1.25, speciesFor(x, z)), x, zc + s * 9.3, k);
        else if (k % 6 === 2) P(lampPostPart(), x, zc + s * 7.6, s > 0 ? Math.PI / 2 : -Math.PI / 2);
        else if (k % 7 === 5) P(furniture[Math.floor(hash(k, s, zc | 0) * furniture.length)](), x, zc + s * 9.6, s > 0 ? Math.PI : 0);
      }
    }
    for (let j = 0; j < zs.length - 1; j++) for (const xc of xs) for (const s of [-1, 1]) {
      const x = xc + s * 8.6;
      if (x < L.ox || x > L.ox + L.width) continue;
      for (let z = zs[j] + 13; z < zs[j + 1] - 12; z += 3) {
        const k = Math.round((z - L.oz) / 3);
        if (k % 4 === 1) P(anyTreePart(hash(k, xc | 0, s), 1.2, speciesFor(x, z)), xc + s * 9.3, z, k);
        else if (k % 6 === 3) P(lampPostPart(), xc + s * 7.6, z, s > 0 ? Math.PI : 0);
      }
    }
    for (const zc of zs) for (const xc of xs) {
      for (const [sx, sz, ry] of [[1, 1, Math.PI], [-1, -1, 0], [1, -1, -Math.PI / 2], [-1, 1, Math.PI / 2]]) {
        const x = xc + sx * 8.2, z = zc + sz * 8.2;
        if (x < L.ox || x > L.ox + L.width || z < L.oz || z > L.oz + L.depth) continue;
        P(trafficLightPart(), x, z, ry);
        P(bollardPart(), xc + sx * 7.3, zc + sz * 10.2);
      }
    }
    b.build(target, this.mats);
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

  buildTraffic() {
    const L = this.layout, closed = L.closed?.size ? L.closed : null;
    // Cut a lane or sidewalk run (a strip hw either side of its center line) wherever a building closes
    // the street under it; each open stretch becomes its own run.
    const split = (run, hw) => {
      if (!closed) return [run];
      const alongX = run.axis === 'x';
      const cell = alongX ? (v) => L.gx(v) : (v) => L.gz(v), edge = alongX ? (i) => L.wx(i) : (i) => L.wz(i);
      const across = [...new Set([run.c - hw, run.c + hw].map(alongX ? (v) => L.gz(v) : (v) => L.gx(v)))];
      const out = [];
      let s = run.lo;
      for (let i = cell(run.lo + 1e-3); i <= cell(run.hi - 1e-3); i++) {
        if (!across.some((k) => closed.has(alongX ? tk(i, k) : tk(k, i)))) continue;
        if (edge(i) - s > 10) out.push({ ...run, lo: s, hi: edge(i) });
        s = edge(i + 1);
      }
      if (run.hi - s > 10) out.push({ ...run, lo: s });
      return out;
    };
    const lanes = [];
    for (const s of L.hStreets) for (const [off, dir] of [[-1.9, 1], [1.9, -1]]) lanes.push(...split({ axis: 'x', c: s.zc + off, dir, lo: L.ox, hi: L.ox + L.width }, 1.1));
    for (const s of L.vStreets) for (const [off, dir] of [[1.9, 1], [-1.9, -1]]) lanes.push(...split({ axis: 'z', c: s.xc + off, dir, lo: L.oz, hi: L.oz + L.depth }, 1.1));
    const types = [carParts(), carParts(), vanParts(), truckParts(), carParts()];
    const palette = [0xc0392b, 0x2c3e50, 0xecf0f1, 0x27ae60, 0xf1c40f, 0x7f8c8d, 0x2980b9, 0x111111, 0xe67e22, 0xf2c14e];
    this.vehicles = [];
    const perType = types.map(() => []);
    for (const lane of lanes) {
      const n = Math.max(1, Math.round((lane.hi - lane.lo) / 34));
      for (let i = 0; i < n; i++) {
        const type = Math.floor(hash(lane.c | 0, i, 7) * types.length);
        const v = { lane, pos: lane.lo + ((i + hash(i, lane.c | 0, 3)) / n) * (lane.hi - lane.lo), v: 8 + hash(i, lane.c | 0, 9) * 5, type, color: palette[Math.floor(hash(i, lane.c | 0, 11) * palette.length)] };
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
          this.streetGroup.add(im);
          meshes.push(im);
        }
      }
      return { list, meshes };
    });

    this.peds = new Crowd(this.streetGroup, 400, this.mats.m);
    this.pedList = [];
    const walks = [];
    for (const s of L.hStreets) for (const o of [-8.9, 8.9]) if (s.zc + o > L.oz && s.zc + o < L.oz + L.depth) walks.push(...split({ axis: 'x', c: s.zc + o, lo: L.ox, hi: L.ox + L.width }, 0.9));
    for (const s of L.vStreets) for (const o of [-8.9, 8.9]) if (s.xc + o > L.ox && s.xc + o < L.ox + L.width) walks.push(...split({ axis: 'z', c: s.xc + o, lo: L.oz, hi: L.oz + L.depth }, 0.9));
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
        this.buses.push({ mesh: g, dir, pos, v: 8, dwell: 0, last: null, key: `${s.j}:${dir}` });
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
    for (const v of this.vehicles) {
      v.pos += v.lane.dir * v.v * simDt;
      if (v.pos > v.lane.hi) v.pos = v.lane.lo; else if (v.pos < v.lane.lo) v.pos = v.lane.hi;
    }
    for (const { list, meshes } of this.vehicleMeshes) {
      list.forEach((v, i) => {
        const s = Math.min(1, Math.max(0, Math.min(v.pos - v.lane.lo, v.lane.hi - v.pos) / 3));
        if (v.lane.axis === 'x') { d.position.set(v.pos, -0.06, v.lane.c); d.rotation.set(0, v.lane.dir > 0 ? 0 : Math.PI, 0); }
        else { d.position.set(v.lane.c, -0.06, v.pos); d.rotation.set(0, v.lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0); }
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
      this.peds.push(x, Math.abs(Math.sin(p.ph)) * 0.03, z, rot, p.ph, true, p.look);
    }
    this.peds.end();

    const lim = L.width / 2;
    for (const t of this.subways) { advance(t, this.stops.subway.get(t.band) || [], simDt, 16, 5, lim + 60, 3); this.placeTrain(t); }
    for (const t of this.rails) { advance(t, this.stops.rail, simDt, 22, 4, lim + 90, 4); this.placeTrain(t); }
    for (const bus of this.buses) {
      let gap = Infinity;
      for (const o of this.buses) { if (o === bus || o.key !== bus.key) continue; const g = (o.pos - bus.pos) * bus.dir; if (g > 0 && g < gap) gap = g; }
      advance(bus, this.stops.bus.get(bus.key) || [], simDt, 10, 3, lim + 8, 4, gap);
      bus.mesh.position.x = bus.pos;
      bus.mesh.visible = Math.abs(bus.pos) < lim - 5.5 && ![-5, 0, 5].some((o) => this.shutAt(bus.pos + o, bus.mesh.position.z));
    }
  }

  placeTrain(t) {
    const n = t.cars.length, lim = this.layout.width / 2;
    t.cars.forEach((m, k) => {
      m.position.x = t.pos - t.dir * (k - (n - 1) / 2) * t.len;
      m.visible = Math.abs(m.position.x) < lim - t.len / 2;
    });
  }
}
