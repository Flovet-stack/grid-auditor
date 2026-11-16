# 08: Geometry inspector (hover)

Status: Done (https://github.com/Flovet-stack/grid-auditor/pull/11)

Brief: must-have #17 (geometry inspection, Shift+M). It builds on spec 07.

## Goal

A developer presses Shift+M and moves the pointer over the page. Only the container under the pointer shows its rendered grid, so they can check any container in one move, without opening the panel or turning eyes on and off, and without the page filling with labels. A pill makes the paused state obvious, and Esc gets them out.

## Decisions

Implements 0018. Reuses what spec 07 built for 0015, 0016 and 0017 (marks, value boxes, name tags, Pick's capture layer and hit-testing). Follows 0005 (shortcuts ignored in editable fields), 0006 (rounding) and 0014 (panel look).

## Acceptance criteria

### Turning it on and off

- [ ] **Shift+M** turns the inspector on, and again turns it off. It's ignored in editable fields (`isFromEditable`), on key repeat and while composing, like Shift+G.
- [ ] **Esc** turns it off. Esc is handled before anything else, the same as for Pick: it ends the inspector before it closes a popover or the panel.
- [ ] **Option:** `shortcuts.inspect?: 'Shift+M' | false`, default `'Shift+M'`. `false` turns the shortcut off. `update()` reads it the same way as `toggle` and `panel`. The `InspectShortcut` type is exported next to `ToggleShortcut` and `PanelShortcut`.
- [ ] **Works anywhere:** the inspector works with the panel open or closed, and with the Rendered section open or closed. It measures the hovered container on demand and doesn't need a scan.
- [ ] **`destroy()`** turns the inspector off and removes the pill and every listener.

### Pill

- [ ] **While on**, a pill sits at the bottom centre of the viewport, 16 px from the bottom.
  - Text: `Geometry inspector on · Page interactions paused · Press Esc to exit`, with `Esc` in a key chip.
  - Look: the panel's dark grey `#2c2c2c` and white text in the panel font at 11 px, fully rounded, with the panel's shadow.
- [ ] **Screen readers:** the pill has `role="status"`, so turning the inspector on is announced once. It sits outside the `aria-hidden` rendered layer.
- [ ] **Never in the way:** `pointer-events: none`, so hovering the pill still inspects what's under it. No animation.
- [ ] **Shift+G** hides the inspector's marks but not the pill (0018 §8).

### Paused page

- [ ] **Capture layer:** while on, Pick's full-viewport capture layer is shown with `cursor: crosshair`. The same events as Pick get `preventDefault` and `stopImmediatePropagation` there (`pointerdown`, `pointerup`, `mousedown`, `mouseup`, `click`, `dblclick`, `contextmenu`, `auxclick`), so the page receives none of them. A click does nothing else.
- [ ] **Still works:** the wheel scrolls the page, and keys other than Esc and Shift+M reach the page.
- [ ] **The panel stays usable** above the capture layer: rows, eyes, chevrons and Show flex all still work.

### Hover

- [ ] **Which container:** on `pointermove` over the capture layer, the container is `containerAt(element under the pointer)`, the same as Pick. Flex containers count even when Show flex is off.
- [ ] **What's drawn:** that one container, with everything spec 07 draws for a shown container:
  - tracks and the content box
  - pink gaps and blue padding, each with its value box
  - the dark name tag with its size
  - the track-size pill when the pointer is over a track
- [ ] **When it changes:** the marks change only when the hovered container changes. They redraw on scroll, resize and changes to that container, like a shown container.
- [ ] **Nothing to show:** with no container under the pointer, or with the pointer over the panel or outside the window, nothing is drawn and only the pill shows.

### Eye state (0018 §5)

- [ ] **Hidden, not changed:** while the inspector is on, the marks of containers whose eyes are on aren't drawn, but the shown set isn't changed. The eye buttons keep their real `aria-pressed` state.
- [ ] **Changing eyes while on:** turning an eye on or off in the panel changes the stored state. It shows when the inspector turns off.
- [ ] **Turning off** draws exactly the containers whose eyes are on at that moment. A container removed from the page meanwhile is dropped, as in spec 07.
- [ ] **The Rendered section is never removed, hidden or changed by the inspector.** It works the same with the inspector on or off.

### Pick and the inspector (0018 §7)

- [ ] **Shift+M while picking** cancels Pick and turns the inspector on.
- [ ] **Pressing Pick while the inspector is on** turns the inspector off and starts Pick.
- [ ] They're never on together. Either handover keeps the eye state.

## Tests

### Browser

1. **Toggle:**
   - Shift+M turns it on and shows the pill with the exact text; Shift+M again turns it off.
   - Esc turns it off and leaves the panel open.
   - Shift+M typed in an `<input>` on the page types an `M` and doesn't start it.
   - `shortcuts: { inspect: false }` turns the shortcut off, and `update()` turns it back on.
2. **Pill:** has `role="status"`, isn't inside an `aria-hidden` element, has `pointer-events: none`, and has a background of `rgb(44, 44, 44)`.
3. **Paused page:**
   - while on, a click on the fixture never reaches a page `click` or `pointerdown` listener
   - after turning it off, the same click does
   - the capture layer's cursor is `crosshair`
4. **Hover:**
   - over a cell inside the fixture grid, its marks are drawn (tracks, gaps, value boxes, and a tag reading the grid's label and size)
   - moving to a flex row with Show flex off draws the flex row instead, and only one container's marks exist
   - moving over a spot with no container draws nothing
5. **Eye state:**
   - turn on two eyes, turn the inspector on: their marks are gone and their eyes still read `aria-pressed="true"`
   - turn one eye off while inspecting, then turn the inspector off: only the other container is drawn
   - the Rendered section and its rows are present throughout
6. **Pick handover:** Shift+M while picking ends Pick and turns the inspector on. Pressing Pick while inspecting turns the inspector off and starts Pick.
7. **Shift+G:** while inspecting, Shift+G hides the hovered marks and keeps the pill.
8. **Speed:** from the pointer moving onto a new container to its marks being drawn takes under 16 ms (median of 5) for a 12-column grid with 24 children.
9. **Accessibility:** axe reports no violations with the inspector on and the panel open.
10. **Destroy:** `destroy()` while inspecting removes the pill and the capture layer, and a later click reaches the page.

## Out of scope

- Click to pin, the box model of elements that aren't containers, margins, and Alt distances (0018 Consequences).
- Comparing with the expected grid (spec 06).
- A panel button or hint for Shift+M.
- Scrolling inner scroll containers while the inspector is on.
- Iframes and shadow DOM inside the host page.

## Edge cases

- **Labels with the section closed:** with no scan, a hovered container's tag uses its base label (`div.cards`) without the ` 2` suffix. After a scan, the scanned label is used.
- **Transformed containers:** drawn as spec 07 draws them (gaps and the content box, tagged `transformed: tracks unavailable`).
- **The hovered container leaves the page:** its marks are cleared, and the next `pointermove` picks again.
- **Window blur or tab switch while on:** the inspector stays on. The pill shows on return.
- **`visible: false`** (the grid hidden by Shift+G or by an option) when Shift+M is pressed: the inspector turns on and the pill shows, but no marks are drawn until Shift+G shows them.

## Files and patterns to follow

- `src/overlay/rendered.ts`: inspect state next to Pick (`startInspect`, `stopInspect`, `isInspecting`), reusing the capture layer, `CAPTURED`, `containerAt` and `underPointer`. Draw the hovered container instead of the shown set while inspecting; don't touch `shown`.
- `src/overlay/create.ts`: the Shift+M listener next to the toggle listener; Esc inside the existing first-registered Esc listener; the pill element, appended to the shadow root outside `.rendered`; `update()` and `destroy()`.
- `src/overlay/shortcuts.ts`: `InspectShortcut` and `matchesInspect` (`KeyM`, Shift only), following `matchesToggle`.
- `src/index.ts`: export the `InspectShortcut` type.
- `src/overlay/panel.ts`: the Pick button handover only.
- New `test/browser/inspector.test.ts`, following `test/browser/rendered.test.ts`.
- README: an "Inspector" subsection after "Rendered grid", with Shift+M in the shortcut list. Design brief: add the inspector and pill to §10.2.
- Playground: no new fixture needed; spec 07's rendered demo is enough.

## Boundaries

- Always: one shadow host; no global CSS; marks and pill `pointer-events: none`; listeners and observers removed on `destroy()`; swallow page events only while Pick or the inspector is on.
- Ask first: any runtime dependency, any API beyond `shortcuts.inspect` and its type, and any other new shortcut.
- Never: read `process.env`; remove, hide or change the Rendered section; change which eyes are on; restore rulers or guides.

## Check

- `pnpm check` passes, including the tests above.
- **Playground proof:** screenshots at 1440 px and 390 px of the inspector over the grid demo with the pill showing. Also a pair showing eyes on before Shift+M and the same eyes back after Esc.
- `/product-team` Workflow E on the diff.
