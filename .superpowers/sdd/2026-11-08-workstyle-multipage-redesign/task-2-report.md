# Task 2 Report: Minimal host reads and scoped export contract

## Status

Implemented the Task 2 host contract and committed it in the focused Task 2 commit listed below. Pre-existing worktree modifications from the redesign remain preserved.

## Files and interfaces

### `index.js`

- Added `GET /api/dsh-workstyle/pack?id=<id>`.
  - Resolves a pack by id or directory through the existing `findPack()` validation path.
  - Returns HTTP 400 when `id` is absent and HTTP 404 for an unknown pack.
  - Returns `packSummary()` plus normalized rules, presets, templates, and skills.
  - Does not mutate `active`, state, or pack files.
- Added `GET /api/dsh-workstyle/reports`.
  - Returns report metadata sorted by `generatedAt` descending.
  - Exposes only report filename, generated time, boolean source availability, and suggestion count.
  - Does not expose prompt text or suggested rule text.
- Added `GET /api/dsh-workstyle/exports`.
  - Returns archive filename, byte size, and modification time sorted newest first.
- Extended `POST /api/dsh-workstyle/export` with `{ pack?, withProject?: boolean, cwd?: string }`.
  - Existing `{}` and `{ pack }` request shapes remain valid.
  - `withProject: true` requires `cwd` and returns HTTP 400 when missing.
  - Reads only the normalized project scope and passes a sanitized schema/version/rules/disabled ids/preset snapshot to `exportPack()`.
  - Does not copy arbitrary project files or write under `pack/reference`.

### `lib/export.js`

- Extended `exportPack()` with optional `projectSnapshot`.
- Default exports retain the prior archive entry set and manifest shape.
- Scoped exports add UTF-8 `project.workstyle.json` and add `scope: 'project'` plus its filename to `manifest.json`.

### `test/smoke.mjs`

- Added route coverage for pack detail, report metadata privacy, and export metadata.
- Added assertions that default exports omit the project snapshot.
- Added scoped export checks for required `cwd`, snapshot contents, archive extraction, and absence of `pack/reference` entries.
- Updated route count for the three new paths.

## Tests and output

- `node test/smoke.mjs`: unavailable because `node` is not installed in the environment.
- `bun test/smoke.mjs`: passed, `ALL 139 CHECKS PASSED`.
- `git diff --check`: passed with no whitespace errors.

## Self-review

- The default tool and command export paths call `exportPack()` without `projectSnapshot`, preserving backward-compatible archive entries.
- `/pack` reuses `findPack()` and does not call `applyPack()`, so it cannot change active state.
- Report listing parses report files only for metadata and never returns raw report objects.
- Project export serializes only the output of `readProjectScope()`, which is already normalized to rule text and ids; it does not walk the project directory.
- The export implementation appends the project entry only for a valid object snapshot.
- Smoke coverage verifies that the scoped archive contains the snapshot and no `pack/reference` path.

## Concerns

- Node.js was unavailable, so validation used Bun 1.3.12 as authorized by the task brief.
- The worktree contained pre-existing redesign changes in several files; those changes were preserved and were not reset or cleaned.

## Fix round 1

- Updated `packDetail()` so `/api/dsh-workstyle/pack` projects each skill to `name`, `description`, and `whenToUse`, matching the portable summary shape and excluding local `dir`/`file` paths and frontmatter.
- Added smoke assertions covering the portable fields and absence of local path/frontmatter fields.
- Follow-up verification: `bun test/smoke.mjs` passed all 141 checks; `git diff --check` passed.

## Fix round 2

- Replaced the `/api/dsh-workstyle/pack` top-level spread with an explicit portable projection containing only id, name, displayName, version, license, description, format, counts, rules, presets, templates, and portable skills.
- Added whole-response smoke assertions for the exact top-level field set, forbidden host-only fields, and absolute filesystem paths.
- Follow-up verification: `bun test/smoke.mjs` passed all 144 checks; `git diff --check` passed.
