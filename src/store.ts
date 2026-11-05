// Persistent state (localStorage) and shareable links (URL hash).
import { PRESETS, presetById } from './presets';
import { isChannelId, isVideoId, withId } from './feeds';
import { MODES } from './types';
import type { AudioMode, Feed, FeedDef, Mode, State } from './types';

const KEY = 'livewall:v1';
const MAX_FEEDS = 36;

export const feedsFromPreset = (id: string): Feed[] => (presetById(id) ?? PRESETS[0]!).feeds.map(withId);

function defaults(): State {
  const first = PRESETS[0]!;
  return {
    mode: 'wall',
    preset: first.id,
    feeds: feedsFromPreset(first.id),
    audio: 'hover',
    volume: 80,
    tour: false,
    tourSecs: 15,
  };
}

const b64 = {
  enc: (s: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(s)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  dec: (s: string) =>
    new TextDecoder().decode(
      Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    ),
};

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

function sanitizeFeeds(raw: unknown): FeedDef[] {
  if (!Array.isArray(raw)) return [];
  const out: FeedDef[] = [];
  for (const f of raw.slice(0, MAX_FEEDS)) {
    if (!isRecord(f) || typeof f.t !== 'string') continue;
    const t = f.t.slice(0, 60);
    if (isChannelId(f.ch)) out.push({ t, ch: f.ch });
    else if (isVideoId(f.v)) out.push({ t, v: f.v });
  }
  return out;
}

/** Turn untrusted JSON (storage or URL) into a valid State. */
export function sanitize(raw: unknown): State {
  const d = defaults();
  if (!isRecord(raw)) return d;
  const feeds = sanitizeFeeds(raw.feeds);
  const presetId = typeof raw.preset === 'string' ? raw.preset : '';
  const preset = presetId === 'custom' || presetById(presetId) ? presetId : d.preset;
  return {
    mode: MODES.includes(raw.mode as Mode) ? (raw.mode as Mode) : d.mode,
    preset,
    feeds: feeds.length ? feeds.map(withId) : preset !== 'custom' ? feedsFromPreset(preset) : d.feeds,
    audio: (raw.audio as AudioMode) === 'click' ? 'click' : 'hover',
    volume: Math.min(100, Math.max(0, Number(raw.volume) || d.volume)),
    tour: raw.tour === true,
    tourSecs: Math.min(300, Math.max(3, Number(raw.tourSecs) || d.tourSecs)),
  };
}

export function load(): State {
  // A shared link wins over saved state.
  try {
    const m = location.hash.match(/[#&]s=([\w-]+)/);
    if (m?.[1]) return sanitize({ ...(JSON.parse(b64.dec(m[1])) as object), preset: 'custom' });
  } catch {
    /* fall through to saved state */
  }
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return defaults();
  }
}

const slimFeeds = (feeds: Feed[]): FeedDef[] =>
  feeds.map((f) => (f.ch ? { t: f.t, ch: f.ch } : { t: f.t, v: f.v! }));

export function save(state: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, feeds: slimFeeds(state.feeds) }));
  } catch {
    /* storage unavailable (private mode, quota) — not fatal */
  }
}

export function shareLink(state: State): string {
  const url = new URL(location.href);
  url.hash = `s=${b64.enc(JSON.stringify({ mode: state.mode, audio: state.audio, feeds: slimFeeds(state.feeds) }))}`;
  return url.toString();
}
