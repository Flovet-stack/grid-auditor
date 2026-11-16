import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createGridOverlay, type GridOverlay, type GridOverlayOptions } from '../../src/index';
import { STORAGE_KEY } from '../../src/overlay/persist';

// Spec 06 browser tests: expected vs rendered comparison (0019).

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const frames = async (n = 3) => {
  for (let i = 0; i < n; i++) await nextFrame();
};

const host = () => document.querySelector('grid-auditor') as HTMLElement;
const shadow = () => host().shadowRoot as ShadowRoot;
const q = <T extends Element = HTMLElement>(sel: string) => shadow().querySelector(sel) as T;
const qa = (sel: string) => Array.from(shadow().querySelectorAll<HTMLElement>(sel));
const rowLabels = () => qa('.rrow').map((r) => r.getAttribute('aria-label'));
const eyeFor = (label: string) => q(`[data-key="r${rowLabels().indexOf(label)}-visible"]`);
const labels = () => qa('.rmarks .rval.dev').map((v) => v.textContent);
const lines = () => qa('.rmarks .rdline');
const status = () => q('[data-key="compare-status"]');
const toggle = () => q('[data-key="compare-show"]');
const tolerance = () => q<HTMLInputElement>('[data-key="compare-tolerance"]');

const MINUS = '−';
// A 12-column Stretch grid, 120 px margins and 24 px gutters: 78 px columns at 1440 px.
const DESKTOP = {
  name: 'Desktop',
  minWidth: 1024,
  grids: [{ pattern: 'COLUMNS', alignment: 'STRETCH', count: 12, gutterSize: 24, offset: 120 }],
} as const;
const MOBILE = {
  name: 'Mobile',
  minWidth: 0,
  grids: [{ pattern: 'COLUMNS', alignment: 'STRETCH', count: 4, gutterSize: 16, offset: 16 }],
} as const;
const OPTIONS: GridOverlayOptions = { extendDefaults: false, breakpoints: [MOBILE, DESKTOP] };

let overlay: GridOverlay | undefined;
let fixture: HTMLElement;
let style: HTMLStyleElement;

const twelve = 'display:grid; grid-template-columns:repeat(12, 1fr); column-gap:24px';
const FIXTURE = `
  <div class="aligned" style="${twelve}; margin:0 120px">${'<div style="height:20px"></div>'.repeat(12)}</div>
  <div class="shifted" style="${twelve}; margin:20px 117px 0 123px">${'<div style="height:20px"></div>'.repeat(12)}</div>
  <div class="wrap" style="display:flex; flex-wrap:wrap; column-gap:24px; row-gap:8px; margin:20px 120px 0; width:872px">
    ${'<span style="width:200px; height:20px"></span>'.repeat(8)}
  </div>
  <div class="turned" style="${twelve}; margin:20px 120px 0; transform:rotate(1deg)">${'<div style="height:20px"></div>'.repeat(12)}</div>
  <p class="plain" style="margin:40px 0; height:40px">No container here</p>
  <div style="height:3000px"></div>
`;

beforeEach(async () => {
  localStorage.clear();
  style = document.createElement('style');
  // No scrollbar, so the page is exactly the viewport's width and every column is whole.
  style.textContent = 'html, body { margin: 0; padding: 0; } html { scrollbar-width: none; }';
  document.head.append(style);
  fixture = document.createElement('div');
  fixture.innerHTML = FIXTURE;
  document.body.append(fixture);
  await page.viewport(1440, 900);
  window.scrollTo(0, 0);
});

afterEach(() => {
  overlay?.destroy();
  overlay = undefined;
  fixture.remove();
  style.remove();
  window.scrollTo(0, 0);
  vi.restoreAllMocks();
});

const start = async (options: GridOverlayOptions = OPTIONS) => {
  overlay = createGridOverlay(options);
  overlay.openPanel();
  await userEvent.click(q('[data-key="rendered-toggle"]'));
  await userEvent.click(q('[data-key="show-flex"]'));
  await frames();
};
const eye = async (label: string) => {
  await userEvent.click(eyeFor(label));
  await frames();
};
const showDeviations = async () => {
  await userEvent.click(toggle());
  await frames();
};
const setTolerance = async (value: string) => {
  const input = tolerance();
  input.focus();
  input.value = value;
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
  );
  await frames();
};

const key = (init: KeyboardEventInit) =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init }),
  );
const shiftM = () => key({ key: 'M', code: 'KeyM', shiftKey: true });
const esc = () => key({ key: 'Escape', code: 'Escape' });
const hover = async (el: Element) => {
  const r = el.getBoundingClientRect();
  q('.pick').dispatchEvent(
    new MouseEvent('pointermove', {
      clientX: r.left + 5,
      clientY: r.top + 5,
      bubbles: true,
      composed: true,
    }),
  );
  await frames();
};
const el = (sel: string) => fixture.querySelector(sel) as HTMLElement;

describe('1. off by default', () => {
  it('draws no deviation marks and hides the status line', async () => {
    await start();
    await eye('div.shifted');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(lines()).toHaveLength(0);
    expect(status().hidden).toBe(true);
    expect(tolerance().value).toBe('0.5');
  });

  it('sits between Layout guide and Rendered', async () => {
    await start();
    const order = qa('.body h3').map((h) => h.textContent?.trim());
    expect(order.indexOf('Compare')).toBe(order.indexOf('Layout guide') + 1);
    expect(order[order.indexOf('Compare') + 1]).toMatch(/^Rendered/);
  });
});

describe('2. aligned', () => {
  it('draws nothing when every column edge lines up', async () => {
    await start();
    await showDeviations();
    await eye('div.aligned');
    expect(lines()).toHaveLength(0);
    expect(status().hidden).toBe(false);
    expect(status().textContent).toBe('No deviations over 0.5 px');
  });
});

describe('3. shifted by 3 px', () => {
  it('marks every column edge with +3 px', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    expect(labels()).toHaveLength(24);
    expect(new Set(labels())).toEqual(new Set(['+3 px']));
    expect(status().textContent).toBe('24 deviations in 1 container');
  });

  it('puts the line on the rendered edge and the bar between the two edges', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    const line = lines()[0]?.getBoundingClientRect();
    expect(line?.left).toBe(122); // the first track starts at 123; the 2 px line is centred on it
    expect(line?.width).toBe(2);
    const bar = qa('.rmarks .rdbar')[0]?.getBoundingClientRect();
    expect(bar?.left).toBe(120);
    expect(bar?.width).toBe(3);
    // Deviation marks draw above the other marks.
    const groups = qa('.rmarks > .rgroup');
    expect(groups.at(-1)?.classList.contains('rdev')).toBe(true);
  });

  it('uses the deviation orange', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    expect(getComputedStyle(lines()[0] as HTMLElement).backgroundColor).toBe('rgb(229, 89, 11)');
    expect(getComputedStyle(lines()[0] as HTMLElement).pointerEvents).toBe('none');
  });
});

describe('4. tolerance', () => {
  it('needs more than the tolerance, rounds to 0.5 steps and never goes below 0.5', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    await setTolerance('3');
    expect(lines()).toHaveLength(0);
    expect(status().textContent).toBe('No deviations over 3 px');
    // Same counts, new tolerance: the status still follows.
    await setTolerance('4');
    expect(status().textContent).toBe('No deviations over 4 px');
    await setTolerance('2.5');
    expect(labels()).toHaveLength(24);
    await setTolerance('0');
    expect(tolerance().value).toBe('0.5');
    await setTolerance('abc');
    expect(tolerance().value).toBe('0.5');
  });

  it('arrow keys step by 0.5, and Shift+arrow by 5', async () => {
    await start();
    const input = tolerance();
    input.focus();
    const arrow = (k: string, shiftKey = false) =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, composed: true }),
      );
    arrow('ArrowUp');
    expect(input.value).toBe('1');
    arrow('ArrowUp', true);
    expect(input.value).toBe('6');
    arrow('ArrowDown', true);
    arrow('ArrowDown', true);
    expect(input.value).toBe('0.5');
    expect(shadow().activeElement).toBe(input);
  });
});

describe('5. flex', () => {
  it('counts each unique item edge once, not once per wrapped line', async () => {
    await start();
    await showDeviations();
    await eye('div.wrap');
    const twoLines = lines().length;
    expect(twoLines).toBeGreaterThan(0);
    // Drop the second line: the deviations stay the same.
    for (const s of Array.from(el('.wrap').children).slice(4)) s.remove();
    await frames(4);
    expect(lines()).toHaveLength(twoLines);
  });
});

describe('6. inspector', () => {
  it('shows the hovered container’s deviations, and the shown set’s after Esc', async () => {
    await start();
    await showDeviations();
    await eye('div.aligned');
    shiftM();
    await hover(el('.shifted > div'));
    expect(labels()).toHaveLength(24);
    expect(status().textContent).toBe('24 deviations in 1 container');
    await hover(el('.aligned > div'));
    expect(lines()).toHaveLength(0);
    expect(status().textContent).toBe('No deviations over 0.5 px');
    esc();
    await frames();
    expect(lines()).toHaveLength(0);
    expect(status().textContent).toBe('No deviations over 0.5 px');
  });
});

describe('7. status messages', () => {
  it('says what to turn on, and when there is nothing to compare', async () => {
    await start();
    await showDeviations();
    expect(status().textContent).toBe("Turn on a container's eye, or press Shift+M");
    await eye('div.turned');
    expect(status().textContent).toBe('Nothing to compare in the drawn containers');
    // Hide the Columns grid in Layout guide.
    await userEvent.click(q('[data-key="g0-visible"]'));
    await frames();
    expect(status().textContent).toBe('Turn on a Columns grid in Layout guide');
  });

  it('leaves out Shift+M when the inspector shortcut is off', async () => {
    await start({ ...OPTIONS, shortcuts: { inspect: false } });
    await showDeviations();
    expect(status().textContent).toBe("Turn on a container's eye");
  });
});

describe('8. staying in sync', () => {
  it('scrolling the page does not change the labels', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    window.scrollTo(0, 200);
    await frames();
    expect(labels()).toHaveLength(24);
    expect(new Set(labels())).toEqual(new Set(['+3 px']));
  });

  it('compares against the new breakpoint after a resize', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    const desktop = status().textContent;
    await page.viewport(800, 900);
    await frames(4);
    expect(status().textContent).not.toBe(desktop);
    expect(labels().some((l) => l !== '+3 px')).toBe(true);
  });

  it('a Layout guide edit moves the expected edges', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    // Margin 120 → 123: the shifted grid's left edges now line up.
    q('[data-key="g0-type"]').click();
    const input = q<HTMLInputElement>('[data-key="g0-offset"]');
    input.focus();
    input.value = '123';
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    );
    await frames(4);
    // The first column's left edge now lines up exactly, so it has no mark.
    expect(labels().length).toBeLessThan(24);
    expect(lines().some((l) => l.getBoundingClientRect().left === 122)).toBe(false);
  });
});

describe('9. Shift+G', () => {
  it('hides the deviation marks with the rest, and showing brings them back', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    overlay?.hide();
    await frames();
    expect(q('.rmarks').hidden).toBe(true);
    overlay?.show();
    await frames();
    expect(q('.rmarks').hidden).toBe(false);
    expect(labels()).toHaveLength(24);
  });
});

describe('10. saving', () => {
  const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

  it('keeps the switch and tolerance across a reload, and code calls leave them alone', async () => {
    await start();
    await showDeviations();
    await setTolerance('2');
    await frames();
    expect(stored()?.compare).toEqual({ show: true, tolerance: 2 });
    overlay?.setBreakpoints([MOBILE, DESKTOP], { extendDefaults: false });
    overlay?.update(OPTIONS);
    await frames();
    expect(stored()?.compare).toEqual({ show: true, tolerance: 2 });
    overlay?.destroy();
    overlay = createGridOverlay(OPTIONS);
    overlay.openPanel();
    await frames();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(tolerance().value).toBe('2');
  });

  it('persist: false writes nothing', async () => {
    await start({ ...OPTIONS, persist: false });
    await showDeviations();
    await setTolerance('2');
    await frames();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('11. accessibility', () => {
  it('has no axe violations with the Compare section and deviation marks showing', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    const result = await axe.run(host(), { resultTypes: ['violations'] });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe('12. speed', () => {
  it('draws a hovered 12-column grid with its deviations in under 16 ms (median of 5)', async () => {
    const big = document.createElement('div');
    big.className = 'big';
    big.style.cssText = `${twelve}; row-gap:8px; margin-left:125px; width:1200px`;
    big.innerHTML = '<div style="height:20px"></div>'.repeat(24);
    fixture.prepend(big);
    await start();
    await showDeviations();
    shiftM();
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      await hover(el('.plain'));
      let before = 0;
      let after = 0;
      requestAnimationFrame(() => {
        before = performance.now();
      });
      const t0 = performance.now();
      const r = (big.children[0] as Element).getBoundingClientRect();
      q('.pick').dispatchEvent(
        new MouseEvent('pointermove', {
          clientX: r.left + 5,
          clientY: r.top + 5,
          bubbles: true,
          composed: true,
        }),
      );
      const sync = performance.now() - t0;
      await new Promise<void>((res) =>
        requestAnimationFrame(() => {
          after = performance.now();
          res();
        }),
      );
      times.push(sync + (after - before));
      expect(lines().length).toBeGreaterThan(0);
    }
    times.sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(16);
  });
});

describe('13. destroy', () => {
  it('removes every deviation mark and the Compare section', async () => {
    await start();
    await showDeviations();
    await eye('div.shifted');
    overlay?.destroy();
    overlay = undefined;
    expect(document.querySelector('grid-auditor')).toBeNull();
  });
});
