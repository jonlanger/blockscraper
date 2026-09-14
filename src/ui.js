// DOM panels: brush, style + colorway accordions, block accordions, building info, view bar,
// overflow menu, New City dialog, easter egg list, tooltip and toasts.
import { MODULES, STYLES, STYLE_ORDER, CATEGORIES, TERRAIN, TERRAIN_GROUPS, levelName, rangeText } from './catalog.js';
import { MAP_SIZES, BLOCK_SIZES, PLOT_SIZES } from './layout.js';
import { EGG_INFO } from './eggs.js';
import { icon, hydrateIcons } from './icons.js';

export const fmt = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const swatch = (p, cls = 'sw') => `<span class="${cls}" style="background:linear-gradient(135deg, ${hex(p.wall)} 0 45%, ${hex(p.trim)} 45% 60%, ${hex(p.accent)} 60% 75%, ${hex(p.glass)} 75%)"></span>`;
const CHEV = icon('chevron-down', 'chev');
const narrow = (px) => matchMedia(`(max-width: ${px}px)`).matches;

export function initUI(game, A) {
  const $ = (id) => document.getElementById(id);
  const open = { style: game.styleId, cats: new Set([MODULES[game.moduleId].cats[0]]), map: new Set(['cover']) };
  hydrateIcons();

  // ---------- styles accordion ----------
  const stylesEl = $('styles');
  function renderStyles() {
    stylesEl.innerHTML = '';
    for (const id of STYLE_ORDER) {
      const s = STYLES[id], isOpen = open.style === id, isSel = game.styleId === id;
      const acc = document.createElement('div');
      acc.className = 'acc' + (isOpen ? ' open' : '') + (isSel ? ' sel' : '');
      const head = document.createElement('button');
      head.className = 'acc-head';
      head.innerHTML = `${swatch(s.variants[isSel ? game.variant : 0])}<span class="acc-title"><b>${s.name}</b><small>${isSel ? icon('check') + ' ' + s.variants[game.variant].name : s.blurb}</small></span>${CHEV}`;
      head.onclick = () => { open.style = isOpen ? null : id; renderStyles(); };
      acc.append(head);
      if (isOpen) {
        const body = document.createElement('div');
        body.className = 'acc-body';
        body.innerHTML = `<p class="blurb">${s.blurb}. Choose a colorway to paint with:</p>`;
        const grid = document.createElement('div');
        grid.className = 'variants';
        s.variants.forEach((p, i) => {
          const b = document.createElement('button');
          b.className = 'variant' + (isSel && game.variant === i ? ' on' : '');
          b.innerHTML = `${swatch(p, 'sw big')}<span>${p.name}</span>`;
          b.onclick = () => A.pickColorway(id, i);
          grid.append(b);
        });
        body.append(grid);
        acc.append(body);
      }
      stylesEl.append(acc);
    }
  }

  // ---------- blocks accordion ----------
  const blocksEl = $('blocks');
  function renderBlocks() {
    blocksEl.innerHTML = '';
    for (const cat of CATEGORIES) {
      const mods = Object.values(MODULES).filter((m) => m.cats[0] === cat.id || (cat.id !== 'transit' && m.cats.includes(cat.id) && m.id !== 'core') || (m.id === 'core' && cat.id === 'floors'));
      const isOpen = open.cats.has(cat.id);
      const hasSel = game.brush === 'module' && mods.some((m) => m.id === game.moduleId);
      const acc = document.createElement('div');
      acc.className = 'acc' + (isOpen ? ' open' : '') + (hasSel ? ' sel' : '');
      const head = document.createElement('button');
      head.className = 'acc-head';
      head.innerHTML = `<span class="cat-ic">${icon(cat.icon)}</span><span class="acc-title"><b>${cat.name}</b><small>${mods.length} blocks${hasSel ? ' · ' + icon('check') + ' ' + MODULES[game.moduleId].name : ''}</small></span>${CHEV}`;
      head.onclick = () => { if (isOpen) open.cats.delete(cat.id); else open.cats.add(cat.id); renderBlocks(); };
      acc.append(head);
      if (isOpen) {
        const body = document.createElement('div');
        body.className = 'acc-body modules';
        for (const m of mods) {
          const b = document.createElement('button');
          b.className = 'module' + (game.brush === 'module' && m.id === game.moduleId ? ' on' : '');
          b.innerHTML = `<span class="mi">${icon(m.icon)}</span><span class="mt"><b>${m.name}</b><small>${m.desc}</small></span>
            <span class="mc">${fmt(m.cost)}<small>${m.topper ? 'roof' : m.park ? 'park' : rangeText(m)}${m.income ? ' · +' + fmt(m.income) : ''}</small></span>`;
          b.onclick = () => { A.setModule(m.id); if (narrow(900)) setDrawer(false); };
          body.append(b);
        }
        acc.append(body);
      }
      blocksEl.append(acc);
    }
  }

  // ---------- map blocks accordion ----------
  const mapEl = $('mapblocks');
  function renderMap() {
    mapEl.innerHTML = '';
    for (const grp of TERRAIN_GROUPS) {
      const items = Object.values(TERRAIN).filter((t) => t.group === grp.id);
      const isOpen = open.map.has(grp.id), sel = game.brush === 'terrain' && TERRAIN[game.terrainId].group === grp.id;
      const acc = document.createElement('div');
      acc.className = 'acc' + (isOpen ? ' open' : '') + (sel ? ' sel' : '');
      const head = document.createElement('button');
      head.className = 'acc-head';
      head.innerHTML = `<span class="cat-ic">${icon(grp.icon)}</span><span class="acc-title"><b>${grp.name}</b><small>${sel ? icon('check') + ' ' + TERRAIN[game.terrainId].name : grp.blurb}</small></span>${CHEV}`;
      head.onclick = () => { if (isOpen) open.map.delete(grp.id); else open.map.add(grp.id); renderMap(); };
      acc.append(head);
      if (isOpen) {
        const body = document.createElement('div');
        body.className = 'acc-body modules';
        for (const t of items) {
          const b = document.createElement('button');
          b.className = 'module' + (game.brush === 'terrain' && game.terrainId === t.id ? ' on' : '');
          const per = !t.cost ? '' : ['raise', 'lower', 'hill', 'mesa'].includes(t.id) ? 'per m' : 'per block';
          b.innerHTML = `<span class="mi">${icon(t.icon)}</span><span class="mt"><b>${t.name}</b><small>${t.desc}</small></span>
            <span class="mc">${t.cost ? fmt(t.cost) : 'Free'}<small>${per}</small></span>`;
          b.onclick = () => { A.setTerrain(t.id); if (narrow(900)) setDrawer(false); };
          body.append(b);
        }
        acc.append(body);
      }
      mapEl.append(acc);
    }
  }

  function renderBrush() {
    if (game.brush === 'terrain') {
      const t = TERRAIN[game.terrainId];
      $('brush').innerHTML = `<span class="cat-ic">${icon(t.icon)}</span><span class="acc-title"><b>${t.name}</b><small>Map block · ${game.brushSize}×${game.brushSize} brush</small></span>`;
      return;
    }
    const s = STYLES[game.styleId], p = s.variants[game.variant], m = MODULES[game.moduleId];
    $('brush').innerHTML = `${swatch(p, 'sw big')}<span class="acc-title"><b>${icon(m.icon)} ${m.name}</b><small>${s.name} · ${p.name}</small></span>`;
  }

  // ---------- drawers, menu & popovers ----------
  const menu = $('menu'), moreBtn = $('btn-more');
  const setMenu = (on) => { menu.classList.toggle('hidden', !on); moreBtn.setAttribute('aria-expanded', on); moreBtn.classList.toggle('on', on); };
  const setDrawer = (on) => { $('palette').classList.toggle('open', on); $('btn-drawer').classList.toggle('on', on); };
  const popover = (id) => {
    const el = $(id), show = el.classList.contains('hidden');
    for (const p of ['eggs', 'help']) $(p).classList.add('hidden');
    if (show) { $('info').classList.remove('open'); el.classList.remove('hidden'); }
    return show;
  };
  moreBtn.onclick = (e) => { e.stopPropagation(); setMenu(menu.classList.contains('hidden')); };
  menu.onclick = (e) => { if (e.target.closest('button')) setMenu(false); };
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.menu-wrap')) setMenu(false); });
  $('btn-drawer').onclick = () => setDrawer(!$('palette').classList.contains('open'));
  $('btn-info').onclick = () => { for (const p of ['eggs', 'help']) $(p).classList.add('hidden'); $('info').classList.toggle('open'); };
  $('info-close').onclick = () => $('info').classList.remove('open');

  // ---------- controls ----------
  document.querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => A.setTool(b.dataset.tool)));
  document.querySelectorAll('[data-speed]').forEach((b) => (b.onclick = () => A.setSpeed(+b.dataset.speed)));
  document.querySelectorAll('[data-brush]').forEach((b) => (b.onclick = () => A.setBrushSize(+b.dataset.brush)));
  $('v-cut').onclick = () => A.toggleCutaway();
  $('v-ug').onclick = () => A.toggleUnderground();
  $('v-iso').onclick = () => A.toggleIsolate();
  $('v-frame').onclick = () => A.frame();
  $('v-hood').onclick = () => A.neighborhood();
  $('wl-up').onclick = () => A.setWorkLevel(game.workLevel + 1);
  $('wl-down').onclick = () => A.setWorkLevel(game.workLevel - 1);
  $('cut').oninput = (e) => A.setCut(+e.target.value >= +e.target.max ? null : +e.target.value);
  $('btn-stack').onclick = () => A.stackFloor();
  $('btn-restyle').onclick = () => A.restyleAll();
  $('btn-prev').onclick = () => A.cycle(-1);
  $('btn-next').onclick = () => A.cycle(1);
  $('btn-sandbox').onclick = () => A.toggleSandbox();
  $('btn-quality').onclick = () => A.toggleQuality();
  $('btn-help').onclick = () => popover('help');
  $('b-name').oninput = (e) => A.rename(e.target.value);

  // ---------- new city dialog ----------
  const modal = $('newcity');
  const fillSelect = (el, obj, cur, label = (v) => v.label || v) => { el.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k == cur ? 'selected' : ''}>${label(v)}</option>`).join(''); };
  $('btn-new').onclick = () => {
    const cfg = game.layoutCfg;
    fillSelect($('nc-map'), MAP_SIZES, cfg.map);
    fillSelect($('nc-lots'), BLOCK_SIZES, cfg.lots);
    fillSelect($('nc-plot'), PLOT_SIZES, cfg.plot);
    modal.classList.remove('hidden');
  };
  $('nc-cancel').onclick = () => modal.classList.add('hidden');
  modal.querySelectorAll('.tpl').forEach((b) => (b.onclick = () => { modal.querySelectorAll('.tpl').forEach((x) => x.classList.toggle('on', x === b)); }));
  $('nc-go').onclick = () => {
    const tpl = modal.querySelector('.tpl.on')?.dataset.tpl || 'classic';
    modal.classList.add('hidden');
    A.newCity({ template: tpl, map: $('nc-map').value, lots: +$('nc-lots').value, plot: $('nc-plot').value });
  };

  // ---------- easter eggs ----------
  const eggTotal = Object.keys(EGG_INFO).length;
  $('btn-eggs').onclick = () => {
    $('eggs').innerHTML = `<h4>${icon('egg')} Easter eggs · ${game.eggsFound.size}/${eggTotal}</h4>` + Object.entries(EGG_INFO).map(([k, e]) => game.eggsFound.has(k)
      ? `<div class="egg found"><b>${icon('sparkles')} ${e.name}</b><small>${e.hint}</small></div>`
      : `<div class="egg"><b>??? </b><small>${e.hint.replace(/[a-z]/gi, (ch, i) => (i % 3 === 0 ? ch : '•'))}</small></div>`).join('') + '<small class="egg-tip">Hints are partly hidden — experiment with neighbors!</small>';
    popover('eggs');
  };

  // ---------- toasts & tooltip ----------
  const toastsEl = $('toasts');
  function toast(msg, kind = '', ic = null) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    if (ic) el.innerHTML = icon(ic);
    el.append(msg);
    toastsEl.append(el);
    while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
    setTimeout(() => el.classList.add('out'), kind === 'egg' ? 4200 : 2600);
    setTimeout(() => el.remove(), kind === 'egg' ? 4700 : 3100);
  }
  const tipEl = $('tooltip');
  function tooltip(x, y, html) {
    if (!html) { tipEl.hidden = true; return; }
    tipEl.hidden = false;
    tipEl.innerHTML = html;
    tipEl.style.left = Math.min(x + 18, innerWidth - tipEl.offsetWidth - 8) + 'px';
    tipEl.style.top = Math.min(y + 18, innerHeight - tipEl.offsetHeight - 8) + 'px';
  }

  function refreshPalette() {
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === game.tool));
    renderBrush();
    renderStyles();
    renderBlocks();
    renderMap();
    document.querySelectorAll('[data-brush]').forEach((b) => b.classList.toggle('on', +b.dataset.brush === game.brushSize));
    $('v-cut').classList.toggle('on', game.cutaway);
    $('v-ug').classList.toggle('on', game.underground);
    $('v-iso').classList.toggle('on', game.isolate);
    $('v-hood').classList.toggle('on', game.hood);
    $('wl').textContent = levelName(game.workLevel);
    const city = game.city, B = city?.buildings.get(game.activeId);
    const cut = $('cut');
    cut.min = Math.min(-4, city ? city.minY : -4);
    cut.max = Math.max(12, B ? B.bbox.y1 + 1 : 12);
    cut.value = game.cutLevel === null ? cut.max : game.cutLevel;
    $('cut-l').textContent = game.cutLevel === null ? 'All' : levelName(game.cutLevel);
    for (const [id, on] of [['btn-sandbox', game.sandbox], ['btn-quality', game.highDetail]]) { $(id).classList.toggle('on', !!on); $(id).setAttribute('aria-checked', !!on); }
    $('eggs-count').textContent = `${game.eggsFound.size}/${eggTotal}`;
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === game.speed));
  }
  function expandFor(moduleId) { open.cats.add(MODULES[moduleId].cats[0]); }

  const STAR = icon('star', 'filled'), STAR_OFF = icon('star');
  function refresh() {
    const city = game.city;
    let income = 0, pop = 0;
    for (const B of city.buildings.values()) { income += B.stats.income; pop += B.stats.pop; }
    $('s-money').textContent = game.sandbox ? '∞' : fmt(game.money);
    $('s-income').textContent = '+' + fmt(income);
    $('s-pop').textContent = pop.toLocaleString('en-US');
    const h = Math.floor(game.time * 24), mi = Math.floor(((game.time * 24) % 1) * 6) * 10;
    $('s-day').textContent = `Day ${game.day} · ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;

    const B = city.buildings.get(game.activeId), nameEl = $('b-name');
    const list = [...city.buildings.values()];
    const stars = $('b-stars');
    const setStars = (html) => { if (stars.dataset.v !== html) { stars.dataset.v = html; stars.innerHTML = html; } };
    if (!B) {
      if (document.activeElement !== nameEl) nameEl.value = '';
      $('b-lot').textContent = `${list.length} buildings & parks`;
      setStars('');
      $('b-rows').innerHTML = '<div><span>No building selected</span><b></b></div>';
      $('b-warn').innerHTML = '';
      $('b-next').textContent = 'Place any block, or double-click a building to select it.';
      return;
    }
    const s = B.stats;
    if (document.activeElement !== nameEl) nameEl.value = city.names.get(B.id) || '';
    const w = B.bbox.x1 - B.bbox.x0 + 1, d = B.bbox.z1 - B.bbox.z0 + 1;
    $('b-lot').textContent = `${B.park ? 'Park' : 'Building'} · ${w * 4}×${d * 4} m`;
    setStars(B.park ? icon('trees') : STAR.repeat(s.stars) + STAR_OFF.repeat(5 - s.stars));
    const rows = B.park ? [
      ['Footprint', `${w} × ${d} blocks`], ['Blocks', s.blocks], ['Visitors', s.pop],
    ] : [
      ['Height', s.topFloor < 0 ? '—' : `${levelName(s.topFloor)} · ${(s.topFloor + 1) * 4} m`],
      ['Deepest basement', s.bottom < 0 ? `${levelName(s.bottom)} · ${-s.bottom * 4} m` : '—'],
      ['Footprint', `${w} × ${d} blocks`],
      ['Height limit', `Floor ${s.heightLimit}`],
      ['Foundation piles', s.piles],
      ['Blocks', s.blocks],
      ['Population', s.pop.toLocaleString('en-US')],
      ['Income / day', fmt(s.income)],
      ['Transit', s.modeCount ? ['subway', 'rail', 'bus'].filter((k) => s.modes[k]).map((k) => k[0].toUpperCase() + k.slice(1)).join(' · ') + (s.modeCount >= 2 ? ' · HUB' : '') : 'None'],
      ['Income bonus', `+${Math.round((s.bonus - 1) * 100)}%${s.nearPark ? ' (park & nature views)' : ''}`],
    ];
    $('b-rows').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    const eggs = [...new Set(B.cells.map((c) => city.eggs.get(`${c.x},${c.y},${c.z}`)?.type).filter(Boolean))];
    $('b-warn').innerHTML = s.warnings.map((x) => `<div>${icon('triangle-alert')}<span>${x}</span></div>`).join('') + (eggs.length ? `<div class="eggline">${icon('sparkles')}<span>${eggs.length} easter egg effect${eggs.length > 1 ? 's' : ''} active here</span></div>` : '');
    $('b-next').textContent = s.next;
  }

  function inspect(c) {
    const el = $('inspect');
    if (!c) { el.innerHTML = ''; return; }
    const m = MODULES[c.m];
    el.innerHTML = `<h4>${icon(m.icon)} ${m.name}</h4>
      <div class="rows"><div><span>Level</span><b>${levelName(c.y)}</b></div>
      ${m.park ? '' : `<div><span>Style</span><b>${STYLES[c.s].name}</b></div><div><span>Colorway</span><b>${STYLES[c.s].variants[c.v || 0].name}</b></div>`}
      <div><span>Status</span><b class="${c.ok ? 'good' : 'bad'}">${c.ok ? 'Operating' : 'Unreachable'}</b></div>
      ${m.income ? `<div><span>Income</span><b>${fmt(m.income)}/day</b></div>` : ''}
      ${m.pop ? `<div><span>Occupants</span><b>${m.pop}</b></div>` : ''}</div>
      <p>${m.desc}</p>`;
  }

  const closeAll = () => { setMenu(false); for (const p of ['eggs', 'help']) $(p).classList.add('hidden'); $('info').classList.remove('open'); setDrawer(false); modal.classList.add('hidden'); };

  refreshPalette();
  return { refresh, refreshPalette, toast, tooltip, inspect, expandFor, openStyle: (id) => { open.style = id; }, toggleHelp: () => popover('help'), closeAll };
}
