/**
 * Layered workstyle scope for dsh-workstyle.
 *
 * A working style is not one global switch. The same machine runs a writing
 * project and an engineering project, and they should not share one rule set.
 * Layers stack, later ones overriding earlier ones by id:
 *
 *   workspace  $DSH_HOME/workstyle/state.json   adoptions, presets, templates
 *   project    <cwd>/.dsh/workstyle.json        extra rules, disabled ids
 *   session    $DSH_HOME/workstyle/sessions/<id>.json   one-off overrides
 *
 * The pack directory stays read-only: nothing here writes into `pack/`.
 * Layers record ids and text only, never raw session content.
 */
import fs from 'node:fs'
import path from 'node:path'
import { workstyleHome, readState, writeJsonAtomic } from './pack.js'

export const PROJECT_DIR = '.dsh'
export const PROJECT_FILE = 'workstyle.json'
export const SCOPE_VERSION = 1

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value)
const strList = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string' && id) : [])

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return isObj(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeJson(file, value) {
  writeJsonAtomic(file, value)
}

function ruleList(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((rule) => isObj(rule) && typeof rule.id === 'string' && rule.id && typeof rule.text === 'string' && rule.text)
    .map((rule) => ({
      id: rule.id,
      title: typeof rule.title === 'string' && rule.title ? rule.title : rule.id,
      text: rule.text,
      evidence: typeof rule.evidence === 'string' ? rule.evidence : '',
      severity: typeof rule.severity === 'string' ? rule.severity : 'medium',
      // Keywords make a rule measurable; dropping them here would leave the
      // metrics unable to see any project rule the user wrote.
      measures: Array.isArray(rule.measures)
        ? rule.measures.filter((word) => typeof word === 'string' && word)
        : [],
      source: 'project',
    }))
}

/* ----------------------------- project layer ---------------------------- */

export function projectFilePath(cwd) {
  if (!cwd || typeof cwd !== 'string') return undefined
  return path.join(cwd, PROJECT_DIR, PROJECT_FILE)
}

export function readProjectScope(cwd) {
  const file = projectFilePath(cwd)
  if (!file) return { present: false, file: null, rules: [], disabledRules: [], disabledSkills: [], preset: null }
  const present = fs.existsSync(file)
  const raw = present ? readJson(file) : {}
  return {
    present,
    file,
    rules: ruleList(raw.rules),
    disabledRules: strList(raw.disabledRules),
    disabledSkills: strList(raw.disabledSkills),
    preset: typeof raw.preset === 'string' ? raw.preset : null,
  }
}

export function writeProjectScope(cwd, patch) {
  const file = projectFilePath(cwd)
  if (!file) throw new Error('cwd is required for a project scope')
  const current = readProjectScope(cwd)
  const next = {
    $schema: 'dsh-workstyle/project@1',
    version: SCOPE_VERSION,
    rules: current.rules,
    disabledRules: current.disabledRules,
    disabledSkills: current.disabledSkills,
    ...(current.preset ? { preset: current.preset } : {}),
    ...(patch || {}),
  }
  next.rules = ruleList(next.rules)
  next.disabledRules = strList(next.disabledRules)
  next.disabledSkills = strList(next.disabledSkills)
  if (!next.rules.length) delete next.rules
  if (!next.disabledRules.length) delete next.disabledRules
  if (!next.disabledSkills.length) delete next.disabledSkills
  if (!next.preset) delete next.preset
  if (Object.keys(next).length <= 2) {
    // Nothing left to record: an empty project file would only add noise.
    try { fs.unlinkSync(file) } catch { /* absent already */ }
    return readProjectScope(cwd)
  }
  next.updatedAt = new Date().toISOString()
  writeJson(file, next)
  return readProjectScope(cwd)
}

/* ----------------------------- session layer ---------------------------- */

export function sessionsDir() {
  return path.join(workstyleHome(), 'sessions')
}

export function sessionFilePath(sessionId) {
  const id = typeof sessionId === 'string' ? sessionId.trim() : ''
  if (!id) return undefined
  const safe = id.replace(/[^A-Za-z0-9._-]/g, '_')
  return path.join(sessionsDir(), safe + '.json')
}

const emptySession = () => ({
  present: false, file: null, enabledRules: [], disabledRules: [], enabledSkills: [], disabledSkills: [],
})

export function readSessionScope(sessionId) {
  const file = sessionFilePath(sessionId)
  if (!file) return emptySession()
  const present = fs.existsSync(file)
  const raw = present ? readJson(file) : {}
  return {
    present,
    file,
    enabledRules: strList(raw.enabledRules),
    disabledRules: strList(raw.disabledRules),
    enabledSkills: strList(raw.enabledSkills),
    disabledSkills: strList(raw.disabledSkills),
  }
}

export function writeSessionScope(sessionId, patch) {
  const file = sessionFilePath(sessionId)
  if (!file) throw new Error('sessionId is required for a session scope')
  const current = readSessionScope(sessionId)
  const next = {
    $schema: 'dsh-workstyle/session@1',
    version: SCOPE_VERSION,
    enabledRules: current.enabledRules,
    disabledRules: current.disabledRules,
    enabledSkills: current.enabledSkills,
    disabledSkills: current.disabledSkills,
    ...(patch || {}),
  }
  for (const key of ['enabledRules', 'disabledRules', 'enabledSkills', 'disabledSkills']) {
    next[key] = strList(next[key])
  }
  const hasContent = ['enabledRules', 'disabledRules', 'enabledSkills', 'disabledSkills'].some((key) => next[key].length)
  if (!hasContent) {
    try { fs.unlinkSync(file) } catch { /* absent already */ }
    return readSessionScope(sessionId)
  }
  next.updatedAt = new Date().toISOString()
  writeJson(file, next)
  return readSessionScope(sessionId)
}

/* ---------------------------- presets & templates ----------------------- */

function normalizePreset(preset, index) {
  const id = typeof preset.id === 'string' && preset.id.trim() ? preset.id.trim() : 'preset-' + (index + 1)
  return {
    id,
    title: typeof preset.title === 'string' && preset.title.trim() ? preset.title.trim() : id,
    description: typeof preset.description === 'string' ? preset.description : '',
    rules: strList(preset.rules),
    skills: strList(preset.skills),
    templates: strList(preset.templates),
    builtin: !!preset.builtin,
  }
}

/**
 * Presets the user can pick: the pack's own first, then locally authored ones.
 * A local preset with the same id replaces the shipped one, so editing a
 * shipped preset is a local change rather than a fork.
 */
export function listPresets(packPresets) {
  const state = readState()
  const local = Array.isArray(state.presets) ? state.presets.map(normalizePreset) : []
  const localIds = new Set(local.map((preset) => preset.id))
  const fromPack = (Array.isArray(packPresets) ? packPresets : [])
    .map(normalizePreset)
    .filter((preset) => !localIds.has(preset.id))
    .map((preset) => ({ ...preset, builtin: true }))
  return [...fromPack, ...local]
}

export function listTemplates(packTemplates) {
  const state = readState()
  const local = (Array.isArray(state.templates) ? state.templates : [])
    .filter(isObj)
    .map((tpl, index) => ({
      id: typeof tpl.id === 'string' && tpl.id ? tpl.id : 'tpl-user-' + (index + 1),
      title: typeof tpl.title === 'string' ? tpl.title : '',
      text: typeof tpl.text === 'string' ? tpl.text : '',
      builtin: false,
    }))
  const localIds = new Set(local.map((tpl) => tpl.id))
  const fromPack = (Array.isArray(packTemplates) ? packTemplates : [])
    .filter(isObj)
    .map((tpl, index) => ({
      id: typeof tpl.id === 'string' && tpl.id ? tpl.id : 'tpl-' + (index + 1),
      title: typeof tpl.title === 'string' ? tpl.title : '',
      text: typeof tpl.text === 'string' ? tpl.text : '',
      builtin: true,
    }))
    .filter((tpl) => !localIds.has(tpl.id))
  return [...fromPack, ...local].filter((tpl) => tpl.text)
}

export function checkPresetId(id) {
  const value = typeof id === 'string' ? id.trim() : ''
  if (!value) throw new Error('preset id is required')
  if (!/^[a-z0-9][a-z0-9-]{0,48}$/.test(value)) {
    throw new Error('preset id must be lowercase letters, digits and dashes: ' + value)
  }
  return value
}

/* -------------------------------- compose ------------------------------- */

/**
 * Compose the effective rules and skills from every layer.
 *
 * `baseRules` is the pack's own rules plus distillation adoptions. Later
 * layers win by id: a project rule replaces a pack rule with the same id, a
 * disabled id is removed wherever it came from, and a session enable wins
 * over every disable above it. Every surviving rule keeps `origin` (where its
 * text came from) and `disabledBy` (which layer turned it off), so the panel
 * can explain itself instead of showing a bare count.
 */
export function composeScope({
  baseRules = [],
  allSkills = [],
  packPresets = [],
  packTemplates = [],
  cwd,
  sessionId,
  disabledGlobal = [],
  disabledGlobalSkills = [],
  presetId,
}) {
  const project = readProjectScope(cwd)
  const session = readSessionScope(sessionId)

  const entries = new Map()
  const add = (rule, scope) => {
    if (!rule || typeof rule.id !== 'string' || !rule.id) return
    const previous = entries.get(rule.id)
    entries.set(rule.id, {
      ...rule,
      origin: scope === 'project' ? 'project' : (previous ? previous.origin : (rule.source === 'distilled' ? 'distilled' : 'pack')),
      textScope: scope,
      shadowed: previous ? [...(previous.shadowed || []), previous.textScope] : [],
    })
  }
  for (const rule of baseRules) add(rule, 'workspace')
  for (const rule of project.rules) add(rule, 'project')

  const disabled = new Map()
  for (const id of disabledGlobal) disabled.set(id, 'workspace')
  for (const id of project.disabledRules) disabled.set(id, 'project')

  const forcedOn = new Set()
  for (const id of session.enabledRules) forcedOn.add(id)
  for (const id of session.disabledRules) disabled.set(id, 'session')

  // Session layer contradictions are surfaced instead of silently resolved:
  // an id present in both enabled and disabled lists would otherwise look
  // intentional to the user.
  const sessionConflicts = session.enabledRules.filter((id) => session.disabledRules.includes(id))
  const rules = []
  for (const entry of entries.values()) {
    const enabled = forcedOn.has(entry.id) ? true : !disabled.has(entry.id)
    const disabledBy = enabled ? null : disabled.get(entry.id)
    rules.push({
      id: entry.id,
      title: entry.title,
      text: entry.text,
      evidence: entry.evidence || '',
      severity: entry.severity || 'medium',
      ...(Array.isArray(entry.measures) && entry.measures.length ? { measures: entry.measures } : {}),
      origin: entry.origin,
      textScope: entry.textScope,
      ...(entry.shadowed.length ? { shadowed: entry.shadowed } : {}),
      enabled,
      ...(disabledBy ? { disabledBy } : {}),
    })
  }

  const skillDisabled = new Map()
  // Workspace-level skill toggles (overrides.json) participate in the same
  // composition as project/session layers; otherwise /scope and /metrics
  // would disagree with buildStatus and the skills provider.
  for (const name of disabledGlobalSkills) skillDisabled.set(name, 'workspace')
  for (const name of project.disabledSkills) skillDisabled.set(name, 'project')
  for (const name of session.disabledSkills) skillDisabled.set(name, 'session')
  for (const name of session.enabledSkills) skillDisabled.delete(name)

  const presets = listPresets(packPresets)
  const effectivePresetId = presetId || project.preset || (typeof readState().activePreset === 'string' ? readState().activePreset : null)
  const activePreset = effectivePresetId ? presets.find((preset) => preset.id === effectivePresetId) || null : null
  const memberSkills = activePreset ? new Set(activePreset.skills) : null

  const skills = allSkills.map((skill, index) => {
    const disabledBy = skillDisabled.get(skill.name) || null
    const inPreset = memberSkills ? memberSkills.has(skill.name) : false
    return {
      name: skill.name,
      description: skill.description,
      whenToUse: skill.whenToUse,
      enabled: !disabledBy,
      ...(disabledBy ? { disabledBy } : {}),
      inPreset,
      rank: memberSkills && inPreset ? index : 1000 + index,
    }
  })
  skills.sort((a, b) => a.rank - b.rank)

  const enabledRules = rules.filter((rule) => rule.enabled)
  return {
    project,
    session,
    rules,
    enabledRules,
    ...(sessionConflicts.length ? { sessionConflicts } : {}),
    skills,
    presets,
    templates: listTemplates(packTemplates),
    activePreset,
    // Attribute the effective preset to the layer that actually chose it;
    // falling back to the workspace default must not be mislabeled.
    presetScope: project.preset ? 'project' : (session.preset ? 'session' : 'workspace'),
    counts: {
      injected: enabledRules.length,
      total: rules.length,
      workspace: enabledRules.filter((rule) => rule.origin === 'pack' || rule.origin === 'distilled').length,
      project: enabledRules.filter((rule) => rule.origin === 'project').length,
      disabled: rules.filter((rule) => !rule.enabled).length,
      skills: skills.filter((skill) => skill.enabled).length,
      skillTotal: skills.length,
    },
  }
}
