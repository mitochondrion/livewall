// Checks every built-in feed against YouTube and reports which are live.
//
//   npm run check
//
// Needs Node 20+ and internet access. It only reads public pages that aren't
// behind YouTube's "confirm you're not a bot" wall, which watch pages often are
// from cloud/datacenter IPs:
//
//   channel feed  → the channel's /streams tab (then its home tab), looking for
//                   a video carrying the LIVE badge.
//   video feed    → oEmbed (does it exist, is embedding allowed, who owns it?),
//                   then the owner's /streams tab (or a live-only search for the
//                   ID) to see if that video is live.
//
// It scrapes ytInitialData, so treat a result as a strong hint, not gospel.
import { PRESETS } from '../src/presets';
import type { FeedDef } from '../src/types';

type Status = 'LIVE' | 'OFFLINE' | 'ENDED' | 'BLOCKED' | 'DEAD' | 'ERROR';
type Result = [feed: FeedDef, status: Status, note: string];
type Lockup = { id: string; live: boolean; title: string };

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const headers = { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', cookie: 'SOCS=CAI' };

const feeds = new Map<string, FeedDef>();
for (const p of PRESETS) for (const f of p.feeds) feeds.set(f.ch ?? f.v, f);

async function get(url: string): Promise<{ status: number; text: string }> {
  const r = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  return { status: r.status, text: await r.text() };
}

const isObj = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null;

/** Every video tile on a channel or search page, in either of YouTube's two renderers. */
export function lockups(html: string): Lockup[] {
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  const out: Lockup[] = [];
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!isObj(o)) return;
    const lv = o.lockupViewModel;
    if (isObj(lv) && typeof lv.contentId === 'string') {
      const s = JSON.stringify(lv);
      const title = /"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)*)"/.exec(s);
      out.push({ id: lv.contentId, live: s.includes('BADGE_STYLE_LIVE'), title: title?.[1] ?? '' });
    }
    const vr = o.videoRenderer;
    if (isObj(vr) && typeof vr.videoId === 'string') {
      const s = JSON.stringify(vr);
      const title = /"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/.exec(s);
      out.push({ id: vr.videoId, live: s.includes('LIVE_NOW'), title: title?.[1] ?? '' });
    }
    Object.values(o).forEach(walk);
  };
  if (m?.[1]) walk(JSON.parse(m[1]) as unknown);
  return out;
}

/** Live videos on a channel, given its base URL (…/channel/UC… or …/@handle). */
async function liveOn(base: string): Promise<Lockup[] | null> {
  let found = false;
  for (const tab of ['/streams', '']) {
    const page = await get(base + tab);
    if (page.status === 404) continue;
    found = true;
    const live = lockups(page.text).filter((l) => l.live);
    if (live.length) return live;
  }
  return found ? [] : null;
}

async function check(f: FeedDef): Promise<[Status, string]> {
  try {
    if (f.ch) {
      const live = await liveOn(`https://www.youtube.com/channel/${f.ch}`);
      if (!live) return ['DEAD', 'channel not found'];
      const [first] = live;
      if (!first) return ['OFFLINE', 'channel exists but is not live right now'];
      const more = live.length > 1 ? ` (+${live.length - 1} more live; embed picks one)` : '';
      return ['LIVE', `${first.id} ${first.title}${more}`];
    }
    const oe = await get(
      `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${f.v}`,
    );
    if (oe.status === 404 || oe.status === 400) return ['DEAD', 'video removed / bad ID'];
    if (oe.status === 401) return ['BLOCKED', 'embedding disabled'];
    if (oe.status === 403) return ['BLOCKED', 'private video'];
    const meta = JSON.parse(oe.text) as { title?: string; author_url?: string };
    // A removed video can still answer 200 with an empty body.
    if (!meta.title || !meta.author_url) return ['DEAD', 'video removed (empty oEmbed)'];
    // Busy webcam channels run dozens of streams, more than one /streams page
    // shows, so fall back to a live-filtered search for the ID itself.
    const live = (await liveOn(meta.author_url)) ?? [];
    const search = async () =>
      lockups(
        (await get(`https://www.youtube.com/results?sp=EgJAAQ%253D%253D&search_query=%22${f.v}%22`)).text,
      );
    return live.some((l) => l.id === f.v) || (await search()).some((l) => l.id === f.v && l.live)
      ? ['LIVE', meta.title]
      : ['ENDED', `${meta.title} (exists, but not live)`];
  } catch (e) {
    return ['ERROR', e instanceof Error ? e.message : String(e)];
  }
}

const results: Result[] = [];
const queue = [...feeds.values()];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const [status, note] = await check(f);
      results.push([f, status, note]);
    }
  }),
);

const order: Status[] = ['LIVE', 'OFFLINE', 'ENDED', 'BLOCKED', 'DEAD', 'ERROR'];
results.sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]) || a[0].t.localeCompare(b[0].t));
for (const [f, status, note] of results) {
  console.log(`${status.padEnd(8)} ${f.t.padEnd(28)} ${(f.ch ?? f.v).padEnd(24)} ${note}`);
}
const bad = results.filter((r) => r[1] !== 'LIVE');
console.log(`\n${results.length - bad.length}/${results.length} live.`);
if (bad.length)
  console.log('Fix stale entries in src/presets.ts (or just edit them in the app’s Feeds panel).');
process.exitCode = bad.length ? 1 : 0;
