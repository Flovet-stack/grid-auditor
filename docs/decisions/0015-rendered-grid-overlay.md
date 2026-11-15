# 0015: Rendered grid overlay first, chosen from the panel

- **Status:** Approved
- **Proposed:** 2026-11-15 by the product team (roles: Tech Lead, Project Manager, Product, UX, UI, Copy, Frontend)
- **Approved:** 2026-11-15 by Flovet
- **Supersedes:** part of 0011: the build order (grid features before the geometry inspector), and how a container is chosen for the container layout overlay (0011 spec 05 used the inspector's pin)
- **Specs:** none yet

## Context

Flovet wants the grid features built first, starting with brief must-have 3:

> Rendered grid overlay: draws the grid the page actually laid out (CSS Grid tracks and gaps, flex gaps, the container's content box) for a chosen container or the hovered one.

0011 already approved what to draw: a grid container's tracks and gaps, and a flex container's item gaps, in the 0005 rendered style, not compared with anything. But it picked containers through the geometry inspector's click-to-pin, and the inspector is now postponed. So this feature needs its own way to choose a container.

## Research

| Reference                                               | What they do                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Adopt / adapt / reject                                                                                                                                                                                                          | Why                                                                                                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Firefox grid inspector                                  | The Layout panel lists every grid on the page, with a checkbox, name, target icon and colour for each. Several overlays at once, each in its own colour. Line numbers and area names are on by default                                                                                                                                                                                                                                                                                   | **Adopt** the list with a checkbox per container and several at once. **Reject** line numbers and area names for now                                                                                                            | You find containers without hunting for them, and nothing on the page is clicked                                                                                               |
| Chrome DevTools grid and flex overlays                  | A "grid" or "flex" badge in the Elements panel toggles each overlay. Grid shows tracks, hatched gaps and optional track sizes. Flex shows the container, items and gaps                                                                                                                                                                                                                                                                                                                  | **Adopt** hatched gaps and the flex drawing (container outline, gaps between items)                                                                                                                                             | It's what developers already read                                                                                                                                              |
| DevTools element picker                                 | A picker button. While it's on, hover highlights an element and a click selects it, and the page never receives that click                                                                                                                                                                                                                                                                                                                                                               | **Adopt** as a **Pick** button for a container the list doesn't cover                                                                                                                                                           | The brief says "the hovered one". The click is captured only while picking, the same exception 0011 approved                                                                   |
| CSS Grid 2 §7.2.6 (via 0011)                            | `getComputedStyle().gridTemplateColumns`/`Rows` return used track sizes in px                                                                                                                                                                                                                                                                                                                                                                                                            | **Adopt** as the source for tracks                                                                                                                                                                                              | Exact and cheap. A browser test pins the behaviour                                                                                                                             |
| Decision 0005                                           | Rendered = dashed blue-violet 1 px outlines, hatched gaps                                                                                                                                                                                                                                                                                                                                                                                                                                | **Adopt** unchanged. Several containers take the same colour, told apart by a label                                                                                                                                             | Keeps "colour says which" free for expected vs rendered vs deviation                                                                                                           |
| Figma                                                   | No rendered grid exists in Figma                                                                                                                                                                                                                                                                                                                                                                                                                                                         | n/a                                                                                                                                                                                                                             | This is our differentiator (brief tags #3 **[ours]**)                                                                                                                          |
| GuideFrame 0.3.0 (`@guideframe/core`, MIT; source read) | No separate rendered grid. It's part of the inspector: Shift+M, hover, click to pin (captures `pointerdown` page-wide). Hold Alt on a pinned flex or grid container to see its children's boxes and the gaps between neighbouring children, each with a px label. Alt+Shift adds grid tracks (`1 · 240`) from `gridTemplateColumns`/`Rows`, offset by `justify-content`/`align-content`, and a flex main-axis arrow. A gap audit reports `x gaps 24px ×5 · consistent` or `inconsistent` | **Adopt** gaps measured between neighbouring children (works for wrapped flex and for grid), and the gap audit. **Adapt** track maths, fixing its gaps (below). **Reject** inspector-only access and the hold-a-modifier reveal | Measuring real children shows what the user sees. The audit is cheap proof of inconsistency. Hidden modifiers fail recognition over recall, and we don't have an inspector yet |

GuideFrame's track maths has gaps we must not copy:

- Zero-size tracks are filtered out, which shifts every later track.
- `space-between`, `space-around`, `space-evenly` and `stretch` are treated as start.
- RTL and `subgrid` (which returns the keyword `subgrid`, not sizes) aren't handled.
- Its "Snap to columns" uses the expected grid, not the rendered one.

Sources (opened):

- https://firefox-source-docs.mozilla.org/devtools-user/page_inspector/how_to/examine_grid_layouts/index.html
- https://guide-frame.vercel.app/ and the published `@guideframe/core@0.3.0` package (`dist/index.js`)
- https://developer.chrome.com/docs/devtools/css/grid (via 0011)
- https://www.w3.org/TR/css-grid-2/ (§7.2.6, via 0011)

## Options

1. **Panel list + Pick (recommended).** A new **Rendered** section in the panel lists the grid and flex containers found on the page, each with an eye. Hovering a row outlines its element on the page. A Pick button covers anything the list misses. No clicks are captured, except while picking.
   - Pros: non-invasive, works without the inspector, and progressive: the section shows a count until opened.
   - Cons: big pages have many flex containers, so the list needs a filter.
2. **Hover mode only.** A shortcut turns on a mode where the hovered container shows its grid.
   - Pros: fast.
   - Cons: only one container at a time, nothing to keep on screen, and it needs a new shortcut.
3. **Wait for the inspector** and use its pin, as 0011 planned.
   - Cons: blocks the grid work Flovet wants first.

## Decision

Option 1.

1. **What it draws** (from 0011, refined with GuideFrame's lessons):
   - **Grid containers:** tracks from `gridTemplateColumns`/`Rows`, placed inside the content box.
     - Zero-size tracks are kept.
     - Every `justify-content`/`align-content` value is handled, including the `space-*` ones.
     - Placement is mirrored for RTL.
     - A `subgrid` axis is skipped and labelled as such.
     - A browser test checks the track edges against the children's real boxes.
   - **Flex and grid gaps:** measured between neighbouring children's boxes, hatched, as GuideFrame does. This covers wrapped flex lines and items that don't use `gap`.
   - **Both:** the container's content box as a dashed outline.
   - Not compared with the expected grid.
   - **Gap audit:** each row in the panel shows the gaps it found, for example `gaps 24 ×5` or `gaps 16 ×3, 24 ×1 · inconsistent`. Inconsistent gaps are flagged with text, not colour alone.
   - **Track sizes:** shown only when you hover a track (progressive disclosure), for example `2 · 240 px`.
2. **Choosing containers:**
   - A **Rendered** section in the panel, after Layout guide and collapsed by default. Its header shows the count, for example `Rendered · 3 grids, 12 flex`.
   - Opening it lists each container as `div.cards` with a type icon and an eye. All are off by default, and several can be on at once.
   - **Grid containers are listed first.** Flex containers sit behind a "Show flex" filter, because there are usually many of them.
   - Hovering a row outlines that element on the page.
3. **Pick:** a button in the section header.
   - While picking, hovering a container outlines it. A click turns its overlay on and ends picking.
   - Esc cancels.
   - The page gets no clicks while picking, and gets every click otherwise.
4. **Staying in sync:** the overlay redraws on scroll, resize, and when a shown container's size or children change (a ResizeObserver plus a MutationObserver on shown containers only).
5. **Labels:** each shown overlay gets a small `div.cards` tag at its top-left, so containers that share a colour are still told apart.
6. **Out of scope for now:** line numbers, area names, always-on track-size labels, subgrid tracks, a flex main-axis arrow, saving choices across reloads, comparison with the expected grid (that's spec 06), and a public API for choosing containers from code.

## Consequences

- The Shift+M shortcut and the click-to-pin interaction stay with the future inspector. Pick is the only click capture, and a test proves clicks reach the page when picking is off.
- The panel gains its second section. It follows 0014's look: 32 px rows, an eye, a type icon.
- Finding containers means scanning the DOM with `getComputedStyle`. It runs only when the section opens, and again on DOM changes while it's open. A test should check that it stays fast on a page with about 2,000 elements.
- No new public API or runtime dependency.
- Reviews check: the track positions match the browser's own layout, no clicks are swallowed outside Pick, axe passes with the section open, and the drawing is legible in grayscale.
