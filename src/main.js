import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CELL, MAX_LEVEL, DAY_SECONDS, MODULES, STYLES, TERRAIN, levelName } from './catalog.js';
import { TerrainRenderer, planTerrain, GROUND_Y, tk } from './terrain.js';
import { Layout, DEFAULT_LAYOUT } from './layout.js';
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
  tool: 'build', moduleId: 'lobby', styleId: 'deco', variant: 0, brush: 'module', terrainId: 'grass', brushSize: 3,
  cutaway: false, underground: false, isolate: false, cutLevel: null, workLevel: 0, activeId: 0, hood: false,
  eggsFound: new Set(), layoutCfg: { ...DEFAULT_LAYOUT }, city: null,
};
const activeB = () => city.buildings.get(game.activeId);
const tallest = () => [...city.buildings.values()].filter((B) => !B.park).sort((a, b) => b.bbox.y1 - a.bbox.y1 || b.cells.length - a.cells.length)[0];

function initCity(cfg) {
  game.layoutCfg = { ...DEFAULT_LAYOUT, ...cfg };
  const layout = new Layout(game.layoutCfg);
  city = new City(layout);
  game.city = city;
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

function placeAt(x, y, z, mode) {
  const mod = MODULES[game.moduleId];
  let placed = 0, err = null, last = null;
  for (const [tx, tz] of fillArea(x, z, mode)) {
    const e = city.canPlace(tx, y, tz, game.moduleId);
    if (e) { if (!mode || e !== 'Space occupied') err = e; continue; }
    if (!game.sandbox && game.money < mod.cost) { err = `Not enough funds — ${mod.name} costs ${fmt(mod.cost)}`; break; }
    city.set(tx, y, tz, game.moduleId, game.styleId, game.variant);
    if (city.terrain.has(tk(tx, tz))) city.setTerrain(tx, tz, null); // level land cover makes way
    if (!game.sandbox) game.money -= mod.cost;
    placed++;
    last = [tx, y, tz];
    if (mode && placed % 25 === 0) city.recompute();
  }
  if (placed) {
    afterEdit(last);
    if (mode) ui.toast(`Built ${placed} × ${mod.name} on ${levelName(y)}${game.sandbox ? '' : ' for ' + fmt(placed * mod.cost)}`);
  } else if (err) ui.toast(err, 'bad');
}

function eraseAt(x, y, z, mode) {
  let removed = 0, refund = 0, err = null;
  for (const [tx, tz] of fillArea(x, z, mode)) {
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

function paintAt(x, y, z, mode) {
  let n = 0;
  for (const [tx, tz] of fillArea(x, z, mode)) {
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

// Map blocks: apply a planned terrain edit (see planTerrain).
function applyTerrain(h) {
  const { out, cost } = h.plan;
  if (!out.length) return ui.toast(h.err, 'bad');
  if (!game.sandbox && game.money < cost) return ui.toast(`Not enough funds — that costs ${fmt(cost)}`, 'bad');
  for (const { kind, x, z, rec } of out) {
    if (kind === 'land') city.setLand(x, z, rec);
    else if (kind === 'road') city.setRoad(x, z, rec);
    else city.setTerrain(x, z, rec);
  }
  if (!game.sandbox) game.money -= cost;
  city.recompute();
  world.setTerrain(city);
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
  setTool: (t) => { game.tool = t; if (t !== 'inspect') ui.inspect(null); ui.refreshPalette(); },
  pickColorway: (s, v) => { game.styleId = s; game.variant = v; ui.refreshPalette(); },
  setModule: (m) => { game.moduleId = m; game.brush = 'module'; game.tool = 'build'; ui.refreshPalette(); },
  setTerrain: (t) => { game.terrainId = t; game.brush = 'terrain'; game.tool = 'build'; ui.refreshPalette(); },
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
  frame, neighborhood, cycle, setWorkLevel, setCut, stackFloor, restyleAll, newCity,
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
  if (game.tool === 'build' && game.brush === 'terrain') { hover = terrainHover(); return; }
  const filter = game.isolate ? (c) => c.b === game.activeId : game.cutLevel !== null ? (c) => c.b !== game.activeId || c.y <= game.cutLevel : null;
  const hit = pickCity(raycaster.ray, city, {
    minLevel: game.underground ? Math.min(-6, city.minY - 1, game.workLevel) : 0,
    maxLevel: MAX_LEVEL, workLevel: game.workLevel, filter,
  });
  if (!hit) return;
  const cell = hit.kind === 'cell' ? city.get(hit.ix, hit.iy, hit.iz) : null;
  if (game.tool === 'build') {
    if (hit.kind === 'cell' && !hit.n.some((v) => v)) return;
    const t = [hit.ix + hit.n[0], hit.iy + hit.n[1], hit.iz + hit.n[2]];
    hover = { t, err: city.canPlace(t[0], t[1], t[2], game.moduleId), cell };
  } else if (cell) {
    hover = { t: [hit.ix, hit.iy, hit.iz], cell, err: game.tool === 'erase' ? city.canRemove(hit.ix, hit.iy, hit.iz) : null };
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
  const plan = planTerrain(city, game.terrainId, cells, gx, gz, r);
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
    for (const [a, b] of hover.cells) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); z0 = Math.min(z0, b); z1 = Math.max(z1, b); }
    const color = hover.err ? 0xff4d4d : TOOL_COLORS.build;
    ghost.visible = true;
    ghost.material.color.setHex(color);
    ghostEdges.material.color.setHex(color);
    ghost.position.set(L.wx((x0 + x1 + 1) / 2), Math.max(hover.y, GROUND_Y) + 0.3, L.wz((z0 + z1 + 1) / 2));
    ghost.scale.set((x1 - x0 + 1) * CELL + 0.1, 0.6, (z1 - z0 + 1) * CELL + 0.1);
    const price = game.sandbox ? 'Free in sandbox' : hover.plan.cost ? fmt(hover.plan.cost) : 'Free';
    ui.tooltip(pointer.x, pointer.y, `<b>${icon(def.icon)} ${def.name}</b> · ${n} block${n === 1 ? '' : 's'}<small>${hover.err ? icon('ban') + ' ' + hover.err : price}</small>`);
    return;
  }
  const [x, y, z] = hover.t;
  const lot = L.lotAt(x, z);
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
  if (mode && game.tool !== 'inspect') {
    const cells = fillArea(x, z, mode);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [a, b] of cells) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); z0 = Math.min(z0, b); z1 = Math.max(z1, b); }
    ghost.position.set(L.wx((x0 + x1 + 1) / 2), y * CELL + 2, L.wz((z0 + z1 + 1) / 2));
    ghost.scale.set((x1 - x0 + 1) * CELL + 0.1, CELL + 0.1, (z1 - z0 + 1) * CELL + 0.1);
  } else {
    ghost.position.set(L.wx(x) + 2, y * CELL + 2, L.wz(z) + 2);
    ghost.scale.setScalar(CELL + 0.12);
  }
  const m = MODULES[game.moduleId];
  const area = mode === 'block' ? ' (whole city block)' : mode ? ' (whole plot)' : '';
  let html;
  if (game.tool === 'build') {
    html = `<b>${icon(m.icon)} ${m.name}</b> → ${levelName(y)}${area}<small>${hover.err && !mode ? icon('ban') + ' ' + hover.err : game.sandbox ? 'Free in sandbox' : fmt(m.cost) + (mode ? ' each' : '')}</small>`;
  } else if (hover.cell) {
    const cm = MODULES[hover.cell.m], bn = city.names.get(hover.cell.b) || '';
    const verb = { erase: 'Remove', paint: `Paint ${STYLES[game.styleId].name} · ${STYLES[game.styleId].variants[game.variant].name}`, inspect: 'Click to select building' }[game.tool];
    html = `<b>${icon(cm.icon)} ${cm.name}</b> · ${levelName(y)}<small>${bn}</small><small>${hover.err ? icon('ban') + ' ' + hover.err : verb + area}</small>`;
  }
  ui.tooltip(pointer.x, pointer.y, html);
}

let down = null, modeHeld = null;
const modeOf = (e) => (e.shiftKey ? (e.ctrlKey || e.metaKey ? 'block' : 'plot') : null);
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, btn: e.button }; });
canvas.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; modeHeld = modeOf(e); });
canvas.addEventListener('pointerleave', () => { pointer = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), btn = down.btn;
  down = null;
  if (moved > 5 || btn !== 0) return;
  pointer = { x: e.clientX, y: e.clientY };
  modeHeld = modeOf(e);
  computeHover();
  if (!hover) return;
  if (hover.terrain) return applyTerrain(hover);
  const [x, y, z] = hover.t, mode = modeOf(e);
  if (e.altKey && hover.cell) {
    game.moduleId = hover.cell.m; game.styleId = hover.cell.s; game.variant = hover.cell.v || 0; game.tool = 'build'; game.brush = 'module';
    ui.expandFor(hover.cell.m); ui.openStyle(hover.cell.s); ui.refreshPalette();
    return ui.toast(`Picked ${MODULES[hover.cell.m].name} · ${STYLES[hover.cell.s].name}`);
  }
  if (game.tool === 'build') placeAt(x, y, z, mode);
  else if (game.tool === 'erase') eraseAt(x, y, z, mode);
  else if (game.tool === 'paint') paintAt(x, y, z, mode);
  else { setActive(hover.cell.b); ui.inspect(hover.cell); }
});
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
  switch (e.key.toLowerCase()) {
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
    case 'r': stackFloor(); break;
    case 'q': case '[': setWorkLevel(game.workLevel - 1); break;
    case 'e': case ']': setWorkLevel(game.workLevel + 1); break;
    case 'pageup': { e.preventDefault(); const top = activeB()?.bbox.y1 ?? 0; setCut(game.cutLevel === null ? top : game.cutLevel + 1 > top ? null : game.cutLevel + 1); break; }
    case 'pagedown': { e.preventDefault(); const top = activeB()?.bbox.y1 ?? 0; setCut((game.cutLevel === null ? top : game.cutLevel) - 1); break; }
    case 'c': setCut(null); break;
    case 'tab': e.preventDefault(); cycle(e.shiftKey ? -1 : 1); break;
    case ' ': e.preventDefault(); A.setSpeed(game.speed ? 0 : 1); break;
    case 'h': ui.toggleHelp(); break;
    case 'escape': A.setTool('inspect'); ui.closeAll(); break;
  }
});
addEventListener('keyup', (e) => { modeHeld = modeOf(e); });

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
