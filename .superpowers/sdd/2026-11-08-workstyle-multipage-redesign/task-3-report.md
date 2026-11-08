# Task 3 report: `/run` current environment page

## Status

Implemented the Task 3 `/run` page in `client.js` and updated the focused panel render coverage.

The run page now provides:

- A semantic status rail showing injected rule counts, scope counts, skill counts, active preset, fingerprint, and latest distillation.
- Actionable semantic links for pending distillation, active-pack work, and metrics:
  - `#/distill`
  - `#/packs/<activePack>`
  - `#/metrics`
- A compact quick-preset switcher that calls the existing host preset action.
- The real injected markdown, section identity, character/rule/skill counts, source counts, renderer name, and `sha256` fingerprint.
- Onboarding copy and one-time dismissal using `dsw-workstyle:onboarding-v1`.
- Stale environment values, including the last successful injection fingerprint, when a refresh partially fails.
- A retry button for failed environment refreshes.
- Focus-visible styling and scoped reduced-motion CSS coverage.
- Full rule and skill inventories removed from `/run`; those remain on their dedicated routes.

## Tests

- `bun test/panel-render.mjs` — 53 checks passed.
- `bun test/smoke.mjs` — 144 checks passed.
- `git diff --check` — passed.

Node was unavailable (`node: command not found`), so Bun was used for both test commands.

## Commit

The focused implementation commit is recorded after this report is staged.

## Concerns

- The existing route shell still contains the previous detailed rules, presets, metrics, and distribution renderers for their dedicated routes. The `/run` route no longer mounts that full tab shell or inventory.
- The `packs` todo destination carries the active pack id in the hash as required; the existing packs route currently uses the id only as route context and may be expanded by the separate pack-page task.

## Fix round 1 (review findings)

All three reviewer findings addressed:

1. **Todo link semantics** — removed `role: 'listitem'` from the todo `<a>` elements and replaced the container's `role: 'list'` with `role: 'group'` so the anchors keep native link semantics. A test asserts the todo anchor carries no ARIA role override.
2. **Link focus styling** — added a scoped `#dsw-root a:focus-visible` rule (2px accent outline, offset, radius) alongside the existing button/input/select focus rules, with a test asserting the mounted stylesheet contains it.
3. **Restored deleted regression coverage as route-focused checks** — the deep inventories the run page omits now live on dedicated routes, and the previously deleted assertions execute against those routes:
   - `rulesBlock`, `presetsBlock`, and the review queue render on the pack routes (`#/packs/<id>` with a pack id, and `#/pack/<id>`); coverage includes the four-layer order, preset cards, project-layer rule, session override, disabled-rule visibility, rule toggles, review queue adoption surface, handled-suggestion expansion, and the rule editor open/cancel.
   - `#/metrics` keeps the four metric cards, formula working, proxy caveat, and the sources sub-tab round trip.
   - `#/distill` keeps the distill action with completion notice.
   - `#/distribute` keeps both export actions, install-command copy, the v5 footer marker, and the no-marketing assertion; the evidence section moved there with the distribution block, as before.
   - Route-switch coverage replaces the old in-run tab switching: navigate to each route, then back to run, asserting the rule inventory stays off the run page.
   - Refresh, onboarding dismissal/persistence, all-handled folding, and inject expand/collapse coverage retained.

The now-dead in-run tab machinery (`tab` state, `onTab`, `tabBar`, `tabPanel`, unused `reviewOpen`) was removed rather than left unreachable.

### Fix round test results

- `bun test/panel-render.mjs` — 86 checks passed (up from 53).
- `bun test/smoke.mjs` — 144 checks passed.
- `git diff --check` — passed.

### Fix round concerns

- The pack-detail routes currently render the active environment's rules/presets/review rather than pack-specific detail from the pack id; that refinement belongs to the pack-page task.

