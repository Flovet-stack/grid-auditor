# 0021: Deviation marks for right edges sit at the bottom

- **Status:** Approved
- **Proposed:** 2026-11-16 by the product team (roles: UI, UX, Frontend), from the Workflow E review of spec 06 in the playground
- **Approved:** 2026-11-16 by Flovet
- **Supersedes:** part of 0019 §4: "It sits near the top of the container", for right edges only
- **Specs:** specs/06-expected-vs-rendered.md (amended)

## Context

0019 put every deviation bar near the top of the container, with its label beside it. In the playground, a grid shifted by 3 px, the most common real case, shows a problem. Each column's right-edge label and the next column's left-edge label are only a gutter apart (24 px at desktop, 16 px at mobile), but a label is 34 px wide. So 11 of 12 pairs overlap at 1440 px, and 3 of 4 at 390 px, where the text runs together as `+3 px px`.

Spec 06 left out "overlapping labels in very dense layouts", but this is an ordinary layout, not a dense one.

## Research

| Reference                               | What they do                                                                                                    | Adopt / adapt / reject                                                                | Why                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Figma measurement labels                | Distance labels sit on the line they measure. When labels would collide, Figma hides them or moves them outside | **Adapt**: keep every label next to its own bar, and give the two sides separate rows | Hiding a deviation would hide a mistake                                      |
| Chrome DevTools grid overlay (via 0015) | Positive line numbers sit along the grid's top and left edges, negative ones along the bottom and right         | **Adopt** the split: start edges at the top, end edges at the bottom                  | Developers already read grids this way, and it can't collide on the same row |
| Our playground (spec 06 review)         | Measured: 34 px labels, 24 px and 16 px gutters                                                                 | n/a                                                                                   | The gutter is narrower than a label at every default breakpoint              |

Sources: Chrome DevTools grid docs (https://developer.chrome.com/docs/devtools/css/grid, opened for 0011 and 0015). Figma's measurement behaviour is from 0005's research.

## Options

1. **Left edges at the top, right edges at the bottom (recommended).**
   - Left-edge bars stay 4 px below the content top, with the label under the bar.
   - Right-edge bars move to 4 px above the content bottom, with the label over the bar.
   - The rows never meet in containers taller than about 40 px.
2. **Both at the top, labels on two rows.** Right-edge labels drop one row below left-edge labels. This stays within 0019 as written, but the right-edge labels then sit 16 px away from their bars, and the top of every container gets busier.
3. **Leave it.** Overlapping labels are unreadable in the most common case.

## Decision

Option 1, built on `feat/inspect-elements`.

## Consequences

- Containers shorter than about 40 px can still have their two rows touch. That's accepted, as 0016 accepted dense value boxes.
- Spec 06's Bar and Label criteria, and design brief §10.4, are updated to match.
- A browser test checks that the labels in each row don't overlap, for the shifted fixture.
