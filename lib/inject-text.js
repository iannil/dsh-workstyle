/**
 * The loaded text, and the fingerprint that proves it.
 *
 * The panel must show what the model actually receives, not a description of
 * it. So the system-prompt section and the panel preview call the same
 * function on the same input, and the pinned fingerprint is the sha256 of that
 * exact string. If a rule, an order or a scope changes, the fingerprint moves;
 * if it does not move, the page is telling the truth.
 */
import { createHash } from 'node:crypto'
import { renderRules } from './pack.js'

/**
 * Render the injectable workstyle text for an already-composed pack.
 *
 * `pack` must look like a normalised pack: displayName, id, version, rules.
 * Rules that are disabled are expected to be filtered out by the caller, since
 * the injected section must never mention a rule the user turned off.
 */
export function renderInjectText(pack) {
  const text = renderRules(pack)
  return {
    text,
    fingerprint: fingerprintOf(text),
    chars: [...text].length,
    ruleCount: pack && Array.isArray(pack.rules) ? pack.rules.length : 0,
    skillCount: pack && typeof pack.skillCount === 'number' ? pack.skillCount : 0,
  }
}

export function fingerprintOf(text) {
  const value = typeof text === 'string' ? text : ''
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12)
}

/**
 * Build the pack-shaped object the renderer expects from a scope compose
 * result. Kept here so index.js never hand-assembles a second shape that the
 * preview and the section could drift away from.
 */
export function packForRender({ pack, enabledRules, enabledSkillCount }) {
  return {
    id: pack.id,
    displayName: pack.displayName,
    version: pack.version,
    rules: enabledRules,
    skillCount: enabledSkillCount,
  }
}
