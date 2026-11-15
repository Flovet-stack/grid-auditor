# 0016: Rendered marks: even hatching, pink gaps, blue padding, value boxes, and a container tree

- **Status:** Approved
- **Proposed:** 2026-11-15 by the product team, from Flovet's direction in chat after testing spec 07 in the playground
- **Approved:** 2026-11-15 by Flovet
- **Supersedes:** part of 0005 (rendered gaps hatched in blue-violet) and part of 0015 (a flat list of containers)
- **Specs:** specs/07-rendered-grid-overlay.md

## Context

Testing spec 07, Flovet found three problems:

- **The hatching was uneven:** a 1 px `repeating-linear-gradient` at 45° aliases into denser and lighter bands.
- **Gaps and padding were hard to tell apart:** padding wasn't shown at all, and gaps had no value on the page.
- **The list hid the page structure:** a flat list doesn't show which container sits inside which.

## Decision

1. **Even hatching.** Shading is a 6 × 6 px SVG tile with one diagonal line, so the lines are about 4.2 px apart (6 / √2) at every size and zoom. A whole-pixel tile can't drift into bands.
2. **Colours:**
   - **Padding** is shaded in the primary blue, `#0c8ce9` (0014).
   - **Gaps** are shaded in pink, `#e90c7a`. It's derived from the primary blue: the same saturation (90 %) and lightness (48 %), with the hue mirrored from 205° to 330°. That makes it read as a sibling of the blue, not a clash.
   - Tracks, the content box and the name tag stay dashed blue-violet (0005).
3. **Value boxes.** Each gap and each padding side that isn't 0 shows its size in a small box centred on it, in the shade's colour with white text. The size is a bare number rounded per 0006 (for example `12`), as in Figma's spacing labels.
4. **Container tree.** The Rendered list follows the page structure, like Figma's layers panel:
   - Each container is indented under the nearest listed container that contains it.
   - Parents have a chevron that collapses and expands their children.
   - With Show flex off, a grid inside a flex container sits under the nearest grid above it.
   - Pick expands the branch of the container it chooses.

## Consequences

- **Spec 06 needs a new deviation colour.** 0005 gives deviations magenta, which is close to the new gap pink. Spec 06 must pick a deviation colour that's clearly different, or change the deviation's shape, and log it.
- **Contrast:**
  - White text on the pink box is about 4.4:1.
  - White on the blue box is about 3.5:1, the same pairing the panel already uses for its primary colour (0014).
  - Both pass 3:1 for the bold 10 px labels as UI marks, but not 4.5:1 for body text.
- **Dense layouts:** many small gaps give many boxes, which can overlap. We accept this for now. If it gets noisy, a later decision can show values only on hover.
