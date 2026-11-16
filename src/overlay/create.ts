/** `createGridOverlay`: the public overlay (decisions 0002, 0005, 0006, 0007; spec 02). */
import {
  type Box,
  type Breakpoint,
  type BreakpointEntry,
  DEFAULT_BREAKPOINTS,
  type GridError,
  type GridWarning,
  type LayoutGridInput,
  mergeBreakpoints,
  normalizeBreakpoints,
  pickBreakpoint,
} from '../engine';
import { compareStatus, expectedEdges, TOLERANCE_DEFAULT } from './compare';
import { createPanel, PANEL_STYLES } from './panel';
import {
  type CompareSettings,
  fingerprint,
  type Position,
  type Stored,
  safeStorage,
  snippet,
  toInputs,
} from './persist';
import { renderBreakpoint, STYLES } from './render';
import { createInspectPill, createRendered, RENDERED_STYLES, setInspectPill } from './rendered';
import {
  type InspectShortcut,
  isFromEditable,
  matchesInspect,
  matchesPanel,
  matchesToggle,
  type PanelShortcut,
  type ToggleShortcut,
} from './shortcuts';

export interface GridOverlayOptions {
  /**
   * Edits to the default breakpoints, or new ones (0010). An entry whose `name`
   * matches a default (Mobile, Tablet, Desktop) edits it; a new name adds one.
   */
  readonly breakpoints?: readonly BreakpointEntry[];
  /** Merge `breakpoints` into the defaults. Default `true`; `false` uses only yours. */
  readonly extendDefaults?: boolean;
  /**
   * Keep panel edits across reloads while the code config is unchanged (0013). Default `true`;
   * `false` never reads or writes storage.
   */
  readonly persist?: boolean;
  /** Show the grid straight away. Default `true`. */
  readonly visible?: boolean;
  readonly shortcuts?: {
    /** Default `'Shift+G'` (Figma's shortcut). `'Mod+G'` is Cmd/Ctrl+G; `false` turns it off. */
    readonly toggle?: ToggleShortcut;
    /** Default `'Mod+Shift+G'` (Cmd/Ctrl+Shift+G) opens the control panel; `false` turns it off. */
    readonly panel?: PanelShortcut;
    /** Default `'Shift+M'` toggles the geometry inspector (0018); `false` turns it off. */
    readonly inspect?: InspectShortcut;
  };
}

export interface GridOverlay {
  show(): void;
  hide(): void;
  toggle(): void;
  isVisible(): boolean;
  update(options: GridOverlayOptions): void;
  /** Replaces the breakpoints live, with the same merge rules. Throws (and keeps the old grid) if invalid. */
  setBreakpoints(
    breakpoints: readonly BreakpointEntry[],
    options?: { readonly extendDefaults?: boolean },
  ): void;
  /** Opens the control panel (spec 03). Focus stays where it is. */
  openPanel(): void;
  closePanel(): void;
  isPanelOpen(): boolean;
  destroy(): void;
}

const PREFIX = '[grid-auditor]';
const HOST_TAG = 'grid-auditor';

let current: GridOverlay | undefined;

interface State {
  breakpoints: readonly Breakpoint[];
  toggle: ToggleShortcut;
  panel: PanelShortcut;
  inspect: InspectShortcut;
  visible: boolean;
}

function fail(errors: readonly { field: string; message: string }[]): never {
  const lines = errors.map((e) => `- breakpoints${e.field}: ${e.message}`);
  throw new Error(`${PREFIX} The options need a few fixes:\n${lines.join('\n')}`);
}

function parse(
  entries: readonly BreakpointEntry[] | undefined,
  extendDefaults: boolean | undefined,
): readonly Breakpoint[] {
  const merged = mergeBreakpoints(DEFAULT_BREAKPOINTS, entries, extendDefaults ?? true);
  if (!merged.ok) fail(merged.errors);
  const r = normalizeBreakpoints(merged.value);
  reportWarnings(r.warnings);
  if (!r.ok) fail(r.errors);
  return r.value;
}

function reportWarnings(warnings: readonly GridWarning[]): void {
  for (const w of warnings) console.warn(`${PREFIX} ${w.field}: ${w.message}`);
}

const noop: GridOverlay = {
  show() {},
  hide() {},
  toggle() {},
  isVisible: () => false,
  update() {},
  setBreakpoints() {},
  openPanel() {},
  closePanel() {},
  isPanelOpen: () => false,
  destroy() {},
};

/** The page target (0007): viewport width without the scrollbar, full document height. */
function measurePage(doc: Document): Box {
  const root = doc.documentElement;
  return { width: root.clientWidth, height: root.scrollHeight };
}

/**
 * Draws the expected Figma layout grid over the page. Calling it again while
 * an overlay exists updates and returns that same overlay.
 */
export function createGridOverlay(options: GridOverlayOptions = {}): GridOverlay {
  if (typeof window === 'undefined' || typeof document === 'undefined') return noop;
  if (current) {
    console.warn(`${PREFIX} An overlay already exists; updating it instead of creating another.`);
    current.update(options);
    return current;
  }

  const state: State = {
    breakpoints: parse(options.breakpoints, options.extendDefaults),
    toggle: options.shortcuts?.toggle ?? 'Shift+G',
    panel: options.shortcuts?.panel ?? 'Mod+Shift+G',
    inspect: options.shortcuts?.inspect ?? 'Shift+M',
    visible: options.visible ?? true,
  };

  // ----- persistence (0013, spec 04) -----
  let persist = options.persist ?? true;
  let codeBreakpoints = state.breakpoints;
  let codeFingerprint = fingerprint(codeBreakpoints);
  let edited = false;
  let setAside: { fingerprint: string; breakpoints: readonly Breakpoint[] } | undefined;
  let position: Position | undefined;
  /** Compare section preferences (0019 §5): saved, but never reset by code calls or Reset. */
  const COMPARE_DEFAULT: CompareSettings = { show: false, tolerance: TOLERANCE_DEFAULT };
  let compare: CompareSettings = COMPARE_DEFAULT;
  let warnedStorage = false;
  const storage = safeStorage(
    () => window.localStorage,
    (error) => {
      if (warnedStorage) return;
      warnedStorage = true;
      console.warn(
        `${PREFIX} Panel edits can't be saved (${String(error)}). They last until reload.`,
      );
    },
  );
  const load = (): void => {
    edited = false;
    setAside = undefined;
    position = undefined;
    compare = COMPARE_DEFAULT;
    if (!persist) return;
    const parsed = storage.read();
    if (!parsed) return;
    position = parsed.stored.panel;
    compare = parsed.stored.compare ?? COMPARE_DEFAULT;
    if (!parsed.breakpoints) return;
    if (parsed.stored.fingerprint === codeFingerprint) {
      state.breakpoints = parsed.breakpoints;
      edited = true;
    } else {
      setAside = { fingerprint: parsed.stored.fingerprint, breakpoints: parsed.breakpoints };
    }
  };
  let saveQueued = false;
  const writeNow = (): void => {
    saveQueued = false;
    if (!persist || destroyed) return;
    const base = edited
      ? { fingerprint: codeFingerprint, breakpoints: toInputs(state.breakpoints) }
      : setAside
        ? { fingerprint: setAside.fingerprint, breakpoints: toInputs(setAside.breakpoints) }
        : { fingerprint: codeFingerprint };
    const keepCompare =
      compare.show !== COMPARE_DEFAULT.show || compare.tolerance !== COMPARE_DEFAULT.tolerance;
    if (!('breakpoints' in base) && !position && !keepCompare) {
      storage.clear();
      return;
    }
    const entry: Stored = {
      version: 1,
      ...base,
      ...(position ? { panel: position } : {}),
      ...(keepCompare ? { compare } : {}),
    };
    storage.write(entry);
  };
  const save = (): void => {
    if (!persist || saveQueued) return;
    saveQueued = true;
    requestAnimationFrame(writeNow);
  };
  /** A code call replaced the config: drop edits (0013) and keep only the panel position. */
  const adoptCode = (): void => {
    codeBreakpoints = state.breakpoints;
    codeFingerprint = fingerprint(codeBreakpoints);
    edited = false;
    setAside = undefined;
    save();
  };
  load();

  const host = document.createElement(HOST_TAG);
  for (const [prop, value] of [
    ['position', 'fixed'],
    ['inset', '0'],
    ['pointer-events', 'none'],
    ['overflow', 'hidden'],
    ['z-index', '2147483646'],
    ['contain', 'strict'],
    ['display', 'block'],
  ] as const) {
    host.style.setProperty(prop, value, 'important');
  }
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLES + RENDERED_STYLES + PANEL_STYLES;
  const layer = document.createElement('div');
  layer.className = 'layer';
  layer.setAttribute('aria-hidden', 'true');

  const controller = new AbortController();
  const { signal } = controller;
  let frame = 0;
  let needsRender = true;
  let lastWarnings = '';
  let activeIndex = -1;

  const activeOf = (): number => {
    const bp = pickBreakpoint(window.innerWidth, state.breakpoints);
    return bp ? state.breakpoints.indexOf(bp) : -1;
  };

  // The rendered grid (0015, spec 07). Its callbacks run later, once `panel` exists.
  const rendered = createRendered(
    document,
    host,
    {
      onChange: () => {
        setInspectPill(inspectPill, rendered.isInspecting());
        panel.syncRendered();
      },
      onPick: (el) => panel.picked(el),
      expectedEdges: () => expectedEdges(state.breakpoints[activeOf()], measurePage(document)),
      onCompare: () => panel.syncCompare(),
    },
    signal,
  );
  rendered.setCompare(compare.show, compare.tolerance);
  const statusText = (): string | undefined => {
    const stats = rendered.compareStats();
    return stats && compareStatus(stats, compare.tolerance, state.inspect !== false);
  };

  const panel = createPanel(
    document,
    {
      rendered: () => rendered,
      compare: () => compare,
      setCompare(next) {
        if (destroyed) return;
        compare = next;
        rendered.setCompare(next.show, next.tolerance);
        save();
      },
      compareStatus: statusText,
      breakpoints: () => state.breakpoints,
      activeIndex: () => activeIndex,
      setGrids(index, grids): readonly GridError[] {
        const bp = state.breakpoints[index];
        if (!bp || destroyed) return [];
        const r = normalizeBreakpoints([
          {
            minWidth: bp.minWidth,
            grids: grids as LayoutGridInput[],
            ...(bp.name === undefined ? {} : { name: bp.name }),
          },
        ]);
        if (!r.ok) return r.errors;
        const next = [...state.breakpoints];
        next[index] = r.value[0] as Breakpoint;
        state.breakpoints = next;
        edited = true;
        save();
        schedule(true);
        panel.sync('panel');
        return [];
      },
      isEdited: () => edited,
      hasSetAside: () => setAside !== undefined,
      restore() {
        if (!setAside) return;
        state.breakpoints = setAside.breakpoints;
        setAside = undefined;
        edited = true;
        save();
        activeIndex = activeOf();
        schedule(true);
        panel.sync('code');
      },
      discard() {
        setAside = undefined;
        save();
        panel.sync('code');
      },
      reset() {
        state.breakpoints = codeBreakpoints;
        edited = false;
        save();
        activeIndex = activeOf();
        schedule(true);
        panel.sync('code');
      },
      snippet: () => snippet(state.breakpoints),
      position: () => position,
      savePosition(p) {
        position = p;
        save();
      },
      isVisible: () => state.visible,
      setVisible: (v) => (v ? overlay.show() : overlay.hide()),
      close: () => overlay.closePanel(),
      box: () => measurePage(document),
    },
    signal,
  );
  // The inspector pill sits outside the aria-hidden rendered layer, so it's announced (spec 08).
  const inspectPill = createInspectPill(document);
  shadow.append(style, layer, rendered.element, inspectPill, panel.element);
  document.documentElement.append(host);

  const flush = (): void => {
    frame = 0;
    if (needsRender) {
      needsRender = false;
      const index = activeOf();
      const bp = state.breakpoints[index];
      if (index !== activeIndex) {
        activeIndex = index;
        panel.sync('resize');
      }
      const warnings = renderBreakpoint(layer, bp, measurePage(document));
      // The expected edges may have moved: compare again (spec 06).
      rendered.refresh();
      const key = JSON.stringify(warnings);
      if (key !== lastWarnings) {
        lastWarnings = key;
        reportWarnings(warnings);
      }
    }
    layer.style.transform = `translate(${-window.scrollX}px, ${-window.scrollY}px)`;
    layer.hidden = !state.visible;
    rendered.setVisible(state.visible);
  };
  const schedule = (render: boolean): void => {
    if (render) needsRender = true;
    if (frame === 0) frame = requestAnimationFrame(flush);
  };

  window.addEventListener(
    'resize',
    () => {
      schedule(true);
      panel.clamp();
    },
    { signal },
  );
  window.addEventListener('scroll', () => schedule(false), { signal, passive: true });
  // Esc cancels Pick or ends the inspector before anything else closes (specs 07, 08), and
  // Shift+M ends the inspector. Registered before the other key listeners.
  window.addEventListener(
    'keydown',
    (event) => {
      const inspecting = rendered.isInspecting();
      if (event.key === 'Escape' && (rendered.isPicking() || inspecting)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        rendered.cancelPick();
        rendered.stopInspect();
        return;
      }
      if (inspecting && !isFromEditable(event) && matchesInspect(event, state.inspect)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        rendered.stopInspect();
      }
    },
    { signal, capture: true },
  );
  window.addEventListener(
    'keydown',
    (event) => {
      if (isFromEditable(event)) return;
      if (matchesPanel(event, state.panel)) {
        event.preventDefault();
        if (panel.isOpen()) overlay.closePanel();
        else overlay.openPanel();
        return;
      }
      if (matchesInspect(event, state.inspect)) {
        rendered.startInspect();
        return;
      }
      if (!matchesToggle(event, state.toggle)) return;
      if (state.toggle === 'Mod+G') event.preventDefault();
      overlay.toggle();
    },
    { signal, capture: true },
  );
  // Keys typed in the panel stay in the panel (spec 03): run its handlers here, then stop the
  // event so no page key listener added after the overlay sees it. Default actions still run.
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    window.addEventListener(
      type,
      (event) => {
        if (!panel.owns(event)) return;
        panel.handleKey(event);
        event.stopImmediatePropagation();
      },
      { signal, capture: true },
    );
  }

  const observer = new ResizeObserver(() => schedule(true));
  observer.observe(document.documentElement);
  if (document.body) observer.observe(document.body);

  let destroyed = false;
  const overlay: GridOverlay = {
    show() {
      state.visible = true;
      schedule(false);
      panel.sync('panel');
    },
    hide() {
      state.visible = false;
      schedule(false);
      panel.sync('panel');
    },
    toggle() {
      state.visible = !state.visible;
      schedule(false);
      panel.sync('panel');
    },
    isVisible: () => state.visible,
    update(next) {
      if (destroyed) return;
      state.breakpoints = parse(next.breakpoints, next.extendDefaults);
      if (next.persist !== undefined) persist = next.persist;
      adoptCode();
      state.toggle = next.shortcuts?.toggle ?? 'Shift+G';
      state.panel = next.shortcuts?.panel ?? 'Mod+Shift+G';
      state.inspect = next.shortcuts?.inspect ?? 'Shift+M';
      panel.syncCompare();
      if (next.visible !== undefined) state.visible = next.visible;
      activeIndex = activeOf();
      schedule(true);
      panel.sync('code');
    },
    setBreakpoints(breakpoints, opts) {
      if (destroyed) return;
      state.breakpoints = parse(breakpoints, opts?.extendDefaults);
      adoptCode();
      activeIndex = activeOf();
      schedule(true);
      panel.sync('code');
    },
    openPanel() {
      if (destroyed) return;
      panel.setOpen(true);
    },
    closePanel() {
      if (destroyed) return;
      panel.setOpen(false);
    },
    isPanelOpen: () => panel.isOpen(),
    destroy() {
      if (destroyed) return;
      if (saveQueued) writeNow();
      destroyed = true;
      controller.abort();
      observer.disconnect();
      rendered.destroy();
      if (frame !== 0) cancelAnimationFrame(frame);
      host.remove();
      if (current === overlay) current = undefined;
    },
  };

  current = overlay;
  flush(); // first paint synchronously so the grid is there straight away
  return overlay;
}
