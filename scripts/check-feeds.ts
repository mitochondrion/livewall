// Checks every built-in feed against YouTube and reports which are live.
//
//   npm run check
//
// Needs Node 20+ and normal internet access. For each feed it asks:
//   1. oEmbed: does the video/channel exist and allow embedding?
//   2. the watch / channel-live page: is it live right now?
// It scrapes public pages, so treat a result as a strong hint, not gospel.
import { PRESETS } from '../src/presets';
import type { FeedDef } from '../src/types';

type Status = 'LIVE' | 'OFFLINE' | 'ENDED' | 'BLOCKED' | 'DEAD' | 'ERROR';
type Result = [feed: FeedDef, status: Status, note: string];

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const headers = { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', cookie: 'SOCS=CAI; CONSENT=YES+1' };

const feeds = new Map<string, FeedDef>();
for (const p of PRESETS) for (const f of p.feeds) feeds.set(f.ch ?? f.v, f);

async function get(url: string): Promise<{ status: number; text: string }> {
  const r = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  return { status: r.status, text: await r.text() };
}

async function check(f: FeedDef): Promise<[Status, string]> {
  try {
    if (f.ch) {
      const page = await get(`https://www.youtube.com/channel/${f.ch}/live`);
      if (page.status === 404) return ['DEAD', 'channel not found'];
      const live = /"isLiveNow":true/.test(page.text);
      const vid = page.text.match(
        /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/,
      )?.[1];
      return live && vid
        ? ['LIVE', `now on ${vid}`]
        : ['OFFLINE', 'channel exists but is not live right now'];
    }
    const oe = await get(
      `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${f.v}`,
    );
    if (oe.status === 404 || oe.status === 400) return ['DEAD', 'video removed / bad ID'];
    if (oe.status === 401) return ['BLOCKED', 'embedding disabled or private'];
    const title = (JSON.parse(oe.text) as { title: string }).title;
    const page = await get(`https://www.youtube.com/watch?v=${f.v}`);
    return /"isLiveNow":true/.test(page.text)
      ? ['LIVE', title]
      : ['ENDED', `${title} (exists, but not live)`];
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
