import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/presets';
import { isChannelId, isVideoId } from '../src/feeds';
import { sanitize } from '../src/store';

describe('presets', () => {
  it('have unique ids and valid, non-duplicated feeds', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(p.feeds.length).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const f of p.feeds) {
        expect(f.ch ? isChannelId(f.ch) : isVideoId(f.v), `${p.id}: ${f.t}`).toBe(true);
        const k = f.ch ?? f.v;
        expect(seen.has(k), `${p.id} repeats ${f.t}`).toBe(false);
        seen.add(k);
      }
    }
  });
});

describe('sanitize', () => {
  it('falls back to defaults for garbage', () => {
    for (const bad of [null, undefined, 42, 'x', []]) {
      const s = sanitize(bad);
      expect(s.mode).toBe('wall');
      expect(s.feeds.length).toBeGreaterThan(0);
    }
  });

  it('drops invalid feeds and clamps values', () => {
    const s = sanitize({
      mode: 'nope',
      preset: 'custom',
      audio: 'click',
      volume: 500,
      tourSecs: 1,
      feeds: [
        { t: 'ok', v: 'dQw4w9WgXcQ' },
        { t: 'bad', v: 'short' },
        { v: 'dQw4w9WgXcQ' },
        null,
        { t: 'x'.repeat(200), ch: 'UCoMdktPbSTixAyNGwb-UYkQ' },
      ],
    });
    expect(s.mode).toBe('wall');
    expect(s.audio).toBe('click');
    expect(s.volume).toBe(100);
    expect(s.tourSecs).toBe(3);
    expect(s.feeds.map((f) => f.t.length)).toEqual([2, 60]);
    expect(new Set(s.feeds.map((f) => f.id)).size).toBe(2);
  });

  it('uses the preset feeds when a known preset has no custom feeds', () => {
    const p = PRESETS[1]!;
    expect(sanitize({ preset: p.id }).feeds).toHaveLength(p.feeds.length);
  });
});
