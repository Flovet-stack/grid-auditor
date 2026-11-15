import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  clipSections,
  computeSections,
  type DirectionalGrid,
  normalizeGrid,
} from '../../src/engine';
import { createGridOverlay, type GridOverlay } from '../../src/index';

// Spec 03 browser tests: the control panel (Layout guides section).

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const frames = async (n = 2) => {
  for (let i = 0; i < n; i++) await nextFrame();
};

const host = () => document.querySelector('grid-auditor') as HTMLElement;
const shadow = () => host().shadowRoot as ShadowRoot;
const panelEl = () => shadow().querySelector('.panel') as HTMLElement;
const q = <T extends Element = HTMLElement>(sel: string) => shadow().querySelector(sel) as T;
/** A grid field; opens that grid's popover first, as a user would (0014). */
const field = (key: string) => {
  const sel = `[data-key="${key}"]`;
  if (!q(sel)) q(`[data-key="g${key.match(/^g(\d+)-/)?.[1]}-type"]`)?.click();
  return q<HTMLInputElement>(sel);
};
const cols = () => Array.from(shadow().querySelectorAll<HTMLElement>('.section.col'));
const rows = () => Array.from(shadow().querySelectorAll<HTMLElement>('.section.row'));

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const panelKey = (target: EventTarget = document.body) => {
  const event = new KeyboardEvent('keydown', {
    code: 'KeyG',
    key: 'G',
    shiftKey: true,
    ctrlKey: !isMac,
    metaKey: isMac,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
};

/** Types into a panel field and commits it, as Enter would. */
const commit = (key: string, value: string) => {
  const input = field(key);
  input.focus();
  input.value = value;
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
  );
};

let overlay: GridOverlay | undefined;
let fixture: HTMLElement;
let style: HTMLStyleElement;

beforeEach(async () => {
  localStorage.clear();
  style = document.createElement('style');
  style.textContent = 'html, body { margin: 0; padding: 0; }';
  document.head.append(style);
  fixture = document.createElement('div');
  document.body.append(fixture);
  await page.viewport(1440, 900);
});

afterEach(() => {
  overlay?.destroy();
  overlay = undefined;
  fixture.remove();
  style.remove();
});

describe('1. open and close', () => {
  it('Ctrl/Cmd+Shift+G toggles the panel and is prevented', async () => {
    overlay = createGridOverlay();
    expect(panelEl().hidden).toBe(true);
    const e = panelKey();
    expect(e.defaultPrevented).toBe(true);
    expect(overlay.isPanelOpen()).toBe(true);
    expect(panelEl().hidden).toBe(false);
    panelKey();
    expect(overlay.isPanelOpen()).toBe(false);
  });

  it('does nothing with shortcuts.panel: false; the methods still work', () => {
    overlay = createGridOverlay({ shortcuts: { panel: false } });
    const e = panelKey();
    expect(e.defaultPrevented).toBe(false);
    expect(overlay.isPanelOpen()).toBe(false);
    overlay.openPanel();
    expect(overlay.isPanelOpen()).toBe(true);
    overlay.closePanel();
    expect(overlay.isPanelOpen()).toBe(false);
  });

  it('Esc closes the popover first, then the panel; the close button closes it too', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    const esc = (t: EventTarget) =>
      t.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
      );
    esc(field('g0-count'));
    expect(q('.popover')).toBeNull();
    expect(overlay.isPanelOpen()).toBe(true);
    expect(shadow().activeElement).toBe(q('[data-key="g0-type"]'));
    esc(q('[data-key="g0-type"]'));
    expect(overlay.isPanelOpen()).toBe(false);
    overlay.openPanel();
    await userEvent.click(q('button[aria-label^="Close panel"]'));
    expect(overlay.isPanelOpen()).toBe(false);
  });

  it('opening it does not show the grid; the header switch toggles the grid', async () => {
    overlay = createGridOverlay({ visible: false });
    overlay.openPanel();
    expect(overlay.isVisible()).toBe(false);
    const sw = q('[role="switch"]');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(sw);
    expect(overlay.isVisible()).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });
});

describe('2. breakpoint badge', () => {
  it('shows the active breakpoint and follows resizes', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    expect(q('.badge').textContent).toBe('Desktop');
    await page.viewport(800, 900);
    await frames();
    expect(q('.badge').textContent).toBe('Tablet');
  });
});

describe('3. live edit', () => {
  it('a count of 16 redraws 16 columns where the engine puts them', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    commit('g0-count', '16');
    await frames();
    expect(cols()).toHaveLength(16);
    const r = normalizeGrid({ pattern: 'COLUMNS', count: 16, offset: 80, gutterSize: 24 });
    if (!r.ok) throw new Error('bad grid');
    const width = document.documentElement.clientWidth;
    const sections = clipSections(
      computeSections(r.value as DirectionalGrid, {
        width,
        height: document.documentElement.scrollHeight,
      }).sections,
      width,
    );
    cols().forEach((c, i) => {
      const rect = c.getBoundingClientRect();
      expect(rect.left).toBe(sections[i]?.visibleStart);
      expect(rect.right).toBe(sections[i]?.visibleEnd);
    });
  });

  it('arrow keys step by 1 and Shift+arrow by 10', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    const input = field('g0-gutterSize');
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }),
    );
    expect(input.value).toBe('25');
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        shiftKey: true,
        bubbles: true,
        composed: true,
      }),
    );
    expect(input.value).toBe('15');
    // Focus survives the in-place update.
    expect(shadow().activeElement).toBe(input);
  });
});

describe('4. invalid values', () => {
  it('count 0 shows an inline error and keeps the grid, without throwing', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    expect(() => commit('g0-count', '0')).not.toThrow();
    await frames();
    const input = field('g0-count');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const msg = shadow().getElementById(input.getAttribute('aria-describedby') as string);
    expect(msg?.textContent).toBe('Count must be a whole number, 1 or more.');
    expect(cols()).toHaveLength(12);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    commit('g0-count', '6');
    expect(field('g0-count').hasAttribute('aria-invalid')).toBe(false);
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('5. add, remove and visibility', () => {
  it('adds and removes a Rows grid, and the eye hides one grid only', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await userEvent.click(q('[data-key="add"]'));
    const pattern = field('g1-pattern') as unknown as HTMLSelectElement;
    pattern.value = 'ROWS';
    pattern.dispatchEvent(new Event('change'));
    await frames();
    expect(rows().length).toBeGreaterThan(0);
    expect(cols()).toHaveLength(12);

    await userEvent.click(q('[data-key="g0-visible"]'));
    await frames();
    expect(cols()).toHaveLength(0);
    expect(rows().length).toBeGreaterThan(0);
    expect(q('[data-key="g0-visible"]').getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(q('[data-key="g1-remove"]'));
    await frames();
    expect(rows()).toHaveLength(0);
    expect(shadow().querySelectorAll('.grid')).toHaveLength(1);
  });
});

describe('6. code wins', () => {
  it('setBreakpoints replaces panel edits, and the panel shows the new values', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    commit('g0-count', '16');
    overlay.setBreakpoints([{ name: 'Desktop', grids: [{ count: 6 }] }]);
    await frames();
    expect(cols()).toHaveLength(6);
    expect(field('g0-count').value).toBe('6');
  });
});

describe('7. non-invasive with the panel open', () => {
  it('leaves layout, focus, page clicks and page keys alone', async () => {
    fixture.innerHTML =
      '<div style="height: 2000px"><button id="b" style="margin: 100px">Press</button></div>';
    const button = fixture.querySelector('button') as HTMLButtonElement;
    button.focus();
    const before = {
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
      rect: JSON.stringify(button.getBoundingClientRect()),
    };
    overlay = createGridOverlay();
    overlay.openPanel();
    await frames();
    expect(document.documentElement.scrollWidth).toBe(before.sw);
    expect(document.documentElement.scrollHeight).toBe(before.sh);
    expect(JSON.stringify(button.getBoundingClientRect())).toBe(before.rect);
    expect(document.activeElement).toBe(button);

    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();

    const onKey = vi.fn();
    const onCaptureKey = vi.fn();
    document.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onCaptureKey, { capture: true });
    await userEvent.click(field('g0-count'));
    await userEvent.keyboard('7');
    expect(onKey).not.toHaveBeenCalled();
    expect(onCaptureKey).not.toHaveBeenCalled();
    expect(field('g0-count').value).toContain('7');
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('keydown', onCaptureKey, { capture: true });

    const onPageClick = vi.fn();
    document.addEventListener('click', onPageClick);
    await userEvent.click(q('.title'));
    expect(onPageClick).not.toHaveBeenCalled();
    document.removeEventListener('click', onPageClick);
  });

  it('keeps aria-hidden on the marks only, and page CSS cannot reach the panel', async () => {
    style.textContent += '* { box-sizing: content-box !important; font-size: 30px !important; }';
    overlay = createGridOverlay();
    overlay.openPanel();
    expect(host().hasAttribute('aria-hidden')).toBe(false);
    expect(q('.layer').getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(panelEl()).boxSizing).toBe('border-box');
    expect(panelEl().getBoundingClientRect().width).toBe(260);
  });
});

describe('8. accessibility', () => {
  it('has no axe violations, names every control, and Tab reaches the controls', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await frames();
    const result = await axe.run(host(), { resultTypes: ['violations'] });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    for (const c of shadow().querySelectorAll<HTMLElement>('button, input, select')) {
      const named =
        c.getAttribute('aria-label') ||
        c.getAttribute('aria-labelledby') ||
        c.closest('label')?.textContent ||
        c.textContent?.trim();
      expect(named, c.outerHTML).toBeTruthy();
    }
    q<HTMLElement>('[role="switch"]').focus();
    await userEvent.tab();
    expect(shadow().activeElement?.getAttribute('aria-label')).toMatch(/^Close panel/);
    expect(getComputedStyle(shadow().activeElement as Element).outlineStyle).toBe('solid');
  });
});

describe('breakpoint switch with a field focused', () => {
  it('moves focus to the panel title, which shows the accent focus ring', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await userEvent.click(field('g0-count'));
    await userEvent.keyboard('9');
    await page.viewport(800, 900);
    await frames();
    const title = q('.title');
    expect(shadow().activeElement).toBe(title);
    expect(field('g0-count').value).toBe('8');
    expect(getComputedStyle(title).outlineColor).toBe('rgb(12, 140, 233)');
  });
});

describe('9. dragging', () => {
  it('keeps the panel fully inside the viewport', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    const head = q('.head');
    const r = head.getBoundingClientRect();
    const opts = { bubbles: true, composed: true, button: 0, pointerId: 1 };
    head.dispatchEvent(
      new PointerEvent('pointerdown', { ...opts, clientX: r.left + 20, clientY: r.top + 10 }),
    );
    head.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 5000, clientY: 5000 }));
    head.dispatchEvent(new PointerEvent('pointerup', opts));
    const p = panelEl().getBoundingClientRect();
    expect(p.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
    expect(p.bottom).toBeLessThanOrEqual(document.documentElement.clientHeight);
    head.dispatchEvent(
      new PointerEvent('pointerdown', { ...opts, clientX: p.left + 20, clientY: p.top + 10 }),
    );
    head.dispatchEvent(
      new PointerEvent('pointermove', { ...opts, clientX: -5000, clientY: -5000 }),
    );
    head.dispatchEvent(new PointerEvent('pointerup', opts));
    const p2 = panelEl().getBoundingClientRect();
    expect(p2.left).toBe(0);
    expect(p2.top).toBe(0);
  });
});

const summaries = () =>
  Array.from(shadow().querySelectorAll('.summary span')).map((s) => s.textContent);
const popLabels = () =>
  Array.from(shadow().querySelectorAll('.popover .prow > span:first-child')).map(
    (s) => s.textContent,
  );

describe('10. compact rows and popover (0014)', () => {
  it('shows one summary row per grid and opens the fields only on demand', async () => {
    overlay = createGridOverlay({
      extendDefaults: false,
      breakpoints: [
        {
          name: 'Desktop',
          minWidth: 0,
          grids: [
            { pattern: 'COLUMNS', count: 12 },
            { pattern: 'ROWS', alignment: 'MIN', count: 2000, sectionSize: 10, gutterSize: 0 },
            { pattern: 'GRID', sectionSize: 10 },
          ],
        },
      ],
    });
    overlay.openPanel();
    expect(summaries()).toEqual(['12 columns', '2000 rows (10px)', 'Grid 10px']);
    for (const row of shadow().querySelectorAll<HTMLElement>('.grid')) {
      expect(row.getBoundingClientRect().height).toBe(32);
    }
    expect(q('.popover')).toBeNull();
    expect(q('[data-key="g0-count"]')).toBeNull();

    await userEvent.click(q('[data-key="g1-type"]'));
    expect(q('.grid[data-index="1"]').classList.contains('selected')).toBe(true);
    expect(q('[data-key="g1-type"]').getAttribute('aria-expanded')).toBe('true');
    expect(popLabels()).toEqual(['Count', 'Color', 'Type', 'Height', 'Offset', 'Gutter']);
    expect(shadow().activeElement).toBe(q('[data-key="g1-count"]'));
    // The popover sits beside the panel, not over it.
    expect(q('.popover').getBoundingClientRect().right).toBeLessThanOrEqual(
      panelEl().getBoundingClientRect().left,
    );

    await userEvent.click(q('[data-key="g2-type"]'));
    expect(popLabels()).toEqual(['Size', 'Color']);
    await userEvent.click(q('[data-key="popover-close"]'));
    expect(q('.popover')).toBeNull();
  });

  it('a stretched grid shows Width as Auto, disabled', () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    const width = field('g0-sectionSize');
    expect(width.disabled).toBe(true);
    expect(width.value).toBe('Auto');
  });

  it('the summary follows edits', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    commit('g0-count', '7');
    await frames();
    expect(q('[data-key="g0-summary"] span').textContent).toBe('7 columns');
  });

  it('reorders with Alt+arrows on the handle, and the first grid draws on top', async () => {
    overlay = createGridOverlay({
      extendDefaults: false,
      breakpoints: [
        {
          name: 'Desktop',
          minWidth: 0,
          grids: [
            { pattern: 'COLUMNS', count: 12 },
            { pattern: 'ROWS', count: 3, gutterSize: 10 },
          ],
        },
      ],
    });
    overlay.openPanel();
    const layer = () => Array.from(q('.layer').children).map((c) => c.classList[1]);
    expect(layer().at(-1)).toBe('col');
    const grip = q('[data-key="g0-grip"]');
    grip.focus();
    grip.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        composed: true,
      }),
    );
    await frames();
    expect(summaries()).toEqual(['3 rows', '12 columns']);
    expect(layer().at(-1)).toBe('row');
    expect(shadow().activeElement).toBe(q('[data-key="g1-grip"]'));
  });

  it('reorders by dragging the handle', async () => {
    overlay = createGridOverlay({
      extendDefaults: false,
      breakpoints: [
        {
          name: 'Desktop',
          minWidth: 0,
          grids: [
            { pattern: 'COLUMNS', count: 12 },
            { pattern: 'ROWS', count: 3 },
            { pattern: 'GRID', sectionSize: 8 },
          ],
        },
      ],
    });
    overlay.openPanel();
    const grip = q('[data-key="g0-grip"]');
    const last = q('.grid[data-index="2"]').getBoundingClientRect();
    const r = grip.getBoundingClientRect();
    const opts = { bubbles: true, composed: true, button: 0, pointerId: 1 };
    grip.dispatchEvent(
      new PointerEvent('pointerdown', { ...opts, clientX: r.left, clientY: r.top }),
    );
    grip.dispatchEvent(
      new PointerEvent('pointermove', { ...opts, clientX: r.left, clientY: last.bottom - 2 }),
    );
    expect(q('.drop-line')).not.toBeNull();
    grip.dispatchEvent(new PointerEvent('pointerup', opts));
    await frames();
    expect(summaries()).toEqual(['3 rows', 'Grid 8px', '12 columns']);
    expect(q('.drop-line')).toBeNull();
  });

  it('uses the Figma UI colours and font from 0014', () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    const cs = getComputedStyle(panelEl());
    expect(cs.backgroundColor).toBe('rgb(44, 44, 44)');
    expect(cs.borderTopColor).toBe('rgb(68, 68, 68)');
    expect(cs.fontFamily.startsWith('Inter')).toBe(true);
    field('g0-gutterSize');
    expect(getComputedStyle(q('.popover .unit:not(.outline)')).backgroundColor).toBe(
      'rgb(56, 56, 56)',
    );
  });

  it('has no axe violations with the popover open', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    field('g0-count');
    const result = await axe.run(host(), { resultTypes: ['violations'] });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe('11. type menu and no Reset to code (0014 §8)', () => {
  it('the summary opens Grid, Columns, Rows and switches the type', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    expect(q('[data-key="reset"]')).toBeNull();
    const summary = q('[data-key="g0-summary"]');
    await userEvent.click(summary);
    expect(q('.popover')).toBeNull();
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    const opts = Array.from(shadow().querySelectorAll('.menu [role="option"]'));
    expect(opts.map((o) => o.textContent)).toEqual(['Grid', 'Columns', 'Rows']);
    expect(shadow().activeElement).toBe(q('[data-key="g0-type-columns"]'));
    await userEvent.click(q('[data-key="g0-type-rows"]'));
    await frames();
    expect(q('.menu')).toBeNull();
    expect(q('[data-key="g0-summary"] span').textContent).toMatch(/rows/);
  });

  it('Esc closes the menu before the panel', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await userEvent.click(q('[data-key="g0-summary"]'));
    q('[data-key="g0-type-grid"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
    expect(q('.menu')).toBeNull();
    expect(overlay.isPanelOpen()).toBe(true);
    expect(shadow().activeElement).toBe(q('[data-key="g0-summary"]'));
  });
});
