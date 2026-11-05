// Built-in feed sets.
//
//   ch = YouTube channel ID (UC…). Embedded as "whatever that channel is live
//        on right now", so it survives the stream's video ID changing.
//   v  = fixed video ID. Fine for webcams that never restart, but these go
//        stale whenever the owner starts a new broadcast.
//
// Run `npm run check` from a machine with normal internet access to see which
// of these are live right now.

import type { FeedDef, Preset } from './types';

const C = (t: string, ch: string): FeedDef => ({ t, ch });
const V = (t: string, v: string): FeedDef => ({ t, v });

const FEEDS = {
  // News: channel embeds, because these channels restart their streams (and
  // change video IDs) daily.
  sky: C('Sky News', 'UCoMdktPbSTixAyNGwb-UYkQ'),
  aje: C('Al Jazeera English', 'UCNye-wNBqNL5ZzHSJj3l8Bg'),
  f24: C('France 24', 'UCQfwfsi5VrQ8yKZ-UWmAEFg'),
  dw: C('DW News', 'UCknLrEdhRCp1aegoMqRaCZg'),
  euro: C('Euronews', 'UCSrZ3UV4jOidv8ppoVuvW9Q'),
  abcau: C('ABC News Australia', 'UCVgO39Bk5sMo66-6o6Spn6Q'),
  cna: C('CNA', 'UC83jt4dlz1Gjl58fzQrrKZg'),
  wion: C('WION', 'UC_gUM8rL-Lrg6O3adPW9K1g'),
  trt: C('TRT World', 'UC7fWeaHhqgM4Ry-RMpM2YYw'),
  nhk: C('NHK World-Japan', 'UCSPEjw8F2nQDtmUKPFNF7_A'),
  abc: C('ABC News', 'UCBi2mrWuNuyYy4gbM6fU18Q'),
  nbc: C('NBC News', 'UCeY0bbntWzzVIaj2z3QigXg'),
  cbs: C('CBS News', 'UC8p1vwvWtl6T73JiExfWs1g'),
  cnn: C('CNN Headlines', 'UCupvZG-5ko_eiXAupbDfxWw'),
  fox: C('LiveNOW from FOX', 'UCJg9wBPyKMNA5sRDnvzmkdg'),
  bbg: C('Bloomberg TV', 'UCIALMKvObZNtJ6AmdCLP7Lg'),
  yf: C('Yahoo Finance', 'UCEAZeUIeJs0IjQiqTCdVSIg'),
  ndtvp: C('NDTV Profit', 'UC3uJIdRFTGgLWrUziaHbzrg'),
  reuters: C('Reuters', 'UChqUTb7kYRX8-EiaN3XFrSQ'),
  nasa: C('NASA', 'UCLA_DiR1FfKNvjuUpBHmylQ'),
  // Fixed video IDs: long-running 24/7 streams, or channels that run several
  // streams at once (a channel embed would pick one of them for us).
  iss: V('ISS · Earth from orbit', 'ROboUHfPUrU'), // NASA official HD views
  sen: V('Sen · Earth in 4K', 'fO9e9jnhYK8'),
  starbase: V('Starbase · Boca Chica', 'mhJRzQsLZGg'), // NASASpaceflight
  coast: V('Space Coast · Cape Canaveral', 'Jm8wRjD3xVA'), // NASASpaceflight
  lofi: V('Lofi Girl', 'rFZHOHl-L8A'),
  shibuya: V('Shibuya Crossing', '5B4LmH4JbnY'), // ANN / TV Asahi
  abbey: V('Abbey Road', 'zMCea32gpmg'), // EarthCam
  jh: V('Jackson Hole Town Square', '1EiC9bvVGnk'),
  tsq: V('Times Square', 'KHy_n-EMWY8'), // EarthCam
  venice: V('Venice · Grand Canal', 'r8N6IsoIkTk'), // I Love You Venice
  dublin: V('Dublin', '3nyPER2kzqk'), // EarthCam
  namib: V('Namib Desert Waterhole', 'ydYDqZQpim8'), // NamibiaCam
};

const pick = (...keys: (keyof typeof FEEDS)[]): FeedDef[] => keys.map((k) => FEEDS[k]);

export const PRESETS: Preset[] = [
  {
    id: 'newsroom',
    name: 'Newsroom · World',
    desc: 'International 24/7 news channels',
    feeds: pick('sky', 'aje', 'f24', 'dw', 'euro', 'abcau', 'cna', 'wion', 'trt'),
  },
  {
    id: 'us-news',
    name: 'Newsroom · US',
    desc: 'US network and cable news streams',
    feeds: pick('abc', 'nbc', 'cbs', 'cnn', 'fox', 'bbg', 'yf', 'reuters'),
  },
  {
    id: 'trading',
    name: 'Trading Floor',
    desc: 'Business TV plus world news for the overhead screens',
    feeds: pick('bbg', 'yf', 'ndtvp', 'reuters', 'nhk', 'cna', 'sky', 'aje', 'dw'),
  },
  {
    id: 'space',
    name: 'Mission Control',
    desc: 'NASA, the ISS, and the launch pads',
    feeds: pick('nasa', 'iss', 'starbase', 'coast', 'sen'),
  },
  {
    id: 'webcams',
    name: 'Webcams · Cities & Wild',
    desc: 'Street corners, a waterhole, the view from orbit',
    feeds: pick('shibuya', 'abbey', 'tsq', 'jh', 'venice', 'dublin', 'namib', 'iss'),
  },
  {
    id: 'storefront',
    name: 'Electronics Store',
    desc: 'A little of everything, like 12 TVs left on different channels',
    feeds: pick(
      'sky',
      'bbg',
      'nasa',
      'shibuya',
      'lofi',
      'aje',
      'namib',
      'starbase',
      'abbey',
      'cnn',
      'dw',
      'iss',
    ),
  },
];

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);
