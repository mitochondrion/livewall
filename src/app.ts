import { $ } from './dom';
import { PRESETS } from './presets';
import { load, save, shareLink, feedsFromPreset } from './store';
import { uid, feedKey, parseSource, isParseError, sourceText } from './feeds';
import { gridPlan, spotlightPlan, crtPlan } from './layout';
import { Tile } from './tile';
import { MODES } from './types';
import type { AudioMode, Feed, Mode, Plan } from './types';

const wall = $('#wall');
const bar = $('#bar');
const state = load();
const tiles = new Map<string, Tile>(); // feed.id → Tile

let soundUnlocked = false; // flips on the first user gesture (browser autoplay policy)
let muted = false;
let hoverId: string | null = null;
let pinId: string | null = null;
let heroId: string | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | undefined;
let tourTimer: ReturnType<typeof setInterval> | undefined;

const MODE_NAMES: Record<Mode, string> = {
  wall: 'Wall',
  spotlight: 'Spotlight',
  crt: 'CRT store window',
  cctv: 'Security desk',
  zen: 'Minimal · move to the top edge for controls',
};

// ───────────────────────── noise texture (static / no signal) ─────────────────────────
(() => {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  if (!g) return;
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
const handlers = { hover: onHover, leave: onLeave, click: onClickTile };

/** Reconcile tiles with state.feeds. Never reparents a live iframe. */
function syncTiles(): void {
  const feeds = state.feeds;
  const wanted = new Set(feeds.map((f) => f.id));
  const spare = [...tiles.values()].filter((t) => !wanted.has(t.feed.id));
  for (const f of feeds) {
    const existing = tiles.get(f.id);
    if (existing) {
      existing.update(f);
      continue;
    }
    // Same stream under a new id (e.g. switching presets)? Reuse the tile, don't reload.
    const i = spare.findIndex((t) => feedKey(t.feed) === feedKey(f));
    const [reused] = i >= 0 ? spare.splice(i, 1) : [];
    if (reused) {
      tiles.delete(reused.feed.id);
      reused.update(f);
      tiles.set(f.id, reused);
    } else {
      tiles.set(f.id, new Tile(f, wall, handlers));
    }
  }
  for (const t of spare) {
    tiles.delete(t.feed.id);
    t.destroy();
  }
  if (pinId && !tiles.has(pinId)) pinId = null;
  if (hoverId && !tiles.has(hoverId)) hoverId = null;
  if (!heroId || !tiles.has(heroId)) heroId = state.feeds[0]?.id ?? null;
}

// ───────────────────────── layout ─────────────────────────
function makePlan(n: number, W: number, H: number): Plan {
  switch (state.mode) {
    case 'spotlight':
      return spotlightPlan(
        n,
        W,
        H,
        Math.max(
          0,
          state.feeds.findIndex((f) => f.id === heroId),
        ),
      );
    case 'crt':
      return crtPlan(n, W, H * 0.95); // leave room for the bottom padding
    default:
      return gridPlan(n, W, H);
  }
}

function layout(): void {
  const feeds = state.feeds;
  const n = feeds.length;
  document.body.dataset.mode = state.mode;
  document.body.dataset.count = String(n);
  if (!n) return;

  const plan = makePlan(n, wall.clientWidth, wall.clientHeight);
  const crt = state.mode === 'crt';
  const s = wall.style;
  s.gridTemplateColumns = plan.colTemplate ?? `repeat(${plan.cols}, 1fr)`;
  s.gridTemplateRows = crt ? 'none' : `repeat(${plan.rows}, minmax(0, 1fr))`;
  s.gridAutoRows = crt ? 'auto' : '';
  s.width = plan.width ? `${plan.width}px` : '';

  feeds.forEach((f, i) => {
    const t = tiles.get(f.id);
    const c = plan.cells[i];
    if (!t || !c) return;
    t.el.style.gridRow = c.rowSpan ? `${c.row} / span ${c.rowSpan}` : `${c.row}`;
    t.el.style.gridColumn = `${c.col} / span ${c.colSpan ?? 1}`;
    t.el.dataset.skin = String(i % 4);
    t.setCam(i);
    t.el.classList.toggle('hero', f.id === heroId);
  });
}

// ───────────────────────── audio ─────────────────────────
function targetId(): string | null {
  if (muted || !soundUnlocked) return null;
  if (state.audio === 'hover' && hoverId) return hoverId;
  if (pinId) return pinId;
  if (state.mode === 'spotlight') return heroId;
  return null;
}

function applyAudio(): void {
  const t = targetId();
  for (const [id, tile] of tiles) {
    tile.setActive(id === t);
    tile.player.fadeTo(id === t ? state.volume : 0);
  }
  updateChrome();
}

function onHover(id: string): void {
  clearTimeout(hoverTimer);
  hoverId = id;
  applyAudio();
}

function onLeave(id: string): void {
  clearTimeout(hoverTimer);
  // Small grace period so crossing the gap between tiles doesn't blip the audio.
  hoverTimer = setTimeout(() => {
    if (hoverId === id) hoverId = null;
    applyAudio();
  }, 180);
}

function onClickTile(id: string): void {
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

function pinIndex(i: number): void {
  const n = state.feeds.length;
  const f = state.feeds[((i % n) + n) % n];
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

function currentIndex(): number {
  const id = targetId() ?? pinId ?? heroId;
  return Math.max(
    0,
    state.feeds.findIndex((f) => f.id === id),
  );
}

function unlockSound(): void {
  if (soundUnlocked) return;
  soundUnlocked = true;
  $('#gate').classList.add('gone');
  applyAudio();
}
addEventListener('pointerdown', unlockSound, { capture: true });
addEventListener('keydown', unlockSound, { capture: true });

// ───────────────────────── tour ─────────────────────────
function restartTour(): void {
  clearInterval(tourTimer);
  if (!state.tour) return;
  tourTimer = setInterval(() => {
    if (!hoverId) pinIndex(currentIndex() + 1);
  }, state.tourSecs * 1000);
}

// ───────────────────────── chrome (toolbar, toasts) ─────────────────────────
function updateChrome(): void {
  for (const b of $('#modes').children)
    b.classList.toggle('on', (b as HTMLElement).dataset.mode === state.mode);
  for (const b of $('#audio-mode').children)
    b.classList.toggle('on', (b as HTMLElement).dataset.audio === state.audio);
  $('#tour').classList.toggle('on', state.tour);
  $('#mute').textContent = muted || state.volume === 0 ? '🔇' : '🔊';
  $<HTMLInputElement>('#volume').value = String(state.volume);
  $<HTMLSelectElement>('#preset').value = state.preset;
  document.body.classList.toggle('pinned', !!pinId);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function toastFor(id: string | null): void {
  const f = state.feeds.find((x) => x.id === id);
  toast(f ? `🔊 ${f.t}` : '🔈 Sound follows the mouse');
}

// Toolbar auto-hide: show on mouse movement, hide after idle.
let idleTimer: ReturnType<typeof setTimeout> | undefined;
function wake(e?: PointerEvent): void {
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
const persist = (): void => save(state);

function setMode(m: Mode): void {
  state.mode = m;
  if (m === 'spotlight' && pinId) heroId = pinId;
  layout();
  applyAudio();
  persist();
  toast(MODE_NAMES[m]);
}

function setPreset(id: string): void {
  state.preset = id;
  if (id !== 'custom') state.feeds = feedsFromPreset(id);
  rebuild();
}

function rebuild(): void {
  syncTiles();
  layout();
  renderRows();
  applyAudio();
  persist();
}

function customised(): void {
  if (state.preset !== 'custom') {
    state.preset = 'custom';
    $<HTMLSelectElement>('#preset').value = 'custom';
  }
}

// ───────────────────────── editor drawer ─────────────────────────
const rowsEl = $('#rows');

function iconButton(txt: string, label: string, fn: () => void): HTMLButtonElement {
  const b = Object.assign(document.createElement('button'), { textContent: txt, title: label });
  b.setAttribute('aria-label', label);
  b.addEventListener('click', fn);
  return b;
}

function renderRow(f: Feed, i: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row';
  const num = Object.assign(document.createElement('span'), { className: 'num', textContent: String(i + 1) });
  const title = Object.assign(document.createElement('input'), {
    value: f.t,
    className: 'r-title',
    maxLength: 60,
  });
  title.setAttribute('aria-label', 'Title');
  const src = Object.assign(document.createElement('input'), {
    value: sourceText(f),
    className: 'r-src',
    spellcheck: false,
  });
  src.setAttribute('aria-label', 'YouTube URL or ID');

  title.addEventListener('change', () => {
    f.t = title.value.trim() || 'Untitled';
    tiles.get(f.id)?.paint();
    customised();
    persist();
  });

  src.addEventListener('change', () => {
    const r = parseSource(src.value);
    if (isParseError(r)) {
      src.classList.add('bad');
      return toast(r.error);
    }
    src.classList.remove('bad');
    const next: Feed = { id: f.id, t: f.t, ...r };
    state.feeds[i] = next;
    src.value = sourceText(next);
    tiles.get(f.id)?.update(next);
    customised();
    persist();
  });

  const move = (d: number) => () => {
    const j = i + d;
    const a = state.feeds[i];
    const b = state.feeds[j];
    if (!a || !b) return;
    state.feeds[i] = b;
    state.feeds[j] = a;
    customised();
    layout();
    renderRows();
    persist();
  };

  row.append(
    num,
    title,
    src,
    iconButton('↑', 'Move up', move(-1)),
    iconButton('↓', 'Move down', move(1)),
    iconButton('✕', 'Remove', () => {
      state.feeds.splice(i, 1);
      customised();
      rebuild();
    }),
  );
  return row;
}

function renderRows(): void {
  rowsEl.replaceChildren(...state.feeds.map(renderRow));
}

$('#add').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('#add-src');
  const r = parseSource(input.value);
  if (isParseError(r)) return toast(r.error);
  if (state.feeds.length >= 36) return toast('That’s plenty. 36 is the max.');
  state.feeds.push({ id: uid(), t: `Feed ${state.feeds.length + 1}`, ...r });
  input.value = '';
  customised();
  rebuild();
  rowsEl.lastElementChild?.querySelector<HTMLInputElement>('.r-title')?.select();
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
$('#reset').addEventListener('click', () =>
  setPreset(state.preset === 'custom' ? PRESETS[0]!.id : state.preset),
);

function drawer(open?: boolean): void {
  document.body.classList.toggle('drawer-open', open ?? !document.body.classList.contains('drawer-open'));
  wake();
}
$('#edit').addEventListener('click', () => drawer());
$('#drawer-close').addEventListener('click', () => drawer(false));

// ───────────────────────── wiring ─────────────────────────
const presetSel = $<HTMLSelectElement>('#preset');
for (const p of PRESETS) presetSel.append(new Option(p.name, p.id));
presetSel.append(new Option('Custom', 'custom'));
presetSel.addEventListener('change', () => setPreset(presetSel.value));

const isMode = (s: string | undefined): s is Mode => MODES.includes(s as Mode);

$('#modes').addEventListener('click', (e) => {
  const m = (e.target as HTMLElement).dataset.mode;
  if (isMode(m)) setMode(m);
});

function setAudioMode(a: AudioMode): void {
  state.audio = a;
  hoverId = null;
  applyAudio();
  persist();
  toast(a === 'hover' ? 'Sound follows the mouse · click to pin' : 'Sound changes only when you click');
}
$('#audio-mode').addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).dataset.audio;
  if (a === 'hover' || a === 'click') setAudioMode(a);
});

$<HTMLInputElement>('#volume').addEventListener('input', (e) => {
  state.volume = Number((e.target as HTMLInputElement).value);
  if (state.volume > 0) muted = false;
  applyAudio();
  persist();
});

function toggleMute(): void {
  muted = !muted;
  applyAudio();
  toast(muted ? '🔇 Muted' : '🔊 Sound on');
}

function toggleTour(): void {
  state.tour = !state.tour;
  restartTour();
  updateChrome();
  persist();
  toast(state.tour ? `Tour on · every ${state.tourSecs}s` : 'Tour off');
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

$('#mute').addEventListener('click', toggleMute);
$('#tour').addEventListener('click', toggleTour);
$('#fs').addEventListener('click', toggleFullscreen);
$('#help-btn').addEventListener('click', () => $<HTMLDialogElement>('#help').showModal());
$('#gate').addEventListener('click', unlockSound);

const MODE_KEYS: Record<string, Mode> = { w: 'wall', s: 'spotlight', c: 'crt', v: 'cctv', z: 'zen' };

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target as HTMLElement;
  if (target.closest('input, select, textarea, dialog')) {
    if (e.key === 'Escape') target.blur();
    return;
  }
  const k = e.key.toLowerCase();
  const mode = MODE_KEYS[k];
  if (mode) setMode(mode);
  else if (k === 'm') toggleMute();
  else if (k === 't') toggleTour();
  else if (k === 'f') toggleFullscreen();
  else if (k === 'e') drawer();
  else if (k === 'h') {
    document.body.classList.toggle('bar-locked-off');
    toast(
      document.body.classList.contains('bar-locked-off') ? 'Toolbar hidden · H to show' : 'Toolbar shown',
    );
  } else if (k === '?') $<HTMLDialogElement>('#help').showModal();
  else if (k === 'arrowright') pinIndex(currentIndex() + 1);
  else if (k === 'arrowleft') pinIndex(currentIndex() - 1);
  else if (k === '0') {
    pinId = null;
    applyAudio();
    toast('Unpinned');
  } else if (/^[1-9]$/.test(k)) pinIndex(Number(k) - 1);
  else if (k === 'escape') drawer(false);
});

let resizeTimer: ReturnType<typeof setTimeout> | undefined;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layout, 60);
});

// CCTV clock
setInterval(() => {
  if (state.mode !== 'cctv') return;
  const now = new Date();
  const ts = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`;
  for (const t of tiles.values()) t.setTimestamp(ts);
}, 1000);

// ───────────────────────── boot ─────────────────────────
if (location.protocol === 'file:') {
  toast('Serve this over http (npm run dev): YouTube refuses embeds from file://');
}
if (matchMedia('(pointer: coarse)').matches) state.audio = 'click'; // no hover on touch screens
syncTiles();
layout();
renderRows();
updateChrome();
restartTour();
