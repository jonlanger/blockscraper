import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CELL, MAX_LEVEL, DAY_SECONDS, MODULES, STYLES, TERRAIN, DECOR, levelName, isHollow } from './catalog.js';
import { TerrainRenderer, planTerrain, GROUND_Y, tk } from './terrain.js';
import { Layout, DEFAULT_LAYOUT, STREET } from './layout.js';
import { City } from './city.js';
import { CityRenderer } from './render.js';
import { World } from './world.js';
import { pickCity } from './pick.js';
import { People } from './people.js';
import { detectEggs, Effects, EGG_INFO } from './eggs.js';
import { initUI, fmt } from './ui.js';
import { icon } from './icons.js';
import { applyClassic, applyRandom } from './presets.js';

// ---------- renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 8000);
camera.position.set(-10, 90, 140);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 1400;
controls.maxPolarAngle = Math.PI * 0.49;
controls.screenSpacePanning = true;

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 2.0, scale: 1.2, samples: 12 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
composer.addPass(gtao);
composer.addPass(new OutputPass());

const quality = { high: true, autoChecked: false };
function applyQuality() {
  renderer.setPixelRatio(quality.high ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1.25));
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  game.highDetail = quality.high;
  ui.refreshPalette();
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

const world = new World(scene);
const people = new People(scene);
const effects = new Effects(scene);
let city = null, cityR = null, terrainR = null;

// ---------- game state ----------
const SAVE_KEY = 'blockscraper-save-v1';
const game = {
  money: 2_000_000, sandbox: false, time: 0.32, day: 1, speed: 1,
  fill: null, // 'plot' | 'block': the Shift / Ctrl+Shift fills, for touch screens
  tool: 'build', moduleId: 'lobby', styleId: 'deco', variant: 0, brush: 'module', terrainId: 'grass', decorId: 'gargoyle', brushSize: 3,
  cutaway: false, underground: false, isolate: false, cutLevel: null, workLevel: 0, activeId: 0, hood: false,
  eggsFound: new Set(), layoutCfg: { ...DEFAULT_LAYOUT }, city: null,
};
const activeB = () => city.buildings.get(game.activeId);

// ---------- undo / redo ----------
// Each edit stores only the blocks and map cells it changed (see City.beginEdit), plus what it cost.
const HISTORY_MAX = 100;
const history = { undo: [], redo: [] };

function record(label, fn) {
  city.beginEdit();
  const money = game.money;
  try { fn(); } finally {
    const edit = city.endEdit();
    if (edit) {
      Object.assign(edit, { label, money: game.money - money });
      history.undo.push(edit);
      if (history.undo.length > HISTORY_MAX) history.undo.shift();
      history.redo.length = 0;
      refreshHistory();
    }
  }
}

function stepHistory(from, to, side, verb) {
  const edit = from.pop();
  if (!edit) return;
  city.applyEdit(edit, side);
  game.money += side ? edit.money : -edit.money;
  to.push(edit);
  afterEdit();
  refreshHistory();
  ui.toast(`${verb} ${edit.label}`, '', side ? 'redo-2' : 'undo-2');
}
const undo = () => stepHistory(history.undo, history.redo, 0, 'Undid');
const redo = () => stepHistory(history.redo, history.undo, 1, 'Redid');

function refreshHistory() {
  const u = history.undo.at(-1), r = history.redo.at(-1), bu = document.getElementById('btn-undo'), br = document.getElementById('btn-redo');
  bu.disabled = !u;
  br.disabled = !r;
  bu.title = u ? `Undo ${u.label} (Ctrl/⌘+Z)` : 'Nothing to undo';
  br.title = r ? `Redo ${r.label} (Ctrl/⌘+Shift+Z)` : 'Nothing to redo';
}
const tallest = () => [...city.buildings.values()].filter((B) => !B.park).sort((a, b) => b.bbox.y1 - a.bbox.y1 || b.cells.length - a.cells.length)[0];

function initCity(cfg) {
  game.layoutCfg = { ...DEFAULT_LAYOUT, ...cfg };
  const layout = new Layout(game.layoutCfg);
  city = new City(layout);
  game.city = city;
  history.undo.length = history.redo.length = 0;
  refreshHistory();
  if (!cityR) cityR = new CityRenderer(scene, city);
  else cityR.setCity(city);
  world.setLayout(layout);
  if (!terrainR) terrainR = new TerrainRenderer(scene, world.mats);
  terrainR.setCity(city);
  buildOverlays();
}

function save() {
  if (!city) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 2, layout: game.layoutCfg, money: game.money, time: game.time, day: game.day, sandbox: game.sandbox,
      eggs: [...game.eggsFound], ...city.serialize(), active: (() => { const B = activeB(); return B ? [B.cells[0].x, B.cells[0].y, B.cells[0].z] : null; })(),
    }));
  } catch { /* storage unavailable */ }
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d) return false;
    Object.assign(game, { money: d.money ?? game.money, time: d.time ?? 0.32, day: d.day ?? 1, sandbox: !!d.sandbox });
    if (d.v === 2) {
      initCity(d.layout);
      city.load(d);
      game.eggsFound = new Set(d.eggs || []);
      if (d.active) { const c = city.get(...d.active); if (c) game.activeId = c.b; }
      return true;
    }
    if (d.v === 1) {
      // Convert the original 8-lot neighborhood into the classic street of the new city grid.
      initCity(DEFAULT_LAYOUT);
      const L = city.layout, names = [];
      d.buildings.forEach((bd, i) => {
        const lot = L.lots.find((l) => l.block[0] === 0 && l.block[1] === (i < 4 ? 0 : 1) && l.row === (i < 4 ? 1 : 0) && l.k === i % 4);
        if (!lot) return;
        for (const [x, y, z, m, s, v] of bd.cells) if (MODULES[m] && STYLES[s]) city.set(lot.gx + x, y, lot.gz + z, m, s, v || 0);
        if (bd.cells.length) names.push([lot.gx + bd.cells[0][0], bd.cells[0][1], lot.gz + bd.cells[0][2], bd.name]);
      });
      city.recompute();
      city.applyNames(names);
      return true;
    }
    return false;
  } catch (e) { console.warn('Save could not be loaded', e); return false; }
}

// ---------- city updates ----------
function refreshEggs(announce = true) {
  const { eggs, found, effects: fx } = detectEggs(city);
  const keys = new Set([...eggs.keys(), ...city.eggs.keys()]);
  for (const k of keys) {
    if (JSON.stringify(eggs.get(k)) !== JSON.stringify(city.eggs.get(k))) { const [x, , z] = k.split(',').map(Number); city.markAround(x, z); }
  }
  city.eggs = eggs;
  for (const f of found) {
    if (game.eggsFound.has(f)) continue;
    game.eggsFound.add(f);
    if (announce) ui.toast(`Easter egg discovered: ${EGG_INFO[f].name}!`, 'egg', 'egg');
  }
  effects.set(fx, city.layout, city);
}

function updateStops() {
  const L = city.layout;
  const runs = (list) => {
    const out = [];
    list.sort((a, b) => a - b);
    let start = null, prev = null;
    for (const x of list) {
      if (start === null) { start = prev = x; continue; }
      if (x === prev + 1) { prev = x; continue; }
      out.push(L.wx((start + prev + 1) / 2)); start = prev = x;
    }
    if (start !== null) out.push(L.wx((start + prev + 1) / 2));
    return out;
  };
  const subway = new Map(), rail = [], bus = new Map();
  const add = (map, k, x) => { if (!map.has(k)) map.set(k, []); map.get(k).push(x); };
  for (const c of city.cells.values()) {
    if (!['station', 'railplatform', 'busbay'].includes(c.m)) continue;
    const t = L.touchingHBand(c.x, c.z);
    if (!t) continue;
    if (c.m === 'station' && c.y === -2) add(subway, t.band, c.x);
    if (c.m === 'railplatform' && c.y === -4 && t.band === L.railBand) rail.push(c.x);
    if (c.m === 'busbay' && c.y === 0) add(bus, `${t.band}:${t.side > 0 ? 1 : -1}`, c.x);
  }
  world.stops = { subway: new Map([...subway].map(([k, v]) => [k, runs(v)])), rail: runs(rail), bus: new Map([...bus].map(([k, v]) => [k, runs(v)])) };
}

function afterEdit(focusCell) {
  city.recompute();
  if (focusCell) { const c = city.get(...focusCell); if (c) setActive(c.b); }
  if (!city.buildings.has(game.activeId)) setActive(city.buildings.keys().next().value || 0);
  refreshEggs();
  cityR.elevDirty = true;
  world.setDepth(city.minY);
  world.setTerrain(city);
  updateStops();
  people.populate(city, activeB(), game.time);
  ui.refresh();
  ui.refreshPalette();
}

function setActive(id, fly = false) {
  if (!city.buildings.has(id)) id = 0;
  const changed = id !== game.activeId;
  game.activeId = id;
  cityR.setActive(id);
  if (changed) { game.cutLevel = null; ui.inspect(null); }
  people.populate(city, activeB(), game.time);
  if (fly) frame();
  ui.refresh();
  ui.refreshPalette();
}

// ---------- actions ----------
function fillArea(x, z, mode) {
  const L = city.layout;
  if (!mode || !L.inGrid(x, z)) return [[x, z]];
  if (L.isGridBand(x, z)) {
    // On a street: Plot fills across the street here, Block the whole stretch between intersections.
    const inX = L.isStreetX(x), inZ = L.isStreetZ(z), sx = Math.floor(x / L.P) * L.P, sz = Math.floor(z / L.Q) * L.Q;
    const xs = inX ? [sx, sx + STREET - 1] : mode === 'block' ? [sx + STREET, sx + L.P - 1] : [x, x];
    const zs = inZ ? [sz, sz + STREET - 1] : mode === 'block' ? [sz + STREET, sz + L.Q - 1] : [z, z];
    const out = [];
    for (let gx = xs[0]; gx <= xs[1]; gx++) for (let gz = zs[0]; gz <= zs[1]; gz++) if (L.inGrid(gx, gz)) out.push([gx, gz]);
    return out;
  }
  if (mode === 'block') {
    const b = L.blockBounds(x, z), out = [];
    for (let gx = b.x0; gx <= b.x1; gx++) for (let gz = b.z0; gz <= b.z1; gz++) out.push([gx, gz]);
    return out;
  }
  const lot = L.lotAt(x, z);
  if (!lot) return [[x, z]];
  const out = [];
  for (let gx = lot.gx; gx < lot.gx + lot.w; gx++) for (let gz = lot.gz; gz < lot.gz + lot.d; gz++) out.push([gx, gz]);
  return out;
}

const levelsOf = (cells) => { const ys = new Set(cells.map((c) => c[1])); return ys.size === 1 ? levelName(cells[0][1]) : `${ys.size} levels`; };

// cells: [[x, y, z], ...]. multi: a fill or drag, which quietly skips spaces already taken. Lower blocks
// go first so a dragged column stands on itself.
function placeAt(cells, multi) {
  const mod = MODULES[game.moduleId];
  let placed = 0, err = null, last = null;
  for (const [tx, y, tz] of [...cells].sort((a, b) => a[1] - b[1])) {
    const e = city.canPlace(tx, y, tz, game.moduleId);
    if (e) { if (!multi || e !== 'Space occupied') err = e; continue; }
    if (!game.sandbox && game.money < mod.cost) { err = `Not enough funds — ${mod.name} costs ${fmt(mod.cost)}`; break; }
    city.set(tx, y, tz, game.moduleId, game.styleId, game.variant);
    if (city.terrain.has(tk(tx, tz))) city.setTerrain(tx, tz, null); // level land cover makes way
    if (y <= 0 && city.roads.has(tk(tx, tz))) city.setRoad(tx, tz, null); // so do map roads built over
    if (!game.sandbox) game.money -= mod.cost;
    placed++;
    last = [tx, y, tz];
    if (multi && placed % 25 === 0) city.recompute();
  }
  if (placed) {
    afterEdit(last);
    if (multi) ui.toast(`Built ${placed} × ${mod.name} on ${levelsOf(cells)}${game.sandbox ? '' : ' for ' + fmt(placed * mod.cost)}`);
  } else if (err) ui.toast(err, 'bad');
}

// Top blocks go first, so a dragged column comes down cleanly.
function eraseAt(cells) {
  let removed = 0, refund = 0, err = null;
  for (const [tx, y, tz] of [...cells].sort((a, b) => b[1] - a[1])) {
    const c = city.get(tx, y, tz);
    if (!c) continue;
    const e = city.canRemove(tx, y, tz);
    if (e) { err = e; continue; }
    refund += MODULES[c.m].cost * 0.5;
    city.remove(tx, y, tz);
    removed++;
  }
  if (removed) {
    if (!game.sandbox) game.money += refund;
    afterEdit();
    ui.toast(`Removed ${removed} block${removed > 1 ? 's' : ''}${game.sandbox ? '' : ' · refund ' + fmt(refund)}`);
  } else if (err) ui.toast(err, 'bad');
}

function paintAt(cells) {
  let n = 0;
  for (const [tx, y, tz] of cells) {
    const c = city.get(tx, y, tz);
    if (!c || (c.s === game.styleId && (c.v || 0) === game.variant)) continue;
    if (!game.sandbox && game.money < 1500) { ui.toast('Not enough funds to restyle', 'bad'); break; }
    city.set(tx, y, tz, c.m, game.styleId, game.variant);
    if (!game.sandbox) game.money -= 1500;
    n++;
  }
  if (n) afterEdit();
}

function stackFloor() {
  const B = activeB();
  if (!B || B.park) return ui.toast('Select a building first', 'bad');
  const top = B.stats.topFloor;
  if (top < 0) return ui.toast('Build the street level first', 'bad');
  const src = B.cells.filter((c) => c.y === top && !MODULES[c.m].topper);
  const y = top + 1;
  let placed = 0, cost = 0, err = null, last = null;
  for (const c of src) {
    const mid = y >= MODULES[c.m].min && y <= MODULES[c.m].max && !MODULES[c.m].open ? c.m : 'office';
    const e = city.canPlace(c.x, y, c.z, mid);
    if (e) { err = e; continue; }
    if (!game.sandbox && game.money < MODULES[mid].cost) { err = 'Not enough funds'; break; }
    city.set(c.x, y, c.z, mid, c.s, c.v);
    if (c.o && !MODULES[mid].open) {
      // Ornaments carry up; crowning ones (gargoyles, cornices) move to the new top floor.
      const o = c.o;
      o.forEach((id, d) => { if (id) city.setDecor(c.x, y, c.z, d, id); });
      o.forEach((id, d) => { if (CROWN_DECOR.has(id)) city.setDecor(c.x, c.y, c.z, d, null); });
    }
    if (!game.sandbox) game.money -= MODULES[mid].cost;
    cost += MODULES[mid].cost;
    placed++;
    last = [c.x, y, c.z];
  }
  if (placed) {
    afterEdit(last);
    ui.toast(`Stacked ${levelName(y)} · ${placed} blocks${game.sandbox ? '' : ' · ' + fmt(cost)}`);
    if (game.workLevel === top) setWorkLevel(y);
  } else ui.toast(err || 'Nothing to stack', 'bad');
}

// ---------- facade ornaments ----------
const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CROWN_DECOR = new Set(['gargoyle', 'cornice']);

// Why side d of block c can't take the ornament (null if it can).
function decorBlocked(c, d, def) {
  const m = MODULES[c.m];
  if (m.open || m.topper || m.park) return 'Ornaments attach to solid building walls';
  if (c.y < 0) return 'Ornaments only go on above-ground walls';
  if (c.y < def.min) return `${def.name} start on ${levelName(def.min)}`;
  const n = city.get(c.x + DIR4[d][0], c.y, c.z + DIR4[d][1]);
  if (n && !isHollow(n)) return 'That wall is hidden by its neighbor';
  const cur = c.o?.[d] || null;
  if (def.remove) return cur ? null : 'No ornament on that wall';
  return cur === def.id ? `Already has ${def.name}` : null;
}

// One wall (side click), every wall of a block (roof click), a whole floor (Shift) or building (Ctrl/⌘+Shift).
function decorHover(hit) {
  if (!hit || hit.kind !== 'cell') return null;
  const cell = city.get(hit.ix, hit.iy, hit.iz), def = DECOR[game.decorId], B = city.buildings.get(cell.b);
  const d = hit.n[0] > 0 ? 0 : hit.n[0] < 0 ? 1 : hit.n[2] > 0 ? 2 : hit.n[2] < 0 ? 3 : -1;
  const cells = !B ? [cell] : modeHeld === 'block' ? B.cells : modeHeld ? B.cells.filter((c) => c.y === cell.y) : [cell];
  const dirs = !modeHeld && d >= 0 ? [d] : [0, 1, 2, 3];
  const faces = [];
  let err = null;
  for (const c of cells) for (const dd of dirs) { const e = decorBlocked(c, dd, def); if (e) err = err || e; else faces.push([c, dd]); }
  // With nothing to do, explain the wall under the pointer first.
  const why = faces.length ? null : (d >= 0 && decorBlocked(cell, d, def)) || err || 'Nothing to decorate here';
  return { decor: true, t: [hit.ix, hit.iy, hit.iz], cell, d, faces, err: why, hit };
}

function applyDecor(h) {
  if (h.err) return ui.toast(h.err, 'bad');
  const def = DECOR[game.decorId], n = h.faces.length, cost = def.cost * n;
  if (!game.sandbox && game.money < cost) return ui.toast(`Not enough funds — that costs ${fmt(cost)}`, 'bad');
  for (const [c, d] of h.faces) city.setDecor(c.x, c.y, c.z, d, def.remove ? null : def.id);
  if (!game.sandbox) game.money -= cost;
  if (h.cell.b !== game.activeId) setActive(h.cell.b); else ui.refresh();
  if (n > 1) ui.toast(`${def.remove ? 'Stripped' : def.name + ' on'} ${n} walls${game.sandbox || !cost ? '' : ' · ' + fmt(cost)}`);
}

function pickDecor(h) {
  const ids = (h.d >= 0 ? [h.cell.o?.[h.d]] : h.cell.o || []).filter(Boolean);
  if (!ids.length) return ui.toast('No ornament on that wall', 'bad');
  A.setDecor(ids[0]);
  ui.expandDecor(ids[0]);
  ui.refreshPalette();
  ui.toast(`Picked ${DECOR[ids[0]].name}`);
}

// Map blocks: apply a planned terrain edit (see planTerrain).
function applyTerrain(h) {
  const { out, cost } = h.plan;
  if (!out.length) return ui.toast(h.err, 'bad');
  if (!game.sandbox && game.money < cost) return ui.toast(`Not enough funds — that costs ${fmt(cost)}`, 'bad');
  for (const { kind, x, z, k, rec, s } of out) {
    if (kind === 'street') city.setStreet(k, rec);
    else if (kind === 'land') city.setLand(x, z, rec);
    else if (kind === 'road') city.setRoad(x, z, rec, s);
    else city.setTerrain(x, z, rec);
  }
  if (!game.sandbox) game.money -= cost;
  city.recompute();
  world.setTerrain(city);
  if (out.some((o) => o.kind === 'street')) updateStops(); // platforms and bus bays may have lost (or found) their street
  ui.refresh();
}

function restyleAll() {
  const B = activeB();
  if (!B) return;
  let n = 0;
  for (const c of B.cells) if (c.s !== game.styleId || (c.v || 0) !== game.variant) { city.set(c.x, c.y, c.z, c.m, game.styleId, game.variant); n++; }
  if (!n) return;
  if (!game.sandbox) game.money -= n * 800;
  afterEdit();
  ui.toast(`Restyled ${n} blocks as ${STYLES[game.styleId].name} · ${STYLES[game.styleId].variants[game.variant].name}`);
}

let tween = null;
function flyTo(pos, target, dur = 0.9) { tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, t: 0, dur }; }

function frame() {
  const B = activeB(), L = city.layout;
  game.hood = false;
  if (!B) return;
  const bb = B.bbox;
  const w = (bb.x1 - bb.x0 + 1) * CELL, d = (bb.z1 - bb.z0 + 1) * CELL, h = Math.max(1, bb.y1 + 1) * CELL;
  const c = new THREE.Vector3(L.wx((bb.x0 + bb.x1 + 1) / 2), Math.min(h * 0.45, 80), L.wz((bb.z0 + bb.z1 + 1) / 2));
  const dist = Math.min(900, Math.max(45, 30 + Math.max(w, d) * 1.1 + h * 1.05));
  const dir = camera.position.clone().sub(controls.target);
  dir.y = 0;
  if (dir.lengthSq() < 1) dir.set(0.6, 0, 0.8);
  dir.normalize().multiplyScalar(0.82);
  dir.y = 0.55;
  flyTo(c.clone().addScaledVector(dir.normalize(), dist), c);
  ui.refreshPalette();
}

function neighborhood() {
  game.hood = !game.hood;
  const L = city.layout, size = Math.max(L.width, L.depth);
  if (game.hood) flyTo(new THREE.Vector3(size * 0.55, size * 0.62, size * 0.8), new THREE.Vector3(0, 10, 0), 1.1);
  else frame();
  ui.refreshPalette();
}

function cycle(dir) {
  const ids = [...city.buildings.values()].sort((a, b) => a.bbox.z0 - b.bbox.z0 || a.bbox.x0 - b.bbox.x0).map((B) => B.id);
  if (!ids.length) return;
  const i = ids.indexOf(game.activeId);
  setActive(ids[(i + dir + ids.length) % ids.length], true);
}

function setUnderground(on) {
  game.underground = on;
  world.setUnderground(on);
  terrainR.setUnderground(on);
  controls.maxPolarAngle = on ? Math.PI * 0.7 : Math.PI * 0.49;
  if (on && game.workLevel >= 0) game.workLevel = -1;
  if (!on && game.workLevel < 0) game.workLevel = 0;
  people.populate(city, activeB(), game.time);
  ui.refreshPalette();
}
function setWorkLevel(l) {
  game.workLevel = Math.min(MAX_LEVEL, l);
  if (game.workLevel < 0 && !game.underground) setUnderground(true);
  ui.refreshPalette();
}
function setCut(l) { game.cutLevel = l; ui.refreshPalette(); }

function newCity({ template, map, lots, plot }) {
  initCity({ map, lots, plot });
  game.money = 2_000_000; game.day = 1; game.time = 0.32; game.activeId = 0;
  if (template === 'classic') applyClassic(city);
  else if (template === 'random') applyRandom(city, Math.random());
  else city.recompute();
  world.setTerrain(city);
  refreshEggs(true);
  world.setDepth(city.minY);
  updateStops();
  const first = (template === 'classic' && [...city.buildings.values()].find((B) => city.names.get(B.id) === 'The Aurora')) || tallest();
  setActive(first ? first.id : 0);
  game.hood = false;
  neighborhood();
  ui.toast(template === 'blank' ? 'A blank city of empty plots — start building!' : template === 'random' ? 'A brand-new random city has been generated.' : 'The classic neighborhood is ready.');
  save();
}

const A = {
  setTool: (t) => { game.tool = t; if (t !== 'inspect') ui.inspect(null); syncControls(); ui.refreshPalette(); },
  pickColorway: (s, v) => { game.styleId = s; game.variant = v; ui.refreshPalette(); },
  setModule: (m) => { game.moduleId = m; game.brush = 'module'; game.tool = 'build'; ui.refreshPalette(); },
  setTerrain: (t) => { game.terrainId = t; game.brush = 'terrain'; game.tool = 'build'; ui.refreshPalette(); },
  setDecor: (id) => { game.decorId = id; game.brush = 'decor'; game.tool = 'build'; ui.refreshPalette(); },
  setFill: (f) => { game.fill = f || null; modeHeld = CLICK_FILLS.has(game.fill) ? game.fill : null; syncControls(); ui.refreshPalette(); },
  setBrushSize: (n) => { game.brushSize = n; if (game.brush !== 'terrain') game.brush = 'terrain'; game.tool = 'build'; ui.refreshPalette(); },
  setSpeed: (s) => { game.speed = s; ui.refreshPalette(); },
  toggleCutaway: () => { game.cutaway = !game.cutaway; people.populate(city, activeB(), game.time); ui.refreshPalette(); },
  toggleUnderground: () => setUnderground(!game.underground),
  toggleIsolate: () => {
    if (!activeB()) { const t = tallest(); if (!t) return ui.toast('Build something first — there is no building to focus on', 'bad'); setActive(t.id); }
    game.isolate = !game.isolate; if (game.isolate) frame(); ui.toast(game.isolate ? 'Focus view: only the selected building is shown' : 'Showing the whole city'); ui.refreshPalette(); },
  toggleSandbox: () => { game.sandbox = !game.sandbox; ui.toast(game.sandbox ? 'Sandbox on — unlimited funds' : 'Sandbox off', '', 'infinity'); ui.refreshPalette(); ui.refresh(); },
  toggleQuality: () => { quality.high = !quality.high; quality.autoChecked = true; applyQuality(); },
  rename: (n) => { if (activeB()) city.names.set(game.activeId, n); },
  stackFloor: () => record('Stack floor', stackFloor),
  restyleAll: () => record('Restyle all', restyleAll),
  frame, neighborhood, cycle, setWorkLevel, setCut, newCity, undo, redo,
};
const ui = initUI(game, A);

// ---------- picking / overlays ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let pointer = null, hover = null;

const ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false }));
const ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ transparent: true }));
ghost.add(ghostEdges);
ghost.renderOrder = 5;
scene.add(ghost);
const rectLine = (color) => {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 1), new THREE.Vector3(0, 0, 1)]);
  return new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
};
const activeRect = rectLine(0xf2c14e), plotRect = rectLine(0x9fe8ff);
scene.add(activeRect, plotRect);
let grid = null;
function buildOverlays() {
  if (grid) { scene.remove(grid); grid.geometry.dispose(); }
  const L = city.layout, pts = [];
  for (let x = 0; x <= L.plotW; x++) pts.push(x * CELL, 0, 0, x * CELL, 0, L.plotD * CELL);
  for (let z = 0; z <= L.plotD; z++) pts.push(0, 0, z * CELL, L.plotW * CELL, 0, z * CELL);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  grid = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(grid);
}

function computeHover() {
  hover = null;
  if (!pointer || !city) return;
  ndc.set((pointer.x / innerWidth) * 2 - 1, -(pointer.y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (drag) { hover = dragHover(); return; }
  if (game.tool === 'build' && game.brush === 'terrain') { hover = terrainHover(); return; }
  const filter = game.isolate ? (c) => c.b === game.activeId : game.cutLevel !== null ? (c) => c.b !== game.activeId || c.y <= game.cutLevel : null;
  const hit = pickCity(raycaster.ray, city, {
    minLevel: game.underground ? Math.min(-6, city.minY - 1, game.workLevel) : 0,
    maxLevel: MAX_LEVEL, workLevel: game.workLevel, filter,
  });
  if (!hit) return;
  const cell = hit.kind === 'cell' ? city.get(hit.ix, hit.iy, hit.iz) : null;
  if (game.tool === 'build' && game.brush === 'decor') { hover = decorHover(hit); return; }
  if (game.tool === 'build') {
    if (hit.kind === 'cell' && !hit.n.some((v) => v)) return;
    const t = [hit.ix + hit.n[0], hit.iy + hit.n[1], hit.iz + hit.n[2]];
    hover = { t, err: city.canPlace(t[0], t[1], t[2], game.moduleId), cell, hit };
  } else if (cell) {
    hover = { t: [hit.ix, hit.iy, hit.iz], cell, hit, err: game.tool === 'erase' ? city.canRemove(hit.ix, hit.iy, hit.iz) : null };
  }
}

function terrainHover() {
  const L = city.layout, ray = raycaster.ray;
  let p = terrainR.pick(raycaster);
  if (Math.abs(ray.direction.y) > 1e-6) {
    const t = (GROUND_Y - ray.origin.y) / ray.direction.y;
    if (t > 0 && (!p || t < ray.origin.distanceTo(p))) p = ray.at(t, new THREE.Vector3());
  }
  if (!p) return null;
  // Land tools reach out past the edge of the map; everything else works on existing ground.
  const gx = L.gx(p.x), gz = L.gz(p.z), anywhere = TERRAIN[game.terrainId].group === 'land';
  if (!anywhere && !L.inMap(gx, gz)) return null;
  const r = (game.brushSize - 1) / 2, cells = [];
  if (modeHeld && L.inMap(gx, gz)) cells.push(...fillArea(gx, gz, modeHeld));
  else for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (anywhere || L.inMap(gx + dx, gz + dz)) cells.push([gx + dx, gz + dz]);
  const plan = planTerrain(city, game.terrainId, cells, { x0: gx, x1: gx, z0: gz, z1: gz }, r);
  return { terrain: true, t: [gx, 0, gz], y: p.y, cells, plan, err: plan.out.length ? null : plan.err || 'Nothing to change here' };
}

const TOOL_COLORS = { build: 0x5cf2a0, erase: 0xff6b5a, paint: 0xffd166, inspect: 0xffffff };
function updateOverlays(mode) {
  const L = city.layout, B = activeB();
  activeRect.visible = !!B && !game.hood;
  if (B) {
    activeRect.position.set(L.wx(B.bbox.x0) - 0.3, 0.08, L.wz(B.bbox.z0) - 0.3);
    activeRect.scale.set((B.bbox.x1 - B.bbox.x0 + 1) * CELL + 0.6, 1, (B.bbox.z1 - B.bbox.z0 + 1) * CELL + 0.6);
  }
  ghost.visible = false; plotRect.visible = false; grid.visible = false;
  if (!hover) { ui.tooltip(0, 0, null); return; }
  if (hover.terrain) {
    const def = TERRAIN[game.terrainId], n = hover.plan.count ?? hover.plan.out.length;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [a, b] of hover.plan.area?.length ? hover.plan.area : hover.cells) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); z0 = Math.min(z0, b); z1 = Math.max(z1, b); }
    const color = hover.err ? 0xff4d4d : TOOL_COLORS.build;
    ghost.visible = true;
    ghost.material.color.setHex(color);
    ghostEdges.material.color.setHex(color);
    ghost.position.set(L.wx((x0 + x1 + 1) / 2), Math.max(hover.y, GROUND_Y) + 0.3, L.wz((z0 + z1 + 1) / 2));
    ghost.scale.set((x1 - x0 + 1) * CELL + 0.1, 0.6, (z1 - z0 + 1) * CELL + 0.1);
    const price = game.sandbox ? 'Free in sandbox' : hover.plan.cost ? fmt(hover.plan.cost) : 'Free';
    ui.tooltip(pointer.x, pointer.y, `<b>${icon(def.icon)} ${def.name}</b> · ${hover.plan.label || `${n} block${n === 1 ? '' : 's'}`}<small>${hover.err ? icon('ban') + ' ' + hover.err : price}</small>`);
    return;
  }
  if (hover.decor) {
    const def = DECOR[game.decorId], n = hover.faces.length, color = hover.err ? 0xff4d4d : TOOL_COLORS.build;
    ghost.visible = true;
    ghost.material.color.setHex(color);
    ghostEdges.material.color.setHex(color);
    const one = n === 1 ? hover.faces[0] : !n && hover.d >= 0 && !modeHeld && !hover.drag ? [hover.cell, hover.d] : null;
    if (one) {
      const [c, d] = one, [dx, dz] = DIR4[d];
      ghost.position.set(L.wx(c.x) + 2 + dx * 2.1, c.y * CELL + 2, L.wz(c.z) + 2 + dz * 2.1);
      ghost.scale.set(dx ? 0.35 : 4.2, 4.1, dz ? 0.35 : 4.2);
    } else {
      const list = n ? hover.faces.map(([c]) => c) : [hover.cell];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const c of list) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
      ghost.position.set(L.wx((x0 + x1 + 1) / 2), ((y0 + y1 + 1) / 2) * CELL, L.wz((z0 + z1 + 1) / 2));
      ghost.scale.set((x1 - x0 + 1) * CELL + 0.5, (y1 - y0 + 1) * CELL + 0.1, (z1 - z0 + 1) * CELL + 0.5);
    }
    const price = def.remove ? 'Click to strip' : game.sandbox ? 'Free in sandbox' : fmt(def.cost * n);
    ui.tooltip(pointer.x, pointer.y, `<b>${icon(def.icon)} ${def.name}</b>${n > 1 ? ` · ${n} walls` : ''}<small>${hover.err ? icon('ban') + ' ' + hover.err : price}</small>`);
    return;
  }
  const [x, y, z] = hover.t;
  const lot = !hover.drag && L.lotAt(x, z);
  if (lot && !game.hood) {
    plotRect.visible = true;
    plotRect.position.set(L.wx(lot.gx), y * CELL + 0.09, L.wz(lot.gz));
    plotRect.scale.set(lot.w * CELL, 1, lot.d * CELL);
    if (game.tool === 'build') { grid.visible = true; grid.position.set(L.wx(lot.gx), y * CELL + 0.07, L.wz(lot.gz)); }
  }
  const bad = !!hover.err && !(mode && hover.err === 'Space occupied');
  const color = bad ? 0xff4d4d : TOOL_COLORS[game.tool];
  ghost.visible = true;
  ghost.material.color.setHex(color);
  ghostEdges.material.color.setHex(color);
  const cells = hover.cells || (mode && game.tool !== 'inspect' ? fillArea(x, z, mode).map(([a, b]) => [a, y, b]) : null);
  if (cells) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [a, b, c] of cells) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); z0 = Math.min(z0, c); z1 = Math.max(z1, c); }
    ghost.position.set(L.wx((x0 + x1 + 1) / 2), ((y0 + y1 + 1) / 2) * CELL, L.wz((z0 + z1 + 1) / 2));
    ghost.scale.set((x1 - x0 + 1) * CELL + 0.1, (y1 - y0 + 1) * CELL + 0.1, (z1 - z0 + 1) * CELL + 0.1);
  } else {
    ghost.position.set(L.wx(x) + 2, y * CELL + 2, L.wz(z) + 2);
    ghost.scale.setScalar(CELL + 0.12);
  }
  const m = MODULES[game.moduleId], multi = !!(mode || hover.drag);
  const area = hover.drag ? ` · ${cells.length} in a ${drag.area ? 'rectangle' : 'line'}` : mode === 'block' ? ' (whole city block)' : mode ? ' (whole plot)' : '';
  let html;
  if (game.tool === 'build') {
    html = `<b>${icon(m.icon)} ${m.name}</b> → ${hover.drag ? levelsOf(cells) : levelName(y)}${area}<small>${hover.err && !multi ? icon('ban') + ' ' + hover.err : game.sandbox ? 'Free in sandbox' : fmt(m.cost) + (multi ? ' each' : '')}</small>`;
  } else if (hover.cell) {
    const cm = MODULES[hover.cell.m], bn = city.names.get(hover.cell.b) || '';
    const verb = { erase: 'Remove', paint: `Paint ${STYLES[game.styleId].name} · ${STYLES[game.styleId].variants[game.variant].name}`, inspect: 'Click to select building' }[game.tool];
    html = `<b>${icon(cm.icon)} ${cm.name}</b> · ${levelName(y)}<small>${bn}</small><small>${hover.err ? icon('ban') + ' ' + hover.err : verb + area}</small>`;
  }
  ui.tooltip(pointer.x, pointer.y, html);
}

// ---------- drag to draw ----------
// Hold the pointer still for a moment, then drag: the action repeats along a straight line, or over a
// rectangle while Shift is held. With the Line or Area fill a plain drag draws (the middle button orbits).
// Blocks draw in the plane of the face the drag started on, so dragging up a wall makes a column.
const HOLD_MS = 320, DRAG_MAX = 1600;
const CLICK_FILLS = new Set(['plot', 'block']), DRAW_FILLS = new Set(['line', 'area']);
let drag = null, holdTimer = 0;
const _dp = new THREE.Vector3();

function syncControls() {
  const draw = DRAW_FILLS.has(game.fill) && game.tool !== 'inspect';
  controls.mouseButtons.LEFT = draw ? -1 : THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = draw ? THREE.MOUSE.ROTATE : THREE.MOUSE.DOLLY;
  controls.touches.ONE = draw ? -1 : THREE.TOUCH.ROTATE;
}

function beginDrag(e) {
  computeHover();
  const h = hover;
  if (!h || game.tool === 'inspect' || (!h.terrain && !h.hit)) return;
  let t0 = h.t, axis = 1, plane = h.y;
  if (!h.terrain) {
    const n = h.hit.n;
    axis = n[0] ? 0 : n[2] ? 2 : 1;
    plane = raycaster.ray.at(h.hit.t, _dp).getComponent(axis);
    if (h.decor || game.tool !== 'build') t0 = [h.hit.ix, h.hit.iy, h.hit.iz];
  }
  drag = { t0, axis, plane, terrain: !!h.terrain, decor: !!h.decor, d: h.decor ? h.d : -1, area: e.shiftKey || game.fill === 'area', key: '', hover: null };
  controls.enabled = false;
  canvas.style.cursor = 'crosshair';
  navigator.vibrate?.(10);
}

function endDrag() {
  drag = null;
  clearTimeout(holdTimer);
  controls.enabled = true;
  canvas.style.cursor = '';
}

// The cells from the drag's start to the pointer, in the drag plane: a line along the longer direction,
// or the whole rectangle.
function dragCells() {
  const L = city.layout, ray = raycaster.ray, a = drag.axis, t0 = drag.t0, dir = ray.direction.getComponent(a);
  const s = Math.abs(dir) > 1e-6 ? (drag.plane - ray.origin.getComponent(a)) / dir : -1;
  const cur = [...t0];
  if (s > 0) {
    const p = ray.at(s, _dp);
    cur[0] = L.gx(p.x); cur[1] = Math.floor(p.y / CELL); cur[2] = L.gz(p.z);
    cur[a] = t0[a];
  }
  if (drag.terrain) cur[1] = t0[1];
  const [u, w] = [0, 1, 2].filter((i) => i !== a), alongU = Math.abs(cur[u] - t0[u]) >= Math.abs(cur[w] - t0[w]);
  const span = (i, on) => (on ? [Math.min(t0[i], cur[i]), Math.max(t0[i], cur[i])] : [t0[i], t0[i]]);
  const [u0, u1] = span(u, drag.area || alongU), [w0, w1] = span(w, drag.area || !alongU);
  const cells = [];
  for (let i = u0; i <= u1 && cells.length < DRAG_MAX; i++) for (let j = w0; j <= w1 && cells.length < DRAG_MAX; j++) { const c = [...t0]; c[u] = i; c[w] = j; cells.push(c); }
  return { cells, key: `${u0},${u1},${w0},${w1}` };
}

// The hover for a drag in progress, shaped like the tool's click hover plus `cells`.
function dragHover() {
  const { cells, key } = dragCells();
  const k = `${key}|${drag.area}|${game.tool}|${game.brush}|${game.moduleId}|${game.terrainId}|${game.decorId}|${game.brushSize}`;
  if (drag.hover && drag.key === k) return drag.hover;
  drag.key = k;
  const L = city.layout, [x, y, z] = drag.t0;
  let h;
  if (drag.terrain) {
    // The brush sweeps the line or rectangle.
    const r = (game.brushSize - 1) / 2, anywhere = TERRAIN[game.terrainId].group === 'land', flat = [];
    const rect = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const [cx, , cz] of cells) { rect.x0 = Math.min(rect.x0, cx); rect.x1 = Math.max(rect.x1, cx); rect.z0 = Math.min(rect.z0, cz); rect.z1 = Math.max(rect.z1, cz); }
    for (let gx = rect.x0 - r; gx <= rect.x1 + r; gx++) for (let gz = rect.z0 - r; gz <= rect.z1 + r; gz++) if (anywhere || L.inMap(gx, gz)) flat.push([gx, gz]);
    // A dragged road runs up to the city streets and joins them rather than replacing them.
    const plan = planTerrain(city, game.terrainId, flat, rect, r, { keepStreets: true });
    h = { terrain: true, drag: true, t: drag.t0, y: drag.plane, cells: flat, plan, err: plan.out.length ? null : plan.err || 'Nothing to change here' };
  } else if (drag.decor) {
    // A wall drag decorates that face of every block along it; a roof drag, every wall.
    const def = DECOR[game.decorId], dirs = drag.d >= 0 ? [drag.d] : [0, 1, 2, 3], faces = [];
    let err = null;
    for (const [cx, cy, cz] of cells) {
      const c = city.get(cx, cy, cz);
      if (c) for (const d of dirs) { const e = decorBlocked(c, d, def); if (e) err = err || e; else faces.push([c, d]); }
    }
    h = { decor: true, drag: true, t: drag.t0, cell: faces[0]?.[0] || city.get(x, y, z), d: drag.d, faces, err: faces.length ? null : err || 'Nothing to decorate here' };
  } else {
    h = { drag: true, t: drag.t0, cells, cell: city.get(x, y, z), err: null };
  }
  return (drag.hover = h);
}

// Carry out a click (mode: a Plot / Block fill or null) or a finished drag.
function act(e, h, mode) {
  if (h.terrain) return record(TERRAIN[game.terrainId].name, () => applyTerrain(h));
  if (h.decor) return e.altKey && !h.drag ? pickDecor(h) : record(DECOR[game.decorId].name, () => applyDecor(h));
  const [x, y, z] = h.t;
  if (e.altKey && h.cell && !h.drag) {
    game.moduleId = h.cell.m; game.styleId = h.cell.s; game.variant = h.cell.v || 0; game.tool = 'build'; game.brush = 'module';
    ui.expandFor(h.cell.m); ui.openStyle(h.cell.s); ui.refreshPalette();
    return ui.toast(`Picked ${MODULES[h.cell.m].name} · ${STYLES[h.cell.s].name}`);
  }
  const cells = h.cells || fillArea(x, z, mode).map(([a, b]) => [a, y, b]), multi = !!(mode || h.drag);
  if (game.tool === 'build') record(MODULES[game.moduleId].name, () => placeAt(cells, multi));
  else if (game.tool === 'erase') record('Erase', () => eraseAt(cells));
  else if (game.tool === 'paint') record('Paint', () => paintAt(cells));
  else if (h.cell) { setActive(h.cell.b); ui.inspect(h.cell); }
}

let down = null, modeHeld = null;
const modeOf = (e) => (e.shiftKey ? (e.ctrlKey || e.metaKey ? 'block' : 'plot') : CLICK_FILLS.has(game.fill) ? game.fill : null);
// A tap is one pointer that barely moved; holding it still starts a drag; a second finger (pinch / pan) cancels both.
const activePointers = new Set();
canvas.addEventListener('pointerdown', (e) => {
  activePointers.add(e.pointerId);
  clearTimeout(holdTimer);
  if (activePointers.size > 1) { down = null; if (drag) endDrag(); return; }
  down = { x: e.clientX, y: e.clientY, btn: e.button, slop: e.pointerType === 'mouse' ? 5 : 12 };
  if (e.button !== 0 || game.tool === 'inspect') return;
  pointer = { x: e.clientX, y: e.clientY };
  modeHeld = modeOf(e);
  if (DRAW_FILLS.has(game.fill)) beginDrag(e);
  else holdTimer = setTimeout(() => { if (down && !drag && activePointers.size === 1) beginDrag(e); }, HOLD_MS);
});
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, (e) => { activePointers.delete(e.pointerId); if (type === 'pointercancel') { down = null; if (drag) endDrag(); } });
canvas.addEventListener('pointermove', (e) => {
  pointer = { x: e.clientX, y: e.clientY };
  modeHeld = modeOf(e);
  if (drag) drag.area = e.shiftKey || game.fill === 'area';
  else if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > down.slop) clearTimeout(holdTimer);
});
canvas.addEventListener('pointerleave', () => { if (!drag) pointer = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerup', (e) => {
  clearTimeout(holdTimer);
  const started = down;
  down = null;
  pointer = { x: e.clientX, y: e.clientY };
  if (drag) {
    computeHover();
    const h = hover;
    endDrag();
    if (h && started) act(e, h, null);
    return;
  }
  if (!started || e.button !== 0 || Math.hypot(e.clientX - started.x, e.clientY - started.y) > started.slop || started.btn !== 0) return;
  modeHeld = modeOf(e);
  computeHover();
  if (hover) act(e, hover, modeOf(e));
});
// Touch has no hover: drop the preview once the tap is handled.
canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pointer = null; });
canvas.addEventListener('dblclick', () => {
  const tool = game.tool;
  game.tool = 'inspect';
  computeHover();
  game.tool = tool;
  if (hover?.cell) setActive(hover.cell.b, true);
});

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  modeHeld = modeOf(e);
  if (drag) drag.area = e.shiftKey || game.fill === 'area';
  const key = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && (key === 'z' || key === 'y')) {
    e.preventDefault();
    if (key === 'y' || e.shiftKey) redo(); else undo();
    return;
  }
  switch (key) {
    case 'v': A.pickColorway(game.styleId, (game.variant + 1) % STYLES[game.styleId].variants.length); break;
    case 'b': A.setTool('build'); break;
    case 'x': A.setTool('erase'); break;
    case 'p': A.setTool('paint'); break;
    case 'i': A.setTool('inspect'); break;
    case 'f': A.toggleCutaway(); break;
    case 'u': A.toggleUnderground(); break;
    case 'o': A.toggleIsolate(); break;
    case 'z': frame(); break;
    case 'n': neighborhood(); break;
    case 'r': A.stackFloor(); break;
    case 'q': case '[': setWorkLevel(game.workLevel - 1); break;
    case 'e': case ']': setWorkLevel(game.workLevel + 1); break;
    case 'pageup': { e.preventDefault(); const top = activeB()?.bbox.y1 ?? 0; setCut(game.cutLevel === null ? top : game.cutLevel + 1 > top ? null : game.cutLevel + 1); break; }
    case 'pagedown': { e.preventDefault(); const top = activeB()?.bbox.y1 ?? 0; setCut((game.cutLevel === null ? top : game.cutLevel) - 1); break; }
    case 'c': setCut(null); break;
    case 'tab': e.preventDefault(); cycle(e.shiftKey ? -1 : 1); break;
    case ' ': e.preventDefault(); A.setSpeed(game.speed ? 0 : 1); break;
    case 'h': ui.toggleHelp(); break;
    case '1': case '2': case '3': case '4': case '5': A.setFill([null, 'plot', 'block', 'line', 'area'][+key - 1]); break;
    case '-': case '_': case '=': case '+': {
      const sizes = [1, 3, 5, 7], i = Math.max(0, Math.min(3, sizes.indexOf(game.brushSize) + (key === '-' || key === '_' ? -1 : 1)));
      game.brushSize = sizes[i];
      ui.refreshPalette();
      ui.toast(`Map brush ${sizes[i]}×${sizes[i]}`);
      break;
    }
    case 'escape':
      if (drag) { endDrag(); down = null; break; } // cancel the drag, keep the tool
      A.setTool('inspect'); ui.closeAll(); break;
  }
});
addEventListener('keyup', (e) => { modeHeld = modeOf(e); if (drag) drag.area = e.shiftKey || game.fill === 'area'; });

// ---------- boot ----------
if (!load()) { initCity(DEFAULT_LAYOUT); applyClassic(city); }
world.setTerrain(city);
refreshEggs(false);
world.setDepth(city.minY);
updateStops();
{
  const all = [...city.buildings.values()];
  const aurora = all.find((B) => city.names.get(B.id) === 'The Aurora');
  const tallest = all.filter((B) => !B.park).sort((a, b) => b.bbox.y1 - a.bbox.y1)[0];
  const pickId = city.buildings.has(game.activeId) ? game.activeId : (aurora || tallest || all[0])?.id || 0;
  game.activeId = 0;
  setActive(pickId);
}
applyQuality();
if (activeB()) frame(); else { game.hood = false; neighborhood(); }
if (tween) tween.dur = 0.01;
setTimeout(() => ui.toast('Welcome! Pick a style, a colorway and a block on the left, then click the plots to build.'), 600);

const clock = new THREE.Clock();
let uiTimer = 0, popTimer = 0, saveTimer = 0, loadingShown = false;
const perf = { t: -4, frames: 0 };
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const simDt = dt * Math.min(game.speed, 4);

  const pending = cityR.pending;
  cityR.process(pending > 40 ? 40 : 22);
  terrainR.process();
  const loading = document.getElementById('loading');
  if (pending > 8 && !loadingShown) { loading.classList.remove('hidden'); loadingShown = true; }
  if (loadingShown) { loading.textContent = `Building the city… ${pending} chunks left`; if (!pending) { loading.classList.add('hidden'); loadingShown = false; } }

  const dDay = (dt * game.speed) / DAY_SECONDS;
  let income = 0;
  for (const B of city.buildings.values()) income += B.stats.income;
  if (!game.sandbox) game.money += income * dDay;
  game.time += dDay;
  if (game.time >= 1) { game.time -= 1; game.day++; ui.toast(`Day ${game.day} — your city earned ${fmt(income)} yesterday`, 'good', 'sun'); }

  if (tween) {
    tween.t = Math.min(1, tween.t + dt / tween.dur);
    const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, k);
    controls.target.lerpVectors(tween.t0, tween.t1, k);
    if (tween.t >= 1) tween = null;
  }
  controls.update();

  world.update(dt, simDt, game.time, camera);
  cityR.setNight(world.night);
  cityR.updateView(camera.position, { cutaway: game.cutaway, underground: game.underground, cutLevel: game.cutLevel, isolate: game.isolate, hood: game.hood });
  cityR.update(simDt);
  effects.update(dt, world.night, { activeId: game.activeId, interior: game.cutaway && !game.hood });
  const interior = !game.hood;
  people.update(simDt, { above: interior && (game.cutaway || game.cutLevel !== null), below: interior && (game.cutaway || game.underground), cutLevel: game.cutLevel });

  computeHover();
  updateOverlays(modeHeld);

  if ((uiTimer -= dt) < 0) { uiTimer = 0.3; ui.refresh(); }
  if ((popTimer -= dt * game.speed) < 0) { popTimer = DAY_SECONDS / 24; people.populate(city, activeB(), game.time); }
  if ((saveTimer -= dt) < 0) { saveTimer = 10; save(); }

  if (!quality.autoChecked && !pending) {
    perf.t += dt; perf.frames++;
    if (perf.t > 6) {
      quality.autoChecked = true;
      if (perf.frames / perf.t < 22 && quality.high) { quality.high = false; applyQuality(); ui.toast('Switched to Fast mode for smoother frame rates — toggle it in the top bar'); }
    }
  }
  if (quality.high && !game.underground && game.cutLevel === null) composer.render();
  else renderer.render(scene, camera);
}
animate();
