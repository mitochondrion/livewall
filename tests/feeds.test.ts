import { describe, expect, it } from 'vitest';
import { embedSrc, feedKey, isParseError, parseSource } from '../src/feeds';

const CH = 'UCoMdktPbSTixAyNGwb-UYkQ';

describe('parseSource', () => {
  it.each([
    ['dQw4w9WgXcQ', { v: 'dQw4w9WgXcQ' }],
    [CH, { ch: CH }],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5', { v: 'dQw4w9WgXcQ' }],
    ['youtube.com/watch?v=dQw4w9WgXcQ', { v: 'dQw4w9WgXcQ' }],
    ['https://youtu.be/dQw4w9WgXcQ?si=x', { v: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', { v: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', { v: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', { v: 'dQw4w9WgXcQ' }],
    [`https://www.youtube.com/channel/${CH}`, { ch: CH }],
    [`https://www.youtube.com/channel/${CH}/live`, { ch: CH }],
    [`https://www.youtube.com/embed/live_stream?channel=${CH}`, { ch: CH }],
    ['  dQw4w9WgXcQ  ', { v: 'dQw4w9WgXcQ' }],
  ])('parses %s', (input, expected) => {
    expect(parseSource(input)).toEqual(expected);
  });

  it.each(['', '   ', 'not a url', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/'])(
    'rejects %j',
    (input) => {
      expect(isParseError(parseSource(input))).toBe(true);
    },
  );

  it('explains why @handles do not work', () => {
    const r = parseSource('https://www.youtube.com/@SkyNews');
    expect(isParseError(r) && r.error).toMatch(/channel ID/);
  });
});

describe('embedSrc', () => {
  it('uses live_stream for channels', () => {
    const u = new URL(embedSrc({ ch: CH }, 'https://x.test'));
    expect(u.pathname).toBe('/embed/live_stream');
    expect(u.searchParams.get('channel')).toBe(CH);
    expect(u.searchParams.get('mute')).toBe('1');
    expect(u.searchParams.get('enablejsapi')).toBe('1');
    expect(u.searchParams.get('origin')).toBe('https://x.test');
  });

  it('uses the video path for fixed videos and omits a null origin', () => {
    const u = new URL(embedSrc({ v: 'dQw4w9WgXcQ' }, 'null'));
    expect(u.pathname).toBe('/embed/dQw4w9WgXcQ');
    expect(u.searchParams.has('origin')).toBe(false);
  });
});

describe('feedKey', () => {
  it('distinguishes channels from videos', () => {
    expect(feedKey({ ch: CH })).not.toBe(feedKey({ v: 'dQw4w9WgXcQ' }));
  });
});
