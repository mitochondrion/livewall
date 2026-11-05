/** A feed points at either a channel's current live stream or one fixed video. */
export type Source = { ch: string; v?: never } | { v: string; ch?: never };

/** A feed as shipped in presets: title + source. */
export type FeedDef = { t: string } & Source;

/** A feed in the running app; `id` is the stable identity of its tile. */
export type Feed = FeedDef & { id: string };

export const MODES = ['wall', 'spotlight', 'crt', 'cctv', 'zen'] as const;
export type Mode = (typeof MODES)[number];

export type AudioMode = 'hover' | 'click';

export type PlayerStatus = 'loading' | 'playing' | 'offline';

export interface State {
  mode: Mode;
  preset: string; // preset id, or 'custom'
  feeds: Feed[];
  audio: AudioMode;
  volume: number; // 0..100
  tour: boolean;
  tourSecs: number;
}

export interface Preset {
  id: string;
  name: string;
  desc: string;
  feeds: FeedDef[];
}

export interface Cell {
  row: number;
  col: number;
  colSpan?: number;
  rowSpan?: number;
}

export interface Plan {
  cols: number;
  rows: number;
  colTemplate?: string;
  /** Pixel width of the whole grid (CRT pyramid only). */
  width?: number;
  cells: Cell[];
}
