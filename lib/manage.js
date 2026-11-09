/**
 * Shared write layer for pack / rule / preset edits.
 *
 * One place decides where a change lands (bundled pack → overlay, user pack →
 * pack file, project/session → their scope file), snapshots the file before
 * writing, and records a revision so the panel can roll back.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { statePath, workstyleHome, writeJsonAtomic } from './pack.js'
import { projectFilePath, sessionFilePath } from './scope.js'

export const REVISION_KEEP = 20

export function revisionsDir() { return path.join(workstyleHome(), 'revisions') }
export function trashDir() { return path.join(workstyleHome(), 'trash') }
export function userPacksDir() { return path.join(workstyleHome(), 'packs') }

export function checkPackId(id) {
  const value = typeof id === 'string' ? id.trim() : ''
  if (!value) throw new Error('pack id is required')
  if (!/^[a-z0-9][a-z0-9-]{0,48}$/.test(value)) {
    throw new Error('pack id must be lowercase letters, digits and dashes: ' + value)
  }
  return value
}

export function isUserPack(pack) {
  if (!pack || typeof pack.dir !== 'string') return false
  const root = path.resolve(userPacksDir())
  const dir = path.resolve(pack.dir)
  return dir === root || dir.startsWith(root + path.sep)
}

function keyOf(file) {
  return crypto.createHash('sha1').update(path.resolve(file)).digest('hex').slice(0, 10)
}

function readIndex() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(revisionsDir(), 'index.json'), 'utf8'))
    return parsed && parsed.files ? parsed : { version: 1, files: {} }
  } catch {
    return { version: 1, files: {} }
  }
}

function writeIndex(index) {
  fs.mkdirSync(revisionsDir(), { recursive: true })
  writeJsonAtomic(path.join(revisionsDir(), 'index.json'), index)
}

/**
 * Copy the current bytes of `file` into the revision store. Returns null when
 * the file does not exist yet.
 *
 * `pin` names a revision id that the ring-buffer cap must not evict. Restoring
 * the oldest retained revision adds one row (the bytes being overwritten) while
 * the ring is already full, so without a pin the eviction would drop exactly
 * the revision being restored.
 */
export function snapshot(file, reason = 'write', { pin = null } = {}) {
  const target = path.resolve(file)
  let stat
  try { stat = fs.statSync(target) } catch { return null }
  if (!stat.isFile()) return null
  const key = keyOf(target)
  const dir = path.join(revisionsDir(), key)
  fs.mkdirSync(dir, { recursive: true })
  const at = new Date().toISOString()
  // Two writes can land in the same millisecond; a plain timestamp would then
  // collide, so the second snapshot would overwrite the first one's file and
  // both index rows would share an id (restore would return the wrong bytes).
  const base = at.replace(/[:.]/g, '-')
  let ts = base
  for (let n = 1; fs.existsSync(path.join(dir, ts + '.json')); n++) ts = base + '-' + n
  const data = fs.readFileSync(target)
  const tmp = path.join(dir, ts + '.json.tmp')
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, path.join(dir, ts + '.json'))

  const index = readIndex()
  const entry = index.files[key] || { path: target, entries: [] }
  entry.path = target
  entry.entries.unshift({ id: key + '-' + ts, at, bytes: data.length, reason, ts })
  if (entry.entries.length > REVISION_KEEP) {
    // Evict oldest rows first, but never `pin`: the caller is replaying that
    // revision, so it must stay in the index (and its file on disk) after the
    // write. If it is the oldest row, evict the next-oldest instead.
    const drop = entry.entries.length - REVISION_KEEP
    let removed = 0
    const kept = []
    for (let i = entry.entries.length - 1; i >= 0; i--) {
      const row = entry.entries[i]
      if (removed < drop && row.id !== pin) { removed++; continue }
      kept.unshift(row)
    }
    entry.entries = kept
  }
  index.files[key] = entry
  writeIndex(index)

  const keep = new Set(entry.entries.map((row) => row.ts + '.json'))
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.json.tmp')) { try { fs.unlinkSync(path.join(dir, name)) } catch { /* raced */ } continue }
    if (name.endsWith('.json') && !keep.has(name)) { try { fs.unlinkSync(path.join(dir, name)) } catch { /* raced */ } }
  }
  return { id: key + '-' + ts, at, bytes: data.length, reason }
}

export function commit(file, value, { reason = 'write' } = {}) {
  const target = path.resolve(file)
  const revision = snapshot(target, reason)
  writeJsonAtomic(target, value)
  return { revision, bytes: fs.statSync(target).size }
}

export function listRevisions(file) {
  const index = readIndex()
  const only = file ? keyOf(file) : null
  const rows = []
  for (const [key, entry] of Object.entries(index.files)) {
    if (only && key !== only) continue
    for (const item of entry.entries) rows.push({ ...item, key, path: entry.path })
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

export function restore(id) {
  const index = readIndex()
  for (const [key, entry] of Object.entries(index.files)) {
    const item = entry.entries.find((row) => row.id === id)
    if (!item) continue
    const source = path.join(revisionsDir(), key, item.ts + '.json')
    if (!fs.existsSync(source)) throw new Error('revision file is missing: ' + id)
    // Read the bytes we are about to replay BEFORE snapshotting. snapshot()
    // prunes old revisions, so reading afterwards could hit ENOENT when this
    // revision sits at the eviction edge.
    const data = fs.readFileSync(source)
    // Pin the id too: the snapshot below adds a row while the ring is full and
    // must not evict the revision we are restoring.
    const revision = snapshot(entry.path, 'restore:' + id, { pin: id })
    const tmp = entry.path + '.' + process.pid + '.restore'
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, entry.path)
    return { file: entry.path, revision, restored: item }
  }
  throw new Error('unknown revision: ' + id)
}

export function resolveWrite({ entity, pack, cwd, sessionId }) {
  if (entity === 'rule' || entity === 'preset') {
    if (isUserPack(pack)) {
      return { scope: 'pack', file: path.join(pack.dir, 'workstyle.json'), label: 'pack file ' + pack.id }
    }
    return { scope: 'overlay', file: statePath(), label: 'overlay (state.json)' }
  }
  if (entity === 'project-rule') {
    const file = projectFilePath(cwd)
    if (!file) throw new Error('cwd is required for a project rule')
    return { scope: 'project', file, label: 'project scope' }
  }
  if (entity === 'session-rule') {
    const file = sessionFilePath(sessionId)
    if (!file) throw new Error('sessionId is required for a session rule')
    return { scope: 'session', file, label: 'session scope' }
  }
  throw new Error('unknown entity: ' + entity)
}

/* ---- overlay helpers (pure: take and return a state object) ---- */

export function patchOverlay(state, packId, ruleId, patch) {
  const patches = { ...(state.rulePatches || {}) }
  const forPack = { ...(patches[packId] || {}) }
  const next = { ...(forPack[ruleId] || {}) }
  if (patch && typeof patch.title === 'string' && patch.title.trim()) next.title = patch.title.trim()
  if (patch && typeof patch.text === 'string' && patch.text.trim()) next.text = patch.text.trim()
  if (!Object.keys(next).length) return state
  forPack[ruleId] = next
  patches[packId] = forPack
  return { ...state, rulePatches: patches }
}

export function removeOverlay(state, packId, ruleId) {
  const removals = { ...(state.ruleRemovals || {}) }
  const list = Array.isArray(removals[packId]) ? removals[packId] : []
  if (list.includes(ruleId)) return state
  removals[packId] = [...list, ruleId]
  return { ...state, ruleRemovals: removals }
}

export function restoreOverlay(state, packId, ruleId) {
  if (!state.ruleRemovals || !Array.isArray(state.ruleRemovals[packId])) return state
  const next = state.ruleRemovals[packId].filter((id) => id !== ruleId)
  const removals = { ...state.ruleRemovals }
  if (next.length) removals[packId] = next
  else delete removals[packId]
  return { ...state, ruleRemovals: removals }
}

export function blockPreset(state, packId, presetId, blocked) {
  const all = { ...(state.presetBlocked || {}) }
  const list = Array.isArray(all[packId]) ? all[packId] : []
  const next = blocked ? [...new Set([...list, presetId])] : list.filter((id) => id !== presetId)
  if (next.length) all[packId] = next
  else delete all[packId]
  return { ...state, presetBlocked: all }
}

export function applyRuleOverlay(rules, { patches = {}, removed = [] } = {}) {
  return rules
    .map((rule) => (patches[rule.id] ? { ...rule, ...patches[rule.id] } : rule))
    .filter((rule) => !removed.includes(rule.id))
}
