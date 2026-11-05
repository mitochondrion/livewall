// Feed helpers: identity, URLs, and parsing whatever the user pastes.

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Stable identity of what a feed points at. */
export const feedKey = (f) => (f.ch ? `ch:${f.ch}` : `v:${f.v}`);

export const feedUrl = (f) =>
  f.ch
    ? `https://www.youtube.com/channel/${f.ch}/live`
    : `https://www.youtube.com/watch?v=${f.v}`;

/** Embed URL for the IFrame API. */
export function embedSrc(f, origin) {
  const p = new URLSearchParams({
    enablejsapi: '1',
    autoplay: '1',
    mute: '1',
    controls: '0',
    playsinline: '1',
    rel: '0',
    iv_load_policy: '3',
    modestbranding: '1',
    fs: '0',
    disablekb: '1',
  });
  if (origin && origin !== 'null') p.set('origin', origin);
  if (f.ch) {
    p.set('channel', f.ch);
    return `https://www.youtube.com/embed/live_stream?${p}`;
  }
  p.set('loop', '1');
  p.set('playlist', f.v);
  return `https://www.youtube.com/embed/${f.v}?${p}`;
}

const VID = /^[\w-]{11}$/;
const CHAN = /^UC[\w-]{22}$/;

/**
 * Accepts a watch/live/embed/shorts/youtu.be URL, a /channel/UC… URL,
 * a bare video ID, or a bare channel ID.
 * Returns {v} | {ch} | {error}.
 */
export function parseSource(raw) {
  const s = (raw || '').trim();
  if (!s) return { error: 'Paste a YouTube URL or ID' };
  if (CHAN.test(s)) return { ch: s };
  if (VID.test(s)) return { v: s };

  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return { error: 'Not a URL or YouTube ID' };
  }
  const host = u.hostname.replace(/^(www|m)\./, '');

  if (host === 'youtu.be') {
    const id = u.pathname.slice(1, 12);
    if (VID.test(id)) return { v: id };
  }
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const v = u.searchParams.get('v');
    if (v && VID.test(v)) return { v };
    const ch = u.searchParams.get('channel');
    if (ch && CHAN.test(ch)) return { ch };
    const vm = u.pathname.match(/^\/(?:live|embed|shorts|v)\/([\w-]{11})(?:\/|$)/);
    if (vm) return { v: vm[1] };
    const cm = u.pathname.match(/^\/channel\/(UC[\w-]{22})/);
    if (cm) return { ch: cm[1] };
    if (u.pathname.startsWith('/@') || u.pathname.startsWith('/c/')) {
      return {
        error:
          '@handles can’t be embedded. Use the channel ID (UC…): on the channel page, About → Share → Copy channel ID.',
      };
    }
  }
  return { error: 'Couldn’t find a video or channel ID in that' };
}

/** What to show in the editor's source box. */
export const sourceText = (f) => f.ch || f.v;
