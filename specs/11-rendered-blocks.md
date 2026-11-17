# 11: Show blocks in the Rendered list

Status: In progress

Brief: must-have #3 (rendered grid overlay, "for a chosen container"), together with #17 (geometry inspection). It builds on specs 07 and 10.

## Goal

A developer opens the Rendered section and turns on **Show blocks**. Every element the inspector can draw now appears in the tree: padded wrappers such as `section.compare-demo` become parents, and plain blocks such as `div.cmp-head` get their own rows. The list matches the page's structure, and any of those elements can be kept drawn with its eye. With Show blocks off, the list is exactly what it was.

## Decisions

Implements 0022. Builds on:

- **0015:** the Rendered list, the scan, Show flex and Pick
- **0016:** the container tree
- **0020:** which elements are inspectable, and how a block is drawn
- **0014:** panel look and icons
- **0019:** Compare skips blocks

## Acceptance criteria

### Show blocks (0022 §1)

- [ ] **The toggle:** a `Show blocks` text toggle next to `Show flex`, with the same style and `aria-pressed`, off by default. Both toggles sit in one row under the list.
- [ ] **When it shows:** whenever the section is open, even when the page has no grid or flex containers, since blocks aren't known until they're scanned. `Show flex` still shows only when there are flex containers.
- [ ] **What gets listed:** with Show blocks on, the scan adds every element that 0020 §1 calls an inspectable block: an HTML element other than `html` or `body`, with `display` not `inline`, `contents` or `none`, a box bigger than 0, and at least one laid-out element child. Grid and flex containers stay `grid` and `flex`.
- [ ] **When blocks are scanned:** only while Show blocks is on and the section is open. Turning it on scans again straight away. Turning it off drops the blocks from the list without a rescan.
- [ ] **Not saved:** like Show flex, the toggle isn't saved and starts off on each load.

### Tree (0022 §2)

- [ ] **Blocks are parents:** they take part in the tree like any other row. Each row sits under the nearest listed element that contains it.
  - In the playground, `div.cmp-head`, `div.cmp-grid` and `div.cmp-grid 2` sit under `section.compare-demo`.
- [ ] **Filters:** with Show flex off and Show blocks on, flex containers are left out, and their children sit under the nearest listed parent. With Show blocks off, the tree is exactly as it is today.
- [ ] **Collapsing:** works for block parents too (0016).

### Rows (0022 §3)

- [ ] **Icon:** a new `block` icon in the 0014 style: an outlined 9 × 9 box with a smaller box inside it, meaning padding.
- [ ] **Label and gap audit:** blocks use the same label rules (`baseLabel` and `uniqueLabels` over the whole list), and they show no gap audit text.
- [ ] **Eye, hover and focus:** these work as they do for containers.

### Drawing (0022 §4)

- [ ] **Shown blocks:** a block whose eye is on is drawn like the inspector's block: the dashed content box, blue padding with value boxes, and the name tag with its size (0020 §2).
  - It's watched for size and child changes like a shown container.
  - It's dropped if it leaves the page.
- [ ] **Turning Show blocks off** doesn't change which eyes are on. Shown blocks stay drawn, as shown flex containers do when Show flex is off, and they're listed again when Show blocks is turned back on.

### Header count (0022 §5)

- [ ] **With Show blocks on:** `3 grids, 12 flex, 40 blocks`, with `1 block` for one.
- [ ] **With it off:** unchanged (`3 grids, 12 flex`).

### Empty state

- [ ] **No containers, Show blocks off:** `No grid or flex containers on this page.`, as now.
- [ ] **Show blocks on, nothing found:** `No grid, flex or block elements on this page.`

### Pick (0022 §6)

- [ ] **What Pick picks:** it uses the inspector's rule (`inspectableAt`), so it can pick a block.
- [ ] **Picking a block** turns on Show blocks, scans, opens the branch that holds it, and focuses its eye, as Pick already does for a flex container with Show flex.

### Compare and speed (0022 §7–8)

- [ ] **Compare:** shown blocks count as drawn but skipped (0020 §5).
- [ ] **Scan budget:** spec 07's scan of 2,000 elements stays under 16 ms (median of 5) with Show blocks off, as before, and with it on.

### Untouched

- [ ] **No new public API, option or shortcut.**

## Tests

### Unit

1. **Tree order:** if the tree building moves into a pure function, test that blocks nest containers and other blocks in document order, and that a hidden flex container's children move up to the nearest listed parent.

### Browser (extend `test/browser/rendered.test.ts`)

**Fixture:** the same shape as spec 10's:

```
section.wrap (padding)
  div.head
    h2
    p
  div.cells (grid)
  div.row (flex)
    div.box
      span
```

1. **Off by default:**
   - The toggle reads `aria-pressed="false"`.
   - The rows and header count are the same as before spec 11.
   - `div.cells` sits at depth 0.
2. **On:**
   - `section.wrap` is listed at depth 0, and `div.head` and `div.cells` at depth 1.
   - `div.head` has the block icon and no gap audit text.
   - The header count includes `blocks`.
3. **Filters:** with Show blocks on and Show flex off, `div.box` sits at depth 1 under `section.wrap`, because `div.row` is a hidden flex container.
4. **Eye:**
   - Turning on `div.head`'s eye draws its content box, padding values and tag, with no tracks or gaps.
   - Turning off Show blocks keeps it drawn and keeps its eye state.
   - Turning Show blocks back on lists it with its eye still pressed.
5. **Rescan:** with Show blocks on, a new padded `div` with a child, added to the page, appears in the list after the next scan.
6. **Empty state:** on a page with no containers, the section shows Show blocks, and turning it on lists the blocks. On a page with no blocks either, it shows `No grid, flex or block elements on this page.`
7. **Pick:**
   - Picking in `section.wrap`'s padding turns on Show blocks, shows the section and focuses its eye.
   - Picking a cell of `div.cells` still picks the grid.
8. **Compare:** with Show deviations on and only `div.head` shown, the status reads `Nothing to compare in the drawn elements`.
9. **Speed:** spec 07's 2,000-element scan stays under 16 ms with blocks included.
10. **Accessibility:** axe reports no violations with Show blocks on and block rows listed.

## Out of scope

- A search or filter box for long lists (0022 Consequences).
- Saving Show blocks or Show flex across reloads.
- Margins or inline elements (0020).
- Comparing blocks with the expected grid.

## Edge cases

- **Label numbering:** labels are numbered over the whole list, so turning Show blocks on can renumber a container whose base label matches a block (for example, a `div.card` grid becomes `div.card 2`). The eye state follows the element, not the label, so nothing breaks.
- **A block that becomes a grid** (or the other way round) on a later scan takes its new kind and icon.
- **A shown block that loses its last child** isn't inspectable any more. It's drawn while it still measures as a block, and dropped when it doesn't, as spec 07 does for containers that disappear.
- **Very long lists:** no limit. The tree's collapsing is the way through.

## Files and patterns to follow

- **`src/overlay/containers.ts`:**
  - `scanContainers(doc, skip, { blocks })` lists blocks as `kind: 'block'`. It keeps the cheap display check first, and only does the box and child checks for display values that could be blocks.
  - `FoundContainer.kind` widens to `LayoutKind`.
  - Reuse `isInspectableBlock` and `isBlock`.
- **`src/overlay/rendered.ts`:**
  - a way to turn block scanning on, which rescans when the section is open
  - `draw()` measures shown targets with blocks allowed
  - Pick uses `inspectableAt`
  - `onPick` reports a block like any other element
- **`src/overlay/panel.ts`:**
  - the `showBlocks` state and its toggle beside Show flex
  - the tree filter
  - the block icon
  - the count and empty texts
  - `picked()` turns on Show blocks for a block, as it does Show flex for flex
- **Tests:** `test/browser/rendered.test.ts` for the browser tests above. Adjust spec 10's "Pick still picks containers only" test in `inspector.test.ts`, which 0022 supersedes.
- **Docs:**
  - **README:** the Rendered grid section mentions Show blocks.
  - **Design brief:** §10.2 gets the Show blocks toggle, the block icon and the count.

## Boundaries

- Always: one shadow host; no global CSS; marks have `pointer-events: none`; every listener and observer is removed on `destroy()`; no scan while the section is closed.
- Ask first: saving the filters, a search box, any public API, and any change to which elements count as blocks.
- Never: read `process.env`; change which eyes are on when a filter changes; remove, hide or replace the Rendered section.

## Check

- `pnpm check` passes, including the tests above.
- **Playground proof:** screenshots at 1440 px and 390 px of the Rendered tree with Show blocks on, showing `section.compare-demo` holding `div.cmp-head`, `div.cmp-grid` and `div.cmp-grid 2`. Also one shot of `div.cmp-head`'s eye on.
- `/product-team` Workflow E on the diff.
