import { describe, expect, it } from 'vitest';
import { bestCols, crtPlan, crtRowCounts, gridPlan, spotlightPlan } from '../src/layout';

const sizes: [number, number][] = [
  [1920, 1080],
  [1280, 720],
  [800, 1200],
  [390, 844],
];

/** Every cell must be unique and inside the grid. */
function expectValid(plan: ReturnType<typeof gridPlan>, n: number) {
  expect(plan.cells).toHaveLength(n);
  const seen = new Set<string>();
  for (const c of plan.cells) {
    expect(c.row).toBeGreaterThanOrEqual(1);
    expect(c.row + (c.rowSpan ?? 1) - 1).toBeLessThanOrEqual(plan.rows);
    expect(c.col).toBeGreaterThanOrEqual(1);
    expect(c.col + (c.colSpan ?? 1) - 1).toBeLessThanOrEqual(plan.cols);
    for (let r = c.row; r < c.row + (c.rowSpan ?? 1); r++)
      for (let k = c.col; k < c.col + (c.colSpan ?? 1); k++) {
        const key = `${r},${k}`;
        expect(seen.has(key), `overlap at ${key}`).toBe(false);
        seen.add(key);
      }
  }
}

describe('bestCols', () => {
  it('prefers a wide grid on a wide screen and a tall one on a tall screen', () => {
    expect(bestCols(4, 1920, 1080)).toBe(2);
    expect(bestCols(9, 1920, 1080)).toBe(3);
    expect(bestCols(4, 400, 1600)).toBe(1);
  });
});

describe.each(Array.from({ length: 36 }, (_, i) => i + 1))('n = %i', (n) => {
  it.each(sizes)('grid plan fits %ix%i', (W, H) => expectValid(gridPlan(n, W, H), n));
  it.each(sizes)('crt plan fits %ix%i', (W, H) => {
    const plan = crtPlan(n, W, H);
    expectValid(plan, n);
    expect(plan.width).toBeGreaterThan(0);
    expect(plan.width!).toBeLessThanOrEqual(W);
  });
  it('crt rows sum to n and never shrink going down', () => {
    const { counts } = crtRowCounts(n, 1920, 1080);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
    for (let i = 1; i < counts.length; i++) expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
  });
  it('spotlight puts the hero in column 1 and everything else in the rail', () => {
    const hero = n - 1;
    const plan = spotlightPlan(n, 1920, 1080, hero);
    expectValid(plan, n);
    expect(plan.cells[hero]!.col).toBe(1);
    plan.cells.forEach((c, i) => i !== hero && expect(c.col).toBeGreaterThan(1));
  });
});

describe('centring', () => {
  it('centres an incomplete last row', () => {
    const plan = gridPlan(7, 1920, 1080); // 3 + 3 + 1 in a 6-column (doubled) grid
    expect(plan.cols).toBe(6);
    const last = plan.cells.filter((c) => c.row === 3);
    expect(last.map((c) => c.col)).toEqual([3]); // spans columns 3–4: dead centre
  });
});
