import { describe, expect, it } from 'vitest';
import { type Breakpoint, normalizeBreakpoints } from '../../src/engine';
import {
  type CompareStats,
  compareStatus,
  dedupeEdges,
  type Edges,
  expectedEdges,
  findDeviations,
  formatDeviation,
  isTolerance,
  normalizeTolerance,
  renderedEdges,
} from '../../src/overlay/compare';
import type { ContainerLayout, Rect } from '../../src/overlay/containers';

// Spec 06 unit tests: matching, tolerance, rounding, duplicates, status text.

const MINUS = '−';
const edges = (left: number[], right: number[]): Edges => ({ left, right });
const bp = (grids: unknown[]): Breakpoint => {
  const r = normalizeBreakpoints([{ minWidth: 0, grids: grids as never }]);
  if (!r.ok) throw new Error('bad fixture');
  return r.value[0] as Breakpoint;
};
const rect = (left: number, width: number): Rect => ({ left, top: 0, width, height: 10 });
const layout = (patch: Partial<ContainerLayout>): ContainerLayout => ({
  kind: 'grid',
  border: rect(0, 100),
  content: rect(0, 100),
  clip: undefined,
  columns: [],
  rows: [],
  gaps: [],
  items: [],
  padding: [],
  transformed: false,
  ...patch,
});

describe('1. matching', () => {
  it('matches left edges to left edges and right edges to right edges', () => {
    // Columns 0–100 and 124–224 (24 px gutter).
    const expected = edges([0, 124], [100, 224]);
    const found = findDeviations(expected, edges([2], [226]), 0.5);
    expect(found).toEqual([
      { side: 'left', expected: 0, rendered: 2, d: 2 },
      { side: 'right', expected: 224, rendered: 226, d: 2 },
    ]);
  });

  it('a left edge 13 px early in a 24 px gutter reads −13, not +11', () => {
    // Column 1 is 0–100, the gutter 100–124, column 2 starts at 124. A left edge at 111 is
    // 11 px from column 1's right edge, but it's column 2's left edge that it's meant to be.
    const expected = edges([0, 124], [100, 224]);
    const [dev] = findDeviations(expected, edges([111], []), 0.5);
    expect(dev).toEqual({ side: 'left', expected: 124, rendered: 111, d: -13 });
    expect(formatDeviation(dev?.d ?? 0)).toBe(`${MINUS}13 px`);
  });

  it('a right edge 13 px late in a 24 px gutter reads +13, not −11', () => {
    // Without side matching, 113 would match the next column's left edge (124) as −11.
    const expected = edges([0, 124], [100, 224]);
    const [dev] = findDeviations(expected, edges([], [113]), 0.5);
    expect(dev).toEqual({ side: 'right', expected: 100, rendered: 113, d: 13 });
    expect(formatDeviation(dev?.d ?? 0)).toBe('+13 px');
  });

  it('prefers the edge further left on a tie', () => {
    const [dev] = findDeviations(edges([0, 20], []), edges([10], []), 0.5);
    expect(dev?.expected).toBe(0);
  });
});

describe('2. tolerance', () => {
  const expected = edges([100], [200]);
  it('exactly the tolerance is not a deviation', () => {
    expect(findDeviations(expected, edges([100.5], [199.5]), 0.5)).toEqual([]);
  });

  it('just over the tolerance is, and the label rounds to at least 1', () => {
    const found = findDeviations(expected, edges([100.6], [199.4]), 0.5);
    expect(found.map((f) => formatDeviation(f.d))).toEqual(['+1 px', `${MINUS}1 px`]);
  });

  it('labels round as 0006 snaps: exact halves round down', () => {
    expect(formatDeviation(2.5)).toBe('+2 px');
    expect(formatDeviation(-2.5)).toBe(`${MINUS}3 px`);
    expect(formatDeviation(3)).toBe('+3 px');
  });

  it('checks the exact distance, not the rounded one', () => {
    // 1.4 rounds to 1, but it's still more than a 1 px tolerance.
    expect(findDeviations(expected, edges([101.4], []), 1)).toHaveLength(1);
    expect(findDeviations(expected, edges([101], []), 1)).toEqual([]);
  });
});

describe('3. several grids', () => {
  it('uses the nearest edge across every visible Columns grid', () => {
    const b = bp([
      {
        pattern: 'COLUMNS',
        alignment: 'MIN',
        count: 1,
        sectionSize: 100,
        gutterSize: 0,
        offset: 0,
      },
      {
        pattern: 'COLUMNS',
        alignment: 'MIN',
        count: 1,
        sectionSize: 100,
        gutterSize: 0,
        offset: 50,
      },
      { pattern: 'ROWS', alignment: 'STRETCH', count: 4, gutterSize: 0, offset: 0 },
      { pattern: 'GRID', sectionSize: 8 },
    ]);
    const exp = expectedEdges(b, { width: 400, height: 800 });
    expect(exp).toEqual({ left: [0, 50], right: [100, 150] });
    const [dev] = findDeviations(exp, edges([53], []), 0.5);
    expect(dev?.expected).toBe(50);
  });

  it('skips hidden grids, and clips columns to the page as drawn', () => {
    const b = bp([
      {
        pattern: 'COLUMNS',
        alignment: 'MIN',
        count: 3,
        sectionSize: 100,
        gutterSize: 0,
        offset: 0,
        visible: false,
      },
      {
        pattern: 'COLUMNS',
        alignment: 'MAX',
        count: 2,
        sectionSize: 100,
        gutterSize: 0,
        offset: 0,
      },
    ]);
    // Two 100 px columns flush right in 150 px: the first is cut at 0.
    expect(expectedEdges(b, { width: 150, height: 10 })).toEqual({
      left: [0, 50],
      right: [50, 150],
    });
  });

  it('uses whole-pixel edges (0006)', () => {
    const b = bp([
      { pattern: 'COLUMNS', alignment: 'STRETCH', count: 3, gutterSize: 0, offset: 0 },
    ]);
    // 100 / 3 = 33.33…: Figma draws 0–33, 33–67, 67–100.
    expect(expectedEdges(b, { width: 100, height: 10 })).toEqual({
      left: [0, 33, 67],
      right: [33, 67, 100],
    });
  });
});

describe('4. duplicate edges', () => {
  it('counts edges within 0.5 px once, and 1 px apart twice', () => {
    expect(dedupeEdges([10, 10.4, 50, 10.2])).toEqual([10, 50]);
    expect(dedupeEdges([10, 11])).toEqual([10, 11]);
  });

  it('wrapped flex rows add each item edge once', () => {
    const items = [rect(0, 50), rect(60, 50), rect(0, 50), rect(60, 50)];
    expect(renderedEdges(layout({ kind: 'flex', items }))).toEqual({
      left: [0, 60],
      right: [50, 110],
    });
  });

  it('grid containers use their column tracks', () => {
    const columns = [
      { start: 0, size: 40 },
      { start: 50, size: 40 },
    ];
    expect(renderedEdges(layout({ columns }))).toEqual({ left: [0, 50], right: [40, 90] });
  });

  it('skips subgrid, transformed and track-less containers', () => {
    expect(renderedEdges(layout({ columns: 'subgrid' }))).toBeUndefined();
    expect(renderedEdges(layout({ columns: 'unavailable' }))).toBeUndefined();
    expect(renderedEdges(layout({ transformed: true, columns: [] }))).toBeUndefined();
    expect(
      renderedEdges(layout({ kind: 'flex', transformed: true, items: [rect(0, 1)] })),
    ).toBeUndefined();
  });
});

describe('5. nothing expected', () => {
  it('gives no deviations', () => {
    expect(findDeviations(edges([], []), edges([3], [9]), 0.5)).toEqual([]);
    expect(expectedEdges(undefined, { width: 100, height: 100 })).toEqual({ left: [], right: [] });
  });
});

describe('6. tolerance input', () => {
  it.each([
    ['0', 0.5],
    ['0.7', 0.5],
    ['0.8', 1],
    ['2', 2],
    ['2.5', 2.5],
    [' 3 ', 3],
    ['25', 20],
    ['-4', 0.5],
  ])('%j → %d', (raw, out) => {
    expect(normalizeTolerance(raw, 1)).toBe(out);
  });

  it('keeps the previous value for text that is not a number', () => {
    expect(normalizeTolerance('abc', 1.5)).toBe(1.5);
    expect(normalizeTolerance('', 1.5)).toBe(1.5);
  });

  it('knows a valid stored tolerance', () => {
    expect([0.5, 1, 20].every(isTolerance)).toBe(true);
    expect([0, 0.25, 0.7, 21, Number.NaN, '1'].some(isTolerance)).toBe(false);
  });
});

describe('7. status text', () => {
  const stats = (patch: Partial<CompareStats>): CompareStats => ({
    hasExpected: true,
    drawn: 1,
    compared: 1,
    deviations: 0,
    containers: 0,
    ...patch,
  });

  it('takes the first case that applies', () => {
    expect(compareStatus(stats({ hasExpected: false, drawn: 0 }), 0.5, true)).toBe(
      'Turn on a Columns grid in Layout guide',
    );
    expect(compareStatus(stats({ drawn: 0 }), 0.5, true)).toBe(
      "Turn on a container's eye, or press Shift+M",
    );
    expect(compareStatus(stats({ drawn: 0 }), 0.5, false)).toBe("Turn on a container's eye");
    expect(compareStatus(stats({ compared: 0 }), 0.5, true)).toBe(
      'Nothing to compare in the drawn containers',
    );
    expect(compareStatus(stats({}), 0.5, true)).toBe('No deviations over 0.5 px');
    expect(compareStatus(stats({}), 2, true)).toBe('No deviations over 2 px');
  });

  it('counts with singular and plural nouns', () => {
    expect(compareStatus(stats({ deviations: 1, containers: 1 }), 0.5, true)).toBe(
      '1 deviation in 1 container',
    );
    expect(
      compareStatus(stats({ drawn: 2, compared: 2, deviations: 3, containers: 2 }), 1, true),
    ).toBe('3 deviations in 2 containers');
  });
});
