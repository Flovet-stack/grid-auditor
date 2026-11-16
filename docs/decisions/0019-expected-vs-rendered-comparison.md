# 0019: Expected vs rendered: compare drawn containers with the expected columns

- **Status:** Approved
- **Proposed:** 2026-11-15 by the product team (roles: Tech Lead, Product, UX, UI, Copy, Frontend)
- **Approved:** 2026-11-16 by Flovet
- **Supersedes:** part of 0011, the rendered side of page comparison (0011 spec 04 compared the hovered or pinned element's edges). Part of 0005: the deviation colour (magenta). The 1 px default tolerance in the brief and in 0011, which becomes 0.5 px.
- **Specs:** specs/06-expected-vs-rendered.md

## Context

Brief must-have #4, the product's main differentiator:

> Expected vs rendered comparison: show either grid or both, each in its own colour, with deviations highlighted and their size in px.

The brief defines a **deviation** as "an expected line and the nearest rendered edge that differ by more than a tolerance (default 1 px)".

0011 planned this comparison before the rendered grid existed. It compared the left and right edges of the element that was hovered or pinned in the inspector. Since then:

- **The rendered grid has been built** (0015–0017). It draws real CSS Grid tracks and the edges of flex items for the containers you choose.
- **The inspector is different now** (0018). It draws the hovered container's rendered grid, and it has no pin.

So the rendered side of the comparison has to be decided again. 0016 also left a task for this decision: 0005's magenta deviation colour is too close to the new gap pink, so spec 06 needs a different colour or shape.

These parts of 0011 still stand:

- compare against the **page grid** of the active breakpoint only (comparisons with grids set on containers come later)
- columns only
- no mark for edges within the tolerance

0011's 1 px default tolerance doesn't stand: Flovet chose 0.5 px (2026-11-15, in chat). Browsers place `fr` tracks, percentages and centred boxes at fractions of a pixel, while Figma draws guides on whole pixels (0006). So a CSS that matches the design exactly can still sit up to about 0.5 px off. A 0.5 px tolerance hides that noise, and still flags any edge that's a pixel or more off, which 1 px would let through.

## Research

| Reference                                                         | What they do                                                                                                                                                                                                                   | Adopt / adapt / reject                                                                         | Why                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| PerfectPixel, Polypane image overlay, BrowserStack Visual Overlay | They place a design image over the page, with an opacity slider. They also offer a Difference blend that turns areas that match black and makes the rest stand out. **None of them reports a size in px**, so you judge by eye | **Reject** image overlays. **Adopt** the lesson: show only what's wrong, and make it stand out | Our data is numbers, not pixels. Giving each deviation its px value is the gap these tools leave open (brief: **[ours]**)               |
| Chromatic Diff Inspector                                          | Highlights only the changed areas, in one loud colour (neon green) that's used for nothing else                                                                                                                                | **Adopt** one colour used only for deviations, drawn only where something is wrong             | One colour for mistakes keeps them readable on a busy page                                                                              |
| Polypane rulers and grids                                         | Draws layout grids over the page in a colour you choose. Grids aren't compared with the page                                                                                                                                   | n/a                                                                                            | Confirms that no tool compares a grid with the page                                                                                     |
| Our rendered grid (0015, 0016)                                    | Track edges come from `gridTemplateColumns`, and flex item edges from the children's boxes. Containers are chosen by eye or Pick, or hovered in the inspector                                                                  | **Adopt** as the rendered side                                                                 | It's already tested against the browser's own layout, and the user already controls which containers are drawn                          |
| 0011's element edges                                              | Compares the left and right edges of the hovered or pinned element                                                                                                                                                             | **Reject** for now                                                                             | It needs a pin that doesn't exist. It also checks one box, while a page grid usually lines up with the tracks and items inside that box |
| Decision 0005, design brief §9.1                                  | Deviation: a solid 2 px bar between the expected line and the rendered edge, with a px label (`+3 px`). Expected = a fill, rendered = dashed lines                                                                             | **Adopt** the solid bar and the signed label. **Change** the colour (below)                    | A solid line stays a shape of its own, next to fills, dashes and hatching                                                               |
| Design brief §10, panel order                                     | Plans a **Compare** section after Layout guide: show expected / rendered / both, and the tolerance                                                                                                                             | **Adapt**: keep the section and the tolerance. **Drop** the expected/rendered/both picker      | The eyes in Layout guide and Rendered already show and hide each grid. A second control for the same state would contradict them        |

**Colour check** (WCAG contrast, against the white and `#121212` test pages):

| Candidate            | Hue | On white       | On `#121212` | White text on it |
| -------------------- | --- | -------------- | ------------ | ---------------- |
| **`#e5590b` orange** | 21° | **3.6:1**      | **5.1:1**    | 3.6:1            |
| `#f76b15`            | 23° | 2.97:1 (fails) | 6.3:1        | 2.97:1           |
| `#f5a623` amber      | 37° | 2.0:1 (fails)  | 9.2:1        | 2.0:1            |

`#e5590b` is 51° of hue away from the gap pink (330°). It's also far from the padding blue (205°), the track violet and the guide cyan. It passes 3:1 on both backgrounds. White bold text on it gets 3.6:1, about the same as the blue value boxes (0016).

Sources (links actually opened):

- https://polypane.app/docs/image-overlay/
- https://polypane.app/docs/rulers-grids-and-guides/
- https://www.browserstack.com/docs/testing-toolkit/visual-overlay

The PerfectPixel and Chromatic rows come from search results: the PerfectPixel store listings, and copies of Chromatic's Diff Inspector docs. I didn't open those pages.

## Options

1. **Compare the containers that are drawn with the expected columns (recommended).** These are the containers whose eyes are on, or the one the inspector is hovering. Their track and item edges are checked against the edges of the visible column grids.
   - Pros: it reuses what's built and tested. The user already controls which containers are drawn, so the comparison never floods the page. It works with the inspector straight away, on hover.
   - Cons: a container has to be drawn before it's checked.
2. **0011 as written:** compare the edges of the hovered or pinned element.
   - Cons: it needs click-to-pin, which 0018 left out. It checks one box instead of the columns inside it, and it doesn't use the rendered grid.
3. **Compare every container on the page automatically.**
   - Cons: grids nested in a column are often not meant to line up with the page grid, so the page fills with false deviations. A page-wide list is really the deviation report (brief #26), a later feature.

## Decision

Option 1.

1. **What's compared:**
   - **Expected side:** every visible **Columns** grid of the active breakpoint. A grid whose eye is off isn't compared, and neither are Rows or Grid patterns. Each column has a start edge and an end edge, at the whole-pixel positions Figma draws (0006, clipped as 0006 requires).
   - **Rendered side:** every container that's drawn. That's each container whose eye is on, or the one the inspector is hovering while it's on (0018).
     - **Grid containers:** the start and end edge of each column track.
     - **Flex containers:** the left and right border-box edges of each item. Edges within 0.5 px of each other count as one edge, so wrapped rows aren't counted twice.
     - **Not compared:** a subgrid axis and a transformed container, since spec 07 has no track positions for them. Their tags already say so.
2. **Matching:** a rendered **start** edge is matched to the nearest expected **start** edge, and an **end** edge to the nearest expected **end** edge, across all visible column grids. Matching start with start stops an edge that's 13 px off in a 24 px gutter from being matched to the column on the other side and reported as −11.
3. **Deviation:** the signed distance, rendered minus expected. It's positive when the rendered edge is to the right.
   - **Checked before rounding:** the exact distance is compared with the tolerance. It counts as a deviation only when it's **more than** the tolerance, so an edge exactly 0.5 px off is fine at a 0.5 px tolerance. Edges within the tolerance get no mark (0011).
   - **Rounded for the label only,** as 0006 rounds values. Rounding first would quietly add half a pixel to the tolerance, because a 0.5 px tolerance on whole-pixel values would act like 0.
   - Any distance over 0.5 px rounds to at least 1, so a label never reads `+0 px`.
4. **The mark:**
   - **Colour:** orange `#e5590b`, used for nothing else. This replaces 0005's magenta.
   - **Rendered edge:** a solid 2 px line along the edge, over the container's height. It sits on top of the dashed track line.
   - **Bar:** a solid 2 px horizontal bar from the expected edge to the rendered edge, with short end caps so a 2 px deviation still shows. It sits near the top of the container and must not cover the name tag. The spec fixes its exact place.
   - **Label:** a value box next to the bar, in orange with bold white text and a 2 px radius, like 0016's value boxes. It shows the sign and the unit: `+3 px`, `−2 px` (with a true minus sign). The sign and unit tell it apart from gap and padding values, which are bare numbers, so colour is never the only cue.
   - **Shift+G** hides deviations along with everything else.
5. **Panel: a new Compare section** between Layout guide and Rendered, following 0014's look (design brief §10). It has:
   - **Show deviations:** a switch, off by default, so turning on an eye looks the same as it does today until you ask for the comparison.
   - **Tolerance:** a number field in px, default 0.5, from 0.5 to 20 in steps of 0.5. The lowest value is 0.5, not 0. Below 0.5, browsers' sub-pixel layout flags edges that match the design, and those labels would read `+0 px`.
   - **A status line:** for example `3 deviations in 2 containers`, or `No deviations over 0.5 px`. When there's nothing to compare, it says why: `Turn on a Columns grid in Layout guide`, or `Turn on a container's eye, or press Shift+M`.
   - The switch and the tolerance are saved in 0013's storage entry next to the panel position. They're viewing preferences, not code config, so they don't affect 0013's fingerprint or its "Edited" badge.
6. **Staying in sync:** deviations are computed when the marks are drawn, so they update on scroll, resize, container changes, hover in the inspector, a breakpoint switch, and edits to the layout guide.
7. **No new public API and no new shortcut.** A `tolerance` option in code (useful for CI, brief #31) is a later decision.

## Consequences

- **0005 and the design brief:** deviation becomes orange `#e5590b` in place of magenta. §9.1 and §10 of the design brief are updated when spec 06 is built. The Compare section loses the expected/rendered/both picker.
- **0011:** its spec 04 is replaced by this decision. Its other parts were already replaced by 0012, 0015 and 0018.
- **The brief:** when this is approved, the Deviation definition changes from "default 1 px" to "default 0.5 px", and a line for 0019 goes in the brief's Decisions list.
- **The inspector gets more useful:** with Show deviations on, hovering a container in Shift+M mode shows its deviations straight away.
- **False deviations on purpose-built nested grids** are possible but limited, because only containers the user chooses are compared. Spec 06 should include a playground fixture with one container that lines up and one that's a few px off.
- **Later, each a decision of its own:**
  - rows and square grids
  - comparing with grids set on containers (brief #5)
  - a list of deviations (#26)
  - the breakpoint sweep (#29)
  - a tolerance option in code
- **Close to the future measurement red:** orange is near the red that 0005 gives measurement lines. Measuring isn't built yet. When it is, its decision must keep the two apart by shape or colour.
- **Reviews check:**
  - start edges are matched to start edges, and end edges to end edges
  - a deviation needs more than the tolerance, and the tolerance is checked against the exact distance before rounding: 0.5 px off gets no mark, 0.6 px gets `+1 px`
  - the tolerance field doesn't accept values below 0.5
  - the signed value matches a measured fixture
  - no deviation marks are drawn while the switch is off
  - 3:1 contrast on the white and `#121212` test pages
  - axe passes with the Compare section open
  - screenshots at 390 px and 1440 px
- **Next step:** spec 06, once this is approved.
