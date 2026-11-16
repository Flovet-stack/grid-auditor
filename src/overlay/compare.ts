/**
 * Expected vs rendered comparison (decision 0019, spec 06). Pure: no DOM, so the unit tests
 * cover the matching, rounding, tolerance and status text.
 */
import { type Box, type Breakpoint, clipSections, computeSections, snap } from '../engine';
import type { ContainerLayout } from './containers';

/** Column edges along x, split by side. Left only matches left, right only right (0019 §2). */
export interface Edges {
  readonly left: readonly number[];
  readonly right: readonly number[];
}

export interface Deviation {
  readonly side: 'left' | 'right';
  /** The matched expected edge, in the same space as `rendered`. */
  readonly expected: number;
  readonly rendered: number;
  /** `rendered − expected`, exact. */
  readonly d: number;
}

/** What the panel's status line needs (spec 06). */
export interface CompareStats {
  /** The active breakpoint has a visible Columns grid with at least one visible column. */
  readonly hasExpected: boolean;
  /** Containers drawn (eyes on, or the inspector's hovered one). */
  readonly drawn: number;
  /** Drawn containers that had edges to compare (not subgrid or transformed). */
  readonly compared: number;
  readonly deviations: number;
  /** Compared containers with at least one deviation. */
  readonly containers: number;
}

export const TOLERANCE_DEFAULT = 0.5;
export const TOLERANCE_MIN = 0.5;
export const TOLERANCE_MAX = 20;
export const TOLERANCE_STEP = 0.5;

/** Edges of one side within this many px count once (spec 06). */
const SAME_EDGE = 0.5;

/**
 * Left and right edges of every visible column in each visible Columns grid, in the page's
 * document px: whole pixels, clipped to the page, as the overlay draws them (0006, 0007).
 */
export function expectedEdges(breakpoint: Breakpoint | undefined, box: Box): Edges {
  const left: number[] = [];
  const right: number[] = [];
  for (const grid of breakpoint?.grids ?? []) {
    if (!grid.visible || grid.pattern !== 'COLUMNS') continue;
    for (const s of clipSections(computeSections(grid, box).sections, box.width)) {
      left.push(s.visibleStart);
      right.push(s.visibleEnd);
    }
  }
  return { left, right };
}

/** Sorts and drops edges within 0.5 px of the previous kept one. */
export function dedupeEdges(edges: readonly number[]): number[] {
  const out: number[] = [];
  for (const x of [...edges].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last === undefined || x - last > SAME_EDGE) out.push(x);
  }
  return out;
}

/**
 * The column edges of a measured container, in viewport px: track edges for a grid, item
 * border-box edges for flex. `undefined` when it's skipped (subgrid columns, transformed, or
 * no track sizes), so it doesn't count as compared.
 */
export function renderedEdges(layout: ContainerLayout): Edges | undefined {
  if (layout.transformed) return undefined;
  if (layout.kind === 'grid') {
    if (typeof layout.columns === 'string') return undefined;
    return {
      left: dedupeEdges(layout.columns.map((t) => t.start)),
      right: dedupeEdges(layout.columns.map((t) => t.start + t.size)),
    };
  }
  if (layout.items.length === 0) return undefined;
  return {
    left: dedupeEdges(layout.items.map((r) => r.left)),
    right: dedupeEdges(layout.items.map((r) => r.left + r.width)),
  };
}

/** The expected edge nearest to `x`; on a tie, the one further left. */
const nearest = (x: number, candidates: readonly number[]): number | undefined => {
  let best: number | undefined;
  for (const c of candidates) {
    if (
      best === undefined ||
      Math.abs(x - c) < Math.abs(x - best) ||
      (Math.abs(x - c) === Math.abs(x - best) && c < best)
    ) {
      best = c;
    }
  }
  return best;
};

/**
 * Matches each rendered edge to the nearest expected edge of the same side and keeps the ones
 * more than `tolerance` px away, checked on the exact distance (0019 §3).
 */
export function findDeviations(expected: Edges, rendered: Edges, tolerance: number): Deviation[] {
  const out: Deviation[] = [];
  for (const side of ['left', 'right'] as const) {
    for (const x of rendered[side]) {
      const e = nearest(x, expected[side]);
      if (e === undefined) continue;
      const d = x - e;
      if (Math.abs(d) > tolerance) out.push({ side, expected: e, rendered: x, d });
    }
  }
  return out;
}

/** The label: a sign, the distance rounded as 0006 rounds, and `px`. Uses a true minus sign. */
export function formatDeviation(d: number): string {
  const s = snap(d);
  return `${s < 0 ? '−' : '+'}${Math.abs(s)} px`;
}

export const isTolerance = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= TOLERANCE_MIN &&
  v <= TOLERANCE_MAX &&
  Number.isInteger(v / TOLERANCE_STEP);

/** Typed tolerance: rounded to the nearest 0.5 and clamped to 0.5–20; not a number keeps `previous`. */
export function normalizeTolerance(raw: string, previous: number): number {
  const text = raw.trim();
  const n = Number(text);
  if (text === '' || !Number.isFinite(n)) return previous;
  const stepped = Math.round(n / TOLERANCE_STEP) * TOLERANCE_STEP;
  return Math.min(TOLERANCE_MAX, Math.max(TOLERANCE_MIN, stepped));
}

/** `0.5`, `2`: no trailing `.0`. */
export const formatTolerance = (t: number): string => String(t);

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** The Compare section's status line (spec 06): the first case that applies. */
export function compareStatus(stats: CompareStats, tolerance: number, inspectOn: boolean): string {
  if (!stats.hasExpected) return 'Turn on a Columns grid in Layout guide';
  if (stats.drawn === 0) {
    return inspectOn ? "Turn on a container's eye, or press Shift+M" : "Turn on a container's eye";
  }
  if (stats.compared === 0) return 'Nothing to compare in the drawn containers';
  if (stats.deviations > 0) {
    return `${plural(stats.deviations, 'deviation')} in ${plural(stats.containers, 'container')}`;
  }
  return `No deviations over ${formatTolerance(tolerance)} px`;
}
