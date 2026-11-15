import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { scanContainers } from '../../src/overlay/containers';
import { createGridOverlay, type GridOverlay } from '../../src/index';

// Spec 07 browser tests: the rendered grid overlay (0015).

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const frames = async (n = 2) => {
  for (let i = 0; i < n; i++) await nextFrame();
};

const host = () => document.querySelector('grid-auditor') as HTMLElement;
const shadow = () => host().shadowRoot as ShadowRoot;
const q = <T extends Element = HTMLElement>(sel: string) => shadow().querySelector(sel) as T;
const qa = (sel: string) => Array.from(shadow().querySelectorAll<HTMLElement>(sel));
const rowLabels = () => qa('.rrow').map((r) => r.getAttribute('aria-label'));
const eyeFor = (label: string) => {
  const i = rowLabels().indexOf(label);
  return q(`[data-key="r${i}-visible"]`);
};

let overlay: GridOverlay | undefined;
let fixture: HTMLElement;
let style: HTMLStyleElement;

const FIXTURE = `
  <div class="cards" style="display:grid; grid-template-columns:100px 1fr 2fr; gap:16px;
    padding:24px; width:700px">
    <div style="height:40px">a</div><div>b</div><div>c</div>
    <div style="height:40px">d</div><div>e</div><div>f</div>
  </div>
  <div class="centered" style="display:grid; grid-template-columns:100px 120px; column-gap:10px;
    justify-content:center; width:600px; padding:8px">
    <div style="height:20px"></div><div></div>
  </div>
  <div class="cards" dir="rtl" style="display:grid; grid-template-columns:100px 150px; gap:20px;
    width:500px">
    <div style="height:20px"></div><div></div>
  </div>
  <div class="tags" style="display:flex; flex-wrap:wrap; gap:8px 12px; width:200px">
    <span style="width:80px;height:20px"></span><span style="width:80px;height:20px"></span>
    <span style="width:80px;height:20px"></span><span style="width:80px;height:20px"></span>
  </div>
`;

beforeEach(async () => {
  localStorage.clear();
  style = document.createElement('style');
  style.textContent = 'html, body { margin: 0; padding: 0; }';
  document.head.append(style);
  fixture = document.createElement('div');
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

const open = async () => {
  overlay = createGridOverlay();
  overlay.openPanel();
  await userEvent.click(q('[data-key="rendered-toggle"]'));
  await frames();
};
const showRow = async (label: string) => {
  await userEvent.click(eyeFor(label));
  await frames();
};
const within = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(0.5);

describe('6. tracks match the browser', () => {
  it('each column track lines up with the children, LTR, centred and RTL', async () => {
    await open();
    for (const [label, sel] of [
      ['div.cards', '.cards:not([dir])'],
      ['div.centered', '.centered'],
      ['div.cards 2', '.cards[dir]'],
    ] as const) {
      await showRow(label);
      const tracks = qa('.rtrack.col');
      const kids = Array.from(fixture.querySelector(sel)?.children ?? []);
      const cols = new Set(kids.map((k) => k.getBoundingClientRect().left));
      const left = [...cols].sort((a, b) => a - b);
      const trackLeft = tracks.map((t) => t.getBoundingClientRect().left).sort((a, b) => a - b);
      expect(trackLeft).toHaveLength(left.length);
      trackLeft.forEach((x, i) => {
        within(x, left[i] ?? Number.NaN);
      });
      const kidRights = [...new Set(kids.map((k) => k.getBoundingClientRect().right))].sort(
        (a, b) => a - b,
      );
      const trackRight = tracks.map((t) => t.getBoundingClientRect().right).sort((a, b) => a - b);
      trackRight.forEach((x, i) => {
        within(x, kidRights[i] ?? Number.NaN);
      });
      await showRow(label); // hide again before the next one
    }
  });
});

describe('7. flex gaps', () => {
  it('a wrapping flex row gives hatched gaps with the measured sizes', async () => {
    await open();
    await userEvent.click(q('[data-key="show-flex"]'));
    expect(qa('.rrow .rlabel small').at(-1)?.textContent).toBe('col gaps 12 ×2 · row gaps 8 ×2');
    await showRow('div.tags');
    const gaps = qa('.rgap').map((g) => g.getBoundingClientRect());
    expect(gaps).toHaveLength(4);
    expect(gaps.filter((g) => g.width === 12)).toHaveLength(2);
    expect(gaps.filter((g) => g.height === 8)).toHaveLength(2);
  });
});

describe('8. section', () => {
  it('is closed by default and scans only when opened', async () => {
    const spy = vi.spyOn(window, 'getComputedStyle');
    overlay = createGridOverlay();
    overlay.openPanel();
    await frames();
    expect(q('[data-key="rendered-toggle"]').getAttribute('aria-expanded')).toBe('false');
    expect(q('.rsec .count')).toBeNull();
    expect(spy.mock.calls.length).toBeLessThan(20);
    await userEvent.click(q('[data-key="rendered-toggle"]'));
    expect(q('.rsec .count').textContent).toBe('3 grids, 1 flex');
    expect(rowLabels()).toEqual(['div.cards', 'div.centered', 'div.cards 2']);
    await userEvent.click(q('[data-key="show-flex"]'));
    expect(rowLabels()).toEqual(['div.cards', 'div.centered', 'div.cards 2', 'div.tags']);
  });

  it('hovering a row outlines its element, and leaving clears it', async () => {
    await open();
    await userEvent.hover(qa('.rrow')[1] as HTMLElement);
    const out = q('.rhl .rout').getBoundingClientRect();
    const target = fixture.querySelector('.centered')?.getBoundingClientRect();
    within(out.left, target?.left ?? Number.NaN);
    within(out.width, target?.width ?? Number.NaN);
    await userEvent.unhover(qa('.rrow')[1] as HTMLElement);
    expect(q('.rhl .rout')).toBeNull();
  });

  it('says so when there are no containers', async () => {
    fixture.innerHTML = '<p>Just text</p>';
    await open();
    expect(q('.rsec .empty').textContent).toBe('No grid or flex containers on this page.');
  });
});

describe('9. eyes', () => {
  it('two eyes draw two containers with tags; one off removes only its marks', async () => {
    await open();
    await showRow('div.cards');
    await showRow('div.centered');
    expect(qa('.rmarks .rtag').map((t) => t.textContent)).toEqual(['div.cards', 'div.centered']);
    expect(eyeFor('div.cards').getAttribute('aria-pressed')).toBe('true');
    await showRow('div.cards');
    expect(qa('.rmarks .rtag').map((t) => t.textContent)).toEqual(['div.centered']);
  });

  it('Shift+G hides rendered marks with the expected grid', async () => {
    await open();
    await showRow('div.cards');
    overlay?.hide();
    await frames();
    expect(q('.rmarks').hidden).toBe(true);
    overlay?.show();
    await frames();
    expect(q('.rmarks').hidden).toBe(false);
  });
});

describe('10. sync', () => {
  it('redraws on resize and drops removed containers', async () => {
    await open();
    await showRow('div.centered');
    const el = fixture.querySelector('.centered') as HTMLElement;
    const before = q('.rbox').getBoundingClientRect().width;
    el.style.width = '400px';
    await frames(4);
    expect(q('.rbox').getBoundingClientRect().width).toBe(before - 200);
    el.remove();
    await frames(4);
    expect(qa('.rmarks .rtag')).toHaveLength(0);
    expect(rowLabels()).not.toContain('div.centered');
  });
});

describe('11. pick', () => {
  const at = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { clientX: r.left + 5, clientY: r.top + 5 };
  };
  const pointer = (type: string, xy: { clientX: number; clientY: number }) =>
    q('.pick').dispatchEvent(
      new MouseEvent(type, { ...xy, bubbles: true, composed: true, cancelable: true }),
    );

  it('picks the grid around a card; the page never gets the click', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    const pageClick = vi.fn();
    const card = fixture.querySelector('.centered > div') as HTMLElement;
    card.addEventListener('click', pageClick);
    document.addEventListener('click', pageClick);
    await userEvent.click(q('[data-key="pick"]'));
    expect(q('[data-key="pick"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('.pick').hidden).toBe(false);
    pointer('pointermove', at(card));
    expect(q('.rhl .rtag').textContent).toBe('div.centered');
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      pointer(type, at(card));
    await frames();
    expect(pageClick).not.toHaveBeenCalled();
    expect(q('.pick').hidden).toBe(true);
    expect(q('[data-key="rendered-toggle"]').getAttribute('aria-expanded')).toBe('true');
    expect(eyeFor('div.centered').getAttribute('aria-pressed')).toBe('true');
    expect(shadow().activeElement).toBe(eyeFor('div.centered'));
    document.removeEventListener('click', pageClick);
  });

  it('picking a flex container turns Show flex on', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await userEvent.click(q('[data-key="pick"]'));
    pointer('click', at(fixture.querySelector('.tags > span') as Element));
    await frames();
    expect(q('[data-key="show-flex"]').getAttribute('aria-pressed')).toBe('true');
    expect(eyeFor('div.tags').getAttribute('aria-pressed')).toBe('true');
  });

  it('with picking off, clicks reach the page', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    const pageClick = vi.fn();
    const card = fixture.querySelector('.centered > div') as HTMLElement;
    card.addEventListener('click', pageClick);
    await userEvent.click(card);
    expect(pageClick).toHaveBeenCalledTimes(1);
  });

  it('Esc cancels picking without closing the panel', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    await userEvent.click(q('[data-key="pick"]'));
    q('[data-key="pick"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
    expect(q('.pick').hidden).toBe(true);
    expect(overlay.isPanelOpen()).toBe(true);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(overlay.isPanelOpen()).toBe(true);
  });
});

describe('12. track hover', () => {
  it('shows the track number and size; the page still gets the pointermove', async () => {
    await open();
    await showRow('div.centered');
    const pageMove = vi.fn();
    document.addEventListener('pointermove', pageMove);
    const second = fixture.querySelectorAll('.centered > div')[1] as HTMLElement;
    await userEvent.hover(second);
    expect(pageMove).toHaveBeenCalled();
    expect(q('.rpill').hidden).toBe(false);
    expect(q('.rpill').textContent).toBe('2 · 120 px');
    document.removeEventListener('pointermove', pageMove);
  });
});

describe('13. speed', () => {
  it('scans 2,000 elements in under 16 ms (median of 5)', () => {
    const big = document.createElement('div');
    let html = '';
    for (let i = 0; i < 400; i++) {
      html += `<section style="display:${i % 4 ? 'block' : 'flex'}"><div>a</div><div>b</div><span>c</span><em>d</em></section>`;
    }
    big.innerHTML = html;
    fixture.append(big);
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      scanContainers(document, document.createElement('div'));
      runs.push(performance.now() - t);
    }
    runs.sort((a, b) => a - b);
    expect(document.querySelectorAll('*').length).toBeGreaterThanOrEqual(2000);
    expect(runs[2]).toBeLessThan(16);
  });
});

describe('14. accessibility', () => {
  it('has no axe violations with the section open, flex shown and Pick on', async () => {
    await open();
    await userEvent.click(q('[data-key="show-flex"]'));
    await showRow('div.cards');
    await userEvent.click(q('[data-key="pick"]'));
    const result = await axe.run(host(), { resultTypes: ['violations'] });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it('works from the keyboard', async () => {
    overlay = createGridOverlay();
    overlay.openPanel();
    q('[data-key="rendered-toggle"]').focus();
    await userEvent.keyboard('{Enter}');
    expect(q('[data-key="rendered-toggle"]').getAttribute('aria-expanded')).toBe('true');
    expect(shadow().activeElement).toBe(q('[data-key="rendered-toggle"]'));
    eyeFor('div.cards').focus();
    await userEvent.keyboard(' ');
    await frames();
    expect(eyeFor('div.cards').getAttribute('aria-pressed')).toBe('true');
    expect(shadow().activeElement).toBe(eyeFor('div.cards'));
  });
});
