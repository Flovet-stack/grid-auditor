// Decision 0004: the consumer gates the library behind a dev-only dynamic
// import, so production builds contain none of it.
if (import.meta.env.DEV) {
  const { createGridOverlay } = await import('grid-auditor');
  // The default breakpoints (0010) match style.css: 4 / 8 / 12 stretch columns.
  createGridOverlay();
}

// Page behaviour for the interactive fixtures: not part of the library. Every click is
// logged, so you can see that Pick and the inspector (Shift+M) keep clicks from the page.
const log = document.getElementById('click-log');
const describe = (el: Element): string => {
  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList.length ? `.${Array.from(el.classList).join('.')}` : '';
  return `${el.tagName.toLowerCase()}${id}${cls}`;
};
document.addEventListener('click', (e) => {
  if (!log || !(e.target instanceof Element) || e.target.closest('grid-auditor')) return;
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} click on ${describe(e.target)}`;
  log.prepend(item);
});
let clicks = 0;
document.getElementById('count-btn')?.addEventListener('click', () => {
  clicks += 1;
  const out = document.getElementById('count');
  if (out) out.textContent = `${clicks} click${clicks === 1 ? '' : 's'}`;
});
