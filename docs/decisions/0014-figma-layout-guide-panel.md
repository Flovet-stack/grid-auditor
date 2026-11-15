# 0014: Match Figma's Layout guide panel, with Figma's dark UI colours

- **Status:** Approved
- **Proposed:** 2026-11-15 by the product team, from Flovet's direction and screenshots of Figma's Layout guide list and its Columns, Rows and Grid popovers
- **Approved:** 2026-11-15 by Flovet
- **Supersedes:** part of 0005: principle 1 ("Figma's rules, not Figma's look") for the control panel, and the colour, font and icon rules in design brief §5 and §9.2–9.5
- **Specs:** specs/03-control-panel.md (panel layout, updated in place)

## Context

Spec 03 shows every field of every grid at once. With three or four grids the panel gets long and hard to scan. Figma's Layout guide section avoids this: each grid is a single 32 px row, and its fields open in a popover. Flovet wants the panel to look and behave like Figma's, so users move between the two without thinking about it.

## Decision

1. **Compact rows.** One 32 px row per grid, in this order:
   - a drag handle, shown only on hover, for reordering
   - a grid-type icon (Columns, Rows or Grid); clicking it opens the popover
   - a dropdown-style summary, for example `12 columns`, `2000 rows (10px)` or `Grid 10px`
   - an eye to show or hide the grid
   - a minus to remove it
2. **Selection.** Clicking a row selects it. A selected row gets the active secondary background, and the border of its summary changes to the primary colour.
3. **Popover.** It opens next to the panel. At the top is a pattern dropdown and a close button. Below that, each field has its own row, with the label on the left and the input on the right, in Figma's order:
   - **Columns and Rows:** Count, Color, Type, Width or Height, Margin or Offset, Gutter
   - **Grid:** Size, Color

   Text inputs use the secondary background. Dropdowns have a border only.
4. **Reorder.** Grids can be reordered by dragging the handle, or with Alt+↑/↓ on the handle. The top row draws on top, as in Figma. The renderer now draws the first grid last.
5. **Colours and font.**
   - **Colours:**
     - background: `#2c2c2c`
     - borders and separators: `#444`
     - primary action: `#0c8ce9`
     - secondary action: `#383838`
     - active secondary action: `#32394d`
   - **Font stack:** Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif, SFProLocalRange. Nothing is loaded into the host page. Inter is used only if it is already installed.
6. **Icons.** Figma's icon set isn't published. AniKansou's animated icons come from lucide-animated, which needs React and Motion, and adding either would be a new runtime dependency. So we draw our own inline SVG icons in Figma's style: 16 px, 1 px stroke, and no animation (brief §9.6).
7. **Always: progressive disclosure and the spectrum of explicitness.** Show the minimum needed to recognise and act on something. Reveal detail on demand. Make the controls more explicit only as the task needs it.
8. **Amendment, 2026-11-15 (Flovet).**
   - **The summary is a type dropdown.** Clicking it opens a menu with Grid, Columns and Rows, the same choice as the popover's pattern dropdown, as in Figma. Only the type icon opens the popover.
   - **No Reset to code button.** A panel with zero grids is fine, and the minus button already removes grids. It can come back if users ask. This supersedes the Reset part of 0013 and spec 04; `update()` and `setBreakpoints()` from code still clear saved edits.
   - **The badge shows only the breakpoint,** for example `Desktop`. The grid details repeated the first row, and the "Edited" suffix went with Reset.
   - **Styles placeholder.** A Styles button (four small circles) sits left of the + button, as in Figma. It is marked disabled and does nothing until a later decision gives it a job.

## Consequences

- The panel matches Figma, but it no longer looks like a clearly separate tool, which was principle 1 of 0005. We accept this because Flovet chose a smooth handover between Figma and the panel over a distinct look.
- Tests that edit fields now open the popover first.
- Flipping the draw order changes how overlapping grids stack for existing configs. Grids are translucent, so the difference is small.
