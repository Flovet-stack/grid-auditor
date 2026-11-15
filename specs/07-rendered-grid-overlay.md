# 07: Rendered grid overlay

Status: Ready

Brief: must-have #3 (rendered grid overlay). It builds on specs 02–04.

## Goal

A developer sees the grid the page actually laid out: a container's real grid tracks, the gaps between its children and its content box. They choose containers from the panel or by picking one on the page, and spot uneven spacing at a glance from the gap audit. Nothing is compared with the expected grid yet. That's spec 06.

## Decisions

Implements 0015 and the container overlay part of 0011, which 0015 updates. Follows 0005 (rendered style, never colour alone), 0007 (page space), 0014 (panel look, progressive disclosure, spectrum of explicitness) and 0006 (rounding of displayed values).

Two details 0015 left open were approved by Flovet on 2026-11-15, in chat: Shift+G hides rendered marks along with the expected grid, and transformed containers draw only gaps and the content box (see Drawing and Edge cases).

## Acceptance criteria

### Detection: new `src/overlay/containers.ts`

- [ ] **What counts:** an element whose computed `display` is `grid`, `inline-grid`, `flex` or `inline-flex`, that has a box larger than 0 × 0, and has at least one rendered child. Our own `<grid-auditor>` host and everything inside it are never listed.
- [ ] **Labels:** `tag.firstClass`, else `tag#id`, else `tag`, as in 0011. Duplicates get ` 2`, ` 3` and so on, in document order, so each row and page tag is unique.
- [ ] **When the scan runs:**
  - when the Rendered section opens
  - again, coalesced to one per animation frame, when a `MutationObserver` on `document.body` (`childList`, `subtree`, `attributes` for `class` and `style`) fires while the section is open
  - never while the section is closed
- [ ] **Speed:** on a fixture page with 2,000 elements, one scan takes under 16 ms in the browser test, measured as the median of 5 runs.

### Geometry: pure functions, unit-tested

- [ ] **Tracks:** computed from the `gridTemplateColumns`/`gridTemplateRows` px lists, the gaps and the content box.
  - **Content alignment:** `justify-content` and `align-content` are applied: `start`, `end`, `center`, `space-between`, `space-around`, `space-evenly`, and `stretch`/`normal` (both treated as start, because the browser has already stretched the tracks).
  - **Zero-size tracks:** kept, and they still count towards gaps.
  - **RTL:** when `direction: rtl`, columns run from the right edge.
  - **Subgrid:** an axis whose value is `subgrid`, or that doesn't parse to px, draws no tracks. Its tag says `subgrid` (or `tracks unavailable`).
- [ ] **Gaps:** measured between neighbouring children's border boxes, the way GuideFrame does it:
  - For each child, the nearest child to its right that overlaps it vertically gives one horizontal gap. The nearest child below that overlaps it horizontally gives one vertical gap.
  - Gaps of 0 px or less aren't drawn, and duplicate gaps are dropped.
  - Children with `display: none`, `position: absolute` or `position: fixed`, and children of 0 × 0, are ignored.
- [ ] **Gap audit:** values are rounded per 0006 and grouped. The text reads:
  - `gaps 24 ×5` when the gaps are consistent
  - `gaps 16 ×3, 24 ×1 · inconsistent` when they differ, with the most common value first
  - `no gaps` when there are none

  It's a pure function with unit tests.

### Drawing: in the existing layer, page space (0007)

- [ ] **Style:** in the 0005 rendered style:
  - each track is a dashed 1 px blue-violet outline with no fill
  - each gap is hatched in the same colour
  - the content box is a dashed outline
  - nothing is filled solid, so the drawing stays distinct from the expected grid in grayscale
- [ ] **Tag:** each shown container gets its label as a small tag at the top-left of its border box, inside the shadow root.
- [ ] **Track size on hover:** hovering a track shows `2 · 240 px` (track number, then size) in a value pill. The marks themselves keep `pointer-events: none`. Hit-testing uses the pointer position against the computed track rects, so the page still receives every pointer event.
- [ ] **Staying in sync:** marks redraw on scroll and resize (reusing the renderer's frame scheduling), and when a `ResizeObserver` or `MutationObserver` on a **shown** container fires.
- [ ] **Removed containers:** if a shown container leaves the DOM, its marks and its row are removed. Nothing throws.
- [ ] **Visibility:** Shift+G hides and shows all marks, expected and rendered together. Closing the panel doesn't hide rendered marks, the same as Layout guides.

### Panel: Rendered section (0014 look)

- [ ] **Placement:** a new section after Layout guide, collapsed by default.
  - The header is a disclosure button with `aria-expanded`, showing `Rendered` and a muted count, for example `3 grids, 12 flex`.
  - The count is only shown after the first scan. Before that, the header reads `Rendered`.
- [ ] **Rows:** opening it lists grid containers first, in document order. Each 32 px row has:
  - a type icon (grid or flex)
  - the label
  - the gap audit in muted text, ellipsised, with the full text in `title`
  - an eye, off by default

  Several rows can be on at once.

- [ ] **Show flex:** a "Show flex" toggle (a pressed-state button, off by default) adds the flex containers below the grid ones.
- [ ] **Hover outline:** hovering or focusing a row draws a temporary solid 1 px outline around that element on the page. It goes away on leave or blur.
- [ ] **Empty state:** with no containers, the section says `No grid or flex containers on this page.`
- [ ] **Not saved:** which eyes are on isn't kept across reloads (0015 out of scope).

### Pick

- [ ] **Starting:** a Pick button in the section header, with a crosshair-style icon in our own icon style, `aria-pressed` and the tooltip `Pick a container`. Pressing it starts picking.
- [ ] **While picking:**
  - hovering the page outlines the nearest grid or flex container at or above the pointer, with its label
  - a click turns that container's eye on, opens the section (and the flex filter if needed), focuses its row, and ends picking
  - hovering something with no container ancestor outlines nothing, and a click there ends picking without doing anything
- [ ] **Clicks:** while picking, the click (`pointerdown`, `mousedown`, `click` and `pointerup`) gets `preventDefault` and `stopImmediatePropagation` in the capture phase, so the page never receives it. **Picking is the only time any page event is swallowed.**
- [ ] **Cancelling:** Esc, or pressing Pick again, cancels picking. Esc cancels picking before it closes any popover or the panel.
- [ ] **Cursor:** `crosshair` while picking. It's set on our own full-viewport capture element, never on the host page's elements.

## Tests

### Unit (node)

1. Track placement for each content alignment value, with zero-size tracks, and in RTL.
2. `subgrid` and non-px values give no tracks.
3. Gap pairing: a row, a wrapped flex layout (two lines), a 3 × 2 grid, overlapping children, and absolute children (ignored).
4. Gap audit text: consistent, inconsistent (ordered by count), and none.
5. Labels: class, id, bare tag, and the duplicate suffixes.

### Browser

6. **Tracks match the browser:** for a fixture grid (`grid-template-columns: 100px 1fr 2fr`, `gap: 16px`, padding 24 px, `justify-content: center` on a fixed-width variant), each column track's left and right edges equal the children's `getBoundingClientRect` edges within 0.5 px. Repeat with `direction: rtl`.
7. **Flex gaps:** a wrapping flex row gives the right number of hatched gaps, with px values equal to the measured spaces.
8. **Section:** closed by default, and no scan runs (spy on `getComputedStyle` call count). Opening it shows the count and rows. Show flex adds the flex rows. Hovering a row draws and removes the outline.
9. **Eyes:** turning two eyes on draws both containers with their tags. Turning one off removes only its marks.
10. **Sync:** resizing a shown container redraws its tracks. Removing it from the DOM removes its marks and row.
11. **Pick:**
    - while picking, a click on a card inside a grid shows that grid, ends picking, and the page's own click listener isn't called
    - with picking off, the same click reaches the page listener
    - Esc cancels picking without closing the panel
12. **Track hover:** moving the pointer over a track shows its `n · size px` pill, and the page still receives the `pointermove`.
13. **Speed:** the scan on the 2,000-element fixture takes under 16 ms (median of 5).
14. **Accessibility:** axe reports no violations with the section open, flex shown and Pick on. All controls work from the keyboard.

## Out of scope

- **Labels and drawing:** line numbers, area names, always-on track labels, subgrid tracks, and a flex main-axis arrow.
- **State:** keeping eye or filter state across reloads.
- **Comparison:** comparing with the expected grid (spec 06), and snapping to rendered columns.
- **API:** a public API for choosing containers from code.
- **Other:** the geometry inspector (Shift+M, click to pin), and iframes and shadow DOM inside the host page.

## Edge cases

- **Scrolling containers:** the tracks are drawn at the container's scrolled position, clipped to the container's border box.
- **Transformed or zoomed containers:** draw from `getBoundingClientRect`. Track maths assumes no transform. If a container has a non-`none` transform on itself or an ancestor, draw only gaps and the content box, and tag it `transformed: tracks unavailable`.
- **`display: contents` children:** use the grandchildren that are actually laid out as the children.
- **Very large grids (more than 200 tracks):** draw them, but the hover pill only needs to work. No per-track DOM labels are created up front.
- **A container that is also the page's `<body>` or `<html>`:** allowed. Its tag sits at the top-left of the document.

## Files and patterns to follow

- New `src/overlay/containers.ts`: detection, labels, track and gap maths, and the gap audit. Keep the maths pure, taking plain numbers and rects, so node tests cover it.
- `src/overlay/render.ts`: draw the rendered marks in the existing layer, next to the expected grid. Reuse its frame scheduling and page-space transform.
- `src/overlay/panel.ts`: the Rendered section, rows, the Show flex toggle and the Pick button. Follow the 0014 row pattern (`renderRow`, `keyHandlers`, data keys such as `r{j}-visible`, `rendered-toggle`, `show-flex`, `pick`).
- `src/overlay/create.ts`: wire Pick's capture listeners (added only while picking, removed after) and Esc priority.
- README: a "Rendered grid" subsection under Control panel. Design brief §10.1: add the Rendered section.

## Boundaries

- Always: one shadow host; no global CSS; marks `pointer-events: none`; observers only while needed and disconnected on `destroy()`; never swallow a page event outside Pick.
- Ask first: any runtime dependency, any public API, and any new keyboard shortcut.
- Never: read `process.env`; change the engine's expected-grid maths; restore the inspector, rulers or guides.

## Check

- `pnpm check` passes, including the tests above.
- **Playground proof:** add a fixture section to the playground with a CSS grid, a wrapping flex row with one uneven gap, and an RTL grid. Show the Rendered section, Show flex, the gap audit reading `inconsistent`, a track hover pill, and Pick in use. Attach screenshots at 1440 px and 390 px to the PR.
- `/product-team` Workflow E on the diff.
