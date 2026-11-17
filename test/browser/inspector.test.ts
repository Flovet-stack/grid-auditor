import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { snapValue } from '../../src/overlay/containers';
import { createGridOverlay, type GridOverlay } from '../../src/index';

// Spec 08 browser tests: the geometry inspector (0018).

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const frames = async (n = 2) => {
  for (let i = 0; i < n; i++) await nextFrame();
};

const host = () => document.querySelector('grid-auditor') as HTMLElement;
const shadow = () => host().shadowRoot as ShadowRoot;
const q = <T extends Element = HTMLElement>(sel: string) => shadow().querySelector(sel) as T;
const qa = (sel: string) => Array.from(shadow().querySelectorAll<HTMLElement>(sel));
const rowLabels = () => qa('.rrow').map((r) => r.getAttribute('aria-label'));
const eyeFor = (label: string) => q(`[data-key="r${rowLabels().indexOf(label)}-visible"]`);
const tagNames = () => qa('.rmarks .rtag .rname').map((t) => t.textContent);

const PILL_TEXT = 'Geometry inspector on · Page interactions paused · Press Esc to exit';

let overlay: GridOverlay | undefined;
let fixture: HTMLElement;
let style: HTMLStyleElement;

const FIXTURE = `
  <div class="cards" style="display:grid; grid-template-columns:100px 1fr 2fr; gap:16px;
    padding:24px; width:700px">
    <div style="height:40px">a</div><div>b</div><div>c</div>
  </div>
  <div class="tags" style="display:flex; gap:12px; width:400px; margin-top:20px">
    <span style="width:80px;height:20px"></span><span style="width:80px;height:20px"></span>
  </div>
  <p class="plain" style="margin:40px 0; height:40px">No container here</p>
  <input class="field" />
`;

beforeEach(async () => {
  localStorage.clear();
  style = document.createElement('style');
  style.textContent = 'html, body { margin: 0; padding: 0; }';
  document.head.append(style);
  fixture = document.createElement('div');
  // Not a box of its own, so the inspector (0020) never picks the wrapper: `.plain` has nothing above it.
  fixture.style.display = 'contents';
  fixture.innerHTML = FIXTURE;
  document.body.append(fixture);
  await page.viewport(1440, 900);
});

afterEach(() => {
  overlay?.destroy();
  overlay = undefined;
  fixture.remove();
  style.remove();
  vi.restoreAllMocks();
});

const key = (init: KeyboardEventInit, target: EventTarget = document.body) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init }),
  );
const shiftM = () => key({ key: 'M', code: 'KeyM', shiftKey: true });
const esc = () => key({ key: 'Escape', code: 'Escape' });
const pill = () => q('.ipill');
const inspecting = () => !q('.pick').hidden && !pill().hidden;

const at = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { clientX: r.left + 5, clientY: r.top + 5 };
};
const pointer = (
  type: string,
  xy: { clientX: number; clientY: number } = { clientX: 0, clientY: 0 },
) =>
  q('.pick').dispatchEvent(
    new MouseEvent(type, { ...xy, bubbles: true, composed: true, cancelable: true }),
  );
const hoverOver = async (el: Element) => {
  pointer('pointermove', at(el));
  await frames();
};

describe('1. toggle', () => {
  it('Shift+M turns it on with the pill, and off again', async () => {
    overlay = createGridOverlay();
    shiftM();
    expect(inspecting()).toBe(true);
    expect(pill().textContent).toBe(PILL_TEXT);
    expect(pill().querySelector('kbd')?.textContent).toBe('Esc');
    shiftM();
    expect(q('.pick').hidden).toBe(true);
    expect(pill().hidden).toBe(true);
  });

  it('Esc turns it off and leaves the panel open', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    shiftM();
    esc();
    expect(pill().hidden).toBe(true);
    expect(overlay.isPanelOpen()).toBe(true);
  });

  it('Shift+M typed in a field types an M and does not start it', async () => {
    overlay = createGridOverlay();
    const field = fixture.querySelector('.field') as HTMLInputElement;
    await userEvent.click(field);
    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(field.value).toBe('M');
    expect(pill().hidden).toBe(true);
  });

  it('shortcuts.inspect: false turns the shortcut off; update() turns it back on', async () => {
    overlay = createGridOverlay({ shortcuts: { inspect: false } });
    shiftM();
    expect(pill().hidden).toBe(true);
    overlay.update({ shortcuts: { inspect: 'Shift+M' } });
    shiftM();
    expect(pill().hidden).toBe(false);
  });
});

describe('2. pill', () => {
  it('is a status region outside the aria-hidden layer, on the panel grey, never in the way', () => {
    overlay = createGridOverlay();
    shiftM();
    expect(pill().getAttribute('role')).toBe('status');
    expect(pill().closest('[aria-hidden="true"]')).toBeNull();
    const s = getComputedStyle(pill());
    expect(s.pointerEvents).toBe('none');
    expect(s.backgroundColor).toBe('rgb(44, 44, 44)');
  });
});

describe('2b. pill on a narrow screen', () => {
  it('wraps inside the viewport at 320 px, 16 px from each edge at most', async () => {
    await page.viewport(320, 640);
    overlay = createGridOverlay();
    shiftM();
    const r = pill().getBoundingClientRect();
    expect(r.left).toBeGreaterThanOrEqual(16);
    expect(r.right).toBeLessThanOrEqual(304);
    expect(r.height).toBeGreaterThan(20); // two lines
    expect(640 - r.bottom).toBeCloseTo(16, 0);
  });
});

describe('3. paused page', () => {
  it('clicks never reach the page while on, and do after; the cursor is a crosshair', async () => {
    overlay = createGridOverlay();
    const card = fixture.querySelector('.cards > div') as HTMLElement;
    const pageClick = vi.fn();
    const pageDown = vi.fn();
    card.addEventListener('click', pageClick);
    document.addEventListener('pointerdown', pageDown);
    shiftM();
    expect(getComputedStyle(q('.pick')).cursor).toBe('crosshair');
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      pointer(type, at(card));
    expect(pageClick).not.toHaveBeenCalled();
    expect(pageDown).not.toHaveBeenCalled();
    expect(inspecting()).toBe(true); // a click does nothing else
    esc();
    await userEvent.click(card);
    expect(pageClick).toHaveBeenCalledTimes(1);
    document.removeEventListener('pointerdown', pageDown);
  });
});

describe('4. hover', () => {
  it('draws only the container under the pointer, flex included, and nothing elsewhere', async () => {
    overlay = createGridOverlay();
    shiftM();
    await hoverOver(fixture.querySelector('.cards > div') as Element);
    expect(tagNames()).toEqual(['div.cards']);
    const r = (fixture.querySelector('.cards') as Element).getBoundingClientRect();
    expect(q('.rmarks .rtag .rdim').textContent).toBe(
      `${snapValue(r.width)} × ${snapValue(r.height)}`,
    );
    expect(qa('.rmarks .rtrack.col')).toHaveLength(3);
    expect(qa('.rmarks .rgap').length).toBeGreaterThan(0);
    expect(qa('.rmarks .rval.pad')).toHaveLength(4);

    await hoverOver(fixture.querySelector('.tags > span') as Element);
    expect(tagNames()).toEqual(['div.tags']);
    expect(qa('.rmarks .rgroup')).toHaveLength(1);

    await hoverOver(fixture.querySelector('.plain') as Element);
    expect(qa('.rmarks .rgroup')).toHaveLength(0);
  });

  it('scrolling under a still pointer switches to the container now under it', async () => {
    const spacer = document.createElement('div');
    spacer.style.height = '2000px';
    fixture.append(spacer);
    overlay = createGridOverlay();
    shiftM();
    const cell = fixture.querySelector('.cards > div') as Element;
    const xy = at(cell);
    pointer('pointermove', xy);
    await frames();
    expect(tagNames()).toEqual(['div.cards']);
    const tags = (fixture.querySelector('.tags > span') as Element).getBoundingClientRect();
    window.scrollBy(0, tags.top + 5 - xy.clientY);
    window.dispatchEvent(new Event('scroll'));
    await frames();
    expect(tagNames()).toEqual(['div.tags']);
    window.scrollTo(0, 0);
  });

  it('leaving the capture layer (over the panel) clears the marks', async () => {
    overlay = createGridOverlay();
    shiftM();
    await hoverOver(fixture.querySelector('.cards > div') as Element);
    pointer('pointerleave');
    await frames();
    expect(qa('.rmarks .rgroup')).toHaveLength(0);
  });
});

describe('5. eye state', () => {
  const openSection = async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await userEvent.click(q('[data-key="rendered-toggle"]'));
    await userEvent.click(q('[data-key="show-flex"]'));
    await frames();
  };

  it('hides eye marks while on without changing them, and brings them back after', async () => {
    await openSection();
    await userEvent.click(eyeFor('div.cards'));
    await userEvent.click(eyeFor('div.tags'));
    await frames();
    expect(tagNames()).toEqual(['div.cards', 'div.tags']);
    shiftM();
    await frames();
    expect(qa('.rmarks .rgroup')).toHaveLength(0);
    expect(eyeFor('div.cards').getAttribute('aria-pressed')).toBe('true');
    expect(eyeFor('div.tags').getAttribute('aria-pressed')).toBe('true');
    expect(q('.rsec')).not.toBeNull();
    esc();
    await frames();
    expect(tagNames()).toEqual(['div.cards', 'div.tags']);
  });

  it('an eye changed while inspecting takes effect when it turns off', async () => {
    await openSection();
    await userEvent.click(eyeFor('div.cards'));
    await userEvent.click(eyeFor('div.tags'));
    shiftM();
    await userEvent.click(eyeFor('div.cards'));
    await frames();
    expect(qa('.rmarks .rgroup')).toHaveLength(0);
    expect(eyeFor('div.cards').getAttribute('aria-pressed')).toBe('false');
    expect(qa('.rrow')).not.toHaveLength(0);
    shiftM();
    await frames();
    expect(tagNames()).toEqual(['div.tags']);
  });
});

describe('6. pick handover', () => {
  it('Shift+M while picking ends Pick; Pick while inspecting ends the inspector', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await userEvent.click(q('[data-key="pick"]'));
    expect(q('[data-key="pick"]').getAttribute('aria-pressed')).toBe('true');
    shiftM();
    expect(q('[data-key="pick"]').getAttribute('aria-pressed')).toBe('false');
    expect(inspecting()).toBe(true);
    await userEvent.click(q('[data-key="pick"]'));
    expect(pill().hidden).toBe(true);
    expect(q('[data-key="pick"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('.pick').hidden).toBe(false);
  });
});

describe('7. Shift+G', () => {
  it('hides the hovered marks and keeps the pill', async () => {
    overlay = createGridOverlay();
    shiftM();
    await hoverOver(fixture.querySelector('.cards > div') as Element);
    key({ key: 'G', code: 'KeyG', shiftKey: true });
    await frames();
    expect(q('.rmarks').hidden).toBe(true);
    expect(pill().hidden).toBe(false);
  });
});

describe('8. speed', () => {
  it('draws a newly hovered 12-column grid in under 16 ms (median of 5)', async () => {
    const big = document.createElement('div');
    big.className = 'big';
    big.style.cssText =
      'display:grid; grid-template-columns:repeat(12, 1fr); gap:8px; width:1200px';
    big.innerHTML = '<div style="height:20px"></div>'.repeat(24);
    fixture.prepend(big);
    overlay = createGridOverlay();
    shiftM();
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      await hoverOver(fixture.querySelector('.plain') as Element);
      let before = 0;
      let after = 0;
      requestAnimationFrame(() => {
        before = performance.now();
      });
      const t0 = performance.now();
      pointer('pointermove', at(big.children[0] as Element));
      const sync = performance.now() - t0;
      await new Promise<void>((r) =>
        requestAnimationFrame(() => {
          after = performance.now();
          r();
        }),
      );
      times.push(sync + (after - before));
      expect(tagNames()).toEqual(['div.big']);
    }
    times.sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(16);
  });
});

describe('9. accessibility', () => {
  it('has no axe violations with the inspector on and the panel open', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    shiftM();
    await hoverOver(fixture.querySelector('.cards > div') as Element);
    const result = await axe.run(host(), { resultTypes: ['violations'] });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe('10. destroy', () => {
  it('removes the pill and capture layer; a later click reaches the page', async () => {
    overlay = createGridOverlay();
    shiftM();
    overlay.destroy();
    overlay = undefined;
    expect(document.querySelector('grid-auditor')).toBeNull();
    const pageClick = vi.fn();
    const card = fixture.querySelector('.cards > div') as HTMLElement;
    card.addEventListener('click', pageClick);
    await userEvent.click(card);
    expect(pageClick).toHaveBeenCalledTimes(1);
    shiftM(); // listeners are gone: nothing throws
  });
});

// Spec 10 browser tests: elements with children (0020).
describe('11. elements with children', () => {
  const BLOCKS = `
    <section class="wrap" style="padding:24px; width:600px">
      <div class="head" style="padding:8px 16px">
        <h2 style="margin:0">Heading</h2>
        <p style="margin:0">Text <span class="inl"><b>bold</b></span></p>
      </div>
      <div class="cells" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:20px">
        <div class="t" style="height:40px">a</div><div>b</div><div>c</div>
        <div class="card" style="padding:12px"><span>x</span><p style="margin:0">y</p></div>
      </div>
      <div class="pic" style="width:60px">
        <svg class="art" width="40" height="40"><g><rect width="40" height="40" /></g></svg>
      </div>
      <div class="ghost" style="display:contents"><p class="inner" style="margin:0">only text</p></div>
    </section>
  `;
  let blocks: HTMLElement;
  beforeEach(() => {
    blocks = document.createElement('div');
    blocks.style.display = 'contents';
    blocks.innerHTML = BLOCKS;
    fixture.append(blocks);
  });
  const b = (sel: string) => blocks.querySelector(sel) as HTMLElement;
  const hoverAt = async (x: number, y: number) => {
    pointer('pointermove', { clientX: x, clientY: y });
    await frames();
  };

  it('draws a padded block: box, padding and tag, but no tracks or gaps', async () => {
    overlay = createGridOverlay();
    shiftM();
    const r = b('.wrap').getBoundingClientRect();
    await hoverAt(r.left + 5, r.top + 5); // in the section's padding
    expect(tagNames()).toEqual(['section.wrap']);
    expect(q('.rmarks .rtag .rdim').textContent).toBe(
      `${snapValue(r.width)} × ${snapValue(r.height)}`,
    );
    expect(qa('.rmarks .rbox')).toHaveLength(1);
    expect(qa('.rmarks .rval.pad').map((v) => v.textContent)).toEqual(['24', '24', '24', '24']);
    expect(qa('.rmarks .rtrack')).toHaveLength(0);
    expect(qa('.rmarks .rgap')).toHaveLength(0);
  });

  it('text goes to the nearest parent with children', async () => {
    overlay = createGridOverlay();
    shiftM();
    await hoverOver(b('.head h2'));
    expect(tagNames()).toEqual(['div.head']);
  });

  it('a grid wins over its text-only cells; a cell with children is drawn itself', async () => {
    overlay = createGridOverlay();
    shiftM();
    await hoverOver(b('.cells .t'));
    expect(tagNames()).toEqual(['div.cells']);
    expect(qa('.rmarks .rtrack.col')).toHaveLength(4);
    await hoverOver(b('.card span'));
    expect(tagNames()).toEqual(['div.card']);
    // A gap of the grid: between the first and second cells.
    const t = b('.cells .t').getBoundingClientRect();
    await hoverAt(t.right + 10, t.top + 5);
    expect(tagNames()).toEqual(['div.cells']);
  });

  it('never picks inline elements, SVG, display: contents, or body', async () => {
    overlay = createGridOverlay();
    shiftM();
    // The inline span is skipped; its parent <p> has an element child, so it's the block drawn.
    await hoverOver(b('.inl b'));
    expect(tagNames()).toEqual(['p']);
    const art = b('.art').getBoundingClientRect();
    await hoverAt(art.left + 5, art.top + 5);
    expect(tagNames()).toEqual(['div.pic']);
    await hoverOver(b('.inner'));
    expect(tagNames()).toEqual(['section.wrap']);
    await hoverOver(fixture.querySelector('.plain') as Element);
    expect(qa('.rmarks .rgroup')).toHaveLength(0);
    expect(pill().hidden).toBe(false);
  });

  it('Pick follows the same rule: a block from its padding, a grid from its cells (0022)', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await userEvent.click(q('[data-key="pick"]'));
    const r = b('.wrap').getBoundingClientRect();
    pointer('pointermove', { clientX: r.left + 5, clientY: r.top + 5 });
    await frames();
    expect(qa('.rhl .rtag .rname').map((t) => t.textContent)).toEqual(['section.wrap']);
    pointer('pointermove', at(b('.cells .t')));
    await frames();
    expect(qa('.rhl .rtag .rname').map((t) => t.textContent)).toEqual(['div.cells']);
  });

  it('Compare skips a hovered block', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await userEvent.click(q('[data-key="compare-show"]'));
    shiftM();
    const r = b('.wrap').getBoundingClientRect();
    await hoverAt(r.left + 5, r.top + 5);
    expect(q('[data-key="compare-status"]').textContent).toBe(
      'Nothing to compare in the drawn elements',
    );
    expect(qa('.rmarks .rdline')).toHaveLength(0);
  });

  it('draws the innermost of 7 nested padded blocks in under 16 ms (median of 5)', async () => {
    let html = '<p style="margin:0">leaf</p>';
    for (let i = 7; i >= 1; i--) html = `<div class="n${i}" style="padding:4px">${html}</div>`;
    blocks.insertAdjacentHTML('afterbegin', html);
    overlay = createGridOverlay();
    shiftM();
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      await hoverOver(fixture.querySelector('.plain') as Element);
      let before = 0;
      let after = 0;
      requestAnimationFrame(() => {
        before = performance.now();
      });
      const t0 = performance.now();
      pointer('pointermove', at(b('.n7 p')));
      const sync = performance.now() - t0;
      await new Promise<void>((r) =>
        requestAnimationFrame(() => {
          after = performance.now();
          r();
        }),
      );
      times.push(sync + (after - before));
      expect(tagNames()).toEqual(['div.n7']);
    }
    times.sort((x, y) => x - y);
    expect(times[2]).toBeLessThan(16);
  });

  it('has no axe violations while a block is inspected', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    shiftM();
    await hoverOver(b('.head h2'));
    const result = await axe.run(host(), { resultTypes: ['violations'] });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
