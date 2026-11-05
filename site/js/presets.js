// Built-in feed sets.
//
//   ch = YouTube channel ID (UC…). Embedded as "whatever that channel is live
//        on right now", so it survives the stream's video ID changing.
//   v  = fixed video ID. Fine for webcams that never restart, but these go
//        stale whenever the owner starts a new broadcast.
//
// Run `npm run check` from a machine with normal internet access to see which
// of these are live right now.

const C = (t, ch) => ({ t, ch });
const V = (t, v) => ({ t, v });

const FEEDS = {
  sky: C('Sky News', 'UCoMdktPbSTixAyNGwb-UYkQ'),
  aje: C('Al Jazeera English', 'UCNye-wNBqNL5ZzHSJj3l8Bg'),
  f24: C('France 24', 'UCQfwfsi5VrQ8yKZ-UWmAEFg'),
  dw: C('DW News', 'UCknLrEdhRCp1aegoMqRaCZg'),
  euro: C('Euronews', 'UCSrZ3UV4jOidv8ppoVuvW9Q'),
  abcau: C('ABC News Australia', 'UCVgO39Bk5sMo66-6o6Spn6Q'),
  cna: C('CNA', 'UC83jt4dlz1Gjl58fzQrrKZg'),
  wion: C('WION', 'UC_gUM8rL-Lrg6O3adPW9K1g'),
  trt: C('TRT World', 'UC7fWeaHhqgM4Ry-RMpM2YYw'),
  abc: C('ABC News', 'UCBi2mrWuNuyYy4gbM6fU18Q'),
  nbc: C('NBC News', 'UCeY0bbntWzzVIaj2z3QigXg'),
  cbs: C('CBS News', 'UC8p1vwvWtl6T73JiExfWs1g'),
  fox: C('LiveNOW from FOX', 'UCJg9wBPyKMNA5sRDnvzmkdg'),
  pbs: C('PBS NewsHour', 'UC6ZFN9Tx6xh-skXCuRHCDpQ'),
  bbg: C('Bloomberg TV', 'UCIALMKvObZNtJ6AmdCLP7Lg'),
  yf: C('Yahoo Finance', 'UCEAZeUIeJs0IjQiqTCdVSIg'),
  cnbc: C('CNBC', 'UCrp_UI8XtuYfpiqluWLD7Lw'),
  reuters: C('Reuters', 'UChqUTb7kYRX8-EiaN3XFrSQ'),
  nasa: C('NASA', 'UCLA_DiR1FfKNvjuUpBHmylQ'),
  spacex: C('SpaceX', 'UCtI0Hodo5o5dUb67FeUjDeA'),
  nsf: C('NASASpaceflight', 'UCSUu1lih2RifWkKtDOJdsBA'),
  esa: C('ESA', 'UCIBaDdAbGlFDeS33shmlD0A'),
  lofi: C('Lofi Girl', 'UCSJ4gkVC6NrvII8umztf0Ow'),
  iss: V('ISS · Earth from orbit', '86YLFOog4GM'),
  shibuya: V('Shibuya Crossing', 'HpdO5Kq3o7Y'),
  abbey: V('Abbey Road', '57w2gYXjRic'),
  jh: V('Jackson Hole Town Square', '1EiC9bvVGnk'),
  tsq: V('Times Square', 'rnXIjl_Rzy4'),
  venice: V('Venice', 'ph1vpnYIxJk'),
  dublin: V('Dublin · Temple Bar', 'u4UZ4UvZXrg'),
  namib: V('Namib Desert Waterhole', 'ydYDqZQpim8'),
};

const pick = (...keys) => keys.map((k) => FEEDS[k]);

export const PRESETS = [
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
    feeds: pick('abc', 'nbc', 'cbs', 'fox', 'pbs', 'bbg', 'yf', 'reuters'),
  },
  {
    id: 'trading',
    name: 'Trading Floor',
    desc: 'Business TV plus world news for the overhead screens',
    feeds: pick('bbg', 'cnbc', 'yf', 'reuters', 'cna', 'sky', 'aje', 'dw', 'f24'),
  },
  {
    id: 'space',
    name: 'Mission Control',
    desc: 'Launches, the ISS, and space agencies',
    feeds: pick('nasa', 'spacex', 'nsf', 'esa', 'iss'),
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
    feeds: pick('sky', 'bbg', 'nasa', 'shibuya', 'lofi', 'aje', 'namib', 'spacex', 'abbey', 'cnbc', 'dw', 'iss'),
  },
];

export const presetById = (id) => PRESETS.find((p) => p.id === id);
