// Persistent state (localStorage) and shareable links (URL hash).
import { PRESETS, presetById } from './presets.js';
import { uid } from './feeds.js';

const KEY = 'livewall:v1';

export const MODES = ['wall', 'spotlight', 'crt', 'cctv', 'zen'];

const clone = (feeds) => feeds.map((f) => ({ ...f, id: uid() }));

export const feedsFromPreset = (id) => clone((presetById(id) || PRESETS[0]).feeds);

function defaults() {
  return {
    mode: 'wall',
    preset: PRESETS[0].id, // or 'custom'
    feeds: feedsFromPreset(PRESETS[0].id),
    audio: 'hover', // 'hover' | 'click'
    volume: 80,
    tour: false,
    tourSecs: 15,
  };
}

const b64 = {
  enc: (s) =>
    btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))),
};

function sanitize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const feeds = Array.isArray(raw.feeds)
    ? raw.feeds
        .filter((f) => f && typeof f.t === 'string' && (/^UC[\w-]{22}$/.test(f.ch) || /^[\w-]{11}$/.test(f.v)))
        .slice(0, 36)
        .map((f) => ({ id: uid(), t: f.t.slice(0, 60), ...(f.ch ? { ch: f.ch } : { v: f.v }) }))
    : null;
  return {
    mode: MODES.includes(raw.mode) ? raw.mode : d.mode,
    preset: raw.preset === 'custom' || presetById(raw.preset) ? raw.preset : d.preset,
    feeds: feeds && feeds.length ? feeds : raw.preset && presetById(raw.preset) ? feedsFromPreset(raw.preset) : d.feeds,
    audio: raw.audio === 'click' ? 'click' : 'hover',
    volume: Math.min(100, Math.max(0, Number(raw.volume) || d.volume)),
    tour: !!raw.tour,
    tourSecs: Math.min(300, Math.max(3, Number(raw.tourSecs) || d.tourSecs)),
  };
}

export function load() {
  // A shared link wins over saved state.
  try {
    const m = location.hash.match(/[#&]s=([\w-]+)/);
    if (m) return sanitize({ preset: 'custom', ...JSON.parse(b64.dec(m[1])) });
  } catch {}
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return defaults();
  }
}

const slim = (s) => ({
  ...s,
  feeds: s.feeds.map(({ t, ch, v }) => (ch ? { t, ch } : { t, v })),
});

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(slim(state)));
  } catch {}
}

export function shareLink(state) {
  const { mode, audio, feeds } = slim(state);
  const url = new URL(location.href);
  url.hash = `s=${b64.enc(JSON.stringify({ mode, audio, feeds }))}`;
  return url.toString();
}
