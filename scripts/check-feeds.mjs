#!/usr/bin/env node
// Checks every built-in feed against YouTube and reports which are live.
//
//   npm run check
//
// Needs Node 18+ and normal internet access. For each feed it asks:
//   1. oEmbed: does the video/channel exist and allow embedding?
//   2. the watch / channel-live page: is it live right now?
// It scrapes public pages, so treat a result as a strong hint, not gospel.

import { PRESETS } from '../site/js/presets.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const headers = { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', cookie: 'SOCS=CAI; CONSENT=YES+1' };

const seen = new Map();
for (const p of PRESETS) for (const f of p.feeds) seen.set(f.ch || f.v, { ...f, sets: [...(seen.get(f.ch || f.v)?.sets || []), p.id] });

async function get(url) {
  const r = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  return { status: r.status, url: r.url, text: await r.text() };
}

async function check(f) {
  try {
    if (f.ch) {
      const page = await get(`https://www.youtube.com/channel/${f.ch}/live`);
      if (page.status === 404) return ['DEAD', 'channel not found'];
      const live = /"isLiveNow":true/.test(page.text);
      const vid = page.text.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1];
      if (live && vid) return ['LIVE', `now on ${vid}`];
      return ['OFFLINE', 'channel exists but is not live right now'];
    }
    const oe = await get(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${f.v}`);
    if (oe.status === 404 || oe.status === 400) return ['DEAD', 'video removed / bad ID'];
    if (oe.status === 401) return ['BLOCKED', 'embedding disabled or private'];
    const title = JSON.parse(oe.text).title;
    const page = await get(`https://www.youtube.com/watch?v=${f.v}`);
    if (/"isLiveNow":true/.test(page.text)) return ['LIVE', title];
    return ['ENDED', `${title} (exists, but not live)`];
  } catch (e) {
    return ['ERROR', e.message];
  }
}

const rows = [...seen.values()];
const results = [];
const queue = [...rows];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const f = queue.shift();
      results.push([f, ...(await check(f))]);
    }
  }),
);

const order = ['LIVE', 'OFFLINE', 'ENDED', 'BLOCKED', 'DEAD', 'ERROR'];
results.sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]) || a[0].t.localeCompare(b[0].t));
for (const [f, status, note] of results) {
  console.log(`${status.padEnd(8)} ${f.t.padEnd(28)} ${(f.ch || f.v).padEnd(24)} ${note}`);
}
const bad = results.filter((r) => r[1] !== 'LIVE');
console.log(`\n${results.length - bad.length}/${results.length} live.`);
if (bad.length) console.log('Fix stale entries in site/js/presets.js (or just edit them in the app’s Feeds panel).');
process.exitCode = bad.length ? 1 : 0;
