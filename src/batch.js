// Collects detailed part instances during a rebuild and turns them into one BatchedMesh per
// material (and shadow flag). Unique part geometry is stored once; instances carry matrix + color.
import * as THREE from 'three';

const _c = new THREE.Color();

export class PartBatcher {
  constructor() { this.groups = new Map(); }

  add(mat, geo, matrix, color, bucket, cast) {
    const key = `${mat}|${cast ? 1 : 0}`;
    let list = this.groups.get(key);
    if (!list) { list = []; this.groups.set(key, list); }
    list.push({ geo, m: matrix.clone(), color, bucket });
  }

  // part = { layers: [{ mat, slot, geo }] }; colors = { slot: hex }; glass = 'wl' | 'wc' | 'wd'
  place(part, matrix, colors, bucket, glass = 'wd', cast = true) {
    for (const l of part.layers) {
      const mat = l.mat === 'glass' ? glass : l.mat;
      const color = typeof l.slot === 'number' ? 0xffffff : (colors[l.slot] ?? 0xffffff);
      this.add(mat, l.geo, matrix, color, bucket, cast && mat !== 'l');
    }
  }

  // Returns { meshes, buckets: Map(bucket -> [[mesh, id], ...]) }
  build(group, mats) {
    const meshes = [], buckets = new Map();
    for (const [key, list] of this.groups) {
      if (!list.length) continue;
      const [matKey, cast] = key.split('|');
      const ids = new Map();
      let verts = 0;
      for (const it of list) {
        if (!ids.has(it.geo)) { ids.set(it.geo, -1); verts += it.geo.attributes.position.count; }
      }
      const bm = new THREE.BatchedMesh(list.length, verts, 0, mats[matKey]);
      bm.perObjectFrustumCulled = false;
      bm.sortObjects = false;
      bm.frustumCulled = false;
      bm.castShadow = cast === '1';
      bm.receiveShadow = true;
      for (const g of ids.keys()) ids.set(g, bm.addGeometry(g));
      for (const it of list) {
        const id = bm.addInstance(ids.get(it.geo));
        bm.setMatrixAt(id, it.m);
        bm.setColorAt(id, _c.set(it.color));
        let b = buckets.get(it.bucket);
        if (!b) { b = []; buckets.set(it.bucket, b); }
        b.push(bm, id);
      }
      group.add(bm);
      meshes.push(bm);
    }
    this.groups.clear();
    return { meshes, buckets };
  }
}
