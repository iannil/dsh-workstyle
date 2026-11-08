# Task 8 final verification report

## Status

PASS with one documented runtime limitation. Verification artifacts and the route verification note are present. No product defect was found, so no product code fix was required.

The required isolated Harness command was attempted with a fresh temporary `DSH_HOME`:

```text
DSH_HOME=/tmp/dsh-workstyle-task8-home.2weBWK dsh --profile web --patch cordis.patch.yml
```

It returned exit 127 because `dsh` is not installed in this environment. The installed `/Applications/DeepSeek Harness.app` could not be executed from this worktree because the shell sandbox rejects external app binaries in an isolated worktree. The limitation is recorded in `docs/verification/README.md`.

## Commits

- Existing implementation baseline: `8e4b05f` (`fix(panel): surface post-export history refresh failures with retry`).
- Task 8 verification commit: the final commit with message `test: verify multi-page workstyle panel` (hash reported in the completion status).

Unrelated dirty work was preserved and was not reset, cleaned, or staged.

## Tests

Fresh final Bun equivalents:

- `bun test/smoke.mjs`: **ALL 146 CHECKS PASSED**.
- `bun test/panel-render.mjs`: **PANEL RENDER: 104 CHECKS PASSED**.
- `bun test/multipage-render.mjs`: **MULTIPAGE RENDER: 97 CHECKS PASSED**.

Additional checks:

- `git diff --check`: passed with no output.
- Required route set (`run`, `packs`, `pack`, `distill`, `metrics`, `distribute`) and `aria-current` marker: passed.
- Temporary project isolation: a rule persisted to project A at `.dsh/workstyle.json`; temporary project B did not present or inherit that rule.
- `pack/reference/workstyle.json` SHA-256 before and after verification: `1dce344a09dfc9f966b2b5e694a9e2c19c00cc8427e95cac67abb02e3fed416a`.
- All six screenshots are 1440×1000: run, dark run, packs, distill, metrics, distribute.

## Concerns

- Real Harness GUI route refresh and live cookie-authenticated screenshot capture remain unverified because `dsh` is unavailable and the external Harness app cannot be launched by this sandbox. The direct Bun suites cover route transitions, refresh recovery, stale-response protection, active navigation semantics, project persistence, export/distribution behavior, and the required multipage states.
- The requested screenshot artifacts use the repository's existing real API response render evidence, normalized to 1440×1000, and are documented as such in `docs/verification/README.md`. The dark run image is included separately as `multipage-run-dark.png`.

## Focused P1 fix wave

Status: PASS.

- Project-origin rule toggles now write the project layer with the current cwd through `POST /scope`, including project-only and project-shadowed rules. Successful writes refresh the environment; failed writes retain the existing selection and surface the error.
- Project rule saves, project removals, project/session scope toggles, preset changes, and scoped exports require the current environment query identity to be loaded. During an A→B transition, stale A scope remains visible for read-only display while mutations and scoped export report `环境正在加载，请稍后重试` without posting A's cwd. Normal B actions work after B resolves.
- Added mounted regressions to `test/panel-render.mjs`; the panel suite now has 115 checks.

Focused checks:

- `bun test/panel-render.mjs` — 115 checks passed.
- `bun test/multipage-render.mjs` — 97 checks passed.
- `bun test/smoke.mjs` — 146 checks passed.
- `bun build client.js --outfile /tmp/dsh-workstyle-client-check.js --no-bundle` — passed.
- `git diff --check` — passed.

Concern: the real Harness GUI limitation from the original Task 8 verification remains; `dsh` is unavailable in this environment and the external Harness app cannot be launched from this isolated worktree.
