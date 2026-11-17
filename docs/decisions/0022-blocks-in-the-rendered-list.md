# 0022: The Rendered list can show elements with children, behind a Show blocks filter

- **Status:** Approved
- **Proposed:** 2026-11-17 by the product team (roles: Product, UX, UI, Tech Lead, Frontend), from Flovet's direction in chat after testing spec 10
- **Approved:** 2026-11-17 by Flovet
- **Supersedes:** part of 0020 §4 ("The Rendered list, its eyes and Pick still cover grid and flex containers only")
- **Specs:** specs/11-rendered-blocks.md

## Context

Spec 10 lets the inspector draw any element with children (0020). The Rendered list still holds only grid and flex containers, so it no longer matches what you can inspect:

- `div.cmp-head` can be inspected but isn't in the list.
- `div.cmp-grid` and `div.cmp-grid 2` sit at the top level, because their parent, `section.compare-demo`, is a block and isn't listed.

Flovet wants the list to show these elements, so the tree matches the page.

The risk is size. A real page has hundreds of `div`s with children, and the scan has to stay under 16 ms for 2,000 elements (0015).

## Research

| Reference                         | What they do                                                                           | Adopt / adapt / reject                                               | Why                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Figma layers panel (via 0016)     | Lists every frame and group as a tree, collapsible by parent                           | **Adopt** the tree with blocks as parents                            | It's the model 0016 already follows                                                    |
| Chrome DevTools Elements panel    | The full DOM tree, with `grid` and `flex` badges on containers                         | **Reject** the full DOM. **Adopt** the type badge per row            | The whole DOM is too much for a 260 px panel. A type icon tells blocks from containers |
| Firefox grid inspector (via 0015) | Lists grid containers only                                                             | **Keep** as the default view                                         | Most of the time you're after the grids                                                |
| Our Show flex filter (0015)       | Flex containers are hidden until you turn on Show flex, because there are usually many | **Adopt** the same pattern: a **Show blocks** filter, off by default | Same problem, same fix. The default list stays as short as it is now                   |

Sources: Figma, DevTools and Firefox were researched for 0015 and 0016 (links there).

## Options

1. **A Show blocks filter, off by default (recommended).** With it on, every element the inspector could draw is listed in the tree. Blocks are only scanned while the filter is on, so the default scan costs what it does now.
2. **Always list blocks.** The tree is right at once, but the list gets long on real pages, and every scan pays for checking every block.
3. **List only blocks that hold a listed container,** as structure. This fixes the parents of `div.cmp-grid`, but `div.cmp-head` still wouldn't appear, which doesn't meet the request.

## Decision

Option 1.

1. **Show blocks:** a text toggle next to Show flex, styled the same and off by default. With it on, the list adds every element that 0020 §1 calls inspectable: an HTML element other than `html` or `body`, not `inline` or `contents`, with a box bigger than 0 and at least one laid-out element child.
2. **Tree:** blocks are parents like any other row (0016), so `div.cmp-grid` sits under `section.compare-demo` and `div.cmp-head` is listed beside it.
   - With Show blocks off, the tree is exactly as it is today.
   - With Show flex off but Show blocks on, a flex container is hidden, but its block children stay listed under the nearest listed parent.
3. **Row:** a new block icon (an outlined box with padding marks, in the 0014 icon style), the label, and an eye. Blocks show no gap audit, since they have no gaps.
4. **Eye:** turning on a block's eye draws it as the inspector does: content box, padding with values, and the name tag (0020 §2). It stays drawn like any shown container.
5. **Header count:** with Show blocks on, `3 grids, 12 flex, 40 blocks`. With it off, unchanged.
6. **Pick:** Pick follows the inspector's rule (0020 §1), so it can pick a block. Picking a block turns on Show blocks, just as picking a flex container turns on Show flex.
7. **Compare:** shown blocks are skipped (0020 §5).
8. **Scan cost:** blocks are scanned only while Show blocks is on. The 16 ms scan budget for 2,000 elements still applies with it on.

## Consequences

- **Default list unchanged.** With Show blocks off, nothing changes for someone who only wants grids.
- **Long lists with it on.** Real pages can list hundreds of blocks. The tree's collapsing (0016) is the way through. A search box is a later decision if that isn't enough.
- **Pick changes:** it can now pick a block, which supersedes 0020 §4 for Pick too.
- **Reviews check:**
  - the playground tree with Show blocks on: `section.compare-demo` holding `div.cmp-head`, `div.cmp-grid` and `div.cmp-grid 2`
  - nothing changes with Show blocks off
  - the scan budget is met with Show blocks on
  - Pick on a block turns on Show blocks
  - axe passes with blocks listed
- **Next step:** a spec once this is approved.
