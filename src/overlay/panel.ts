/**
 * The control panel: Layout guide section (decisions 0012 and 0014, spec 03; design brief §10–12).
 * Each grid is one compact row; its fields open in a popover, as in Figma.
 * It holds no grid state of its own: it reads the store and writes through `setGrids`.
 */
import {
  type Box,
  type Breakpoint,
  computeSections,
  type GridError,
  type LayoutGrid,
  type LayoutGridInput,
} from '../engine';
import { type Position, toInput } from './persist';

export interface PanelStore {
  breakpoints(): readonly Breakpoint[];
  /** Index of the active breakpoint in `breakpoints()`, or -1. */
  activeIndex(): number;
  /** Replaces one breakpoint's grids. Returns the errors (empty when applied). */
  setGrids(index: number, grids: readonly LayoutGridInput[]): readonly GridError[];
  isVisible(): boolean;
  setVisible(visible: boolean): void;
  close(): void;
  box(): Box;
  /** Panel edits are applied (0013). */
  isEdited(): boolean;
  /** Saved edits were set aside because the code config changed. */
  hasSetAside(): boolean;
  restore(): void;
  discard(): void;
  /** Drops the edits and shows the code config again. */
  reset(): void;
  /** The "Copy config" text. */
  snippet(): string;
  position(): Position | undefined;
  savePosition(position: Position): void;
}

/** Why the panel is re-syncing: code replaces everything; panel and resize keep in-progress fields. */
export type SyncSource = 'code' | 'panel' | 'resize';

export interface Panel {
  readonly element: HTMLElement;
  sync(source: SyncSource): void;
  setOpen(open: boolean): void;
  isOpen(): boolean;
  /** Keeps the panel inside the viewport after a resize. */
  clamp(): void;
  /** True when the event started inside the panel. */
  owns(event: Event): boolean;
  /**
   * Runs the panel's own key handling. The overlay calls this from its window capture
   * listener, then stops the event so the page's key listeners never see panel typing.
   */
  handleKey(event: KeyboardEvent): void;
}

/** Colours, font and sizes from decision 0014 (Figma's dark UI). */
export const PANEL_STYLES = `
.panel {
  --ga-bg: #2c2c2c; --ga-border: #444; --ga-primary: #0c8ce9; --ga-secondary: #383838;
  --ga-active: #32394d; --ga-text: #ffffff; --ga-muted: rgb(255 255 255 / 0.7); --ga-error: #ff8a8a;
  --ga-font: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, "Noto Sans", sans-serif, SFProLocalRange;
  position: absolute; top: 12px; right: 12px; box-sizing: border-box;
  width: min(260px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
  display: flex; flex-direction: column; pointer-events: auto;
  background: var(--ga-bg); color: var(--ga-text); border: 1px solid var(--ga-border);
  border-radius: 8px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.35), 0 1px 3px rgb(0 0 0 / 0.3);
  font: 400 11px/16px var(--ga-font); font-variant-numeric: tabular-nums;
  text-align: left; letter-spacing: normal; opacity: 1; transition: opacity 120ms ease-out;
}
@starting-style { .panel { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .panel { transition: none; } }
.panel[hidden], .panel [hidden] { display: none !important; }
.panel *, .panel *::before, .panel *::after { box-sizing: border-box; }
.head { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 8px 0 16px;
  border-bottom: 1px solid var(--ga-border); cursor: grab; user-select: none; touch-action: none; }
.head.dragging { cursor: grabbing; }
.title { flex: 1; font-weight: 600; margin: 0; font-size: 12px; }
.body { overflow: auto; overscroll-behavior: contain; padding: 8px 0; }
.badge { margin: 0 16px 8px; padding: 4px 8px; border-radius: 5px; background: var(--ga-secondary);
  color: var(--ga-muted); font-weight: 500; }
.section-head { display: flex; align-items: center; gap: 4px; height: 32px; padding: 0 8px 0 16px; }
.section-head h3 { flex: 1; margin: 0; font-size: 11px; font-weight: 600; }
.list { position: relative; padding-bottom: 4px; }
.grid { display: flex; align-items: center; gap: 2px; height: 32px; padding: 0 8px 0 0; }
.grid.selected { background: var(--ga-active); }
.grid .grip { min-width: 16px; width: 16px; color: var(--ga-muted); cursor: grab; opacity: 0;
  touch-action: none; }
.grid:hover .grip, .grid .grip:focus-visible, .grid.dragging .grip { opacity: 1; }
.grid.dragging { opacity: 0.6; }
.drop-line { position: absolute; left: 8px; right: 8px; height: 2px; margin-top: -1px;
  background: var(--ga-primary); pointer-events: none; }
.summary { flex: 1; min-width: 0; justify-content: space-between; gap: 4px; height: 24px;
  margin: 0 2px; padding: 0 4px 0 8px; border: 1px solid var(--ga-border); color: var(--ga-text); }
.summary span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.summary svg { color: var(--ga-muted); }
.panel .summary:hover { background: transparent; }
.grid.selected .summary { border-color: var(--ga-primary); }
.prow { display: grid; grid-template-columns: 64px 1fr; align-items: center; gap: 8px;
  min-height: 32px; padding: 0 16px; }
.prow > span:first-child { color: var(--ga-muted); }
.unit { display: flex; align-items: center; height: 24px; border: 1px solid transparent;
  border-radius: 5px; background: var(--ga-secondary); padding: 0 8px; gap: 6px; min-width: 0; }
.unit.outline { background: transparent; border-color: var(--ga-border); padding-right: 4px; }
.unit:focus-within { border-color: var(--ga-primary); }
.unit input { flex: 1; min-width: 0; height: 22px; border: 0; padding: 0; background: transparent;
  color: var(--ga-text); font: inherit; outline: none; }
.unit input:disabled { color: rgb(255 255 255 / 0.45); }
.unit:has(input:disabled) { background: transparent; border-color: var(--ga-secondary); }
.unit small { color: var(--ga-muted); font: inherit; }
.unit .sep { align-self: stretch; width: 1px; background: var(--ga-bg); }
.unit .hex { flex: 1; }
.unit .pct { flex: 0 0 22px; text-align: right; }
.unit input[type="color"] { flex: 0 0 14px; width: 14px; height: 14px; padding: 0; border: 0;
  border-radius: 2px; background: none; cursor: pointer; }
.unit input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
.unit input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 2px; }
.unit input[type="color"]::-moz-color-swatch { border: 0; border-radius: 2px; }
.combo { position: relative; flex: 0 0 16px; width: 16px; height: 16px; color: var(--ga-muted); }
.combo svg { position: absolute; inset: 0; pointer-events: none; }
.combo select { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; opacity: 0;
  cursor: pointer; }
.unit:has([aria-invalid="true"]) { border-color: var(--ga-error); }
.error { color: var(--ga-error); line-height: 14px; margin: 0; padding: 0 16px 4px 88px; }
select { height: 24px; min-width: 0; border: 1px solid var(--ga-border); border-radius: 5px;
  color: var(--ga-text); font: inherit; padding: 0 24px 0 8px; appearance: none; cursor: pointer;
  background: transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M5.5 6.75 8 9.25l2.5-2.5' fill='none' stroke='%23b3b3b3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 4px center / 16px; }select option { background: var(--ga-bg); color: var(--ga-text); }
button { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px;
  padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--ga-text);
  font: inherit; cursor: pointer; }
button:hover { background: var(--ga-secondary); }
.grid.selected button:not(.summary):hover { background: rgb(255 255 255 / 0.08); }
svg { width: 16px; height: 16px; flex: 0 0 16px; fill: none; stroke: currentColor; stroke-width: 1;
  stroke-linecap: round; stroke-linejoin: round; }
svg .dot { fill: currentColor; stroke: none; }
button[aria-pressed="false"] { color: var(--ga-muted); }
.title:focus-visible, select:focus-visible, button:focus-visible, .section-head h3:focus-visible {
  outline: 2px solid var(--ga-primary); outline-offset: 1px; }
.switch { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 4px;
  color: var(--ga-muted); }
.switch .track { width: 24px; height: 14px; border-radius: 7px; background: #5a5a5a; position: relative; }
.switch .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px;
  border-radius: 50%; background: var(--ga-text); }
.switch[aria-checked="true"] .track { background: var(--ga-primary); }
.switch[aria-checked="true"] .track::after { left: 12px; }
kbd { font: 400 11px var(--ga-font); color: var(--ga-muted); border: 1px solid var(--ga-border);
  border-radius: 4px; padding: 0 3px; }
.empty { margin: 4px 16px; color: var(--ga-muted); }
.text-btn { padding: 0 8px; color: var(--ga-text); background: var(--ga-secondary); }
.text-btn:hover { background: var(--ga-active); }
.notice { margin: 0 16px 8px; padding: 8px; border-radius: 5px; background: var(--ga-secondary);
  border: 1px solid var(--ga-border); line-height: 14px; }
.notice p { margin: 0 0 6px; }
.notice .row, .footer { display: flex; gap: 6px; align-items: center; }
.footer { padding: 8px 16px 0; border-top: 1px solid var(--ga-border); flex-wrap: wrap; }
.footer .status { color: var(--ga-muted); }
.footer textarea { width: 100%; height: 120px; margin-top: 4px; resize: vertical;
  background: var(--ga-secondary); color: var(--ga-text); border: 1px solid var(--ga-border);
  border-radius: 5px; padding: 6px; font: 400 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace; }
.footer .note { width: 100%; margin: 4px 0 0; color: var(--ga-error); }
.popover { position: absolute; top: 0; width: 240px; background: var(--ga-bg);
  border: 1px solid var(--ga-border); border-radius: 8px; padding-bottom: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.35), 0 1px 3px rgb(0 0 0 / 0.3); }
.popover .phead { display: flex; align-items: center; justify-content: space-between; height: 48px;
  padding: 0 8px 0 16px; border-bottom: 1px solid var(--ga-border); margin-bottom: 8px; }
.menu { position: absolute; z-index: 1; min-width: 120px; padding: 4px 0; background: #1e1e1e;
  border-radius: 6px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.35), 0 1px 3px rgb(0 0 0 / 0.3); }
.menu button { display: flex; width: 100%; justify-content: flex-start; gap: 4px; height: 24px;
  padding: 0 12px 0 4px; border-radius: 0; color: var(--ga-text); }
.menu button:hover, .menu button:focus-visible { background: var(--ga-primary); outline: none; }
.menu button[aria-selected="false"] svg { visibility: hidden; }
`;

/** Our own 16 px icons, drawn in Figma's style (0014). */
const ICONS = {
  eye: '<path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4Z"/><circle cx="8" cy="8" r="1.75"/>',
  eyeOff:
    '<path d="M2.5 2.5l11 11M6.6 4.2A5.6 5.6 0 0 1 8 4c3.8 0 6 4 6 4a11 11 0 0 1-1.7 2.2M4.3 5.3A11 11 0 0 0 2 8s2.2 4 6 4a5.6 5.6 0 0 0 2.5-.6"/>',
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  minus: '<path d="M3.5 8h9"/>',
  close: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
  chevron: '<path d="M5.5 6.75 8 9.25l2.5-2.5"/>',
  check: '<path d="M4 8.25 6.75 11 12 5.5"/>',
  COLUMNS: '<rect x="3.5" y="3.5" width="9" height="9" rx="0.5"/><path d="M6.5 3.5v9M9.5 3.5v9"/>',
  ROWS: '<rect x="3.5" y="3.5" width="9" height="9" rx="0.5"/><path d="M3.5 6.5h9M3.5 9.5h9"/>',
  GRID: '<rect x="3.5" y="3.5" width="9" height="9" rx="0.5"/><path d="M6.5 3.5v9M9.5 3.5v9M3.5 6.5h9M3.5 9.5h9"/>',
  grip: [5, 8, 11]
    .flatMap((y) => [6, 10].map((x) => `<circle class="dot" cx="${x}" cy="${y}" r="1"/>`))
    .join(''),
};

/** Figma's default for a new column grid. */
const NEW_GRID: LayoutGridInput = {
  pattern: 'COLUMNS',
  alignment: 'STRETCH',
  count: 5,
  gutterSize: 20,
  offset: 0,
};

const PATTERN_LABELS = { COLUMNS: 'Columns', ROWS: 'Rows', GRID: 'Grid' } as const;

const isMac = (): boolean => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** The active breakpoint only, e.g. "Desktop"; grid details live in the rows (0014 §8). */
export function badgeText(bp: Breakpoint | undefined): string {
  if (!bp) return 'No breakpoint';
  return bp.name ?? `From ${bp.minWidth} px`;
}

/** The row summary, as Figma writes it: "12 columns", "2000 rows (10px)", "Grid 10px". */
export function summaryText(g: LayoutGrid): string {
  if (g.pattern === 'GRID') return `Grid ${g.sectionSize}px`;
  const noun = g.pattern === 'COLUMNS' ? 'column' : 'row';
  const count = g.count === 'auto' ? 'Auto' : String(g.count);
  const plural = g.count === 1 ? noun : `${noun}s`;
  const size = g.alignment === 'STRETCH' ? '' : ` (${g.sectionSize}px)`;
  return `${count} ${plural}${size}`;
}

type Field = 'count' | 'sectionSize' | 'gutterSize' | 'offset' | 'opacity';

const MESSAGES: Record<string, string> = {
  count: 'Count must be a whole number, 1 or more.',
  countAuto: 'Count must be a whole number, 1 or more, or Auto.',
  sectionSize: 'Size must be above 0.',
  gutterSize: 'Gutter must be 0 or more.',
  offset: 'Must be 0 or more.',
  opacity: 'Opacity must be between 0 and 100.',
  number: 'Enter a number.',
};

/** Splits a CSS colour into a hex swatch and an opacity %. `probe` resolves any CSS colour. */
function splitColor(color: string, probe: HTMLElement): { hex: string; opacity: number } {
  probe.style.color = '';
  probe.style.color = color;
  const m = getComputedStyle(probe).color.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/,
  );
  if (!m) return { hex: '#ff0000', opacity: 100 };
  const hex = `#${[m[1], m[2], m[3]]
    .map((v) => Math.round(Number(v)).toString(16).padStart(2, '0'))
    .join('')}`;
  const a =
    m[4] === undefined ? 1 : m[4].endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number(m[4]);
  return { hex, opacity: Math.round(a * 100) };
}

const joinColor = (hex: string, opacity: number): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(opacity) / 100})`;
};

export function createPanel(doc: Document, store: PanelStore, signal: AbortSignal): Panel {
  const el = (tag: string, props: Record<string, string> = {}, text?: string): HTMLElement => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const icon = (name: keyof typeof ICONS): string =>
    `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

  const root = el('div', {
    class: 'panel',
    role: 'dialog',
    'aria-modal': 'false',
    'aria-labelledby': 'ga-title',
  });
  root.hidden = true;
  const head = el('div', { class: 'head' });
  const title = el('h2', { class: 'title', id: 'ga-title', tabindex: '-1' }, 'Grid Auditor');
  const visSwitch = el('button', {
    type: 'button',
    class: 'switch',
    role: 'switch',
    'aria-label': 'Show grid (Shift+G)',
  });
  visSwitch.innerHTML = '<span class="track"></span><kbd>⇧G</kbd>';
  const closeBtn = el('button', {
    type: 'button',
    'aria-label': `Close panel (${isMac() ? '⌘' : 'Ctrl'}+Shift+G)`,
    title: 'Close',
  });
  closeBtn.innerHTML = icon('close');
  head.append(title, visSwitch, closeBtn);
  const body = el('div', { class: 'body' });
  const probe = el('span', { hidden: '' });
  root.append(head, body, probe);

  // Events that start in the panel never reach the page (spec 03). Page events are untouched.
  for (const type of [
    'keydown',
    'keyup',
    'keypress',
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'pointerdown',
    'pointerup',
    'contextmenu',
    'input',
    'change',
  ]) {
    root.addEventListener(type, (e) => e.stopPropagation(), { signal });
  }
  /** Per-element key handlers, run by `handleKey` (the event never reaches the element's own listeners). */
  const keyHandlers = new WeakMap<EventTarget, (e: KeyboardEvent) => void>();
  visSwitch.addEventListener('click', () => store.setVisible(!store.isVisible()), { signal });
  closeBtn.addEventListener('click', () => store.close(), { signal });

  // Dragging by the header, kept inside the viewport.
  let pos: { x: number; y: number } | undefined;
  const place = (): void => {
    if (pos) {
      const r = root.getBoundingClientRect();
      const vw = doc.documentElement.clientWidth;
      const vh = doc.documentElement.clientHeight;
      pos = {
        x: Math.min(Math.max(0, pos.x), Math.max(0, vw - r.width)),
        y: Math.min(Math.max(0, pos.y), Math.max(0, vh - r.height)),
      };
      root.style.left = `${pos.x}px`;
      root.style.top = `${pos.y}px`;
      root.style.right = 'auto';
    }
    placePopover();
  };
  head.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || (e.target as Element).closest('button')) return;
      const r = root.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      try {
        head.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointers can't be captured; dragging still works while over the header.
      }
      head.classList.add('dragging');
      const move = (m: PointerEvent): void => {
        pos = { x: m.clientX - dx, y: m.clientY - dy };
        place();
      };
      const up = (): void => {
        head.classList.remove('dragging');
        if (pos) store.savePosition(pos);
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', up);
      };
      head.addEventListener('pointermove', move, { signal });
      head.addEventListener('pointerup', up, { signal });
      head.addEventListener('pointercancel', up, { signal });
    },
    { signal },
  );

  // ----- rendering -----

  let shapeKey = '';
  let renderedIndex = -2;
  const fieldErrors = new Map<string, string>();
  /** The selected row and the row whose popover is open (progressive disclosure, 0014). */
  let selected = -1;
  let openGrid = -1;
  let popover: HTMLElement | undefined;
  /** Set while the panel re-renders: removing a focused field fires `change`, which must not commit. */
  let rebuilding = false;

  const active = (): { index: number; bp: Breakpoint | undefined } => {
    const index = store.activeIndex();
    return { index, bp: store.breakpoints()[index] };
  };

  const shapeOf = (index: number, bp: Breakpoint | undefined): string =>
    `${index}|${store.hasSetAside()}|${openGrid}|${(bp?.grids ?? [])
      .map((g) => (g.pattern === 'GRID' ? 'G' : `${g.pattern}:${g.alignment}`))
      .join(',')}`;

  /** Writes grid `j` with `patch` applied; reports errors on `key` (the field's data-key). */
  const commit = (j: number, patch: Partial<LayoutGridInput>, key?: string): boolean => {
    const { index, bp } = active();
    if (!bp) return false;
    const grids = bp.grids.map(toInput);
    const base = grids[j];
    if (!base) return false;
    let next = { ...base, ...patch } as LayoutGridInput;
    // Drop fields that the new pattern or alignment doesn't use.
    next = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== undefined),
    ) as unknown as LayoutGridInput;
    if (next.pattern === 'GRID') {
      next = {
        pattern: 'GRID',
        sectionSize: next.sectionSize ?? 8,
        visible: next.visible ?? true,
        color: next.color ?? base.color ?? '',
      };
    } else {
      const { sectionSize, offset, ...rest } = next;
      next = {
        ...rest,
        ...(next.alignment === 'CENTER' ? {} : { offset: offset ?? 0 }),
        ...(next.alignment === 'STRETCH' ? {} : { sectionSize }),
      };
    }
    grids[j] = next;
    const errors = store.setGrids(index, grids);
    if (key) {
      const prefix = `grids[${j}].`;
      const err = errors.find((e) => e.field.includes(prefix));
      if (err) {
        const field = err.field.slice(err.field.indexOf(prefix) + prefix.length);
        const auto = field === 'count' && next.pattern !== 'GRID' && next.alignment !== 'STRETCH';
        setError(key, MESSAGES[auto ? 'countAuto' : field] ?? err.message);
        return false;
      }
      setError(key, undefined);
    }
    return errors.length === 0;
  };

  const setError = (key: string, message: string | undefined): void => {
    if (message === undefined) fieldErrors.delete(key);
    else fieldErrors.set(key, message);
    const input = root.querySelector<HTMLInputElement>(`[data-key="${key}"]`);
    if (!input) return;
    const errId = `${key}-error`;
    root.querySelector(`#${CSS.escape(errId)}`)?.remove();
    if (message === undefined) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      return;
    }
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', errId);
    const p = el('p', { class: 'error', id: errId }, message);
    input.closest('.prow')?.after(p);
  };

  /** One popover row: the label on the left, the control on the right (0014). */
  const prow = (label: string, control: HTMLElement): HTMLElement => {
    const row = el('label', { class: 'prow' });
    row.append(el('span', {}, label), control);
    return row;
  };

  /** A number input: arrows step by 1 (Shift: 10), Enter or blur commits. */
  const numberInput = (
    j: number,
    field: Field,
    label: string,
    value: string,
    onCommit: (raw: string, key: string) => void,
    stepFrom: () => number,
  ): HTMLInputElement => {
    const key = `g${j}-${field}`;
    const input = el('input', {
      type: 'text',
      inputmode: 'decimal',
      autocomplete: 'off',
      spellcheck: 'false',
      'data-key': key,
      'aria-label': `${label}, grid ${j + 1}`,
    }) as HTMLInputElement;
    input.value = value;
    let committed = value;
    const run = (): void => {
      if (rebuilding) return;
      if (input.value === committed && !input.hasAttribute('aria-invalid')) return;
      committed = input.value;
      onCommit(input.value.trim(), key);
    };
    input.addEventListener('change', run, { signal });
    keyHandlers.set(input, (e) => {
      if (e.key === 'Enter') run();
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        const n = Number.parseFloat(input.value);
        input.value = String(Math.max(0, (Number.isFinite(n) ? n : stepFrom()) + step));
        run();
      }
    });
    return input;
  };

  const numberRow = (
    j: number,
    field: Field,
    label: string,
    value: string,
    onCommit: (raw: string, key: string) => void,
    stepFrom: () => number,
  ): HTMLElement => {
    const box = el('span', { class: 'unit' });
    box.append(numberInput(j, field, label, value, onCommit, stepFrom));
    return prow(label, box);
  };

  const parseNumber = (raw: string, key: string): number | undefined => {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) {
      setError(key, MESSAGES.number);
      return undefined;
    }
    return n;
  };

  const select = (
    key: string,
    label: string,
    options: readonly (readonly [string, string])[],
    value: string,
    onChange: (v: string) => void,
  ): HTMLSelectElement => {
    const s = el('select', { 'aria-label': label, 'data-key': key }) as HTMLSelectElement;
    for (const [v, t] of options) s.append(el('option', { value: v }, t));
    s.value = value;
    s.addEventListener('change', () => onChange(s.value), { signal });
    return s;
  };

  const setPattern = (j: number, p: LayoutGrid['pattern']): void => {
    const g = active().bp?.grids[j];
    if (!g || g.pattern === p) return;
    if (p === 'GRID') commit(j, { pattern: 'GRID', sectionSize: 8 });
    else if (g.pattern === 'GRID')
      commit(j, { ...NEW_GRID, pattern: p, color: g.color, visible: g.visible });
    else commit(j, { pattern: p });
  };

  const moveGrid = (from: number, to: number): void => {
    const { index, bp } = active();
    if (!bp || from === to || to < 0 || to >= bp.grids.length) return;
    const grids = bp.grids.map(toInput);
    const [g] = grids.splice(from, 1);
    if (!g) return;
    grids.splice(to, 0, g);
    const follow = (k: number): number =>
      k === from ? to : from < k && k <= to ? k - 1 : to <= k && k < from ? k + 1 : k;
    selected = follow(selected);
    openGrid = follow(openGrid);
    store.setGrids(index, grids);
  };

  const selectRow = (j: number): void => {
    selected = j;
    for (const row of body.querySelectorAll<HTMLElement>('.grid')) {
      row.classList.toggle('selected', row.dataset.index === String(j));
    }
  };

  const openPopover = (j: number): void => {
    selectRow(j);
    openGrid = openGrid === j ? -1 : j;
    shapeKey = '';
    sync('panel');
    if (openGrid === j) {
      const first = root.querySelector<HTMLElement>(
        '.popover input:not([type="color"]):not(:disabled)',
      );
      first?.focus({ preventScroll: true });
      if (first instanceof HTMLInputElement) first.select();
    }
  };

  /** The grid-type menu under a row's summary: Grid, Columns, Rows, as in Figma. */
  let menu: HTMLElement | undefined;
  const closeMenu = (focusBack = true): void => {
    if (!menu) return;
    const j = Number(menu.dataset.index);
    menu.remove();
    menu = undefined;
    const s = root.querySelector<HTMLElement>(`[data-key="g${j}-summary"]`);
    s?.setAttribute('aria-expanded', 'false');
    if (focusBack) s?.focus({ preventScroll: true });
  };
  const toggleMenu = (j: number, anchor: HTMLElement): void => {
    const was = menu && Number(menu.dataset.index) === j;
    closeMenu(false);
    if (was) return;
    const g = active().bp?.grids[j];
    if (!g) return;
    const m = el('div', {
      class: 'menu',
      role: 'listbox',
      'aria-label': `Type, grid ${j + 1}`,
      'data-index': String(j),
    });
    const order = ['GRID', 'COLUMNS', 'ROWS'] as const;
    const items = order.map((p) => {
      const b = el('button', {
        type: 'button',
        role: 'option',
        'aria-selected': String(g.pattern === p),
        'data-key': `g${j}-type-${p.toLowerCase()}`,
      });
      b.innerHTML = `${icon('check')}<span>${PATTERN_LABELS[p]}</span>`;
      b.addEventListener(
        'click',
        () => {
          closeMenu();
          setPattern(j, p);
          root
            .querySelector<HTMLElement>(`[data-key="g${j}-summary"]`)
            ?.focus({ preventScroll: true });
        },
        { signal },
      );
      keyHandlers.set(b, (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const k = items.indexOf(b) + (e.key === 'ArrowDown' ? 1 : -1);
        items[(k + items.length) % items.length]?.focus({ preventScroll: true });
      });
      return b;
    });
    m.append(...items);
    const r = root.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    m.style.left = `${a.left - r.left}px`;
    m.style.top = `${a.bottom - r.top + 2}px`;
    root.append(m);
    menu = m;
    selectRow(j);
    root
      .querySelector<HTMLElement>(`[data-key="g${j}-summary"]`)
      ?.setAttribute('aria-expanded', 'true');
    (items[order.indexOf(g.pattern)] ?? items[0])?.focus({ preventScroll: true });
  };
  doc.addEventListener(
    'pointerdown',
    (e) => {
      if (!menu) return;
      const path = e.composedPath();
      const anchor = root.querySelector(`[data-key="g${menu.dataset.index}-summary"]`);
      // Its own summary toggles the menu on click, so leave that to the click handler.
      if (!path.includes(menu) && !(anchor && path.includes(anchor))) closeMenu(false);
    },
    { signal, capture: true },
  );

  const closePopover = (): void => {
    if (openGrid < 0) return;
    const j = openGrid;
    openGrid = -1;
    shapeKey = '';
    sync('panel');
    root.querySelector<HTMLElement>(`[data-key="g${j}-type"]`)?.focus({ preventScroll: true });
  };

  /** Starts a drag on a row's handle; the drop line shows where it will land. */
  const startReorder = (e: PointerEvent, j: number, row: HTMLElement, list: HTMLElement): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    const grip = e.currentTarget as HTMLElement;
    try {
      grip.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointers can't be captured.
    }
    row.classList.add('dragging');
    const line = el('div', { class: 'drop-line', 'aria-hidden': 'true' });
    list.append(line);
    let target = j;
    const rowsNow = (): HTMLElement[] => Array.from(list.querySelectorAll<HTMLElement>('.grid'));
    const move = (m: PointerEvent): void => {
      const rows = rowsNow();
      let slot = rows.length;
      for (let k = 0; k < rows.length; k++) {
        const r = (rows[k] as HTMLElement).getBoundingClientRect();
        if (m.clientY < r.top + r.height / 2) {
          slot = k;
          break;
        }
      }
      const listTop = list.getBoundingClientRect().top;
      const edge =
        slot < rows.length
          ? (rows[slot] as HTMLElement).getBoundingClientRect().top
          : ((rows.at(-1) as HTMLElement | undefined)?.getBoundingClientRect().bottom ?? listTop);
      line.style.top = `${edge - listTop}px`;
      target = slot > j ? slot - 1 : slot;
    };
    const up = (): void => {
      row.classList.remove('dragging');
      line.remove();
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', cancel);
      moveGrid(j, target);
    };
    const cancel = (): void => {
      target = j;
      up();
    };
    grip.addEventListener('pointermove', move, { signal });
    grip.addEventListener('pointerup', up, { signal });
    grip.addEventListener('pointercancel', cancel, { signal });
  };

  /** One compact 32 px row: handle, type icon, summary, eye, minus (0014). */
  const renderRow = (g: LayoutGrid, j: number, list: HTMLElement): HTMLElement => {
    const now = (): LayoutGrid => active().bp?.grids[j] ?? g;
    const row = el('div', {
      class: j === selected ? 'grid selected' : 'grid',
      role: 'group',
      'aria-label': `Grid ${j + 1}`,
      'data-index': String(j),
    });
    row.addEventListener('pointerdown', () => selectRow(j), { signal });

    const grip = el('button', {
      type: 'button',
      class: 'grip',
      'aria-label': `Reorder grid ${j + 1} (Alt+Up or Alt+Down)`,
      title: 'Drag to reorder',
      'data-key': `g${j}-grip`,
    });
    grip.innerHTML = icon('grip');
    grip.addEventListener('pointerdown', (e) => startReorder(e, j, row, list), { signal });
    keyHandlers.set(grip, (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      const to = j + (e.key === 'ArrowUp' ? -1 : 1);
      moveGrid(j, to);
      root.querySelector<HTMLElement>(`[data-key="g${to}-grip"]`)?.focus({ preventScroll: true });
    });

    const type = el('button', {
      type: 'button',
      class: 'type',
      'aria-label': `Edit grid ${j + 1}, ${PATTERN_LABELS[g.pattern]}`,
      'aria-expanded': String(openGrid === j),
      'aria-haspopup': 'dialog',
      title: 'Layout guide settings',
      'data-key': `g${j}-type`,
    });
    type.innerHTML = icon(g.pattern);
    type.addEventListener('click', () => openPopover(j), { signal });

    const summary = el('button', {
      type: 'button',
      class: 'summary',
      'aria-label': `Grid ${j + 1}: ${summaryText(g)}`,
      'aria-expanded': 'false',
      'aria-haspopup': 'listbox',
      'data-key': `g${j}-summary`,
    });
    summary.innerHTML = `<span>${summaryText(g)}</span>${icon('chevron')}`;
    // Like Figma: the summary picks the grid type; the type icon opens the settings.
    summary.addEventListener('click', () => toggleMenu(j, summary), { signal });

    const eye = el('button', {
      type: 'button',
      'aria-pressed': String(g.visible),
      'aria-label': `Show grid ${j + 1}`,
      title: g.visible ? 'Hide' : 'Show',
      'data-key': `g${j}-visible`,
    });
    eye.innerHTML = icon(g.visible ? 'eye' : 'eyeOff');
    eye.addEventListener('click', () => commit(j, { visible: !now().visible }), { signal });

    const remove = el('button', {
      type: 'button',
      'aria-label': `Remove grid ${j + 1}`,
      title: 'Remove',
      'data-key': `g${j}-remove`,
    });
    remove.innerHTML = icon('minus');
    remove.addEventListener(
      'click',
      () => {
        const { index, bp } = active();
        if (!bp) return;
        if (openGrid === j) openGrid = -1;
        else if (openGrid > j) openGrid--;
        selected = -1;
        store.setGrids(index, bp.grids.filter((_, k) => k !== j).map(toInput));
      },
      { signal },
    );
    row.append(grip, type, summary, eye, remove);
    return row;
  };

  /** The popover for grid `j`: one field per row, in Figma's order (0014). */
  const renderPopover = (g: LayoutGrid, j: number): HTMLElement => {
    const now = (): LayoutGrid => active().bp?.grids[j] ?? g;
    const pop = el('div', {
      class: 'popover',
      role: 'dialog',
      'aria-label': `Layout guide ${j + 1} settings`,
    });
    const ph = el('div', { class: 'phead' });
    const pattern = select(
      `g${j}-pattern`,
      `Pattern, grid ${j + 1}`,
      Object.entries(PATTERN_LABELS),
      g.pattern,
      (v) => setPattern(j, v as LayoutGrid['pattern']),
    );
    const close = el('button', {
      type: 'button',
      'aria-label': 'Close layout guide settings',
      title: 'Close',
      'data-key': 'popover-close',
    });
    close.innerHTML = icon('close');
    close.addEventListener('click', closePopover, { signal });
    ph.append(pattern, close);
    pop.append(ph);

    // Colour: swatch, hex and opacity in one field, as in Figma.
    const { hex, opacity } = splitColor(g.color, probe);
    const colorBox = el('span', { class: 'unit' });
    const swatch = el('input', {
      type: 'color',
      'aria-label': `Colour, grid ${j + 1}`,
      'data-key': `g${j}-color`,
    }) as HTMLInputElement;
    swatch.value = hex;
    const hexText = el(
      'small',
      { class: 'hex', 'aria-hidden': 'true' },
      hex.slice(1).toUpperCase(),
    );
    swatch.addEventListener(
      'change',
      () => {
        const current = splitColor(now().color, probe);
        commit(j, { color: joinColor(swatch.value, current.opacity) });
      },
      { signal },
    );
    const opacityInput = numberInput(
      j,
      'opacity',
      'Opacity',
      String(opacity),
      (raw, key) => {
        const n = parseNumber(raw, key);
        if (n === undefined) return;
        if (n < 0 || n > 100) {
          setError(key, MESSAGES.opacity);
          return;
        }
        setError(key, undefined);
        commit(j, { color: joinColor(swatch.value, n) });
      },
      () => splitColor(now().color, probe).opacity,
    );
    opacityInput.classList.add('pct');
    colorBox.append(
      swatch,
      hexText,
      el('span', { class: 'sep' }),
      opacityInput,
      el('small', {}, '%'),
    );
    const colorRow = el('div', { class: 'prow' });
    colorRow.append(el('span', {}, 'Color'), colorBox);

    if (g.pattern === 'GRID') {
      pop.append(
        numberRow(
          j,
          'sectionSize',
          'Size',
          String(g.sectionSize),
          (raw, key) => {
            const n = parseNumber(raw, key);
            if (n !== undefined) commit(j, { sectionSize: n }, key);
          },
          () => (now() as { sectionSize: number }).sectionSize,
        ),
        colorRow,
      );
      return pop;
    }

    const isCols = g.pattern === 'COLUMNS';
    const stretch = g.alignment === 'STRETCH';
    const box = store.box();

    // Count: a combo field (border only, like Figma's dropdown); type a number or pick a preset.
    const countBox = el('span', { class: 'unit outline' });
    const count = numberInput(
      j,
      'count',
      'Count',
      g.count === 'auto' ? 'Auto' : String(g.count),
      (raw, key) => {
        if (raw.toLowerCase() === 'auto') {
          commit(j, { count: 'auto' }, key);
          return;
        }
        const n = parseNumber(raw, key);
        if (n !== undefined) commit(j, { count: n }, key);
      },
      () => {
        const c = (now() as { count?: number | 'auto' }).count;
        return typeof c === 'number' ? c : 1;
      },
    );
    const combo = el('span', { class: 'combo' });
    combo.innerHTML = icon('chevron');
    const presets = select(
      `g${j}-count-presets`,
      `Count presets, grid ${j + 1}`,
      [
        ['', ''],
        ...(stretch ? [] : ([['auto', 'Auto']] as const)),
        ...[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24].map((n) => [String(n), String(n)] as const),
      ],
      '',
      (v) => {
        if (!v) return;
        count.value = v === 'auto' ? 'Auto' : v;
        count.dispatchEvent(new Event('change'));
      },
    );
    combo.append(presets);
    countBox.append(count, combo);
    pop.append(prow('Count', countBox), colorRow);

    const alignLabels = isCols
      ? ([
          ['STRETCH', 'Stretch'],
          ['MIN', 'Left'],
          ['CENTER', 'Center'],
          ['MAX', 'Right'],
        ] as const)
      : ([
          ['STRETCH', 'Stretch'],
          ['MIN', 'Top'],
          ['CENTER', 'Center'],
          ['MAX', 'Bottom'],
        ] as const);
    const align = select(
      `g${j}-alignment`,
      `Type, alignment, grid ${j + 1}`,
      alignLabels,
      g.alignment,
      (v) => {
        const a = v as 'MIN' | 'MAX' | 'CENTER' | 'STRETCH';
        const g = now();
        if (g.pattern === 'GRID') return;
        if (a === 'STRETCH') {
          const count = g.count === 'auto' ? computeSections(g, box).sections.length || 1 : g.count;
          commit(j, { alignment: a, count });
        } else if (g.alignment === 'STRETCH') {
          // Keep the current section size, as Figma does when leaving Stretch.
          const size = computeSections(g, box).sections[0]?.size ?? 64;
          commit(j, { alignment: a, sectionSize: Math.max(1, Math.round(size)) });
        } else {
          commit(j, { alignment: a });
        }
      },
    );
    pop.append(prow('Type', align));

    const sizeLabel = isCols ? 'Width' : 'Height';
    if (stretch) {
      // Figma shows the size as "Auto", disabled, while the grid stretches.
      const auto = el('span', { class: 'unit' });
      const input = el('input', {
        type: 'text',
        disabled: '',
        'aria-label': `${sizeLabel}, grid ${j + 1}`,
        'data-key': `g${j}-sectionSize`,
      }) as HTMLInputElement;
      input.value = 'Auto';
      auto.append(input);
      pop.append(prow(sizeLabel, auto));
    } else {
      pop.append(
        numberRow(
          j,
          'sectionSize',
          sizeLabel,
          String(g.sectionSize),
          (raw, key) => {
            const n = parseNumber(raw, key);
            if (n !== undefined) commit(j, { sectionSize: n }, key);
          },
          () => (now() as { sectionSize?: number }).sectionSize ?? 0,
        ),
      );
    }
    if (g.alignment !== 'CENTER') {
      pop.append(
        numberRow(
          j,
          'offset',
          stretch ? 'Margin' : 'Offset',
          String(g.offset),
          (raw, key) => {
            const n = parseNumber(raw, key);
            if (n !== undefined) commit(j, { offset: n }, key);
          },
          () => (now() as { offset?: number }).offset ?? 0,
        ),
      );
    }
    pop.append(
      numberRow(
        j,
        'gutterSize',
        'Gutter',
        String(g.gutterSize),
        (raw, key) => {
          const n = parseNumber(raw, key);
          if (n !== undefined) commit(j, { gutterSize: n }, key);
        },
        () => (now() as { gutterSize?: number }).gutterSize ?? 0,
      ),
    );
    return pop;
  };

  /** Puts the popover beside the panel, level with its row; flips right when there's no room. */
  function placePopover(): void {
    if (!popover || root.hidden) return;
    const row = body.querySelector<HTMLElement>(`.grid[data-index="${openGrid}"]`);
    const r = root.getBoundingClientRect();
    const w = popover.offsetWidth || 240;
    const gap = 8;
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    // Left of the panel if it fits, else right of it, else as far in view as possible.
    let x = r.left - gap - w;
    if (x < 0) x = r.right + gap + w <= vw ? r.right + gap : Math.max(gap, vw - w - gap);
    popover.style.left = `${x - r.left}px`;
    const rowTop = row ? row.getBoundingClientRect().top - r.top : 0;
    const maxTop = vh - r.top - popover.offsetHeight - gap;
    popover.style.top = `${Math.max(-r.top + gap, Math.min(rowTop - 8, maxTop))}px`;
  }

  /** "Copy config" (0013): clipboard first, a selected text box if that fails. */
  const footer = (): HTMLElement => {
    const f = el('div', { class: 'footer' });
    const copy = el(
      'button',
      { type: 'button', class: 'text-btn', 'data-key': 'copy' },
      'Copy config',
    );
    const status = el('span', { class: 'status', 'aria-live': 'polite' });
    let timer = 0;
    copy.addEventListener(
      'click',
      async () => {
        const text = store.snippet();
        f.querySelector('textarea')?.remove();
        f.querySelector('.note')?.remove();
        try {
          if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
          await navigator.clipboard.writeText(text);
          copy.textContent = 'Copied';
          status.textContent = 'Config copied';
          clearTimeout(timer);
          timer = window.setTimeout(() => {
            copy.textContent = 'Copy config';
            status.textContent = '';
          }, 1500);
        } catch {
          const note = el(
            'p',
            { class: 'note', id: 'ga-copy-note' },
            'Copy failed. Select and copy the text below.',
          );
          const area = el('textarea', {
            readonly: '',
            'aria-label': 'Grid config',
            'aria-describedby': 'ga-copy-note',
            spellcheck: 'false',
          }) as HTMLTextAreaElement;
          area.value = text;
          f.append(note, area);
          area.focus({ preventScroll: true });
          area.select();
        }
      },
      { signal },
    );
    f.append(copy, status);
    return f;
  };

  const rebuild = (index: number, bp: Breakpoint | undefined): void => {
    const shadow = root.getRootNode() as ShadowRoot | Document;
    const focusedKey = (shadow.activeElement as HTMLElement | null)?.dataset?.key;
    const hadFocus = root.contains(shadow.activeElement);
    const indexChanged = index !== renderedIndex;
    if (!bp || openGrid >= bp.grids.length) openGrid = -1;
    if (!bp || selected >= bp.grids.length) selected = -1;

    closeMenu(false);
    const badge = el('p', { class: 'badge', 'aria-live': 'polite' }, badgeText(bp));
    const parts: HTMLElement[] = [badge];
    if (store.hasSetAside()) {
      const notice = el('div', { class: 'notice', role: 'status' });
      notice.append(el('p', {}, "Your code's grid changed since your last edits."));
      const row = el('div', { class: 'row' });
      const restore = el(
        'button',
        { type: 'button', class: 'text-btn', 'data-key': 'restore' },
        'Restore edits',
      );
      const discard = el(
        'button',
        { type: 'button', class: 'text-btn', 'data-key': 'discard' },
        'Discard',
      );
      restore.addEventListener('click', () => store.restore(), { signal });
      discard.addEventListener('click', () => store.discard(), { signal });
      row.append(restore, discard);
      notice.append(row);
      parts.push(notice);
    }
    const sh = el('div', { class: 'section-head' });
    sh.append(el('h3', { id: 'ga-layout', tabindex: '-1' }, 'Layout guide'));
    const add = el('button', {
      type: 'button',
      'aria-label': 'Add grid',
      title: 'Add layout guide',
      'data-key': 'add',
    });
    add.innerHTML = icon('plus');
    (add as HTMLButtonElement).disabled = !bp;
    add.addEventListener(
      'click',
      () => {
        const cur = active();
        if (!cur.bp) return;
        selected = cur.bp.grids.length;
        store.setGrids(cur.index, [...cur.bp.grids.map(toInput), NEW_GRID]);
      },
      { signal },
    );
    sh.append(add);
    const list = el('div', { class: 'list', role: 'group', 'aria-labelledby': 'ga-layout' });
    bp?.grids.forEach((g, j) => {
      list.append(renderRow(g, j, list));
    });
    if (bp && bp.grids.length === 0)
      list.append(el('p', { class: 'empty' }, 'No grids. Add one with +.'));
    body.replaceChildren(...parts, sh, list, footer());

    popover?.remove();
    popover = undefined;
    const og = openGrid >= 0 ? bp?.grids[openGrid] : undefined;
    if (og) {
      popover = renderPopover(og, openGrid);
      root.append(popover);
      placePopover();
    }
    fieldErrors.clear();

    if (hadFocus) {
      const again =
        focusedKey && !indexChanged
          ? root.querySelector<HTMLElement>(`[data-key="${focusedKey}"]`)
          : null;
      (again ?? title).focus({ preventScroll: true });
    }
    renderedIndex = index;
  };

  /** Updates values in place when the structure is the same, so focus and typing survive. */
  const patch = (bp: Breakpoint): void => {
    const shadow = root.getRootNode() as ShadowRoot | Document;
    const focused = shadow.activeElement;
    const badge = body.querySelector('.badge');
    if (badge) badge.textContent = badgeText(bp);
    bp.grids.forEach((g, j) => {
      const set = (field: string, value: string): void => {
        const input = root.querySelector<HTMLInputElement>(`[data-key="g${j}-${field}"]`);
        if (!input || input.disabled || input === focused || fieldErrors.has(`g${j}-${field}`))
          return;
        input.value = value;
      };
      const eye = body.querySelector<HTMLElement>(`[data-key="g${j}-visible"]`);
      if (eye && eye.getAttribute('aria-pressed') !== String(g.visible)) {
        eye.setAttribute('aria-pressed', String(g.visible));
        eye.title = g.visible ? 'Hide' : 'Show';
        eye.innerHTML = icon(g.visible ? 'eye' : 'eyeOff');
      }
      const summary = body.querySelector<HTMLElement>(`[data-key="g${j}-summary"]`);
      const text = summaryText(g);
      const span = summary?.querySelector('span');
      if (summary && span && span.textContent !== text) {
        span.textContent = text;
        summary.setAttribute('aria-label', `Grid ${j + 1}: ${text}`);
      }
      const { hex, opacity } = splitColor(g.color, probe);
      set('opacity', String(opacity));
      set('color', hex);
      const hexText = popover?.querySelector('.hex');
      if (hexText && j === openGrid) hexText.textContent = hex.slice(1).toUpperCase();
      if (g.pattern === 'GRID') {
        set('sectionSize', String(g.sectionSize));
        return;
      }
      set('count', String(g.count === 'auto' ? 'Auto' : g.count));
      set('gutterSize', String(g.gutterSize));
      set('offset', String(g.offset));
      if (g.sectionSize !== undefined) set('sectionSize', String(g.sectionSize));
    });
  };

  function sync(source: SyncSource): void {
    visSwitch.setAttribute('aria-checked', String(store.isVisible()));
    if (root.hidden) {
      shapeKey = '';
      return;
    }
    const { index, bp } = active();
    const key = shapeOf(index, bp);
    if (source === 'code' || key !== shapeKey || !bp) {
      rebuilding = true;
      try {
        rebuild(index, bp);
      } finally {
        rebuilding = false;
      }
      shapeKey = shapeOf(index, bp);
      return;
    }
    patch(bp);
    placePopover();
  }

  return {
    element: root,
    sync,
    setOpen(open) {
      if (open === !root.hidden) return;
      root.hidden = !open;
      if (open) {
        sync('code');
        if (!pos) pos = store.position();
        place();
      } else {
        openGrid = -1;
        const shadow = root.getRootNode() as ShadowRoot | Document;
        if (root.contains(shadow.activeElement)) (shadow.activeElement as HTMLElement).blur();
      }
    },
    isOpen: () => !root.hidden,
    clamp: place,
    owns: (event) => event.composedPath().includes(root),
    handleKey(event) {
      if (event.type !== 'keydown') return;
      if (event.key === 'Escape') {
        // Esc closes the innermost layer first: the type menu, the popover, then the panel.
        if (menu) closeMenu();
        else if (openGrid >= 0) closePopover();
        else store.close();
        return;
      }
      keyHandlers.get(event.composedPath()[0] as EventTarget)?.(event);
    },
  };
}
