/**
 * The rendered grid overlay (decision 0015, spec 07): which containers are found and shown,
 * their marks, the hover outline, track-size hover and Pick. The panel drives it.
 * The geometry inspector (0018, spec 08) draws the hovered container instead of the shown set.
 */
import {
  type AxisTracks,
  baseLabel,
  type ContainerLayout,
  containerAt,
  type FoundContainer,
  gapAudit,
  snapValue,
  layoutChildren,
  measureContainer,
  pairGaps,
  type Rect,
  scanContainers,
} from './containers';

/** The panel's font stack (0014); the inspector pill uses it too. */
export const UI_FONT =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, SFProLocalRange';

/** Gap pink, derived from the primary blue (0016): same saturation and lightness, hue mirrored 205° → 330°. */
export const GAP_COLOR = '#e90c7a';
/** Padding: the primary blue (0014, 0016). */
export const PADDING_COLOR = '#0c8ce9';

/**
 * Even hatching (0016): a 6 × 6 px tile with one diagonal line, so lines sit about 4.2 px
 * apart at any size. A whole-pixel tile can't alias into denser bands the way a 1 px
 * gradient stop does.
 */
export const hatch = (color: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><path d='M-1 1l2-2M0 6l6-6M5 7l2-2' stroke='${color}' stroke-width='1'/></svg>`,
  )}") repeat 0 0 / 6px 6px`;

/** Blue-violet tracks from 0005 (3:1 or better on white and on #121212); 0016 shades. */
export const RENDERED_STYLES: string = `
.rendered { position: absolute; inset: 0; --ga-rendered: #6e56cf; --ga-gap: ${GAP_COLOR};
  --ga-pad: ${PADDING_COLOR}; }
.rendered [hidden] { display: none !important; }
.rmarks, .rhl { position: absolute; inset: 0; }
.rbox, .rtrack, .rgap, .rpad, .rclip, .rout { position: absolute; box-sizing: border-box; }
.rbox, .rtrack { border: 1px dashed var(--ga-rendered); }
.rclip { overflow: hidden; }
.rgap { background: ${hatch(GAP_COLOR)}; }
.rpad { background: ${hatch(PADDING_COLOR)}; }
.rval { position: absolute; transform: translate(-50%, -50%); padding: 0 3px; border-radius: 2px;
  color: #fff; font: 600 10px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.rval.gap { background: var(--ga-gap); }
.rval.pad { background: var(--ga-pad); }
.rout { border: 1px solid var(--ga-rendered); }
.rtag, .rpill { position: absolute; white-space: nowrap; padding: 0 4px; border-radius: 3px;
  color: #fff; font: 600 10px/16px ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums; }
.rpill { background: var(--ga-rendered); }
.rtag { background: #2c2c2c; }
.rtag .rdim { margin-left: 6px; font-weight: 400; opacity: 0.6; }
.pick { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; background: transparent; }
.ipill { position: fixed; left: 16px; right: 16px; bottom: 16px; z-index: 1; margin: 0 auto;
  width: fit-content; box-sizing: border-box; padding: 6px 12px; border-radius: 16px;
  text-align: center; background: #2c2c2c; color: #fff; pointer-events: none;
  font: 500 11px/16px ${UI_FONT};
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.35), 0 1px 3px rgb(0 0 0 / 0.3); }
.ipill[hidden] { display: none; }
.ipill kbd { margin: 0 2px; padding: 0 4px; border: 1px solid #444; border-radius: 3px;
  background: #383838; font: inherit; white-space: nowrap; }
`;

/** The inspector's status text (0018 §2), before the `Esc` chip and after it. */
export const INSPECT_TEXT: readonly [string, string] = [
  'Geometry inspector on · Page interactions paused · Press ',
  ' to exit',
];

/** The pill shown while the inspector is on (0018 §2). Lives outside the aria-hidden layer. */
export function createInspectPill(doc: Document): HTMLElement {
  const pill = doc.createElement('div');
  pill.className = 'ipill';
  pill.setAttribute('role', 'status');
  pill.hidden = true;
  return pill;
}

/** Fills the pill when the inspector turns on, so the live region announces it once. */
export function setInspectPill(pill: HTMLElement, on: boolean): void {
  if (on === !pill.hidden) return;
  pill.hidden = !on;
  if (!on) {
    pill.replaceChildren();
    return;
  }
  const doc = pill.ownerDocument;
  const kbd = doc.createElement('kbd');
  kbd.textContent = 'Esc';
  pill.replaceChildren(INSPECT_TEXT[0], kbd, INSPECT_TEXT[1]);
}

export interface RenderedItem extends FoundContainer {
  /** Gap audit text, computed on demand and cached until the next scan. */
  audit(): string;
}

export interface Rendered {
  /** Appended to the shadow root: marks, outlines and the Pick capture layer. */
  readonly element: HTMLElement;
  /** Starts or stops scanning and watching the page (only while the Rendered section is open). */
  setWatching(on: boolean): void;
  /** True once a scan has run. */
  scanned(): boolean;
  items(): readonly RenderedItem[];
  isShown(el: Element): boolean;
  setShown(el: Element, on: boolean): void;
  /** Outlines `el` (row hover or focus); `undefined` clears it. */
  highlight(el: Element | undefined): void;
  startPick(): void;
  cancelPick(): void;
  isPicking(): boolean;
  /** Geometry inspector (0018): draws only the hovered container; eye state is kept as is. */
  startInspect(): void;
  stopInspect(): void;
  isInspecting(): boolean;
  setVisible(visible: boolean): void;
  destroy(): void;
}

export interface RenderedEvents {
  /** The list, shown set or Pick state changed. */
  onChange(): void;
  /** Pick chose `el` (already shown). */
  onPick(el: Element): void;
}

const CAPTURED = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'contextmenu',
  'auxclick',
] as const;

export function createRendered(
  doc: Document,
  host: Element,
  events: RenderedEvents,
  signal: AbortSignal,
): Rendered {
  const view = doc.defaultView as Window;
  const el = (cls: string): HTMLElement => {
    const e = doc.createElement('div');
    e.className = cls;
    return e;
  };
  const root = el('rendered');
  root.setAttribute('aria-hidden', 'true');
  const marks = el('rmarks');
  const hl = el('rhl');
  const pill = el('rpill');
  pill.hidden = true;
  const capture = el('pick');
  capture.hidden = true;
  root.append(marks, hl, pill, capture);

  let list: RenderedItem[] = [];
  let hasScanned = false;
  let watching = false;
  let picking = false;
  let inspecting = false;
  /** The container under the pointer while inspecting. */
  let inspectTarget: Element | undefined;
  /** Where the pointer last moved over the capture layer, for hit-testing again on scroll. */
  let lastPointer: { x: number; y: number } | undefined;
  let highlighted: Element | undefined;
  let pickTarget: Element | undefined;
  const shown = new Set<Element>();
  /** Shown tracks in viewport px, for the hover pill. */
  let hoverTracks: { rect: Rect; label: string }[] = [];

  // ----- scanning (section open only) -----
  const scan = (): void => {
    hasScanned = true;
    list = scanContainers(doc, host).map((f) => {
      let cached: string | undefined;
      return {
        ...f,
        audit: () => {
          cached ??= gapAudit(pairGaps(layoutChildren(f.el).map((c) => c.getBoundingClientRect())));
          return cached;
        },
      };
    });
  };
  let scanFrame = 0;
  const pageObserver = new MutationObserver(() => {
    if (!watching || scanFrame) return;
    scanFrame = requestAnimationFrame(() => {
      scanFrame = 0;
      if (!watching) return;
      scan();
      request();
      events.onChange();
    });
  });

  // ----- drawing (shown containers only) -----
  const labelOf = (target: Element): string =>
    list.find((i) => i.el === target)?.label ??
    baseLabel(target.tagName, Array.from(target.classList), target.id);

  const place = (e: HTMLElement, r: Rect, origin: Rect | undefined): void => {
    e.style.left = `${r.left - (origin?.left ?? 0)}px`;
    e.style.top = `${r.top - (origin?.top ?? 0)}px`;
    e.style.width = `${r.width}px`;
    e.style.height = `${r.height}px`;
  };
  /** A value box centred on a shaded area (0016): bare number, rounded per 0006. */
  const value = (kind: 'gap' | 'pad', r: Rect, size: number, origin: Rect | undefined) => {
    const v = el(`rval ${kind}`);
    v.textContent = String(snapValue(size));
    v.style.left = `${r.left + r.width / 2 - (origin?.left ?? 0)}px`;
    v.style.top = `${r.top + r.height / 2 - (origin?.top ?? 0)}px`;
    return v;
  };
  /** The container's name on the panel's dark grey, with its border-box size dimmed beside it (0017). */
  const tag = (text: string, border: Rect): HTMLElement => {
    const t = el('rtag');
    const name = doc.createElement('span');
    name.className = 'rname';
    name.textContent = text;
    const dim = doc.createElement('span');
    dim.className = 'rdim';
    dim.textContent = `${snapValue(border.width)} × ${snapValue(border.height)}`;
    t.append(name, dim);
    t.style.left = `${border.left}px`;
    t.style.top = `${border.top >= 16 ? border.top - 16 : border.top}px`;
    return t;
  };
  const drawAxis = (
    tracks: AxisTracks,
    x: boolean,
    layout: ContainerLayout,
    into: HTMLElement,
    origin: Rect | undefined,
  ): void => {
    if (typeof tracks === 'string') return;
    tracks.forEach((t, i) => {
      const r: Rect = x
        ? { left: t.start, top: layout.content.top, width: t.size, height: layout.content.height }
        : { left: layout.content.left, top: t.start, width: layout.content.width, height: t.size };
      const d = el(x ? 'rtrack col' : 'rtrack row');
      place(d, r, origin);
      into.append(d);
      hoverTracks.push({
        rect: r,
        label: `${i + 1} · ${Math.round(t.size * 10) / 10} px`,
      });
    });
  };

  const draw = (): void => {
    frame = 0;
    hoverTracks = [];
    const frag = doc.createDocumentFragment();
    let dropped = false;
    for (const target of [...shown]) {
      if (target.isConnected) continue;
      unwatch(target);
      shown.delete(target);
      dropped = true;
    }
    if (inspectTarget && !inspectTarget.isConnected) setInspectTarget(undefined);
    // While inspecting, only the hovered container is drawn; `shown` is left untouched (0018 §5).
    const targets = inspecting ? (inspectTarget ? [inspectTarget] : []) : [...shown];
    for (const target of targets) {
      const layout = measureContainer(target);
      if (!layout) continue;
      const group = el('rgroup');
      // Marks inside a scrolling container are clipped to its padding box.
      let into: HTMLElement = group;
      if (layout.clip) {
        into = el('rclip');
        place(into, layout.clip, undefined);
        group.append(into);
      }
      const origin = layout.clip;
      const box = el('rbox');
      place(box, layout.content, origin);
      into.append(box);
      // Columns first, so a pointer over both a column and a row reports the column.
      drawAxis(layout.columns, true, layout, into, origin);
      drawAxis(layout.rows, false, layout, into, origin);
      for (const p of layout.padding) {
        const d = el('rpad');
        place(d, p, origin);
        into.append(d, value('pad', p, p.size, origin));
      }
      for (const g of layout.gaps) {
        const d = el('rgap');
        place(d, g, origin);
        into.append(d, value('gap', g, g.size, origin));
      }
      let text = labelOf(target);
      if (layout.transformed) text += ' · transformed: tracks unavailable';
      else if (layout.kind === 'grid') {
        if (layout.columns === 'subgrid' || layout.rows === 'subgrid') text += ' · subgrid';
        else if (layout.columns === 'unavailable' && layout.rows === 'unavailable')
          text += ' · tracks unavailable';
      }
      group.append(tag(text, layout.border));
      frag.append(group);
    }
    marks.replaceChildren(frag);
    drawHighlight();
    if (dropped) events.onChange();
  };

  const drawHighlight = (): void => {
    const target = pickTarget ?? highlighted;
    if (!target?.isConnected) {
      hl.replaceChildren();
      return;
    }
    const r = target.getBoundingClientRect();
    const out = el('rout');
    place(out, r, undefined);
    hl.replaceChildren(out, tag(labelOf(target), r));
  };

  let frame = 0;
  const request = (): void => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  const sizeObserver = new ResizeObserver(request);
  const childObserver = new MutationObserver(request);
  const watch = (target: Element): void => {
    sizeObserver.observe(target);
    for (const c of Array.from(target.children)) sizeObserver.observe(c);
    childObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
  };
  const unwatch = (target: Element): void => {
    sizeObserver.unobserve(target);
    for (const c of Array.from(target.children)) sizeObserver.unobserve(c);
  };
  const rewatchChildren = (): void => {
    childObserver.disconnect();
    sizeObserver.disconnect();
    for (const t of shown) watch(t);
    if (inspectTarget) watch(inspectTarget);
  };
  const setInspectTarget = (next: Element | undefined): void => {
    if (next === inspectTarget) return;
    inspectTarget = next;
    rewatchChildren();
    request();
  };

  // Scrolling moves the page under a still pointer: hit-test again for Pick and the inspector
  // (spec 08), and hide the track pill, which sits where the pointer last moved.
  view.addEventListener(
    'scroll',
    () => {
      pill.hidden = true;
      if (lastPointer && (inspecting || picking)) {
        const next = containerAt(underPointer(lastPointer.x, lastPointer.y), host);
        if (inspecting) setInspectTarget(next);
        else if (next !== pickTarget) {
          pickTarget = next;
          drawHighlight();
        }
      }
      request();
    },
    { signal, capture: true, passive: true },
  );
  view.addEventListener('resize', request, { signal });

  // ----- track-size hover: hit-test only; the page still gets every pointer event -----
  view.addEventListener(
    'pointermove',
    (e) => {
      if (picking) return;
      if (!hoverTracks.length || marks.closest('[hidden]')) {
        pill.hidden = true;
        return;
      }
      const hit = hoverTracks.find(
        ({ rect: r }) =>
          e.clientX >= r.left &&
          e.clientX < r.left + r.width &&
          e.clientY >= r.top &&
          e.clientY < r.top + r.height,
      );
      if (!hit) {
        pill.hidden = true;
        return;
      }
      pill.textContent = hit.label;
      pill.style.left = `${e.clientX + 12}px`;
      pill.style.top = `${e.clientY + 12}px`;
      pill.hidden = false;
    },
    { signal, passive: true },
  );

  // ----- Pick -----
  const underPointer = (x: number, y: number): Element | null =>
    doc.elementsFromPoint(x, y).find((n) => n !== host && !host.contains(n)) ?? null;
  capture.addEventListener(
    'pointermove',
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY };
      const next = containerAt(underPointer(e.clientX, e.clientY), host);
      if (inspecting) {
        setInspectTarget(next);
        return;
      }
      if (next !== pickTarget) {
        pickTarget = next;
        drawHighlight();
      }
    },
    { signal },
  );
  // Over the panel or outside the window, the inspector shows nothing (spec 08).
  capture.addEventListener(
    'pointerleave',
    () => {
      lastPointer = undefined;
      if (inspecting) setInspectTarget(undefined);
    },
    { signal },
  );
  for (const type of CAPTURED) {
    capture.addEventListener(
      type,
      (e) => {
        // The page never sees a click while picking (0015): it lands on our layer and stops here.
        e.preventDefault();
        e.stopPropagation();
        // While inspecting, a click does nothing else (0018 §6).
        if (inspecting || type !== 'click') return;
        const me = e as MouseEvent;
        const target = containerAt(underPointer(me.clientX, me.clientY), host);
        api.cancelPick();
        if (target) {
          api.setShown(target, true);
          events.onPick(target);
        }
      },
      { signal },
    );
  }

  const api: Rendered = {
    element: root,
    setWatching(on) {
      if (on === watching) return;
      watching = on;
      if (on) {
        scan();
        pageObserver.observe(doc.body ?? doc.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style'],
        });
      } else {
        pageObserver.disconnect();
        if (scanFrame) cancelAnimationFrame(scanFrame);
        scanFrame = 0;
      }
    },
    scanned: () => hasScanned,
    items: () => list,
    isShown: (target) => shown.has(target),
    setShown(target, on) {
      if (on === shown.has(target)) return;
      if (on) {
        shown.add(target);
        watch(target);
      } else {
        shown.delete(target);
        rewatchChildren();
      }
      request();
      events.onChange();
    },
    highlight(target) {
      highlighted = target;
      drawHighlight();
    },
    startPick() {
      if (picking) return;
      api.stopInspect(); // never both on (0018 §7)
      picking = true;
      pill.hidden = true;
      capture.hidden = false;
      events.onChange();
    },
    cancelPick() {
      if (!picking) return;
      picking = false;
      pickTarget = undefined;
      capture.hidden = true;
      drawHighlight();
      events.onChange();
    },
    isPicking: () => picking,
    startInspect() {
      if (inspecting) return;
      api.cancelPick(); // never both on (0018 §7)
      inspecting = true;
      pill.hidden = true;
      capture.hidden = false;
      request();
      events.onChange();
    },
    stopInspect() {
      if (!inspecting) return;
      inspecting = false;
      capture.hidden = true;
      pill.hidden = true;
      setInspectTarget(undefined);
      request();
      events.onChange();
    },
    isInspecting: () => inspecting,
    setVisible(visible) {
      marks.hidden = !visible;
      if (!visible) pill.hidden = true;
    },
    destroy() {
      pageObserver.disconnect();
      sizeObserver.disconnect();
      childObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (scanFrame) cancelAnimationFrame(scanFrame);
    },
  };
  return api;
}
