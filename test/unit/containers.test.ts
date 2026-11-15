import { describe, expect, it } from 'vitest';
import {
  baseLabel,
  type ContentAlign,
  type Gap,
  gapAudit,
  normalizeAlign,
  paddingBands,
  pairGaps,
  parseTrackList,
  placeTracks,
  type Rect,
  uniqueLabels,
} from '../../src/overlay/containers';

// Spec 07 unit tests: track placement, track parsing, gap pairing, gap audit, labels.

const starts = (sizes: number[], align: ContentAlign, reverse = false) =>
  placeTracks(sizes, 10, 0, 200, align, reverse).map((t) => t.start);

describe('1. track placement', () => {
  // Two tracks of 50 with a 10 gap in 200: 110 used, 90 free.
  it.each([
    ['start', [0, 60]],
    ['end', [90, 150]],
    ['center', [45, 105]],
    ['space-between', [0, 150]],
    ['space-around', [22.5, 127.5]],
    ['space-evenly', [30, 120]],
  ] as const)('%s', (align, expected) => {
    expect(starts([50, 50], align)).toEqual(expected);
  });

  it('keeps zero-size tracks, and they still take a gap', () => {
    expect(placeTracks([50, 0, 50], 10, 0, 120, 'start')).toEqual([
      { start: 0, size: 50 },
      { start: 60, size: 0 },
      { start: 70, size: 50 },
    ]);
  });

  it('runs from the right edge in RTL', () => {
    expect(placeTracks([50, 30], 10, 100, 200, 'start', true)).toEqual([
      { start: 250, size: 50 },
      { start: 210, size: 30 },
    ]);
  });

  it('space-between with one track is start; overflow ignores distribution', () => {
    expect(starts([50], 'space-between')).toEqual([0]);
    expect(placeTracks([150, 150], 10, 0, 200, 'space-evenly').map((t) => t.start)).toEqual([
      0, 160,
    ]);
    expect(placeTracks([150, 150], 10, 0, 200, 'center').map((t) => t.start)).toEqual([-55, 105]);
  });

  it('normalizes alignment keywords, flipping left and right in RTL', () => {
    expect(normalizeAlign('normal', 'x', false)).toBe('start');
    expect(normalizeAlign('stretch', 'y', false)).toBe('start');
    expect(normalizeAlign('safe center', 'x', false)).toBe('center');
    expect(normalizeAlign('flex-end', 'x', false)).toBe('end');
    expect(normalizeAlign('space-evenly', 'y', false)).toBe('space-evenly');
    expect(normalizeAlign('right', 'x', false)).toBe('end');
    expect(normalizeAlign('right', 'x', true)).toBe('start');
    expect(normalizeAlign('left', 'x', true)).toBe('end');
    expect(normalizeAlign('left', 'y', true)).toBe('start');
  });
});

describe('2. track parsing', () => {
  it('reads px lists, with line names', () => {
    expect(parseTrackList('100px 216.5px 0px')).toEqual([100, 216.5, 0]);
    expect(parseTrackList('[a] 100px [b c] 200px [d]')).toEqual([100, 200]);
  });

  it('gives nothing for subgrid, none and non-px values', () => {
    expect(parseTrackList('subgrid')).toBeUndefined();
    expect(parseTrackList('subgrid [a] [b]')).toBeUndefined();
    expect(parseTrackList('none')).toBeUndefined();
    expect(parseTrackList('1fr 2fr')).toBeUndefined();
    expect(parseTrackList('')).toBeUndefined();
  });
});

const box = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
});
const sizes = (gaps: Gap[], axis: 'x' | 'y') =>
  gaps.filter((g) => g.axis === axis).map((g) => g.size);

describe('3. gap pairing', () => {
  it('a row', () => {
    const gaps = pairGaps([box(0, 0, 50, 20), box(60, 0, 50, 20), box(130, 0, 50, 20)]);
    expect(sizes(gaps, 'x')).toEqual([10, 20]);
    expect(sizes(gaps, 'y')).toEqual([]);
    expect(gaps[0]).toMatchObject({ left: 50, top: 0, width: 10, height: 20 });
  });

  it('a wrapped flex layout pairs within and between lines', () => {
    const gaps = pairGaps([
      box(0, 0, 50, 20),
      box(60, 0, 50, 30),
      box(0, 40, 50, 20),
      box(60, 40, 50, 20),
    ]);
    expect(sizes(gaps, 'x')).toEqual([10, 10]);
    expect(sizes(gaps, 'y')).toEqual([20, 10]);
  });

  it('a 3 × 2 grid gives 4 column gaps and 3 row gaps', () => {
    const cells = [0, 1].flatMap((r) => [0, 1, 2].map((c) => box(c * 60, r * 30, 50, 20)));
    const gaps = pairGaps(cells);
    expect(sizes(gaps, 'x')).toEqual([10, 10, 10, 10]);
    expect(sizes(gaps, 'y')).toEqual([10, 10, 10]);
  });

  it('overlapping children make no gap', () => {
    expect(pairGaps([box(0, 0, 50, 20), box(40, 0, 50, 20)])).toEqual([]);
  });

  it('touching children make no gap, and duplicates are dropped', () => {
    expect(pairGaps([box(0, 0, 50, 20), box(50, 0, 50, 20)])).toEqual([]);
    const a = box(0, 0, 50, 20);
    expect(pairGaps([a, box(60, 0, 50, 20), box(60, 0, 50, 20)])).toHaveLength(1);
  });
});

const g = (axis: 'x' | 'y', size: number): Gap => ({
  axis,
  size,
  left: 0,
  top: 0,
  width: 1,
  height: 1,
});

describe('4. gap audit', () => {
  it('consistent', () => {
    expect(gapAudit([24, 24, 24, 24, 24].map((s) => g('x', s)))).toBe('gaps 24 ×5');
  });

  it('inconsistent, most common first, rounded per 0006', () => {
    expect(gapAudit([24, 16, 16, 15.5].map((s) => g('x', s)))).toBe(
      'gaps 16 ×2, 15 ×1, 24 ×1 · inconsistent',
    );
    expect(gapAudit([16, 16, 16, 24].map((s) => g('y', s)))).toBe(
      'gaps 16 ×3, 24 ×1 · inconsistent',
    );
  });

  it('none', () => {
    expect(gapAudit([])).toBe('no gaps');
  });

  it('audits each axis on its own when gaps run both ways', () => {
    expect(gapAudit([g('x', 24), g('x', 24), g('y', 16)])).toBe('col gaps 24 ×2 · row gaps 16 ×1');
  });
});

describe('5. labels', () => {
  it('class, then id, then the bare tag', () => {
    expect(baseLabel('DIV', ['cards', 'x'], 'main')).toBe('div.cards');
    expect(baseLabel('SECTION', [], 'main')).toBe('section#main');
    expect(baseLabel('UL', [], '')).toBe('ul');
  });

  it('numbers repeats in order', () => {
    expect(uniqueLabels(['div.a', 'ul', 'div.a', 'div.a', 'ul'])).toEqual([
      'div.a',
      'ul',
      'div.a 2',
      'div.a 3',
      'ul 2',
    ]);
  });
});

describe('6. padding bands (0016)', () => {
  it('top and bottom span the width; left and right fill between them; 0 sides are skipped', () => {
    const bands = paddingBands({ left: 10, top: 20, width: 100, height: 60 }, 8, 4, 0, 12);
    expect(bands).toEqual([
      { side: 'top', size: 8, left: 10, top: 20, width: 100, height: 8 },
      { side: 'right', size: 4, left: 106, top: 28, width: 4, height: 52 },
      { side: 'left', size: 12, left: 10, top: 28, width: 12, height: 52 },
    ]);
  });
});
