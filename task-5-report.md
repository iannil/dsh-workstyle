# Task 5 report

Status: implemented.

Changes:

- Added independent `/distill` and `/metrics` route page components in `client.js`.
- Distill page now shows local source availability, last generated time, scan action, privacy boundary, pending/handled suggestion review, adoption/revoke flow, and report metadata history without report bodies or prompt text.
- Successful adoption and revoke operations refresh status, evidence/report state, and environment; selection clears only after success.
- Metrics page now shows four proxy metric cards with values, units, formulas, denominators, windows, available baseline deltas, caveat, and source availability. Empty metrics link to `/distill` and retain the scan action.
- Added real route and interaction assertions to `test/multipage-render.mjs`.

Commits: pending.

Tests:

- `bun run ./test/multipage-render.mjs` — 30 checks passed.
- `bun run ./test/smoke.mjs` — 144 checks passed.
- `bun --check client.js` — passed.
- `node` was unavailable, so Bun was used as permitted by the brief.

Concerns:

- The existing panel render fixture does not provide a `/reports` response, so the report history section is empty in that fixture; production uses the existing `/reports` host route and the host smoke test verifies metadata privacy.
- Existing unrelated worktree changes were preserved and excluded from the focused commit.

## Fix round 1

- MetricsPage now maps the real payload shape (`metrics.baseline.planRate.delta`, `metrics.baseline.verifyRate.delta`) onto the plan-rate and verify-rate cards via the shared `metricDelta` helper; chips render as `较上次 +0.6%` / `较上次 -0.2%` with the baseline note as title text when `baseline.available` is true.
- Distill page handled/adopted suggestions expose a revoke action calling the existing `onUnadopt`; the all-handled review header (`查看已处理` / `收起已处理`) is shared between the pack page and the distill page so the fold works on both.
- Extended the panel fixture (`test/panel-render.mjs`) with `/reports` metadata responses, baseline deltas in the metrics payload, and adopt/unadopt POST handlers with a `failEnv.adopt` failure lever.
- New interaction coverage: baseline delta chips, `aria-pressed` on metric/source pills with toggle behavior, report history metadata rows without report body or prompt text, revoke posting `/unadopt`, rejected adopt reporting failure and preserving selection, successful adopt clearing selection.
- Removed the dead pre-v5 `metricsBlock` / `metricCards` / `metricsBody` / `metricTabs` code; the MetricsPage implementation is the single metrics renderer.
- Note: this Bun version evaluates modules during `bun --check`, so the parse check for `client.js` runs as `bun build` (non-executing) instead.
