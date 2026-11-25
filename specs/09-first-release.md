# 09: First release 0.1.0

Status: In progress (approved by Flovet, 2026-11-25)

Brief: Packaging #22 (vanilla JS core) and #25 (nothing shipped in production). Flovet asked on 2026-11-25 to publish what is built so far, to test it in another product.

## Goal

Publish `grid-auditor@0.1.0` to npm as a preview of the features already merged (specs 00–08, 10, 11). It adds no features.

## Decisions

Implements 0003 (tooling, Changesets) and 0004 (production exclusion).

## Scope

- In: version bump, CHANGELOG, README status, a passing `pnpm check`, a packed tarball tested locally, `npm publish`.
- Out: any feature work. Rulers, guides, the toolbar and the framework entries are still not built, and the README says so.

## Acceptance criteria

- [ ] `pnpm check` passes locally. Browser tests run without coverage instrumentation, so their speed budgets measure real time. Coverage (100% of `src/engine`) comes from the unit tests.
- [ ] `package.json` and `version` in `src/index.ts` both read `0.1.0`.
- [ ] `CHANGELOG.md` has a 0.1.0 entry, written by hand (Changesets does not see the root package as a workspace package; fixing that is out of scope).
- [ ] The README status line says what 0.1.0 includes and what it doesn't.
- [ ] `pnpm pack` contains only `dist/`, `package.json`, `README.md`, `LICENSE` and `CHANGELOG.md`.
- [ ] The packed tarball installs and runs in a separate app (Flovet's product).
- [ ] Flovet runs `npm publish` (it needs their npm login and 2FA), then tags `v0.1.0`.

## Check

```
pnpm check
pnpm pack
```
