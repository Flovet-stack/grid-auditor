# 06: Expected vs rendered comparison

Status: Ready

Brief: must-have #4 (expected vs rendered comparison). It builds on specs 02, 04, 07 and 08.

## Goal

A developer turns on **Show deviations** in the panel. Then every container they're looking at, whether its eye is on or the inspector is hovering it, shows exactly where its columns miss the Figma grid, and by how many px. They don't measure anything by hand. Edges that line up show nothing, so the only marks on the page are the ones that need fixing.

## Decisions

Implements 0019. Uses:

- **0006:** the expected grid's whole-pixel edges, clipping, and rounding for labels
- **0007:** the expected grid lives in document space, and breakpoints are picked by `innerWidth`
- **0013:** storage
- **0014:** the panel's look
- **0015–0018:** the rendered grid, its marks and the inspector

## Acceptance criteria

### What's compared (0019 §1–3)

- [ ] **Expected edges:** the left and right edge of every column in each **visible Columns** grid of the active breakpoint. They're computed as the overlay draws them: `computeSections` on the page box, then `clipSections`, using the whole-pixel (snapped) edges. Grids whose eye is off aren't compared, and neither are Rows and Grid patterns.
- [ ] **Rendered edges:** taken from every container that's drawn. That's the containers whose eyes are on, or only the hovered container while the inspector is on (0018 §5).
  - **Grid:** each column track's left and right edge.
  - **Flex:** the left and right border-box edges of each layout child (`layoutChildren`).
  - **Duplicates:** in both cases, edges of the same side within 0.5 px of each other count once.
  - **Skipped:** a container with a `subgrid` column axis or a transform. It adds nothing, and it doesn't count as compared.
- [ ] **Matching:** a left edge is matched only to the nearest expected left edge, and a right edge only to the nearest expected right edge, across all visible Columns grids.
  - "Left" and "right" mean the physical sides, because Figma grids have no writing direction.
  - Both sides are in the same coordinates: the expected document px minus `scrollX`, and the rendered viewport px.
- [ ] **Deviation:** `d = rendered − expected`, computed on the exact values.
  - It's a deviation only when `|d| > tolerance`.
  - The label shows `snap(d)` (0006): a sign, then the number, a space and `px`, for example `+3 px` or `−2 px`. The minus is U+2212, and 0 never shows, since every deviation rounds to at least 1.

### Marks (0019 §4)

- [ ] **Colour:** `#e5590b`, set as one CSS custom property in the rendered layer's styles and used for nothing else.
- [ ] **Edge line:** a 2 px solid line centred on the rendered edge, spanning the container's content box vertically.
- [ ] **Bar:** a 2 px solid horizontal bar from the expected x to the rendered x, at 4 px below the content box's top. It has a 1 × 8 px end cap at each end, so a 1 px deviation still shows two caps.
- [ ] **Label:** a value box centred under the bar's midpoint.
  - Bold 10 px white text on the deviation colour, with a 2 px radius.
  - The same padding as the gap and padding value boxes (0016).
  - It never covers the name tag (0017), which sits above the top edge.
- [ ] **Clipping and order:**
  - Marks are clipped like the container's other marks: to the padding box when overflow isn't visible.
  - They draw above every other rendered mark.
  - They have `pointer-events: none`, so the track-size pill still works under them.
- [ ] **When there are no marks:** when Show deviations is off, when an edge is within the tolerance, and when the overlay is hidden (Shift+G hides them along with everything else).

### Panel: Compare section (0019 §5)

- [ ] **Placement:** a section headed `Compare`, between Layout guide and Rendered. It's always expanded, styled per 0014 with its rows following the panel's 32 px row height, and its heading is an `h3` like the other sections.
- [ ] **Show deviations:** a text toggle button with `aria-pressed`, styled like Show flex. It's off by default.
- [ ] **Tolerance:**
  - **The field:** a label, then a text input (`inputmode="decimal"`) and a `px` suffix. Its accessible name is `Tolerance`, and it shows `0.5` by default.
  - **Editing:** Arrow keys step by 0.5, and Shift+Arrow by 5. Enter or blur commits the value.
  - **Committing:** the value is rounded to the nearest 0.5 and clamped to 0.5–20. Anything that isn't a number puts back the last good value.
  - **Always visible:** the field shows whether or not the switch is on.
- [ ] **Status line:** muted 11 px text under the row, shown only while Show deviations is on. The first case that applies wins:
  1. `Turn on a Columns grid in Layout guide`: the active breakpoint has no visible Columns grid.
  2. `Turn on a container's eye, or press Shift+M`: nothing is drawn. When `shortcuts.inspect` is `false`, it reads `Turn on a container's eye`.
  3. `Nothing to compare in the drawn containers`: every drawn container was skipped (subgrid or transformed).
  4. `N deviation(s) in M container(s)`, for example `1 deviation in 1 container` or `3 deviations in 2 containers`.
  5. `No deviations over T px`, where T is the tolerance with no trailing `.0`, for example `No deviations over 0.5 px` or `over 2 px`.
- [ ] **Not a live region:** the status line isn't a live region, because it changes on every inspector hover. Its text is plain and readable in place.
- [ ] **Updates without rebuilding:** the panel updates the status line only when its text changes, not every frame. Typing in the tolerance field keeps focus, as the Layout guide fields do.

### Saving (0019 §5, 0013)

- [ ] **What's saved:** the switch and the tolerance go in the `grid-auditor:v1` entry as `compare: { show: boolean, tolerance: number }`.
  - Both are read back through `parseStored`, so a bad or missing value falls back to the defaults.
  - They're not part of the fingerprint, and they don't set the `Edited` badge.
- [ ] **Reset to code** doesn't change them, and neither do `update()` or `setBreakpoints()`.
- [ ] **`persist: false`:** nothing is read or written, and each load starts from the defaults.

### Staying in sync (0019 §6)

- [ ] **When it recomputes:** deviations are worked out in the same draw pass as the rendered marks. So they follow scroll, resize, changes to a shown container, inspector hover, a breakpoint switch, Layout guide edits, eye toggles and tolerance changes.
- [ ] **When it's off:** Show deviations off costs nothing. No expected edges are computed and no marks are built.

### Untouched

- [ ] **No new public API and no new shortcut.** The Rendered section, the inspector and Pick work as before.

## Tests

### Unit (`test/unit/compare.test.ts`)

1. **Matching:**
   - Left edges match left edges, and right edges match right edges.
   - A rendered left edge 13 px to the right of a column's left edge, with a 24 px gutter, gives `+13 px`, not `−11 px`.
2. **Tolerance:**
   - At 0.5 px, `d = 0.5` is no deviation.
   - `d = 0.6` gives `+1 px`, and `d = −0.6` gives `−1 px` with U+2212.
   - Labels round as `snap` does: `d = 2.5` gives `+2 px`, and `d = −2.5` gives `−3 px` (0006: exact halves round down).
3. **Several grids:** with two visible Columns grids, the nearest edge across both is used.
4. **Duplicates:** flex edges within 0.5 px count once. Edges 1 px apart count twice.
5. **Nothing expected:** with no expected edges, there are no deviations.
6. **Tolerance input:**
   - `0` → 0.5, `0.7` → 0.5, `0.8` → 1, `25` → 20.
   - `abc` keeps the previous value.
7. **Status text:** each of the five cases, with singular and plural, and `over 2 px` without a trailing `.0`.
8. **Saved values:** in `persist.test.ts`, `parseStored` keeps a valid `compare` and drops a bad one (a wrong type, or a tolerance outside 0.5–20), without losing the rest of the entry.

### Browser (`test/browser/compare.test.ts`)

**Fixtures:** a fixed viewport, an expected 12-column Stretch grid with known margin and gutter, and three containers:

- **Aligned:** a grid container whose columns match the expected grid exactly.
- **Shifted:** a copy moved right with `margin-left: 3px`.
- **Wrapping:** a flex row whose items wrap onto two lines.

1. **Off by default:** with an eye on the shifted grid, no deviation marks exist, and the Compare status line isn't shown.
2. **Aligned:** with the switch on and the aligned grid's eye on, no marks are drawn, and the status reads `No deviations over 0.5 px`.
3. **Shifted:**
   - With the shifted grid's eye on, each column edge has a mark labelled `+3 px`.
   - The status reads `24 deviations in 1 container` (12 left and 12 right edges).
   - The edge line's left equals the track edge, and the bar spans from the expected x to the rendered x.
4. **Tolerance:**
   - Typing `3` and Enter removes the marks, since 3 isn't more than 3.
   - `2.5` brings them back.
   - Typing `0` shows `0.5`.
5. **Flex:** the wrapping flex row's deviations count each unique edge once, not once per line.
6. **Inspector:**
   - With the switch on, Shift+M and a hover over the shifted grid show its deviations.
   - Moving to the aligned grid clears them, and the status follows.
   - After Esc, the shown set's deviations come back.
7. **Status messages:**
   - With the Columns grid's eye off: `Turn on a Columns grid in Layout guide`.
   - With no eyes on: `Turn on a container's eye, or press Shift+M`.
   - With `shortcuts: { inspect: false }`: `Turn on a container's eye`.
   - With only a transformed container: `Nothing to compare in the drawn containers`.
8. **Sync:**
   - Scrolling the page vertically doesn't change the labels.
   - Resizing across a breakpoint compares against the new breakpoint's grid.
   - Changing the gutter in Layout guide updates the labels.
9. **Shift+G** hides the deviation marks, and showing the grid again brings them back.
10. **Saving:**
    - After the switch is on and the tolerance is 2, a new overlay on the same storage starts with both.
    - Reset to code leaves them as they are.
    - `persist: false` writes nothing.
11. **Colour:** the edge line's computed background is `rgb(229, 89, 11)`.
12. **Accessibility:** axe reports no violations with the panel open, the Compare section showing and deviation marks on the page.
13. **Speed:** with the switch on, inspector hover to drawn marks stays under 16 ms (median of 5), for spec 08's 12-column, 24-child grid compared against a 12-column expected grid.
14. **Destroy:** `destroy()` removes every deviation mark and the Compare section.

## Out of scope

- Rows and square grids (0019 Consequences).
- Comparing with grids set on containers (brief #5).
- A list of deviations (#26) and the breakpoint sweep (#29).
- A `tolerance` option in code, and any shortcut.
- Drawing deviations for subgrid or transformed containers.
- Fixing overlapping labels in very dense layouts (accepted in 0016).

## Edge cases

- **Horizontal page scroll:** expected edges are converted with `scrollX`, so the marks stay right when the page scrolls sideways.
- **Containers inside an inner scroll area:** measured in viewport px like every other mark, and clipped by the existing clip rule.
- **Zero-size tracks** (kept by 0015): their left and right edges coincide. Both are compared, so two marks can share an x. That's accepted.
- **An edge in the margin, outside every column,** is still matched to the nearest expected edge of its side, and it shows a deviation if it's beyond the tolerance.
- **No breakpoint is active,** or the active breakpoint has no grids: status case 1.
- **The inspector is on but hovering nothing:** nothing is drawn, so status case 2 applies.
- **The overlay is hidden by Shift+G** while the switch is on: the marks are hidden, and the status line keeps the last result.
- **A container leaves the page:** it's dropped, as in spec 07, and the counts update on the next draw.

## Files and patterns to follow

- **New `src/overlay/compare.ts`:** pure functions with no DOM, so the unit tests cover them, like `containers.ts`:
  - `expectedEdges(breakpoint, box)` → left and right edge lists
  - `renderedEdges(layout)` → left and right edge lists, or `undefined` when the container is skipped
  - `findDeviations(expected, rendered, tolerance)`
  - `formatDeviation(d)`
  - `normalizeTolerance(raw, previous)`
  - `compareStatus(...)`
- **`src/overlay/containers.ts`:** add the layout children's border-box rects (`items`) to `ContainerLayout`. `measureContainer` already measures them for `pairGaps`.
- **`src/overlay/rendered.ts`:**
  - deviation marks and the colour property in `RENDERED_STYLES`
  - drawing them in `draw()` for the same targets as the other marks
  - a way for `create.ts` to hand in the compare state and the expected edges
  - the last counts, readable by the panel, with `onChange` only when they change
- **`src/overlay/create.ts`:** works out the active breakpoint's expected edges (reusing `measurePage` and the engine), keeps the compare state, saves it, and connects the panel and the rendered layer.
- **`src/overlay/persist.ts`:** `Stored.compare`, and parsing it.
- **`src/overlay/panel.ts`:**
  - the Compare section between Layout guide and Rendered
  - the toggle, styled like Show flex
  - the tolerance field, reusing the `numberInput` keyboard behaviour
  - the status line
  - new `PanelStore` members for the compare state
- **New `test/browser/compare.test.ts`**, following `rendered.test.ts` and `inspector.test.ts`, and `test/unit/compare.test.ts`, following `containers.test.ts`.
- **Docs:**
  - **README:** a "Compare" subsection after "Inspector".
  - **Design brief:** §9.1's Deviation row becomes orange `#e5590b` with the edge line, capped bar and signed label. §10's panel row drops the expected/rendered/both picker. A new §10.4 covers the Compare section.
- **Playground:** a Compare fixture with a 12-column grid built from the playground's desktop margin and gutter, and a copy shifted by 3 px, so both cases can be checked by hand.

## Boundaries

- **Always:**
  - one shadow host
  - no global CSS
  - marks have `pointer-events: none`
  - every listener and observer is removed on `destroy()`
  - storage reads and writes go through `safeStorage`
- **Ask first:** any public API, including a tolerance option; any shortcut; any runtime dependency; and any change to which containers are compared.
- **Never:**
  - read `process.env`
  - change which eyes are on
  - remove, hide or replace the Rendered section
  - compare containers that aren't drawn
  - restore rulers or guides

## Check

- `pnpm check` passes, including every test above.
- **Playground proof:**
  - screenshots at 1440 px and 390 px with the switch on, showing the shifted fixture's marks and the aligned fixture without marks
  - one shot over the dark section
  - one shot of the inspector hovering the shifted fixture
- `/product-team` Workflow E on the diff.
