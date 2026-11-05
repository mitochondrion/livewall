// Pure layout math. Every layout returns a Plan: grid dimensions plus a cell
// per feed, in feed order. Grid columns are doubled (each normal tile spans 2)
// so incomplete rows can be centred by offsetting a single column.
import type { Cell, Plan } from './types';

const A = 16 / 9;

/** Pick the column count that makes 16:9 tiles biggest in W×H. */
export function bestCols(n: number, W: number, H: number, aspect = A): number {
  let best = { c: 1, area: -1 };
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c);
    const w = Math.min(W / c, (H / r) * aspect);
    const area = w * (w / aspect);
    if (area > best.area) best = { c, area };
  }
  return best.c;
}

/** Rows of `counts[i]` tiles, each row centred within the widest row. */
export function centredRows(counts: number[]): Plan & { maxCols: number } {
  const maxCols = Math.max(...counts);
  const cells: Cell[] = [];
  counts.forEach((k, r) => {
    const start = 1 + (maxCols - k);
    for (let j = 0; j < k; j++) cells.push({ row: r + 1, col: start + j * 2, colSpan: 2 });
  });
  return { cols: maxCols * 2, rows: counts.length, maxCols, cells };
}

export function gridPlan(n: number, W: number, H: number): Plan {
  const c = bestCols(n, W, H);
  const counts: number[] = [];
  for (let left = n; left > 0; left -= c) counts.push(Math.min(c, left));
  return centredRows(counts);
}

/** One big tile plus a rail of the rest. `heroIdx` is the featured feed. */
export function spotlightPlan(n: number, W: number, H: number, heroIdx: number): Plan {
  if (n === 1) return { cols: 1, rows: 1, colTemplate: '1fr', cells: [{ row: 1, col: 1 }] };
  const others = n - 1;
  const railCols = others > 7 ? 2 : 1;
  const rows = Math.ceil(others / railCols);
  // Rail tiles are 16:9 at the row height, but never more than ~30% of the width in total.
  const railW = Math.min((H / rows) * A, (W * 0.3) / railCols);
  const cells: Cell[] = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (i === heroIdx) cells.push({ row: 1, col: 1, rowSpan: rows });
    else {
      cells.push({ row: 1 + Math.floor(k / railCols), col: 2 + (k % railCols) });
      k++;
    }
  }
  return {
    cols: 1 + railCols,
    rows,
    colTemplate: `minmax(0,1fr) ${Array<string>(railCols)
      .fill(`${Math.round(railW)}px`)
      .join(' ')}`,
    cells,
  };
}

/** Height / width of a whole CRT (bezel included). Keep in sync with the CSS aspect-ratio. */
export const CRT_ASPECT = 0.97;

/** Stacked CRTs: a pyramid with the widest row at the bottom. */
export function crtRowCounts(n: number, W: number, H: number): { counts: number[]; w: number } {
  let best: { counts: number[]; w: number } | null = null;
  for (let R = 1; R <= n; R++) {
    // R rows with counts a, a+1, … a+R-1, leftovers pushed onto the bottom rows
    const tri = (R * (R - 1)) / 2;
    const a = Math.floor((n - tri) / R);
    if (a < 1) break;
    const counts = Array.from({ length: R }, (_, i) => a + i);
    let rem = n - counts.reduce((s, x) => s + x, 0);
    for (let i = R - 1; rem > 0; i = i === 0 ? R - 1 : i - 1, rem--) counts[i]!++;
    const maxCols = Math.max(...counts);
    const w = Math.min(W / maxCols, H / (R * CRT_ASPECT));
    if (!best || w > best.w) best = { counts, w };
  }
  return best ?? { counts: [n], w: W / n };
}

export function crtPlan(n: number, W: number, H: number): Plan {
  const { counts, w } = crtRowCounts(n, W, H);
  const { maxCols, ...plan } = centredRows(counts);
  return { ...plan, width: Math.floor(w * maxCols) };
}
