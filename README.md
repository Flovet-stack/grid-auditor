# Grid Auditor

A dev-only browser overlay that shows the **expected** Figma layout grid next to the grid your page **actually rendered**, so you can see where they disagree.

Works with layout grids from Figma. Not affiliated with or endorsed by Figma.

> **Status: 0.1.0 preview.** Expected grids, breakpoints, the control panel, the rendered grid, the inspector and Compare work. Rulers, guides, the toolbar and React/Svelte/Vue entries are not built yet. The plan is in [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) and [`specs/`](specs/).

## Usage

The library never runs in production. Load it only in development with a dynamic import, so your bundler drops it from production builds:

```ts
// Vite
if (import.meta.env.DEV) {
  const { createGridOverlay } = await import('grid-auditor');
  createGridOverlay(); // Shift+G toggles the grid
}
```

## Breakpoints

With no options, you get three default breakpoints (Figma Stretch columns):

| Name    | From width | Columns | Margin | Gutter |
| ------- | ---------- | ------- | ------ | ------ |
| Mobile  | 0          | 4       | 16     | 16     |
| Tablet  | 768        | 8       | 24     | 24     |
| Desktop | 1200       | 12      | 80     | 24     |

The breakpoint with the largest "from width" that fits the window is used. You can edit the defaults and add as many breakpoints as you like:

```ts
createGridOverlay({
  breakpoints: [
    // Same name as a default: edits it. Fields you leave out keep their default values.
    { name: 'Desktop', grids: [{ count: 16 }] },
    // New name: adds a breakpoint. It needs a minWidth and at least one grid.
    {
      name: 'Laptop',
      minWidth: 1024,
      grids: [{ pattern: 'COLUMNS', count: 12, offset: 40, gutterSize: 24 }],
    },
  ],
});
```

- `extendDefaults: false` ignores the defaults and uses only your breakpoints.
- `overlay.setBreakpoints(breakpoints, { extendDefaults })` changes them while the page runs, with no reload.
- `DEFAULT_BREAKPOINTS` is exported (read-only) if you want to copy it.
- Two breakpoints with the same `minWidth` are an error.

## Control panel

Press **Ctrl+Shift+G** (**Cmd+Shift+G** on Mac) to open the panel. It shows the active breakpoint and lists its grids the way Figma's Layout guide section does: one row per grid, with a summary such as `12 columns`. Click a row's icon to edit its count, colour, type, width, margin or offset, and gutter in a popover; click its summary to switch between Grid, Columns and Rows. You can also add, remove, show, hide and reorder grids (drag the handle, or Alt+↑/↓). Changes appear straight away.

- Arrow keys change a value by 1, and Shift+arrow by 10. Enter or leaving the field applies it.
- **Edits are saved** in `localStorage` and come back after a reload, as long as your code's grid config hasn't changed. If you change the grid in code, the panel offers to restore or discard the old edits instead of applying them.
- Calling `update()` or `setBreakpoints()` from code replaces and clears your edits. To keep none, remove every grid with the minus button.
- **Copy config** copies a `createGridOverlay({ ... })` call that reproduces exactly what's on screen, ready to paste into your code.
- `persist: false` turns saving off, so nothing is read from or written to storage.
- `overlay.openPanel()`, `overlay.closePanel()` and `overlay.isPanelOpen()` control it from code.
- `shortcuts: { panel: false }` turns the shortcut off.

### Rendered grid

The **Rendered** section, below Layout guide, shows the grid the page actually laid out. Open it to list the page's grid containers as a tree that follows the page structure, like Figma's layers panel (flex containers are behind **Show flex**; chevrons collapse a branch), then turn on a container's eye to draw it. **Show blocks** adds every other element that has child elements, such as a padded `<section>`, as parents in the tree. Their eyes draw their box, padding and name tag:

- **Grid containers:** each real column and row track as a dashed outline, from the browser's own computed sizes.
- **Gaps:** shaded pink, measured between neighbouring children, so wrapped flex rows work too. Each shows its size in a small pink box.
- **Padding:** shaded in blue, with its size in a small blue box. Sides of 0 aren't drawn.
- **Content box:** a dashed outline, with a dark tag showing the container's name and size (`div.cards 977 × 152`).
- **Gap audit:** each row reads, for example, `gaps 24 ×5`, or `gaps 16 ×3, 24 ×1 · inconsistent` when the spacing isn't even.
- **Track sizes:** hover a track to see its number and size, for example `2 · 240 px`.
- **Pick:** the target button lets you click an element on the page instead, by the same rule as the inspector. Picking a block turns on Show blocks. While picking, the page doesn't receive that click; at all other times the overlay never swallows a page event. Esc cancels.

Shift+G hides these marks along with the expected grid. Nothing here is saved across reloads yet, and nothing is compared with the expected grid yet.

### Inspector

Press **Shift+M** to inspect without opening the panel. Move the pointer over the page: only the element under it is drawn. That's the nearest grid or flex container, with its tracks, gaps, padding, values and size, or the nearest other element that has child elements, with its box, padding and size. Text, inline elements and SVG are skipped in favour of their parent. A pill at the bottom says the inspector is on. While it's on, page clicks are paused (the wheel still scrolls). Press **Esc** or **Shift+M** to exit.

The inspector doesn't change which containers you turned on in the Rendered section. They're hidden while you inspect and come back when you exit.

- `shortcuts: { inspect: false }` turns the shortcut off.

### Compare

The **Compare** section checks the rendered grid against your Figma columns. Turn on **Show deviations**, then turn on a container's eye in the Rendered section, or press Shift+M and hover one.

- **What's checked:** each column edge of that container is compared with the nearest column edge of the same side in the visible Columns grids.
  - For a grid container, these are the track edges.
  - For a flex container, they're the left and right edges of each item.
- **What's marked:** edges more than the **Tolerance** away (0.5 px by default) get an orange line, a bar back to the Figma edge, and a signed label such as `+3 px`. Edges that line up get nothing.
- **Status line:** shows how many deviations there are, or what to turn on first.

The switch and the tolerance are saved with the panel. Rows, square grids and containers with a transform or `subgrid` columns aren't compared.

## Development

Requires Node 24 and pnpm 11.

```bash
pnpm install
pnpm exec playwright install chromium
pnpm dev     # playground
pnpm check   # everything CI runs
```

## Licence

MIT
