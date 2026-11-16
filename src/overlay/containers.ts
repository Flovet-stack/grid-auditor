/**
 * Rendered grid geometry (decision 0015, spec 07): what the page actually laid out.
 * The maths takes plain numbers and rects, so node tests cover it; the DOM helpers at the
 * bottom read computed styles and boxes.
 */
import { snap } from '../engine';

/** Rounds a displayed px value per 0006. */
export const snapValue = (v: number): number => snap(v);

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export type ContainerKind = 'grid' | 'flex';
/** What the inspector can draw: a container, or a block with children (0020). */
export type LayoutKind = ContainerKind | 'block';

/** One track along an axis: its start (px, in the same space as the content box) and size. */
export interface Track {
  readonly start: number;
  readonly size: number;
}

/** A space between two neighbouring children. `axis` is the direction the gap runs across. */
export interface Gap extends Rect {
  readonly axis: 'x' | 'y';
  readonly size: number;
}

/** How the free space of an axis is distributed (CSS Box Alignment, content distribution). */
export type ContentAlign =
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

/**
 * Parses a resolved `grid-template-columns`/`-rows` value: px sizes with optional
 * `[line names]`. Returns `undefined` for `none`, `subgrid` or anything not in px.
 */
export function parseTrackList(value: string): number[] | undefined {
  const v = value.replace(/\[[^\]]*\]/g, ' ').trim();
  if (!v || v === 'none' || v.startsWith('subgrid')) return undefined;
  const sizes: number[] = [];
  for (const part of v.split(/\s+/)) {
    if (!/^-?\d*\.?\d+(e[+-]?\d+)?px$/i.test(part)) return undefined;
    sizes.push(Number.parseFloat(part));
  }
  return sizes;
}

/**
 * Maps a computed `justify-content` (x) or `align-content` (y) value to a logical alignment.
 * `stretch` and `normal` are start: the browser has already stretched the tracks.
 * `left`/`right` are physical, so they flip in RTL.
 */
export function normalizeAlign(value: string, axis: 'x' | 'y', rtl: boolean): ContentAlign {
  const v = value.replace(/\b(safe|unsafe)\b/g, '').trim();
  switch (v) {
    case 'end':
    case 'flex-end':
      return 'end';
    case 'center':
      return 'center';
    case 'space-between':
    case 'space-around':
    case 'space-evenly':
      return v;
    case 'left':
      return axis === 'x' && rtl ? 'end' : 'start';
    case 'right':
      return axis === 'x' && !rtl ? 'end' : 'start';
    default:
      return 'start';
  }
}

/**
 * Places tracks inside a content box of `available` px starting at `origin`.
 * Zero-size tracks are kept and still take a gap. With `reverse` (RTL columns),
 * tracks run from the far edge.
 */
export function placeTracks(
  sizes: readonly number[],
  gap: number,
  origin: number,
  available: number,
  align: ContentAlign,
  reverse = false,
): Track[] {
  const n = sizes.length;
  if (n === 0) return [];
  const used = sizes.reduce((a, b) => a + b, 0) + gap * (n - 1);
  const free = available - used;
  let offset = 0;
  let extra = 0;
  if (free > 0) {
    if (align === 'end') offset = free;
    else if (align === 'center') offset = free / 2;
    else if (align === 'space-between') extra = n > 1 ? free / (n - 1) : 0;
    else if (align === 'space-around') {
      extra = free / n;
      offset = extra / 2;
    } else if (align === 'space-evenly') {
      extra = free / (n + 1);
      offset = extra;
    }
  } else if (align === 'end') offset = free;
  else if (align === 'center') offset = free / 2;

  const tracks: Track[] = [];
  let pos = offset;
  for (const size of sizes) {
    const start = reverse ? origin + available - pos - size : origin + pos;
    tracks.push({ start, size });
    pos += size + gap + extra;
  }
  return tracks;
}

const right = (r: Rect): number => r.left + r.width;
const bottom = (r: Rect): number => r.top + r.height;

/**
 * Gaps between neighbouring children, as GuideFrame measures them: for each child, the
 * nearest child to its right that overlaps it vertically, and the nearest below that
 * overlaps it horizontally. Gaps of 0 or less and duplicates are dropped.
 */
export function pairGaps(children: readonly Rect[]): Gap[] {
  const gaps: Gap[] = [];
  const seen = new Set<string>();
  const add = (g: Gap): void => {
    if (g.size <= 0 || g.width <= 0 || g.height <= 0) return;
    const key = [g.axis, g.left, g.top, g.width, g.height].map((v) => String(v)).join(':');
    if (seen.has(key)) return;
    seen.add(key);
    gaps.push(g);
  };
  for (const a of children) {
    let nextRight: Rect | undefined;
    let nextBelow: Rect | undefined;
    for (const b of children) {
      if (b === a) continue;
      const overlapY = Math.min(bottom(a), bottom(b)) - Math.max(a.top, b.top);
      if (b.left >= right(a) && overlapY > 0 && (!nextRight || b.left < nextRight.left)) {
        nextRight = b;
      }
      const overlapX = Math.min(right(a), right(b)) - Math.max(a.left, b.left);
      if (b.top >= bottom(a) && overlapX > 0 && (!nextBelow || b.top < nextBelow.top)) {
        nextBelow = b;
      }
    }
    if (nextRight) {
      const top = Math.max(a.top, nextRight.top);
      add({
        axis: 'x',
        left: right(a),
        top,
        width: nextRight.left - right(a),
        height: Math.min(bottom(a), bottom(nextRight)) - top,
        size: nextRight.left - right(a),
      });
    }
    if (nextBelow) {
      const left = Math.max(a.left, nextBelow.left);
      add({
        axis: 'y',
        left,
        top: bottom(a),
        width: Math.min(right(a), right(nextBelow)) - left,
        height: nextBelow.top - bottom(a),
        size: nextBelow.top - bottom(a),
      });
    }
  }
  return gaps;
}

/** One padding side to shade (0016): its band in the padding box and its size. */
export interface Band extends Rect {
  readonly side: 'top' | 'right' | 'bottom' | 'left';
  readonly size: number;
}

/**
 * The four padding bands of a padding box, as Chrome DevTools draws them: top and bottom
 * span the full width, left and right fill the height between them. Sides of 0 are skipped.
 */
export function paddingBands(
  box: Rect,
  top: number,
  rightSize: number,
  bottomSize: number,
  left: number,
): Band[] {
  const middle = Math.max(0, box.height - top - bottomSize);
  const bands: Band[] = [
    { side: 'top', size: top, left: box.left, top: box.top, width: box.width, height: top },
    {
      side: 'right',
      size: rightSize,
      left: box.left + box.width - rightSize,
      top: box.top + top,
      width: rightSize,
      height: middle,
    },
    {
      side: 'bottom',
      size: bottomSize,
      left: box.left,
      top: box.top + box.height - bottomSize,
      width: box.width,
      height: bottomSize,
    },
    { side: 'left', size: left, left: box.left, top: box.top + top, width: left, height: middle },
  ];
  return bands.filter((b) => b.size > 0 && b.width > 0 && b.height > 0);
}

/** `24 ×5`, or `16 ×3, 24 ×1 · inconsistent` (most common first), for one axis. */
function auditValues(values: readonly number[]): string {
  const counts = new Map<number, number>();
  for (const v of values) {
    const s = snap(v);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([v, n]) => `${v} ×${n}`);
  return parts.join(', ') + (counts.size > 1 ? ' · inconsistent' : '');
}

/**
 * The gap audit shown on each Rendered row (0015): `gaps 24 ×5`,
 * `gaps 16 ×3, 24 ×1 · inconsistent` or `no gaps`. When gaps run both ways, each
 * axis is audited on its own (`col gaps 24 ×4 · row gaps 16 ×2`), so a grid with a
 * different row and column gap isn't called inconsistent.
 */
export function gapAudit(gaps: readonly Gap[]): string {
  const x = gaps.filter((g) => g.axis === 'x').map((g) => g.size);
  const y = gaps.filter((g) => g.axis === 'y').map((g) => g.size);
  if (!x.length && !y.length) return 'no gaps';
  if (!x.length || !y.length) return `gaps ${auditValues(x.length ? x : y)}`;
  return `col gaps ${auditValues(x)} · row gaps ${auditValues(y)}`;
}

/** `tag.firstClass`, else `tag#id`, else `tag` (0011). */
export function baseLabel(tag: string, classes: readonly string[], id: string): string {
  const t = tag.toLowerCase();
  if (classes[0]) return `${t}.${classes[0]}`;
  if (id) return `${t}#${id}`;
  return t;
}

/** Repeated labels get ` 2`, ` 3`… in order, so every row and page tag is unique. */
export function uniqueLabels(labels: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((l) => {
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    return n === 1 ? l : `${l} ${n}`;
  });
}

// ----- DOM -----

const px = (v: string): number => Number.parseFloat(v) || 0;
const toRect = (r: DOMRect): Rect => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});

/** True as soon as one child is laid out (cheaper than `layoutChildren` for detection). */
function hasLayoutChild(el: Element): boolean {
  const view = el.ownerDocument.defaultView;
  for (const child of Array.from(el.children)) {
    const r = child.getBoundingClientRect();
    const style = view?.getComputedStyle(child);
    if (!style || style.display === 'none') continue;
    if (style.display === 'contents') {
      if (hasLayoutChild(child)) return true;
      continue;
    }
    if (style.position === 'absolute' || style.position === 'fixed') continue;
    if (r.width > 0 || r.height > 0) return true;
  }
  return false;
}

/** The children that are laid out: `display: contents` is flattened; absolute, fixed and empty boxes are skipped. */
export function layoutChildren(el: Element): Element[] {
  const view = el.ownerDocument.defaultView;
  const out: Element[] = [];
  const visit = (parent: Element): void => {
    for (const child of Array.from(parent.children)) {
      const style = view?.getComputedStyle(child);
      if (!style || style.display === 'none') continue;
      if (style.display === 'contents') {
        visit(child);
        continue;
      }
      if (style.position === 'absolute' || style.position === 'fixed') continue;
      const r = child.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push(child);
    }
  };
  visit(el);
  return out;
}

/** `grid` or `flex` when `el` is a container with a box and at least one laid-out child. */
export function containerKind(el: Element, style?: CSSStyleDeclaration): ContainerKind | undefined {
  const s = style ?? el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!s) return undefined;
  const kind: ContainerKind | undefined =
    s.display === 'grid' || s.display === 'inline-grid'
      ? 'grid'
      : s.display === 'flex' || s.display === 'inline-flex'
        ? 'flex'
        : undefined;
  if (!kind) return undefined;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return undefined;
  return hasLayoutChild(el) ? kind : undefined;
}

export interface FoundContainer {
  readonly el: Element;
  readonly kind: ContainerKind;
  readonly label: string;
}

/** Every grid and flex container on the page, in document order, skipping `skip` (our host). */
export function scanContainers(doc: Document, skip: Element): FoundContainer[] {
  const view = doc.defaultView;
  const found: { el: Element; kind: ContainerKind }[] = [];
  // A flat list is much faster than a TreeWalker with a JS filter. `skip` (our host) has no
  // light-DOM children, so skipping the element itself is enough.
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i] as Element;
    if (el === skip) continue;
    const style = view?.getComputedStyle(el);
    const display = style?.display ?? '';
    // Cheap check first; only possible containers pay for boxes and children.
    if (display.length < 4 || !/^(inline-)?(grid|flex)$/.test(display)) continue;
    const kind = containerKind(el, style);
    if (kind) found.push({ el, kind });
  }
  const labels = uniqueLabels(
    found.map(({ el }) => baseLabel(el.tagName, Array.from(el.classList), el.id)),
  );
  return found.map((f, i) => ({ ...f, label: labels[i] ?? '' }));
}

/** The nearest grid or flex container at or above `el`. */
const HTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * Whether an element can be inspected as a block (0020 §1): an HTML element other than `html`
 * or `body`, not `inline`, `contents` or `none`, with at least one laid-out element child.
 * Pure, so the unit tests cover it; `blockAt` feeds it the live values.
 */
export function isInspectableBlock(e: {
  readonly display: string;
  readonly localName: string;
  readonly namespace: string | null;
  readonly hasChild: boolean;
}): boolean {
  if (e.namespace !== HTML_NS) return false;
  if (e.localName === 'html' || e.localName === 'body') return false;
  if (e.display === 'inline' || e.display === 'contents' || e.display === 'none') return false;
  return e.hasChild;
}

/** `true` when `el` is an inspectable block with a box bigger than 0. */
function isBlock(el: Element, style?: CSSStyleDeclaration): boolean {
  const s = style ?? el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!s) return false;
  const quick = { display: s.display, localName: el.localName, namespace: el.namespaceURI };
  if (!isInspectableBlock({ ...quick, hasChild: true })) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  return hasLayoutChild(el);
}

/**
 * The inspector's hover target (0020): the first element from `el` up that's a grid or flex
 * container or an inspectable block. Stops at `body`, so empty page areas give nothing.
 * Pick keeps using `containerAt`.
 */
export function inspectableAt(el: Element | null, skip: Element): Element | undefined {
  for (let n = el; n; n = n.parentElement) {
    if (n === skip || n.localName === 'body' || n.localName === 'html') return undefined;
    if (containerKind(n) || isBlock(n)) return n;
  }
  return undefined;
}

export function containerAt(el: Element | null, skip: Element): Element | undefined {
  for (let n = el; n; n = n.parentElement) {
    if (n === skip) return undefined;
    if (containerKind(n)) return n;
  }
  return undefined;
}

/** True when `el` or an ancestor is transformed, so track maths from its box would be wrong. */
function isTransformed(el: Element): boolean {
  const view = el.ownerDocument.defaultView;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const s = view?.getComputedStyle(n);
    if (!s) continue;
    if (s.transform !== 'none' && s.transform !== '') return true;
    for (const p of ['translate', 'rotate', 'scale'] as const) {
      const v = s[p];
      if (v && v !== 'none') return true;
    }
  }
  return false;
}

/** Tracks for one axis, or why there are none. */
export type AxisTracks = readonly Track[] | 'subgrid' | 'unavailable';

export interface ContainerLayout {
  readonly kind: LayoutKind;
  /** Border box, in viewport (client) px. */
  readonly border: Rect;
  /** Content box at the current scroll position. */
  readonly content: Rect;
  /** Set when overflow isn't visible: marks are clipped to the padding box. */
  readonly clip: Rect | undefined;
  readonly columns: AxisTracks;
  readonly rows: AxisTracks;
  readonly gaps: readonly Gap[];
  /** Border boxes of the laid-out children, in viewport px (spec 06 compares flex items). */
  readonly items: readonly Rect[];
  /** Padding sides that aren't 0 (0016). */
  readonly padding: readonly Band[];
  readonly transformed: boolean;
}

/**
 * Measures a container as laid out now, in viewport px. With `allowBlock` (the inspector, 0020),
 * an inspectable block that isn't a container is measured too, with no tracks and no gaps.
 */
export function measureContainer(el: Element, allowBlock = false): ContainerLayout | undefined {
  const view = el.ownerDocument.defaultView;
  const s = view?.getComputedStyle(el);
  if (!s) return undefined;
  const kind: LayoutKind | undefined =
    containerKind(el, s) ?? (allowBlock && isBlock(el, s) ? 'block' : undefined);
  if (!kind) return undefined;
  const border = toRect(el.getBoundingClientRect());
  const bl = px(s.borderLeftWidth);
  const bt = px(s.borderTopWidth);
  const pl = px(s.paddingLeft);
  const pt = px(s.paddingTop);
  const html = el as HTMLElement;
  // The page's own scroll already moves its box; only inner scroll containers shift their content.
  const scrolls = el !== el.ownerDocument.scrollingElement;
  const clientW = html.clientWidth ?? border.width;
  const clientH = html.clientHeight ?? border.height;
  const content: Rect = {
    left: border.left + bl + pl - (scrolls ? html.scrollLeft : 0),
    top: border.top + bt + pt - (scrolls ? html.scrollTop : 0),
    width: Math.max(0, clientW - pl - px(s.paddingRight)),
    height: Math.max(0, clientH - pt - px(s.paddingBottom)),
  };
  const clipped = s.overflowX !== 'visible' || s.overflowY !== 'visible';
  const paddingBox: Rect = {
    left: border.left + bl,
    top: border.top + bt,
    width: clientW,
    height: clientH,
  };
  const clip: Rect | undefined = clipped ? paddingBox : undefined;
  const padding = paddingBands(paddingBox, pt, px(s.paddingRight), px(s.paddingBottom), pl);
  const transformed = isTransformed(el);
  const items = layoutChildren(el).map((c) => toRect(c.getBoundingClientRect()));
  // A block shows its box and padding only (0020 §2).
  const gaps = kind === 'block' ? [] : pairGaps(items);

  let columns: AxisTracks = 'unavailable';
  let rows: AxisTracks = 'unavailable';
  if (kind === 'grid' && !transformed) {
    const rtl = s.direction === 'rtl';
    const axis = (value: string, gap: number, x: boolean): AxisTracks => {
      if (value.trim().startsWith('subgrid')) return 'subgrid';
      const sizes = parseTrackList(value);
      if (!sizes) return 'unavailable';
      const align = normalizeAlign(x ? s.justifyContent : s.alignContent, x ? 'x' : 'y', rtl);
      return x
        ? placeTracks(sizes, gap, content.left, content.width, align, rtl)
        : placeTracks(sizes, gap, content.top, content.height, align);
    };
    columns = axis(s.gridTemplateColumns, px(s.columnGap), true);
    rows = axis(s.gridTemplateRows, px(s.rowGap), false);
  }
  return { kind, border, content, clip, columns, rows, gaps, items, padding, transformed };
}
