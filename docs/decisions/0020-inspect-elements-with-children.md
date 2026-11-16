# 0020: The inspector shows padding for any element with children

- **Status:** Approved
- **Proposed:** 2026-11-16 by the product team (roles: Product, UX, UI, Tech Lead, Frontend), from Flovet's direction in chat after testing spec 06 in the playground
- **Approved:** 2026-11-16 by Flovet
- **Supersedes:** part of 0018 §4: which element the inspector draws (only the nearest grid or flex container)
- **Specs:** specs/10-inspect-elements-with-children.md

## Context

The inspector (0018) draws only grid and flex containers. When you hover a plain block element, it looks up through the parents for the nearest grid or flex container, and draws nothing if there isn't one.

Flovet found two padded elements in the playground that can't be inspected:

- **`section.compare-demo`:** a block element with padding
- **`div.cmp-head`:** a block element with padding inside it

Only the `div.cmp-grid` containers show. Flovet wants padding shown for any page element that has children, without showing everything about every element.

## Research

| Reference                                   | What they do                                                                                                                                                | Adopt / adapt / reject                                                                     | Why                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Chrome DevTools inspect mode (via 0018)     | Hover highlights the innermost element under the pointer, of any type, with its content, padding, border and margin tinted, and a `tag.class W × H` tooltip | **Adopt** the innermost element and the padding tint. **Reject** margins and every element | Developers know it. But most innermost elements are text and icons, and margins add a layer we've chosen not to draw (below) |
| GuideFrame 0.3.0 (source read for 0015)     | Hover outlines any element. Its grid view only appears on a pinned flex or grid container                                                                   | **Adapt**: any element with children, and the grid view still drawn for containers         | One hover shows both                                                                                                         |
| Our inspector (0018) and marks (0016, 0017) | Nearest grid or flex container: tracks, pink gaps, blue padding, value boxes, the dark name tag with the size                                               | **Keep** the marks. **Change** which element is picked                                     | Blocks reuse the padding marks, so nothing new needs to be learned                                                           |
| CSS box model (MDN)                         | Vertical margins between blocks collapse. Inline boxes split across lines, with padding only on the first and last fragment                                 | **Reject** margins and inline elements for now                                             | Both are hard to read correctly, and Flovet asked for padding                                                                |

Sources: Chrome DevTools inspect mode and GuideFrame were researched for 0018 and 0015 (links there). Margin collapsing and inline fragments are well-known CSS behaviour, not pages opened for this decision.

## Options

1. **The innermost element with children (recommended).** The inspector draws the element under the pointer, or its nearest parent that has element children. Grid and flex containers keep their full drawing, and blocks get the box and padding.
   - Pros: every padded wrapper can be reached by hovering its padding or its text. It's the same rule as DevTools, one level up.
   - Cons: a card inside a grid now shows the card, not the grid, when the card has children of its own. You reach the grid by hovering its gaps or padding, or by turning on its eye.
2. **Container first, block as a fallback.** Keep the nearest grid or flex container, and draw a block only when there's no container above it.
   - Cons: on the many pages where `body` or a root wrapper is flex or grid, there's always a container above, so blocks would never show. The two padded elements Flovet found would show only by chance.
3. **Every element, as DevTools does.**
   - Cons: text, icons and buttons crowd out the layout, which is the noise 0018 set out to avoid.

## Decision

Option 1.

1. **Which element:** starting from the element under the pointer, the first that is one of these:
   - a grid or flex container, as now (0015 rules)
   - an HTML element with at least one laid-out element child (`layoutChildren`), a box bigger than 0, and `display` other than `inline` or `contents`

   `html` and `body` are never picked, so empty page areas show nothing, as now. SVG elements are never picked.
2. **What's drawn for a block element:**
   - the dashed content box (0005)
   - padding shaded blue with value boxes (0016)
   - the dark name tag with its size (0017), for example `section.compare-demo 1425 × 312`

   It has no tracks and no gaps. Grid and flex containers are drawn as before.
3. **Not drawn:** margins, borders as a separate band, and inline elements. Each needs its own decision.
4. **Only the inspector changes.** The Rendered list, its eyes and Pick still cover grid and flex containers only.
5. **Compare (0019):** block elements aren't compared, because they have no column edges. A hovered block counts as drawn but skipped, so the Compare status reads `Nothing to compare in the drawn containers`.

## Consequences

- **The hover target moves inward.** Inside a grid whose cells have their own children, the inspector now shows the cell. The grid is reached by hovering its gaps or padding, or by turning on its eye.
  - If that turns out to be a problem, a key that steps up to the parent (DevTools and Figma both have one) would be a later decision.
- **The inspector's tag** now also names plain elements (`div.cmp-head`). Its format is unchanged.
- **Compare status copy:** "drawn containers" reads slightly oddly for a block. A copy tweak in the spec may change it to "drawn elements".
- **Later, each a decision of its own:**
  - margins
  - inline elements
  - comparing block edges with the columns (0011's original idea)
  - stepping up to the parent while hovering
- **Reviews check:**
  - hovering the padding and text of `section.compare-demo` and `div.cmp-head` in the playground shows each one
  - hovering a grid gap still shows the grid
  - `html` and `body` are never drawn
  - inline elements and SVG are never picked
  - the 16 ms hover budget still holds
- **Next step:** a small spec (or an amendment to spec 08) once this is approved.
