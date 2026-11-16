# 10: Inspect elements with children

Status: In progress

Brief: must-have #17 (geometry inspection: "dimensions, padding, gaps and alignment of the hovered element"). It builds on spec 08.

## Goal

A developer presses Shift+M and hovers a padded wrapper, for example a `<section>` with padding, or a heading block inside it. The inspector shows that element's box, padding and size, just as it already does for grid and flex containers. Every padded wrapper on the page can be checked, not only the grids and flex rows. Text, icons and inline elements still never crowd the screen.

## Decisions

Implements 0020. Builds on 0018 (the inspector), 0016 (padding marks and value boxes), 0017 (name tags), 0015 (container rules), 0006 (rounding) and 0019 (Compare).

## Acceptance criteria

### Which element is drawn (0020 §1)

- [ ] **The rule:** on `pointermove` over the capture layer, the inspector starts at the element under the pointer and walks up to the first element that is one of these:
  - a grid or flex container, by the existing `containerKind` rules
  - an **inspectable block**: an HTML element with at least one laid-out element child (`layoutChildren`), a border box wider and taller than 0, and a computed `display` other than `inline`, `contents` or `none`
- [ ] **Never picked:** `html`, `body`, the overlay's own host, and SVG elements (any element not in the HTML namespace). Walking up stops at `body`, so a spot with nothing inspectable above it draws nothing and shows only the pill.
- [ ] **Text alone isn't enough:** an element whose only children are text nodes isn't inspectable. Hovering its text picks its nearest inspectable parent.
- [ ] **Scroll and leave:** the scroll re-check and `pointerleave` behave as in spec 08, using the new rule.

### What's drawn for a block (0020 §2–3)

- [ ] **The marks:** the same marks a grid or flex container gets, minus the parts it doesn't have:
  - the dashed content box (`.rbox`)
  - each padding side that isn't 0, shaded blue with its value box (0016)
  - the dark name tag with its size dimmed beside it (0017), for example `section.compare-demo 1440 × 312`
- [ ] **Not drawn for a block:** tracks, gaps, the track-size pill, margins, or a separate border band.
- [ ] **Clipping:** a block with overflow that isn't `visible` clips its marks to its padding box, like a container.
- [ ] **Containers are unchanged:** grid and flex containers are drawn exactly as before.
- [ ] **The name tag** uses the scanned label when the element is in the Rendered list, and its base label otherwise (spec 08 edge case). Blocks are never in the list, so they always get the base label.

### What doesn't change (0020 §4–5)

- [ ] **The Rendered section, eyes and Pick** still find and pick grid and flex containers only. Pick keeps using `containerAt`.
- [ ] **Compare:** a hovered block counts as drawn but isn't compared. With Show deviations on and a block hovered, the status reads `Nothing to compare in the drawn elements`.
  - This copy change from spec 06 ("containers" → "elements") was allowed by 0020's Consequences.
  - It applies to every case 3, including transformed and subgrid containers.
- [ ] **Speed:** hover to drawn marks stays under 16 ms (spec 08's budget).
- [ ] **No new public API, shortcut or option.**

## Tests

### Unit (`test/unit/containers.test.ts` or a new file, whichever fits)

1. If the inspectable-block check is a pure function of a computed display value, a tag name, a namespace and a child count, test it directly:
   - `block`, `flow-root`, `list-item`, `inline-block` and `table` with children → yes
   - `inline` and `contents` → no
   - `html`, `body` and SVG → no
   - no element children → no

### Browser (extend `test/browser/inspector.test.ts`)

**Fixture:** add a padded wrapper, the same shape as the playground's Compare section:

```
section.wrap (padding: 24px)
  div.head (padding: 8px 16px)
    h2 (text only)
    p (text only)
  div.cells (display: grid)
    div (text only) × 3
    div.card (padding: 12px)
      span (text only)
      p (text only)
```

1. **Block padding:** hovering `section.wrap`'s padding draws `section.wrap`, with:
   - one `.rbox`
   - four padding shades with value boxes reading `24`
   - a tag reading `section.wrap` and its size
   - no `.rtrack` and no `.rgap`
2. **Text goes to the parent:** hovering the `h2` text draws `div.head`, not the `h2`.
3. **Containers come first when they're innermost:**
   - Hovering a text-only cell of `div.cells` draws the grid, with its tracks and gaps.
   - Hovering `div.card` draws the card (0020's trade-off).
   - Hovering a gap of `div.cells` draws the grid.
4. **Never picked:** a body-level `<p>` hovered with nothing inspectable above it draws nothing and shows the pill.
   - An inline `<span>` with an element child inside `div.head` is skipped, and its block parent is drawn.
   - An `<svg>` with `<path>` children is skipped.
   - A `display: contents` wrapper is skipped.
5. **Existing tests:** spec 08's "nothing under the pointer" cases (`p.plain`) must hover a spot whose parents aren't inspectable. Move `p.plain` out of the fixture wrapper so it sits directly in `body`, or give the fixture wrapper `display: contents`. Update those tests to match. The rest of `inspector.test.ts` must pass unchanged.
6. **Pick is unchanged:** Pick over `section.wrap`'s padding highlights nothing, since there's no container above it. Over a cell of `div.cells`, it highlights the grid.
7. **Compare:** with Show deviations on, hovering `section.wrap` gives the status `Nothing to compare in the drawn elements` and no deviation marks. Spec 06's tests and unit test for case 3 are updated to the new copy.
8. **Speed:** spec 08's 16 ms test still passes. Add a run that hovers the innermost leaf of a 7-level nest of padded blocks.
9. **Accessibility:** axe reports no violations while a block is inspected.

## Out of scope

- Margins, inline elements, and borders as their own band (0020 §3).
- A key to step up to the parent element.
- Adding blocks to the Rendered list, eyes or Pick.
- Comparing block edges with the expected columns.

## Edge cases

- **Hovering the padding of a block inside a grid cell's padding** picks the block, because it's innermost.
- **A block with children that are all `position: absolute`** has no laid-out children (`layoutChildren` skips them), so it isn't inspectable.
- **A transformed block** is drawn from its measured boxes, like a transformed container, and tagged as transformed.
- **A replaced element** (`img`, `input`, `video`) has no element children, so its parent is picked.
- **Very large blocks** (a full-width `main`) are drawn like any other: one box, up to four padding shades, one tag.

## Files and patterns to follow

- **`src/overlay/containers.ts`:**
  - a check for inspectable blocks next to `containerKind`
  - an `inspectableAt(el, skip)` hit rule next to `containerAt`, which stays as it is for Pick
  - `measureContainer`, or a sibling measuring function, returning a layout for a block, with kind `'block'`, `'unavailable'` tracks and no gaps
  - `scanContainers` and the Rendered list unchanged
- **`src/overlay/rendered.ts`:**
  - the inspector's `pointermove` and scroll re-check use `inspectableAt`
  - `draw()` already handles tracks being missing and gaps being empty; check that the tag doesn't get the `tracks unavailable` suffix for blocks
- **`src/overlay/compare.ts`:** `renderedEdges` returns `undefined` for `'block'`, and the case 3 copy changes.
- **`test/browser/inspector.test.ts`, `test/browser/compare.test.ts`, `test/unit/compare.test.ts`:** as above.
- **Docs:**
  - **README:** the "Inspector" subsection says any element with children shows its box and padding, and that grid and flex containers also show tracks and gaps.
  - **Design brief:** §10.3 says the same.
  - **Spec 06:** status line case 3 copy.
- **Playground:** no new fixture. `section.compare-demo` and `div.cmp-head` are the manual check.

## Boundaries

- Always: one shadow host; no global CSS; marks have `pointer-events: none`; listeners are removed on `destroy()`.
- Ask first: margins, inline elements, any new key or option, and any change to the Rendered list or Pick.
- Never: read `process.env`; change which eyes are on; remove, hide or replace the Rendered section.

## Check

- `pnpm check` passes, including the tests above.
- **Playground proof:** with Shift+M on, screenshots at 1440 px and 390 px of each of these being hovered:
  - `section.compare-demo` (its padding)
  - `div.cmp-head` (its heading text)
  - `div.cmp-grid` (a cell)
- `/product-team` Workflow E on the diff.
