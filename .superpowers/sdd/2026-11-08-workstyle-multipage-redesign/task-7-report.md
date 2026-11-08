# Task 7 Report: Finish shared states, visual system, and accessibility

## Status

Implemented and verified Task 7 in the existing monolithic `client.js` React shim. Existing route/context behavior, stale environment data handling, metadata-only history/export behavior, privacy wording, and unrelated dirty work were preserved.

## Implementation

- Added shared `Loading`, `EmptyState`, `ErrorState`, `Notice`, and `EnvironmentContextBar` renderers.
- Added operation-specific error copy with retry actions for status, environment refresh, and pack detail failures.
- Added an announced loading state and a semantic `main` landmark for route content.
- Added named visual tokens for `#14171C`, `#F4F0E8`, `#FBF9F5`, `#95550F`, `#E3A660`, `#47739A`, and `#A44A3F`; tokens are exposed on the themed root for host styling and test inspection.
- Extended focus-visible coverage to textareas, tabindex controls, and local tabs; retained scoped reduced-motion behavior and disabled animation/scroll motion under `prefers-reduced-motion: reduce`.
- Updated metrics empty state to explain the next action, while preserving stale successful environment data when a refresh route fails.
- Added real mounted multipage assertions for retry/error copy, empty metrics guidance, active navigation, current environment context, main landmark, theme tokens, focus-visible CSS, and reduced-motion CSS.
- Added an explicit empty metrics fixture to the panel test harness.

## Fix round (review findings)

Five high-confidence review findings were fixed in a follow-up commit on top of the initial Task 7 commit:

1. Pack detail retry refetches in place. Added a `packReload` generation counter to the detail-fetch effect deps; the retry action increments it instead of navigating to the same route (which did not rerun the effect). A failed detail fetch on a supported pack now surfaces the shared ErrorState (previously a list-summary fallback silently rendered a degraded page), while preserving the back-to-packs link.
2. The shared shell (nav, 当前环境 context bar, main landmark, focus stylesheet) now renders around every state. The shell was extracted and hoisted above the status gate; initial loading, initial status failure, and the no-active-pack path render through it with retry actions instead of bare pre-shell returns.
3. Distribution export failures render the shared ErrorState with operation-specific copy (`导出工作方式包失败`) and a retry action that re-posts the preserved export mode (scoped vs pack-only) with fresh scope inputs.
4. GET /reports and GET /exports failures are no longer silently discarded: `reportsError`/`exportsError` state renders an operation-specific ErrorState with retry on the Distill/Distribution history sections, while stale metadata rows stay visible next to the error.
5. Mounted coverage added for both `#/pack/<id>` and `#/packs/<id>` retry, initial loading, initial status failure, missing active pack, export retry mode preservation, and both history failure/recovery flows, using new `detailControl.fail`, `statusControl.fail`, `statusControl.noActive`, and `exportControl.failReports` levers and an exported `remount()` helper.
6. Scoped re-review gap: `onExport`’s chained GET /exports no longer silently ignores failures. A failed post-export history refresh now sets the same operation-specific `exportsError` (explaining with a retry action on the Distribution history section) while the export result, its success notice, and the previous history rows all stay visible; a successful refresh clears the error.

## Validation

- `bun test/multipage-render.mjs` — PASS, 97 checks (62 base + 30 fix-round + 5 post-export history-refresh regression checks).
- `bun test/panel-render.mjs` — PASS, 104 checks.
- `grep -nE '遵守率|违反率|color:.*#fff|text-transform: uppercase' client.js` — no matches.

## Concerns

The render tests use the existing React/DOM shim, so the dark-theme assertion verifies the themed root token contract and shared semantic labels rather than a browser-computed dark screenshot. Browser-level visual rendering remains outside this task’s focused test harness. The pack-error surface change means a supported pack whose detail fetch fails now shows the error state instead of the count-only list summary — this matches the brief’s requirement that error content name the failed operation and retry target.

