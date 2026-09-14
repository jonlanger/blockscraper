// Articulated people: torso, head, hair, and swinging arms and legs drawn as instanced meshes.
import * as THREE from 'three';
import { CELL, MODULES } from './catalog.js';
import { GeoBuilder, SHAPES } from './geo.js';
import { rbox } from './props.js';

const SHIRTS = [0x34495e, 0xc0392b, 0x16a085, 0x8e44ad, 0xd35400, 0x2c3e50, 0xf1c40f, 0xecf0f1, 0x2980b9, 0x7f8c8d, 0xe76f51, 0x3a6ea5];
const PANTS = [0x2b2b2b, 0x3a4a6a, 0x5a4a3a, 0x6d6a66, 0x1f3a5f, 0xc9b28a];
const SKIN = [0xf1c9a5, 0xe0b090, 0xc68c62, 0xa0673f, 0x7a4a2a, 0x5a3520];
const HAIR = [0x1a1410, 0x3a2a1e, 0x6b4a2a, 0xb08850, 0x9a9a9a, 0x8a3a1a];

const M = new THREE.Matrix4(), T = new THREE.Matrix4(), Rm = new THREE.Matrix4(), _c = new THREE.Color();
const mk = (x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));

function geos() {
  const torso = new GeoBuilder(), head = new GeoBuilder(), hair = new GeoBuilder(), leg = new GeoBuilder(), arm = new GeoBuilder();
  torso.addGeometry(rbox(0.34, 0.5, 0.2, 0.08), mk(0, 1.15, 0), 0xffffff);
  torso.addGeometry(rbox(0.32, 0.16, 0.2, 0.06), mk(0, 0.9, 0), 0xcccccc);
  torso.addGeometry(SHAPES.sphere, mk(0, 1.34, 0, 0.19, 0.09, 0.11), 0xffffff);
  head.addGeometry(SHAPES.sphere, mk(0, 1.57, 0, 0.11, 0.13, 0.12), 0xffffff);
  head.addGeometry(SHAPES.cyl, mk(0, 1.43, 0, 0.045, 0.08, 0.045), 0xffffff);
  head.addGeometry(SHAPES.sphere, mk(0, 1.56, 0.115, 0.02, 0.025, 0.02), 0xeeeeee);
  for (const x of [-0.04, 0.04]) head.addGeometry(SHAPES.sphere, mk(x, 1.6, 0.105, 0.015, 0.015, 0.01), 0x222222);
  hair.addGeometry(SHAPES.hemi, mk(0, 1.6, -0.01, 0.12, 0.1, 0.13), 0xffffff);
  hair.addGeometry(SHAPES.sphere, mk(0, 1.58, -0.07, 0.11, 0.1, 0.07), 0xffffff);
  leg.addGeometry(SHAPES.cyl, mk(0, -0.22, 0, 0.065, 0.44, 0.07), 0xffffff);
  leg.addGeometry(SHAPES.cyl, mk(0, -0.62, 0, 0.055, 0.4, 0.06), 0xffffff);
  leg.addGeometry(rbox(0.1, 0.07, 0.22, 0.03), mk(0, -0.86, 0.04), 0x333333);
  arm.addGeometry(SHAPES.cyl, mk(0, -0.16, 0, 0.045, 0.32, 0.045), 0xffffff);
  arm.addGeometry(SHAPES.cyl, mk(0, -0.45, 0, 0.038, 0.28, 0.038), 0xffffff);
  arm.addGeometry(SHAPES.sphere, mk(0, -0.62, 0, 0.042, 0.05, 0.04), 0xf1c9a5);
  return { torso: torso.build(), head: head.build(), hair: hair.build(), leg: leg.build(), arm: arm.build() };
}

export class Crowd {
  constructor(scene, max, material) {
    const g = geos();
    const mat = material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    const IM = (geo, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(m); return m; };
    this.max = max;
    this.torso = IM(g.torso, max); this.head = IM(g.head, max); this.hair = IM(g.hair, max);
    this.legs = IM(g.leg, max * 2); this.arms = IM(g.arm, max * 2);
    this.all = [this.torso, this.head, this.hair, this.legs, this.arms];
    this.n = 0;
  }
  set visible(v) { for (const m of this.all) m.visible = v; }
  begin() { this.n = 0; }
  // look: [shirt, pants, skin, hair] indices
  push(x, y, z, rot, phase, moving, look) {
    if (this.n >= this.max) return;
    const i = this.n++;
    M.makeRotationY(rot).setPosition(x, y, z);
    this.torso.setMatrixAt(i, M); this.head.setMatrixAt(i, M); this.hair.setMatrixAt(i, M);
    const sw = moving ? Math.sin(phase) * 0.55 : 0;
    for (const [s, k] of [[-1, 0], [1, 1]]) {
      T.makeTranslation(s * 0.09, 0.88, 0); Rm.makeRotationX(sw * s);
      this.legs.setMatrixAt(i * 2 + k, M.clone().multiply(T).multiply(Rm));
      T.makeTranslation(s * 0.215, 1.36, 0); Rm.makeRotationX(-sw * s * 0.8);
      this.arms.setMatrixAt(i * 2 + k, M.clone().multiply(T).multiply(Rm));
    }
    this.torso.setColorAt(i, _c.set(SHIRTS[look[0] % SHIRTS.length]));
    this.head.setColorAt(i, _c.set(SKIN[look[2] % SKIN.length]));
    this.hair.setColorAt(i, _c.set(HAIR[look[3] % HAIR.length]));
    for (const k of [0, 1]) { this.legs.setColorAt(i * 2 + k, _c.set(PANTS[look[1] % PANTS.length])); this.arms.setColorAt(i * 2 + k, _c.set(SHIRTS[look[0] % SHIRTS.length])); }
  }
  end() {
    this.torso.count = this.head.count = this.hair.count = this.n;
    this.legs.count = this.arms.count = this.n * 2;
    for (const m of this.all) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
}

function occupancy(id, t) {
  const day = t > 0.33 && t < 0.78, eve = t > 0.7 || t < 0.04;
  const m = MODULES[id];
  if (m.transit || ['subwayconcourse', 'trainhall', 'waitingroom', 'ticketing'].includes(id)) return day ? 0.9 : 0.35;
  if (m.park) return day ? 0.9 : 0.15;
  switch (id) {
    case 'office': case 'clinic': case 'lab': case 'classroom': case 'datacenter': return day ? 1 : 0.05;
    case 'shop': case 'cafe': case 'mall': case 'gym': case 'lobby': case 'vault': case 'market': case 'library': case 'gallery': case 'skylobby': return day ? 0.9 : eve ? 0.4 : 0.05;
    case 'condo': case 'penthouse': case 'hotel': return day ? 0.35 : 0.9;
    case 'skybar': case 'observation': case 'nightclub': case 'cinema': case 'ballroom': case 'skydining': return eve ? 1 : 0.4;
    case 'skygarden': case 'skypool': case 'pool': return day ? 0.8 : 0.15;
    default: return 0;
  }
}

export class People {
  constructor(scene) {
    this.crowd = new Crowd(scene, 1400);
    this.agents = [];
  }

  populate(city, B, t) {
    this.agents = [];
    if (!B) return;
    const L = city.layout;
    for (const c of B.cells) {
      const m = MODULES[c.m];
      if (!c.ok || m.topper) continue;
      const base = c.m === 'lobby' ? 3 : m.transit ? 4 : Math.min(4, Math.ceil((m.pop || 0) / 3));
      const n = Math.floor(base * occupancy(c.m, t) + Math.random());
      for (let i = 0; i < n && this.agents.length < this.crowd.max; i++) {
        this.agents.push({
          ox: L.wx(c.x), oz: L.wz(c.z), y: c.y * CELL + (m.park ? 0.2 : m.open ? 0.36 : 0.25), lvl: c.y, park: !!m.park,
          x: 0.5 + Math.random() * 3, z: 0.5 + Math.random() * 3, tx: 0.5 + Math.random() * 3, tz: 0.5 + Math.random() * 3,
          sp: 0.5 + Math.random() * 0.6, pause: Math.random() * 2, rot: 0, ph: Math.random() * 6,
          look: [Math.floor(Math.random() * 12), Math.floor(Math.random() * 6), Math.floor(Math.random() * 6), Math.floor(Math.random() * 6)],
        });
      }
    }
  }

  // v: { above, below, cutLevel }
  update(dt, v) {
    const cr = this.crowd;
    cr.begin();
    for (const a of this.agents) {
      let moving = false;
      if (a.pause > 0) a.pause -= dt;
      else {
        const dx = a.tx - a.x, dz = a.tz - a.z, dist = Math.hypot(dx, dz);
        if (dist < 0.05) { a.tx = 0.5 + Math.random() * 3; a.tz = 0.5 + Math.random() * 3; a.pause = Math.random() * 3; }
        else { const s = Math.min(dist, a.sp * dt); a.x += (dx / dist) * s; a.z += (dz / dist) * s; a.rot = Math.atan2(dx, dz); moving = true; }
      }
      if (moving) a.ph += dt * 9;
      if (!a.park && !(a.lvl >= 0 ? v.above : v.below)) continue;
      if (v.cutLevel !== null && a.lvl > v.cutLevel) continue;
      cr.push(a.ox + a.x, a.y + (moving ? Math.abs(Math.sin(a.ph)) * 0.03 : 0), a.oz + a.z, a.rot, a.ph, moving, a.look);
    }
    cr.end();
  }
}
