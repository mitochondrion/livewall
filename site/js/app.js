import { PRESETS, presetById } from './presets.js';
import { MODES, load, save, shareLink, feedsFromPreset } from './store.js';
import { uid, feedKey, feedUrl, parseSource, sourceText } from './feeds.js';
import { Player } from './yt.js';
import { gridPlan, spotlightPlan, crtPlan } from './layout.js';

const $ = (s, r = document) => r.querySelector(s);
const wall = $('#wall');
const state = load();

let soundUnlocked = false; // flips on the first user gesture (browser autoplay policy)
let muted = false;
let hoverId = null;
let pinId = null;
let heroId = null;
let hoverTimer = null;
let tourTimer = null;

// ───────────────────────── noise texture (static / no signal) ─────────────────────────
(() => {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  document.documentElement.style.setProperty('--noise', `url(${c.toDataURL()})`);
})();

// ───────────────────────── tiles ─────────────────────────
const TILE_HTML = `
  <div class="crt-body">
    <div class="screen"><div class="static"></div><div class="status"><b>NO SIGNAL</b><small></small></div><div class="glass"></div></div>
    <div class="deco"><i class="grille"></i><i class="knob k1"></i><i class="knob k2"></i><i class="led"></i></div>
  </div>
  <div class="hit"></div>
  <div class="hud"><span class="cam"></span><span class="rec">● REC</span><span class="ts"></span></div>
  <div class="label"><span class="eq"><i></i><i></i><i></i></span><span class="name"></span></div>
  <div class="tools">
    <a class="t-open" target="_blank" rel="noopener" title="Open on YouTube">↗</a>
    <button class="t-reload" title="Reload this feed">⟳</button>
  </div>`;

const tiles = new Map(); // feed.id → Tile

class Tile {
  constructor(feed) {
    this.feed = feed;
    this.el = document.createElement('div');
    this.el.className = 'tile';
    this.el.dataset.status = 'loading';
    this.el.innerHTML = TILE_HTML;
    this.screen = $('.screen', this.el);
    wall.append(this.el);
    this.player = new Player(this.screen, feed, (s, detail) => this.setStatus(s, detail));
    this.bind();
    this.paint();
  }

  bind() {
    const el = this.el;
    el.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && onHover(this.feed.id));
    el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && onLeave(this.feed.id));
    el.addEventListener('click', (e) => {
      if (e.target.closest('.tools')) return;
      onClickTile(this.feed.id);
    });
    $('.t-reload', el).addEventListener('click', () => this.player.reload());
  }

  paint() {
    $('.name', this.el).textContent = this.feed.t;
    const a = $('.t-open', this.el);
    a.href = feedUrl(this.feed);
  }

  update(feed) {
    const changed = feedKey(feed) !== feedKey(this.feed);
    this.feed = feed;
    this.paint();
    if (changed) this.player.setFeed(feed);
  }

  setStatus(s, detail) {
    this.el.dataset.status = s;
    $('.status small', this.el).textContent = s === 'offline' && detail !== 'No signal' ? detail || '' : '';
  }

  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    this.el.classList.toggle('audio', on);
    if (on) {
      this.el.classList.remove('blip');
      void this.el.offsetWidth; // restart the animation
      this.el.classList.add('blip');
    }
  }

  destroy() {
    this.player.destroy();
    this.el.remove();
  }
}

/** Reconcile tiles with state.feeds. Never reparents a live iframe. */
function syncTiles() {
  const feeds = state.feeds;
  const wanted = new Set(feeds.map((f) => f.id));
  const spare = [...tiles.values()].filter((t) => !wanted.has(t.feed.id));
  for (const f of feeds) {
    const existing = tiles.get(f.id);
    if (existing) {
      existing.update(f);
      continue;
    }
    // Same stream under a new id (e.g. switching presets)? Reuse it, don't reload.
    const i = spare.findIndex((t) => feedKey(t.feed) === feedKey(f));
    if (i >= 0) {
      const [t] = spare.splice(i, 1);
      tiles.delete(t.feed.id);
      t.update(f);
      tiles.set(f.id, t);
    } else {
      tiles.set(f.id, new Tile(f));
    }
  }
  for (const t of spare) {
    tiles.delete(t.feed.id);
    t.destroy();
  }
  if (!tiles.has(pinId)) pinId = null;
  if (!tiles.has(heroId)) heroId = feeds[0]?.id ?? null;
}

// ───────────────────────── layout ─────────────────────────
function layout() {
  const feeds = state.feeds;
  const n = feeds.length;
  document.body.dataset.mode = state.mode;
  document.body.dataset.count = n;
  if (!n) return;

  const W = wall.clientWidth;
  const H = wall.clientHeight;
  let plan;
  if (state.mode === 'spotlight') plan = spotlightPlan(n, W, H, Math.max(0, feeds.findIndex((f) => f.id === heroId)));
  else if (state.mode === 'crt') plan = crtPlan(n, W, H * 0.95);
  else plan = gridPlan(n, W, H);

  const s = wall.style;
  s.gridTemplateColumns = plan.colTemplate || `repeat(${plan.cols}, 1fr)`;
  s.gridTemplateRows = state.mode === 'crt' ? 'none' : `repeat(${plan.rows}, minmax(0, 1fr))`;
  s.gridAutoRows = state.mode === 'crt' ? 'auto' : '';
  s.width = plan.width ? `${plan.width}px` : '';

  feeds.forEach((f, i) => {
    const t = tiles.get(f.id);
    const c = plan.cells[i];
    t.index = i;
    t.el.style.gridRow = c.rowSpan ? `${c.row} / span ${c.rowSpan}` : `${c.row}`;
    t.el.style.gridColumn = `${c.col} / span ${c.colSpan || 1}`;
    t.el.dataset.skin = i % 4;
    $('.cam', t.el).textContent = `CAM ${String(i + 1).padStart(2, '0')}`;
    t.el.classList.toggle('hero', f.id === heroId);
  });
}

// ───────────────────────── audio ─────────────────────────
function targetId() {
  if (muted || !soundUnlocked) return null;
  if (state.audio === 'hover' && hoverId) return hoverId;
  if (pinId) return pinId;
  if (state.mode === 'spotlight') return heroId;
  return null;
}

function applyAudio() {
  const t = targetId();
  for (const [id, tile] of tiles) {
    tile.setActive(id === t);
    tile.player.fadeTo(id === t ? state.volume : 0);
  }
  updateChrome();
}

function onHover(id) {
  clearTimeout(hoverTimer);
  hoverId = id;
  applyAudio();
}
function onLeave(id) {
  clearTimeout(hoverTimer);
  // Small grace period so crossing the gap between tiles doesn't blip the audio.
  hoverTimer = setTimeout(() => {
    if (hoverId === id) hoverId = null;
    applyAudio();
  }, 180);
}
function onClickTile(id) {
  if (state.mode === 'spotlight' && id !== heroId) {
    heroId = id;
    pinId = id;
    layout();
  } else {
    pinId = pinId === id ? null : id;
    if (state.mode === 'spotlight' && pinId) heroId = pinId;
  }
  if (state.audio === 'click') hoverId = null;
  applyAudio();
  toastFor(pinId);
}

function pinIndex(i) {
  const f = state.feeds[(i + state.feeds.length) % state.feeds.length];
  if (!f) return;
  pinId = f.id;
  hoverId = null;
  if (state.mode === 'spotlight') {
    heroId = f.id;
    layout();
  }
  applyAudio();
  toastFor(pinId);
}
function currentIndex() {
  const id = targetId() || pinId || heroId;
  return Math.max(0, state.feeds.findIndex((f) => f.id === id));
}

function unlockSound() {
  if (soundUnlocked) return;
  soundUnlocked = true;
  $('#gate').classList.add('gone');
  applyAudio();
}
addEventListener('pointerdown', unlockSound, { capture: true });
addEventListener('keydown', unlockSound, { capture: true });

// ───────────────────────── tour ─────────────────────────
function restartTour() {
  clearInterval(tourTimer);
  if (!state.tour) return;
  tourTimer = setInterval(() => {
    if (!hoverId) pinIndex(currentIndex() + 1);
  }, state.tourSecs * 1000);
}

// ───────────────────────── chrome (toolbar, labels) ─────────────────────────
const bar = $('#bar');

function updateChrome() {
  for (const b of $('#modes').children) b.classList.toggle('on', b.dataset.mode === state.mode);
  for (const b of $('#audio-mode').children) b.classList.toggle('on', b.dataset.audio === state.audio);
  $('#tour').classList.toggle('on', state.tour);
  $('#mute').textContent = muted || state.volume === 0 ? '🔇' : '🔊';
  $('#volume').value = state.volume;
  $('#preset').value = state.preset;
  document.body.classList.toggle('pinned', !!pinId);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
function toastFor(id) {
  const f = state.feeds.find((x) => x.id === id);
  toast(f ? `🔊 ${f.t}` : '🔈 Sound follows the mouse');
}

// Toolbar auto-hide: show on mouse movement, hide after idle.
let idleTimer;
function wake(e) {
  const zen = state.mode === 'zen';
  const nearTop = !e || e.clientY < 48;
  document.body.classList.remove('idle');
  if (!zen || nearTop) document.body.classList.add('bar-on');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (bar.matches(':hover') || document.body.classList.contains('drawer-open')) return wake();
    document.body.classList.remove('bar-on');
    document.body.classList.add('idle');
  }, 2800);
}
addEventListener('pointermove', wake);
wake();

// ───────────────────────── mode / set / settings ─────────────────────────
function persist() {
  save(state);
}

function setMode(m) {
  if (!MODES.includes(m)) return;
  state.mode = m;
  if (m === 'spotlight' && pinId) heroId = pinId;
  layout();
  applyAudio();
  persist();
  toast({ wall: 'Wall', spotlight: 'Spotlight', crt: 'CRT store window', cctv: 'Security desk', zen: 'Minimal · move to the top edge for controls' }[m]);
}

function setPreset(id) {
  state.preset = id;
  if (id !== 'custom') state.feeds = feedsFromPreset(id);
  rebuild();
}

function rebuild() {
  syncTiles();
  layout();
  renderRows();
  applyAudio();
  persist();
}

function customised() {
  if (state.preset !== 'custom') {
    state.preset = 'custom';
    $('#preset').value = 'custom';
  }
}

// ───────────────────────── editor drawer ─────────────────────────
const rowsEl = $('#rows');
function renderRows() {
  rowsEl.replaceChildren();
  state.feeds.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    const num = Object.assign(document.createElement('span'), { className: 'num', textContent: i + 1 });
    const title = Object.assign(document.createElement('input'), { value: f.t, className: 'r-title', maxLength: 60 });
    title.setAttribute('aria-label', 'Title');
    const src = Object.assign(document.createElement('input'), { value: sourceText(f), className: 'r-src', spellcheck: false });
    src.setAttribute('aria-label', 'YouTube URL or ID');
    const btn = (txt, label, fn) => {
      const b = Object.assign(document.createElement('button'), { textContent: txt, title: label });
      b.setAttribute('aria-label', label);
      b.addEventListener('click', fn);
      return b;
    };

    title.addEventListener('change', () => {
      f.t = title.value.trim() || 'Untitled';
      tiles.get(f.id)?.paint();
      customised();
      persist();
    });
    src.addEventListener('change', () => {
      const r = parseSource(src.value);
      if (r.error) {
        src.classList.add('bad');
        return toast(r.error);
      }
      src.classList.remove('bad');
      delete f.ch;
      delete f.v;
      Object.assign(f, r);
      src.value = sourceText(f);
      tiles.get(f.id)?.update(f);
      customised();
      persist();
    });
    const move = (d) => () => {
      const j = i + d;
      if (j < 0 || j >= state.feeds.length) return;
      [state.feeds[i], state.feeds[j]] = [state.feeds[j], state.feeds[i]];
      customised();
      layout();
      renderRows();
      persist();
    };
    row.append(
      num,
      title,
      src,
      btn('↑', 'Move up', move(-1)),
      btn('↓', 'Move down', move(1)),
      btn('✕', 'Remove', () => {
        state.feeds.splice(i, 1);
        customised();
        rebuild();
      }),
    );
    rowsEl.append(row);
  });
}

$('#add').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#add-src');
  const r = parseSource(input.value);
  if (r.error) return toast(r.error);
  if (state.feeds.length >= 36) return toast('That’s plenty. 36 is the max.');
  state.feeds.push({ id: uid(), t: `Feed ${state.feeds.length + 1}`, ...r });
  input.value = '';
  customised();
  rebuild();
  rowsEl.lastElementChild?.querySelector('.r-title')?.select();
});

$('#share').addEventListener('click', async () => {
  const url = shareLink(state);
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    prompt('Copy this link', url);
  }
});
$('#reset').addEventListener('click', () => {
  setPreset(state.preset === 'custom' ? PRESETS[0].id : state.preset);
});

function drawer(open) {
  document.body.classList.toggle('drawer-open', open ?? !document.body.classList.contains('drawer-open'));
  wake();
}
$('#edit').addEventListener('click', () => drawer());
$('#drawer-close').addEventListener('click', () => drawer(false));

// ───────────────────────── wiring ─────────────────────────
const presetSel = $('#preset');
for (const p of PRESETS) presetSel.append(new Option(p.name, p.id));
presetSel.append(new Option('Custom', 'custom'));
presetSel.addEventListener('change', () => setPreset(presetSel.value));

$('#modes').addEventListener('click', (e) => e.target.dataset.mode && setMode(e.target.dataset.mode));
$('#audio-mode').addEventListener('click', (e) => {
  if (!e.target.dataset.audio) return;
  state.audio = e.target.dataset.audio;
  hoverId = null;
  applyAudio();
  persist();
  toast(state.audio === 'hover' ? 'Sound follows the mouse · click to pin' : 'Sound changes only when you click');
});
$('#volume').addEventListener('input', (e) => {
  state.volume = +e.target.value;
  if (state.volume > 0) muted = false;
  applyAudio();
  persist();
});
$('#mute').addEventListener('click', toggleMute);
$('#tour').addEventListener('click', toggleTour);
$('#fs').addEventListener('click', toggleFullscreen);
$('#help-btn').addEventListener('click', () => $('#help').showModal());
$('#gate').addEventListener('click', unlockSound);

function toggleMute() {
  muted = !muted;
  applyAudio();
  toast(muted ? '🔇 Muted' : '🔊 Sound on');
}
function toggleTour() {
  state.tour = !state.tour;
  restartTour();
  updateChrome();
  persist();
  toast(state.tour ? `Tour on · every ${state.tourSecs}s` : 'Tour off');
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input, select, textarea, dialog')) {
    if (e.key === 'Escape') e.target.blur?.();
    return;
  }
  const k = e.key.toLowerCase();
  const modeKeys = { w: 'wall', s: 'spotlight', c: 'crt', v: 'cctv', z: 'zen' };
  if (modeKeys[k]) setMode(modeKeys[k]);
  else if (k === 'm') toggleMute();
  else if (k === 't') toggleTour();
  else if (k === 'f') toggleFullscreen();
  else if (k === 'e') drawer();
  else if (k === 'h') {
    document.body.classList.toggle('bar-locked-off');
    toast(document.body.classList.contains('bar-locked-off') ? 'Toolbar hidden · H to show' : 'Toolbar shown');
  } else if (k === '?') $('#help').showModal();
  else if (k === 'arrowright') pinIndex(currentIndex() + 1);
  else if (k === 'arrowleft') pinIndex(currentIndex() - 1);
  else if (k === '0') {
    pinId = null;
    applyAudio();
    toast('Unpinned');
  } else if (/^[1-9]$/.test(k)) pinIndex(+k - 1);
  else if (k === 'escape') drawer(false);
});

let rz;
addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(layout, 60);
});

// CCTV clock
setInterval(() => {
  if (state.mode !== 'cctv') return;
  const now = new Date();
  const ts = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 8);
  for (const t of tiles.values()) $('.ts', t.el).textContent = ts;
}, 1000);

// ───────────────────────── boot ─────────────────────────
if (location.protocol === 'file:') {
  toast('Serve this over http (npm start): YouTube refuses embeds from file://');
}
if (matchMedia('(pointer: coarse)').matches) $('#audio-mode [data-audio=click]').click();
syncTiles();
layout();
renderRows();
updateChrome();
restartTour();
