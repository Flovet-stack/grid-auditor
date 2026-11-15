# 0017: Rendered name tags on the panel grey, with the container's size

- **Status:** Approved
- **Proposed:** 2026-11-15 by the product team (roles: UI Designer), from Flovet's direction in chat after testing 0016 in the playground
- **Approved:** 2026-11-15 by Flovet
- **Supersedes:** part of 0016 (the name tag stays blue-violet)
- **Specs:** specs/07-rendered-grid-overlay.md

## Context

After 0016, three label colours sat on the page: blue-violet name tags, pink gap boxes and blue padding boxes. The name tag read as one more measurement instead of a label for the container. It also didn't say how big the container is, which is the first thing you check against a design.

## Decision

1. **Name tags use the panel's dark grey,** `#2c2c2c` (0014), with white text. That ties them to the panel's tree rows, and keeps colour for measurements: blue-violet tracks, pink gaps, blue padding.
2. **The container's size sits beside its name,** for example `div.cards  977 × 152`. It's the border box, as in Figma's frame size, rounded per 0006, at 60 % opacity and regular weight, so the name stays the main thing.
3. The hover and Pick outline tag shows the same name and size.
4. **Value boxes keep a 2 px corner radius** (0016), and a test now checks it.
5. The track hover pill stays blue-violet, because it's a track measurement.

## Consequences

- **On dark pages** the grey tag has less contrast against the page itself. The white text on `#2c2c2c` is about 13:1, so it stays readable; only the tag's edge is softer.
- **Long labels get longer.** On a narrow container the tag can run past its border box. That's the same as Figma's frame labels and doesn't block the page, because the tags ignore the pointer.
