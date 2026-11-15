# 0018: Geometry inspector: Shift+M shows the rendered grid of the hovered container

- **Status:** Approved
- **Proposed:** 2026-11-15 by the product team (roles: Product, UX, UI, Copy, Tech Lead, Frontend), from Flovet's direction in chat after testing 0016 and 0017
- **Approved:** 2026-11-15 by Flovet
- **Supersedes:** part of 0011: the scope of spec 03 (geometry inspector) and its `inspect` option. The rest of 0011 still stands.
- **Specs:** specs/08-geometry-inspector.md

## Context

Testing the Rendered section (0015, 0016), Flovet found two problems:

- **Too much work:** to see one container you open the section, find its row and turn on its eye, then turn it off again.
- **Too much on screen:** with several eyes on, every gap and padding side shows a value box, and the page is buried under labels.

Flovet wants a geometry inspector like GuideFrame's:

- **Shift+M** toggles it.
- **A pill** says the inspector is on, that page interactions are paused, and that Esc exits.
- **While it's on,** the cursor is a crosshair, and the rendered details (0016, 0017) are drawn only for the container under the pointer.

The brief lists geometry inspection as #17 ("Shift+M toggles it"). 0001 stripped the old inspector and CLAUDE.md forbids bringing it back without a new approved decision. 0011 was that decision, but its spec 03 inspected any element's box model, with click-to-pin and Alt distances. This entry narrows the first inspector to what Flovet asked for, built on the rendered grid that already exists.

## Research

| Reference                                    | What they do                                                                                                                                                                              | Adopt / adapt / reject                                                                                          | Why                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GuideFrame 0.3.0 (source read for 0015)      | Shift+M toggles inspect mode. It captures `pointerdown` page-wide while on. Hover outlines an element; click pins it; holding Alt on a pinned container shows gaps, Alt+Shift adds tracks | **Adopt** Shift+M and page-wide capture while on. **Reject** pin-then-hold-a-modifier to see a container's grid | Showing the grid straight on hover is one step instead of three. Hidden modifiers fail recognition over recall (Nielsen) |
| Chrome DevTools inspect mode (Ctrl+Shift+C)  | A mode you enter and leave. Hover shows a tooltip and highlights the element; a click selects instead of reaching the page                                                                | **Adopt** a clear mode where clicks don't reach the page                                                        | Developers already know this pattern, so "page paused" won't surprise them                                               |
| Firefox grid inspector (researched for 0015) | A list of grids with a checkbox each; several overlays at once                                                                                                                            | **Keep** for the Rendered section, which stays as it is                                                         | The list is still the way to keep a container drawn while you work. The inspector is for a quick look                    |
| Our Pick (0015)                              | A one-shot capture layer with a crosshair; Esc cancels                                                                                                                                    | **Reuse** its capture layer, hit-testing (`containerAt`) and Esc handling                                       | Same mechanics, already tested: clicks reach the page whenever no mode is on                                             |

Sources (links actually opened):

- https://guide-frame.vercel.app/ (lists "Toggle geometry inspection" as Shift + M; the package source was read for 0015)
- https://developer.chrome.com/docs/devtools/open#inspect
- https://developer.chrome.com/docs/devtools/css/grid

## Options

1. **Inspector shows the hovered container's rendered grid** (Flovet's direction). One shortcut, no list, and one container's labels at a time.
2. **0011's spec 03 as written:** any element's box model, click to pin, Alt distances. It's a bigger build and doesn't fix the work or the noise in the Rendered section.
3. **Hover-to-preview in the Rendered list only.** It's quieter, but you still hunt for rows.

## Decision

Option 1.

1. **Toggle:** Shift+M turns the inspector on and off. Esc also turns it off. Like Shift+G, the shortcut is ignored while typing in a field (0005).
2. **Pill:** while the inspector is on, a pill sits at the bottom centre of the viewport, on the panel's dark grey (0014, 0017) with white text: **"Geometry inspector on · Page interactions paused · Press Esc to exit"**, with `Esc` in a key chip. It's a live status region, so screen readers announce it once.
3. **Paused page:** a capture layer with a crosshair cursor covers the page, as Pick does. Pointer and click events don't reach the page, and page hover styles don't fire. The wheel still scrolls the page. Keys still reach the page, except Esc and Shift+M.
4. **Hover:** the container under the pointer is the nearest grid or flex container that holds the hovered element, or the element itself. Flex is included even when Show flex is off, because that setting only filters the list. It's drawn with everything from 0016 and 0017: tracks, the content box, pink gaps, blue padding, value boxes, the dark name tag with its size, and the track-size pill on hover. With no container under the pointer, only the pill shows.
5. **Eye state is kept, untouched, while the inspector is on.** Containers whose eyes are on are only hidden from the page, so only one container's labels are ever on screen. The inspector never changes which eyes are on, in the panel or in memory. When it turns off, exactly those containers are drawn again, as they were before.
   - The panel's eye buttons keep showing their real state the whole time.
   - A container that leaves the page while the inspector is on is dropped, as it would be anyway (spec 07).
   - **The Rendered section of the panel is never removed, hidden or replaced by the inspector.** It works the same with the inspector on or off.
6. **A click does nothing for now.** It's swallowed, and pinning is left for later (see Consequences).
7. **Pick and the inspector are never on at the same time,** because both put the same crosshair layer over the page and a click can only mean one thing. Press Shift+M while Pick is waiting for a click, and Pick is cancelled and the inspector starts. Click the Pick button while the inspector is on, and the inspector turns off and Pick starts. Eye state is kept either way (5).
8. **Shift+G** hides the inspector's marks along with everything else; the pill stays, so the mode is never invisible.
9. **New public API (approved by Flovet on 2026-11-15 as detail 6 in chat):** `shortcuts.inspect?: 'Shift+M' | false`, default `'Shift+M'`, alongside `toggle` and `panel`. It replaces 0011's `inspect` option, which was never built. `false` lets a host app keep Shift+M for itself. Nothing else is added.

## Consequences

- **The non-invasive rule now has two exceptions:** Pick, and the inspector while it's on. A test must prove clicks reach the page when neither is on.
- **The Rendered section stays, in full,** for keeping containers drawn while you work. No later inspector work may remove it without a new approved decision.
- **Discoverability:** the shortcut is only in the README and the pill. A panel button, or a hint in the Rendered section, is a later decision if testing shows people miss it.
- **Later, each a decision of its own:**
  - click to pin (Pick stays in the Rendered section either way)
  - box model for elements that aren't containers
  - Alt distances
  - page comparison (0011 spec 04)
- **Inner scroll containers** don't scroll with the wheel while the inspector is on, because the capture layer sits over them. This is acceptable for a quick look; Esc gets you back.
- **Performance:** hover hit-testing and drawing must stay inside one frame. The spec should set a budget like the 16 ms scan test.
- **Next step:** a spec (08) once this is approved.
