# dsh-workstyle marketplace

A public, curated catalog of workstyle packs. The panel page `#/market` reads
`registry.json` from this directory (via `raw.githubusercontent.com` on `master`)
and installs a pack only after the human confirms a preview.

## What is here

| Path | Meaning |
| --- | --- |
| `registry.json` | Generated catalog. Do not edit by hand. |
| `packs/<id>/` | Pack sources submitted by contributors. Text only. |

Archives are **not** committed. CI builds a deterministic `.tar.gz` per pack,
uploads it to the rolling `market` GitHub release, and verifies that the
`sha256` in `registry.json` matches the bytes it just built.

## Submit a pack (pull request)

1. Copy `market/packs/fde-engineering` (or any existing pack) as a starting point.
2. Add your pack at `market/packs/<namespace>-<name>/`:
   - `workstyle.json` with `id`, `version`, `displayName`, `author`, `license`,
     `description`, and at least one rule or skill;
   - `skills/<name>/SKILL.md` for every skill you ship.
3. `id` **must equal the directory name** and must be namespaced, e.g.
   `alice-review` (the validator rejects un-namespaced ids).
4. Run:
   ```bash
   node scripts/build-market.mjs --write
   ```
   This rebuilds `registry.json` with the deterministic `sha256` and the
   release asset URL, and writes the archive to `.market-dist/` for inspection.
5. Commit **both** `market/packs/**` and `market/registry.json`. CI runs
   `node scripts/build-market.mjs --check`; a stale `sha256` or URL fails the PR.

Rules and skills are injected into other people's system prompts, so review is
the trust boundary: keep packs small, prefer documented rules, and state the
license in `workstyle.json`. Symlinks are followed only when they resolve inside
the pack directory; links that point outside it fail the build.

## Install behavior

- Installing never overwrites silently. A same-id pack needs an explicit
  replace, and a bundled id is always refused.
- Installed market packs are read-only: edits to rules/presets land in the local
  overlay (`state.json`), not in the pack directory. Deleting one keeps it
  available in the trash for restore.
- Updates are checked automatically but installed manually: the panel shows
  "可更新 vX → vY" and the human must confirm the download + replace.
- Offline: the panel uses the last cached catalog (`~/.dsh/workstyle/market.json`,
  10 minute TTL) and marks it stale; manual import on `#/pack` still works.

## Acknowledge

By submitting a pack you confirm you have the right to redistribute its rules,
skills and license.
