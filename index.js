/**
 * dsh-workstyle — Host half.
 *
 * A workstyle pack is a small, reviewable bundle of:
 *   - rules   → injected as a system-prompt section, so every turn carries them
 *   - skills  → registered as a `skills` provider (source: bundled)
 *   - evidence→ an aggregate, privacy-preserving distillation of local sessions
 *
 * The plugin also exposes tools, a slash command and exact HTTP routes used by
 * the Web panel in client.js.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  dshHome, exportsDir, loadPackAt, loadPacks, listSkills, readState,
  renderRules, reportsDir, statePath, workstyleHome, writeJsonAtomic, writeState,
} from './lib/pack.js'
import {
  applyRuleOverlay, commit, isUserPack, patchOverlay, removeOverlay,
  restoreOverlay, snapshot,
} from './lib/manage.js'
import { distill, readLatestReport } from './lib/distill.js'
import { exportPack } from './lib/export.js'
import {
  checkPresetId, composeScope, listPresets, listTemplates, projectFilePath, readProjectScope,
  readSessionScope, sessionFilePath, writeProjectScope, writeSessionScope,
} from './lib/scope.js'
import { packForRender, renderInjectText } from './lib/inject-text.js'
import { computeMetrics } from './lib/metrics.js'

const PKG_DIR = path.dirname(fileURLToPath(import.meta.url))
const PKG_JSON = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'))
const VERSION = PKG_JSON.version
const DEFAULT_PACK_ID = 'fde-engineering'
const ROUTE_BASE = '/api/dsh-workstyle'

export const name = 'dsh-workstyle'
export const inject = ['tools', 'systemPrompt', 'skills']

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function log(...args) {
  console.log('[dsh-workstyle]', ...args)
}

/**
 * Tool results must be lossless JSON: `undefined` properties (and other values
 * JSON cannot round-trip) make the harness reject the whole call with
 * "value is not lossless JSON". Drop them here instead of leaking them.
 */
function toLossless(value) {
  if (value === undefined) return null
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(toLossless)
  if (value instanceof Date) return value.toISOString()
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue
    out[key] = toLossless(item)
  }
  return out
}

function packSummary(pack) {
  return {
    id: pack.id,
    name: pack.name,
    displayName: pack.displayName,
    version: pack.version,
    license: pack.license,
    description: pack.description,
    format: pack.format,
    dir: pack.dir,
    ruleCount: pack.rules.length,
    skillCount: pack.skillCount,
    skills: pack.skillList.map((skill) => ({ name: skill.name, description: skill.description, whenToUse: skill.whenToUse })),
  }
}

function loadAllPacks() {
  const packs = loadPacks(PKG_DIR)
  for (const pack of packs) {
    const skills = listSkills(pack)
    pack.skillList = skills
    pack.skillCount = skills.length
  }
  return packs
}

function packDetail(pack) {
  return {
    id: pack.id,
    name: pack.name,
    displayName: pack.displayName,
    version: pack.version,
    license: pack.license,
    description: pack.description,
    format: pack.format,
    ruleCount: pack.rules.length,
    skillCount: pack.skillCount,
    rules: pack.rules,
    presets: listPresets(pack.presets),
    templates: listTemplates(pack.templates),
    skills: (pack.skillList || []).map((skill) => ({
      name: skill.name,
      description: skill.description || '',
      whenToUse: skill.whenToUse || '',
    })),
  }
}

function listReportMetadata() {
  let names
  try { names = fs.readdirSync(reportsDir()) } catch { return [] }
  const candidates = names.filter((name) => /^report-.*\.json$/.test(name))
  if (!candidates.length && names.includes('latest.json')) candidates.push('latest.json')
  const reports = []
  for (const file of candidates) {
    try {
      const report = JSON.parse(fs.readFileSync(path.join(reportsDir(), file), 'utf8'))
      const sources = report.sources && typeof report.sources === 'object' ? report.sources : {}
      reports.push({
        file,
        generatedAt: typeof report.generatedAt === 'string' ? report.generatedAt : null,
        sources: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, !!(value && value.available)])),
        suggestionCount: Array.isArray(report.suggestedRules) ? report.suggestedRules.length : 0,
      })
    } catch { /* ignore corrupt report metadata */ }
  }
  return reports.sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')))
}

function listExportMetadata() {
  let names
  try { names = fs.readdirSync(exportsDir()) } catch { return [] }
  return names
    .filter((file) => file.endsWith('.tar.gz'))
    .map((file) => {
      try {
        const stat = fs.statSync(path.join(exportsDir(), file))
        // Archive names are `<packId>-v<version>-<timestamp>.tar.gz`; anchor
        // on the timestamp so a pack id containing "-v" cannot split wrong.
        const named = file.match(/^(.*)-v([^-]+)-\d{4}-\d{2}-\d{2}T.*\.tar\.gz$/)
        const packId = named ? named[1] : null
        const packVersion = named ? named[2] : null
        return {
          file,
          bytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          packId,
          packVersion,
        }
      } catch { return undefined }
    })
    .filter(Boolean)
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
}

function projectSnapshotFor(cwd) {
  const scope = readProjectScope(cwd)
  return {
    $schema: 'dsh-workstyle/project@1',
    version: 1,
    ...(scope.rules.length ? { rules: scope.rules } : {}),
    ...(scope.disabledRules.length ? { disabledRules: scope.disabledRules } : {}),
    ...(scope.disabledSkills.length ? { disabledSkills: scope.disabledSkills } : {}),
    ...(scope.preset ? { preset: scope.preset } : {}),
  }
}

/* ------------------------------------------------------------------ */
/* Adopted rules: distillation review → pack overlay                   */
/*                                                                     */
/* The bundled pack stays immutable; rules a user adopts from the      */
/* distillation report are stored in state.json as an overlay, keyed by */
/* pack id. They count as pack rules (system prompt, tools, export) and */
/* are marked `source: 'distilled'` so the panel can show/revoke them.  */
/* ------------------------------------------------------------------ */

function readAdoptions() {
  const state = readState()
  return state && state.adoptions && typeof state.adoptions === 'object' ? state.adoptions : {}
}

function adoptedRulesFor(packId) {
  const list = readAdoptions()[packId]
  if (!Array.isArray(list)) return []
  return list.filter((rule) => rule && typeof rule.id === 'string' && typeof rule.text === 'string')
}

function writeAdoptionsFor(packId, list) {
  const all = { ...readAdoptions() }
  if (list && list.length) all[packId] = list
  else delete all[packId]
  writeState({ adoptions: all })
}

function mergeRules(pack, adopted) {
  const ids = new Set(pack.rules.map((rule) => rule.id))
  const extra = (adopted || []).filter((rule) => !ids.has(rule.id))
  return [...pack.rules, ...extra.map((rule) => ({ ...rule, source: 'distilled' }))]
}

/* ------------------------------------------------------------------ */
/* Local overrides: per-pack enable/disable, never written to the pack  */
/*                                                                     */
/* The pack directory stays immutable. `overrides.json` records which   */
/* rules/skills the user turned off on this machine, keyed by pack id.  */
/* Exports ignore overrides, so sharing a pack never drops a rule.      */
/* ------------------------------------------------------------------ */

function overridesPath() {
  return path.join(workstyleHome(), 'overrides.json')
}

function readOverrides() {
  try {
    const parsed = JSON.parse(fs.readFileSync(overridesPath(), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function disabledFor(packId) {
  const all = readOverrides()
  const entry = all.packs && all.packs[packId]
  const list = (value) => new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])
  return {
    rules: list(entry && entry.disabledRules),
    skills: list(entry && entry.disabledSkills),
  }
}

function writeDisabled(packId, kind, ids) {
  const all = readOverrides()
  const packs = { ...(all.packs && typeof all.packs === 'object' ? all.packs : {}) }
  const entry = { ...(packs[packId] && typeof packs[packId] === 'object' ? packs[packId] : {}) }
  const key = kind === 'rule' ? 'disabledRules' : 'disabledSkills'
  const sorted = [...new Set(ids)].sort()
  if (sorted.length) entry[key] = sorted
  else delete entry[key]
  if (Object.keys(entry).length) packs[packId] = { ...entry, updatedAt: new Date().toISOString() }
  else delete packs[packId]
  const next = { ...all, schemaVersion: 1, packs }
  writeJsonAtomic(overridesPath(), next)
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function readJsonBody(request) {
  // Malformed JSON becomes `undefined`; routes must 400 on it instead of
  // treating it as an empty `{}` and silently proceeding.
  return request.json().catch(() => undefined)
}

/* ------------------------------------------------------------------ */
/* Plugin                                                              */
/* ------------------------------------------------------------------ */

export function apply(ctx) {
  let packs = loadAllPacks()
  const saved = readState()
  let active = packs.find((pack) => pack.id === saved.activePack) || packs[0]
  let skillControl

  if (!active) {
    log('no packs found; plugin is idle')
    return
  }

  log('active pack:', active.id, 'v' + active.version, '/', packs.length, 'pack(s),', active.skillCount, 'skill(s)')

  const withSkills = (pack) => {
    const skills = listSkills(pack)
    return { ...pack, skillList: skills, skillCount: skills.length }
  }

  /* ---- overlay: per-machine edits on top of an immutable pack ---- */

  const packOverlay = (packId) => {
    const state = readState()
    const id = packId || active.id
    return {
      patches: (state.rulePatches && state.rulePatches[id]) || {},
      removed: (state.ruleRemovals && state.ruleRemovals[id]) || [],
      blockedPresets: (state.presetBlocked && state.presetBlocked[id]) || [],
    }
  }

  const baseRulesFor = (pack) => mergeRules(pack || active, adoptedRulesFor((pack || active).id))

  const allActiveRules = () => applyRuleOverlay(baseRulesFor(), packOverlay())

  const removedRulesFor = (pack) => {
    const target = pack || active
    const { removed } = packOverlay(target.id)
    if (!removed.length) return []
    return baseRulesFor(target).filter((rule) => removed.includes(rule.id)).map((rule) => ({ ...rule, removed: true }))
  }

  const writeOverlay = (patch, reason) => {
    snapshot(statePath(), reason)
    writeState(patch)
  }

  const refreshPacks = () => {
    const next = loadAllPacks()
    if (!next.length) return { ok: false, error: 'no packs found' }
    packs = next
    active = next.find((pack) => pack.id === active.id) || next[0]
    try { skillControl?.invalidate() } catch { /* provider may be gone */ }
    return { ok: true, activePackId: active.id }
  }

  const effectiveActive = () => {
    const off = disabledFor(active.id)
    return {
      ...active,
      rules: allActiveRules().filter((rule) => !off.rules.has(rule.id)),
      skillCount: (active.skillList || []).filter((skill) => !off.skills.has(skill.name)).length,
    }
  }

  /**
   * Which project and session the page is looking at.
   *
   * The panel passes them explicitly (it knows the live session); a tool call
   * or command usually does not, so those fall back to the process cwd and to
   * no session at all. Never guesses a session id.
   */
  /**
   * Every keyword any enabled rule measures itself by. Distillation counts
   * these while it still holds the prompts; the report keeps only tallies.
   */
  const measureKeywords = (input) => {
    const words = new Set()
    // Keywords come from the rules actually in effect for this context —
    // project and session layers included — not from the pack alone.
    const rules = input ? scopeFor(input).enabledRules : allActiveRules()
    for (const rule of rules) {
      if (!Array.isArray(rule.measures)) continue
      for (const word of rule.measures) {
        if (typeof word === 'string' && word) words.add(word)
      }
    }
    return [...words]
  }

  const resolveContext = (input) => {
    const cwd = input && typeof input.cwd === 'string' && input.cwd.trim()
      ? path.resolve(input.cwd.trim())
      : process.cwd()
    const sessionId = input && typeof input.sessionId === 'string' && input.sessionId.trim()
      ? input.sessionId.trim()
      : undefined
    return { cwd, sessionId }
  }

  /**
   * Where an edit to `rule` actually lands.
   *
   * Ownership decides, not just the pack kind: a user pack's own rules live in
   * its `workstyle.json`, but a rule adopted from distillation belongs to this
   * machine's overlay even while a user pack is active. `cwd` is optional
   * (`/status` has no working directory), so a project rule then reports
   * `file: null` instead of guessing a path.
   */
  const writableFor = (rule, cwd) => {
    if (rule.origin === 'project') {
      return { scope: 'project', packId: active.id, file: cwd ? projectFilePath(cwd) : null }
    }
    const ownedByPack = (ruleId) => (active.rules || []).some((item) => item.id === ruleId)
    if (isUserPack(active) && ownedByPack(rule.id)) {
      return { scope: 'pack', packId: active.id, file: path.join(active.dir, 'workstyle.json') }
    }
    return { scope: 'overlay', packId: active.id, file: statePath() }
  }

  /** Compose every layer into the effective rule/skill set for a context. */
  const scopeFor = (input) => {
    const { cwd, sessionId } = resolveContext(input)
    const { blockedPresets } = packOverlay()
    const composed = composeScope({
      baseRules: allActiveRules(),
      allSkills: active.skillList || [],
      packPresets: active.presets || [],
      packTemplates: active.templates || [],
      removedRules: removedRulesFor(),
      blockedPresets,
      cwd,
      sessionId,
      disabledGlobal: [...disabledFor(active.id).rules],
      disabledGlobalSkills: [...disabledFor(active.id).skills],
      presetId: input && typeof input.preset === 'string' ? input.preset : undefined,
    })
    return {
      ...resolveContext(input),
      ...composed,
      rules: composed.rules.map((rule) => ({ ...rule, writable: writableFor(rule, cwd) })),
      /* 被屏蔽的预设从 composed.presets 里消失，管理界面靠这个列表显示「已屏蔽 + 恢复」 */
      blockedPresets: blockedPresets.map((id) => ({ id, packId: active.id })),
    }
  }

  /** The exact text the system prompt section emits for a context. */
  const injectFor = (input) => {
    const scope = scopeFor(input)
    const rendered = renderInjectText(packForRender({
      pack: active,
      enabledRules: scope.enabledRules,
      enabledSkillCount: scope.counts.skills,
    }))
    return {
      ...rendered,
      section: 'dsh-workstyle.rules',
      packId: active.id,
      packDisplayName: active.displayName,
      packVersion: active.version,
      cwd: scope.cwd,
      sessionId: scope.sessionId || null,
      projectFile: projectFilePath(scope.cwd),
      sessionFile: scope.sessionId ? sessionFilePath(scope.sessionId) : null,
      counts: scope.counts,
      preset: scope.activePreset ? scope.activePreset.id : null,
      presetScope: scope.presetScope,
    }
  }

  const findPack = (idOrDir) => {
    const packsNow = loadAllPacks()
    let next = packsNow.find((pack) => pack.id === idOrDir)
    if (!next) {
      const byDir = loadPackAt(path.resolve(idOrDir))
      if (byDir) next = withSkills(byDir)
    }
    return { packsNow, next }
  }

  const buildStatus = (options = {}) => {
    const latest = readLatestReport()
    const off = disabledFor(active.id)
    const packRuleIds = new Set(active.rules.map((rule) => rule.id))
    const adopted = adoptedRulesFor(active.id)
    const adoptedIds = new Set(adopted.map((rule) => rule.id))
    const rules = allActiveRules().map((rule) => ({
      ...rule,
      enabled: !off.rules.has(rule.id),
      origin: rule.source === 'distilled' ? 'distilled' : 'pack',
      writable: writableFor(rule, options.cwd),
    }))
    const skills = (active.skillList || []).map((skill) => ({
      name: skill.name,
      description: skill.description,
      whenToUse: skill.whenToUse,
      enabled: !off.skills.has(skill.name),
      origin: 'pack',
    }))
    const suggestions = latest && Array.isArray(latest.suggestedRules)
      ? latest.suggestedRules.map((rule) => ({
          id: rule.id,
          title: rule.title,
          text: rule.text,
          evidence: rule.evidence || '',
          confidence: rule.confidence || 'medium',
          adopted: adoptedIds.has(rule.id),
          present: packRuleIds.has(rule.id),
        }))
      : []
    const enabledRules = rules.filter((rule) => rule.enabled)
    const enabledSkills = skills.filter((skill) => skill.enabled)
    return {
      plugin: {
        name, version: VERSION, home: workstyleHome(),
        reports: reportsDir(), exports: exportsDir(), overrides: overridesPath(),
      },
      activePackId: active.id,
      activePack: packSummary(active),
      packs: packs.map(packSummary),
      summary: {
        ruleCount: rules.length,
        enabledRuleCount: enabledRules.length,
        disabledRuleCount: rules.length - enabledRules.length,
        skillCount: skills.length,
        enabledSkillCount: enabledSkills.length,
        disabledSkillCount: skills.length - enabledSkills.length,
        adoptedRuleCount: adopted.length,
        pendingSuggestionCount: suggestions.filter((rule) => !(rule.adopted || rule.present)).length,
        noEvidenceRuleCount: enabledRules.filter((rule) => !rule.evidence).length,
      },
      rules,
      adoptions: adopted.map((rule) => ({
        id: rule.id, title: rule.title, text: rule.text,
        evidence: rule.evidence || '', adoptedAt: rule.adoptedAt,
      })),
      suggestions,
      skills,
      latestDistill: latest
        ? { generatedAt: latest.generatedAt, file: path.join(reportsDir(), 'latest.json') }
        : undefined,
      sources: {
        claude: path.join(process.env.HOME || '', '.claude', 'history.jsonl'),
        codex: path.join(process.env.HOME || '', '.codex', 'session_index.jsonl'),
        dsh: path.join(dshHome(), 'sessions'),
        pi: path.join(process.env.HOME || '', '.pi', 'agent', 'sessions'),
      },
    }
  }

  const applyPack = (idOrDir) => {
    const { packsNow, next } = findPack(idOrDir)
    if (!next) throw new Error('unknown pack: ' + idOrDir + ' (available: ' + packsNow.map((p) => p.id).join(', ') + ')')
    packs = packsNow
    active = next
    writeState({ activePack: active.id })
    try { skillControl?.invalidate() } catch { /* provider may be gone */ }
    log('applied pack:', active.id)
    return packSummary(effectiveActive())
  }

  /**
   * Adopt suggested rules from the latest distillation report into the active
   * pack's overlay. `all` adopts every suggestion; otherwise `ids` selects.
   */
  const adoptRules = (ids, all) => {
    const report = readLatestReport()
    if (!report || !Array.isArray(report.suggestedRules) || !report.suggestedRules.length) {
      throw new Error('no distillation report yet: run workstyle_distill first')
    }
    const wanted = all
      ? report.suggestedRules
      : report.suggestedRules.filter((rule) => Array.isArray(ids) && ids.includes(rule.id))
    if (!wanted.length) {
      throw new Error('no matching suggested rules' + (Array.isArray(ids) && ids.length ? ': ' + ids.join(', ') : ''))
    }
    const packRuleIds = new Set(active.rules.map((rule) => rule.id))
    const existing = adoptedRulesFor(active.id)
    const existingIds = new Set(existing.map((rule) => rule.id))
    const added = []
    const skipped = []
    for (const rule of wanted) {
      if (!rule || typeof rule.id !== 'string' || typeof rule.text !== 'string') continue
      if (packRuleIds.has(rule.id)) { skipped.push(rule.id + '（已在包内）'); continue }
      if (existingIds.has(rule.id)) { skipped.push(rule.id + '（已采纳）'); continue }
      added.push({
        id: rule.id,
        title: rule.title || rule.id,
        text: rule.text,
        evidence: rule.evidence || '',
        severity: rule.severity || 'medium',
        source: 'distilled',
        adoptedAt: new Date().toISOString(),
      })
    }
    if (added.length) {
      writeAdoptionsFor(active.id, [...existing, ...added])
      const off = disabledFor(active.id)
      let changed = false
      for (const rule of added) if (off.rules.delete(rule.id)) changed = true
      if (changed) writeDisabled(active.id, 'rule', [...off.rules])
    }
    log('adopted rules:', added.map((rule) => rule.id).join(', ') || '(none)')
    return { added: added.map((rule) => rule.id), skipped, ruleCount: effectiveActive().rules.length }
  }

  const unadoptRule = (ruleId) => {
    const existing = adoptedRulesFor(active.id)
    const next = existing.filter((rule) => rule.id !== ruleId)
    if (next.length === existing.length) throw new Error('rule not adopted: ' + ruleId)
    writeAdoptionsFor(active.id, next)
    const off = disabledFor(active.id)
    if (off.rules.has(ruleId)) {
      off.rules.delete(ruleId)
      writeDisabled(active.id, 'rule', [...off.rules])
    }
    log('revoked adopted rule:', ruleId)
    return { removed: ruleId, ruleCount: effectiveActive().rules.length }
  }

  /**
   * Enable/disable one rule or skill for the active pack on this machine.
   * Disabled items leave the system prompt and the skills provider, but the
   * pack directory and exports stay untouched.
   */
  const toggleItem = (kind, id, enabled) => {
    if (kind !== 'rule' && kind !== 'skill') throw new Error('kind must be "rule" or "skill"')
    const target = typeof id === 'string' ? id.trim() : ''
    if (!target) throw new Error('id is required')
    const off = disabledFor(active.id)
    if (kind === 'rule') {
      if (!allActiveRules().some((rule) => rule.id === target)) throw new Error('unknown rule: ' + target)
      if (enabled) off.rules.delete(target)
      else off.rules.add(target)
      writeDisabled(active.id, 'rule', [...off.rules])
    } else {
      if (!(active.skillList || []).some((skill) => skill.name === target)) throw new Error('unknown skill: ' + target)
      if (enabled) off.skills.delete(target)
      else off.skills.add(target)
      writeDisabled(active.id, 'skill', [...off.skills])
      try { skillControl?.invalidate() } catch { /* provider may be gone */ }
    }
    log((enabled ? 'enabled ' : 'disabled ') + kind + ':', target)
    return { kind, id: target, enabled: !!enabled, summary: buildStatus().summary }
  }

  const exportActivePack = (idOrDir, projectSnapshot) => {
    let target = active
    if (idOrDir) {
      const found = findPack(idOrDir)
      if (!found.next) throw new Error('unknown pack: ' + idOrDir + ' (available: ' + found.packsNow.map((p) => p.id).join(', ') + ')')
      target = found.next
    }
    const rules = mergeRules(target, adoptedRulesFor(target.id))
    const out = exportPack({
      pack: { ...target, pluginVersion: VERSION },
      rules,
      destDir: exportsDir(),
      ...(projectSnapshot ? { projectSnapshot } : {}),
    })
    log('exported pack:', target.id, '→', out.file)
    return {
      file: out.file,
      bytes: out.bytes,
      files: out.files,
      packId: target.id,
      ruleCount: rules.length,
      skillCount: target.skillCount || 0,
      adoptedRules: adoptedRulesFor(target.id).length,
    }
  }

  /* --- system prompt section --------------------------------------- */
  try {
    let order = 900
    try {
      const base = ctx.systemPrompt.getSectionOrder('HARNESS_IDENTITY')
      if (typeof base === 'number') order = base + 5
    } catch { /* fall back to a late section */ }
    ctx.effect(() => ctx.systemPrompt.section({
      name: 'dsh-workstyle.rules',
      order,
      text: () => {
        // One compose, one render: the panel preview and this section must
        // never render the same state twice and disagree about the bytes.
        const scope = scopeFor({})
        return renderInjectText(packForRender({
          pack: active,
          enabledRules: scope.enabledRules,
          enabledSkillCount: scope.counts.skills,
        })).text
      },
    }), 'dsh-workstyle: system prompt rules')
  } catch (error) {
    log('system prompt section unavailable:', error && error.message ? error.message : String(error))
  }

  /* --- skills provider --------------------------------------------- */
  try {
    ctx.effect(() => ctx.skills.registerProvider((control) => {
      skillControl = control
      return {
        name: 'dsh-workstyle',
        async list() {
          const candidates = []
          let rank = 0
          for (const pack of packs) {
            const off = disabledFor(pack.id)
            for (const skill of pack.skillList || []) {
              if (off.skills.has(skill.name)) continue
              candidates.push({
                name: skill.name,
                description: skill.description,
                whenToUse: skill.whenToUse,
                invocation: { modelInvocable: true, userInvocable: true },
                source: 'bundled',
                provider: 'dsh-workstyle',
                path: skill.file,
                resourceBase: { kind: 'directory', path: skill.dir },
                rank: rank++,
                locator: { file: skill.file, pack: pack.id, dirName: skill.dirName },
                metadata: { pack: pack.id, workstyle: true },
              })
            }
          }
          return { candidates, complete: true }
        },
        async get(candidate) {
          const file = candidate && candidate.locator ? candidate.locator.file : candidate && candidate.path
          if (!file) return undefined
          const content = fs.readFileSync(file, 'utf8')
          return {
            name: candidate.name,
            description: candidate.description,
            whenToUse: candidate.whenToUse,
            invocation: { modelInvocable: true, userInvocable: true },
            source: 'bundled',
            provider: 'dsh-workstyle',
            path: file,
            resourceBase: { kind: 'directory', path: path.dirname(file) },
            content,
            metadata: { pack: candidate.locator ? candidate.locator.pack : active.id, workstyle: true },
          }
        },
      }
    }), 'dsh-workstyle: skills provider')
  } catch (error) {
    log('skills provider unavailable:', error && error.message ? error.message : String(error))
  }

  /* --- tools -------------------------------------------------------- */
  const toolDisposers = []
  const registerTool = (definition) => {
    const tool = {
      ...definition,
      execute: async (...args) => toLossless(await definition.execute(...args)),
    }
    try {
      toolDisposers.push(ctx.effect(() => ctx.tools.register(tool), 'dsh-workstyle: tool ' + definition.name))
    } catch (error) {
      log('tool registration failed for', definition.name, error && error.message ? error.message : String(error))
    }
  }

  const textBlock = (text) => [{ type: 'text', text }]

  registerTool({
    name: 'workstyle_status',
    description: 'Show the active dsh-workstyle pack: rules, skills, sources and the latest distillation report. When the user asks how to use workstyle / 怎么用 / 如何上手 after install, answer in ≤8 short Chinese lines: (1) open sidebar 工作方式 and check status-rail fingerprint, (2) open a new chat and try a feature request to feel plan-first, (3) use 载入预览 to verify inject text; point them to the panel tip and README「3 分钟上手」. Do not dump the full handbook unless they ask.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'object', properties: { activePack: { type: 'string' }, ruleCount: { type: 'number' }, skillCount: { type: 'number' } } },
      render: (args, value) => textBlock(JSON.stringify(value, null, 2)),
    },
    async execute() {
      const status = buildStatus()
      return {
        activePack: status.activePack.id,
        activePackVersion: status.activePack.version,
        ruleCount: status.activePack.ruleCount,
        enabledRuleCount: status.summary.enabledRuleCount,
        disabledRuleCount: status.summary.disabledRuleCount,
        skillCount: status.activePack.skillCount,
        enabledSkillCount: status.summary.enabledSkillCount,
        packs: status.packs.map((pack) => ({ id: pack.id, version: pack.version, rules: pack.ruleCount, skills: pack.skillCount })),
        adoptedRules: status.adoptions.map((rule) => rule.id),
        suggestions: status.suggestions.map((rule) => ({ id: rule.id, title: rule.title, adopted: rule.adopted, present: rule.present })),
        latestDistill: status.latestDistill,
      }
    },
  })

  registerTool({
    name: 'workstyle_list',
    description: 'List available workstyle packs and the skills bundled in the active pack.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'object', properties: { activePack: { type: 'string' }, packs: { type: 'array' }, skills: { type: 'array' } } },
      render: (args, value) => textBlock(JSON.stringify(value, null, 2)),
    },
    async execute() {
      const effective = effectiveActive()
      const off = disabledFor(active.id)
      return {
        activePack: active.id,
        ruleCount: effective.rules.length,
        adoptedRules: adoptedRulesFor(active.id).map((rule) => rule.id),
        packs: packs.map(packSummary),
        skills: effective.skillList
          .filter((skill) => !off.skills.has(skill.name))
          .map((skill) => ({ name: skill.name, description: skill.description })),
      }
    },
  })

  registerTool({
    name: 'workstyle_apply',
    description: 'Apply a workstyle pack by id (or by absolute directory path). The rules and skills switch immediately.',
    parameters: {
      type: 'object',
      properties: { pack: { type: 'string', description: 'Pack id, e.g. fde-engineering, or an absolute pack directory.' } },
      required: ['pack'],
    },
    output: {
      schema: { type: 'object', properties: { applied: { type: 'string' }, ruleCount: { type: 'number' }, skillCount: { type: 'number' } } },
      render: (args, value) => textBlock('已应用工作方式包：' + value.applied + '（' + value.ruleCount + ' 条规则 / ' + value.skillCount + ' 个技能）'),
    },
    async execute(args) {
      const packArg = args && typeof args.pack === 'string' ? args.pack.trim() : ''
      if (!packArg) throw new Error('pack is required')
      const summary = applyPack(packArg)
      return { applied: summary.id, ruleCount: summary.ruleCount, skillCount: summary.skillCount }
    },
  })

  registerTool({
    name: 'workstyle_distill',
    description: 'Read-only scan of local agent sessions (Claude Code, Codex, DSH, Pi) to distill aggregate evidence and suggested rules. Writes only aggregated reports; never stores prompt text.',
    parameters: {
      type: 'object',
      properties: {
        dshSessions: { type: 'number', description: 'How many recent DSH sessions to decompress (default 12, max 50).' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { file: { type: 'string' }, suggestedRules: { type: 'number' } } },
      render: (args, value) => textBlock('蒸馏完成：' + value.file + '\n建议规则 ' + value.suggestedRules + ' 条。报告仅含聚合统计，不含 prompt 原文。'),
    },
    async execute(args) {
      const limit = args && Number.isFinite(args.dshSessions) ? Math.max(0, Math.min(50, args.dshSessions)) : 12
      const { file, report } = await distill({ dshSessions: limit, keywords: measureKeywords() })
      return {
        file,
        suggestedRules: report.suggestedRules.length,
        evidence: {
          claude: report.sources.claude.available ? report.sources.claude.prompts : 0,
          codex: report.sources.codex.available ? report.sources.codex.sessions : 0,
          dsh: report.sources.dsh.available ? report.sources.dsh.sampled : 0,
          pi: report.sources.pi.available ? report.sources.pi.sessions : 0,
        },
      }
    },
  })

  registerTool({
    name: 'workstyle_evidence',
    description: 'Return the latest distilled evidence report (aggregate counts only).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'object', properties: { generatedAt: { type: 'string' }, suggestedRules: { type: 'array' } } },
      render: (args, value) => textBlock(JSON.stringify(value, null, 2)),
    },
    async execute() {
      const report = readLatestReport()
      if (!report) return { generatedAt: undefined, suggestedRules: [], hint: 'run workstyle_distill first' }
      return { generatedAt: report.generatedAt, sources: report.sources, suggestedRules: report.suggestedRules }
    },
  })

  registerTool({
    name: 'workstyle_adopt',
    description: 'Adopt suggested rules from the latest distillation report into the active pack (reviewed overlay). Adopted rules are added to the system prompt and exported with the pack.',
    parameters: {
      type: 'object',
      properties: {
        ruleIds: { type: 'array', items: { type: 'string' }, description: 'Suggested rule ids to adopt, e.g. ["plan-first"].' },
        all: { type: 'boolean', description: 'Adopt every suggested rule in the latest report.' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { added: { type: 'array' }, skipped: { type: 'array' }, ruleCount: { type: 'number' } } },
      render: (args, value) => textBlock(
        '采纳建议规则 ' + value.added.length + ' 条' + (value.added.length ? '：' + value.added.join(', ') : '') + '\n' +
        (value.skipped.length ? '跳过：' + value.skipped.join('；') + '\n' : '') +
        '当前生效规则 ' + value.ruleCount + ' 条。'),
    },
    async execute(args) {
      const ids = args && Array.isArray(args.ruleIds) ? args.ruleIds.map((id) => String(id)) : []
      const all = !!(args && args.all)
      return adoptRules(ids, all)
    },
  })

  registerTool({
    name: 'workstyle_toggle',
    description: 'Enable or disable one rule or skill in the active pack on this machine. The pack directory and exports are unchanged; a disabled rule leaves the system prompt and a disabled skill leaves the skills provider.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['rule', 'skill'], description: 'Item type.' },
        id: { type: 'string', description: 'Rule id or skill name.' },
        enabled: { type: 'boolean', description: 'true enables, false disables.' },
      },
      required: ['kind', 'id', 'enabled'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { kind: { type: 'string' }, id: { type: 'string' }, enabled: { type: 'boolean' }, ruleCount: { type: 'number' }, skillCount: { type: 'number' } } },
      render: (args, value) => textBlock(
        (value.enabled ? '已启用 ' : '已停用 ') + (value.kind === 'rule' ? '规则 ' : '技能 ') + value.id +
        '（生效 ' + value.ruleCount + ' 规则 / ' + value.skillCount + ' 技能；包文件未改动）'),
    },
    async execute(args) {
      const result = toggleItem(args && args.kind, args && args.id, !!(args && args.enabled))
      return {
        kind: result.kind,
        id: result.id,
        enabled: result.enabled,
        ruleCount: result.summary.enabledRuleCount,
        skillCount: result.summary.enabledSkillCount,
      }
    },
  })

  registerTool({
    name: 'workstyle_export',
    description: 'Export a workstyle pack (rules + bundled skills, including adopted distillation rules) as a portable .tar.gz that a teammate can extract and apply.',
    parameters: {
      type: 'object',
      properties: { pack: { type: 'string', description: 'Pack id (default: active pack) or absolute pack directory.' } },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { file: { type: 'string' }, bytes: { type: 'number' }, files: { type: 'number' }, ruleCount: { type: 'number' }, skillCount: { type: 'number' } } },
      render: (args, value) => textBlock(
        '已导出：' + value.file + '\n' +
        value.ruleCount + ' 条规则 / ' + value.skillCount + ' 个技能 · ' + value.files + ' 个文件 · ' + value.bytes + ' 字节'),
    },
    async execute(args) {
      const packArg = args && typeof args.pack === 'string' && args.pack.trim() ? args.pack.trim() : undefined
      return exportActivePack(packArg)
    },
  })

  /* --- slash command ------------------------------------------------ */
  try {
    ctx.inject(['commands'], (scoped) => scoped.effect(() => scoped.commands.register({
      name: 'workstyle',
      description: '工作方式包：/workstyle status | apply <pack> | distill | adopt <id|all> | undo <id> | on <id> | off <id> | export',
      input: { hint: 'status | apply <pack> | distill | adopt <id|all> | undo <id> | on <id> | off <id> | export' },
      async handler(invocation) {
        const raw = String(invocation.rawInput || '').trim()
        const [head, ...rest] = raw.split(/\s+/)
        try {
          if (!head || head === 'status') {
            const status = buildStatus()
            return {
              kind: 'success',
              text: '工作方式：' + status.activePack.displayName + ' v' + status.activePack.version +
                '（' + status.activePack.ruleCount + ' 规则 / ' + status.activePack.skillCount + ' 技能）\n' +
                status.rules.map((rule) => '· ' + rule.title + '：' + rule.text).join('\n'),
            }
          }
          if (head === 'apply') {
            const summary = applyPack(rest.join(' ') || DEFAULT_PACK_ID)
            return { kind: 'success', text: '已应用：' + summary.id + '（' + summary.ruleCount + ' 规则 / ' + summary.skillCount + ' 技能）' }
          }
          if (head === 'distill') {
            const { file, report } = await distill({ keywords: measureKeywords() })
            return { kind: 'success', text: '蒸馏完成：' + file + '（建议规则 ' + report.suggestedRules.length + ' 条）' }
          }
          if (head === 'adopt') {
            const arg = rest.join(' ').trim()
            const result = adoptRules(arg === 'all' || !arg ? [] : [arg], arg === 'all' || !arg)
            return {
              kind: 'success',
              text: '采纳建议规则 ' + result.added.length + ' 条' + (result.added.length ? '：' + result.added.join(', ') : '') +
                '（当前 ' + result.ruleCount + ' 条规则）',
            }
          }
          if (head === 'undo') {
            const id = rest.join(' ').trim()
            if (!id) return { kind: 'error', text: '用法：/workstyle undo <rule-id>' }
            const result = unadoptRule(id)
            return { kind: 'success', text: '已撤销采纳：' + result.removed + '（当前 ' + result.ruleCount + ' 条规则）' }
          }
          if (head === 'on' || head === 'off') {
            const id = rest.join(' ').trim()
            if (!id) return { kind: 'error', text: '用法：/workstyle ' + head + ' <rule-id|skill-name>' }
            const enabled = head === 'on'
            const kind = allActiveRules().some((rule) => rule.id === id) ? 'rule' : 'skill'
            const result = toggleItem(kind, id, enabled)
            return {
              kind: 'success',
              text: (enabled ? '已启用 ' : '已停用 ') + (kind === 'rule' ? '规则 ' : '技能 ') + id +
                '（生效 ' + result.summary.enabledRuleCount + ' 规则 / ' + result.summary.enabledSkillCount + ' 技能）',
            }
          }
          if (head === 'export') {
            const out = exportActivePack(rest.join(' ') || undefined)
            return { kind: 'success', text: '已导出：' + out.file + '（' + out.ruleCount + ' 规则 / ' + out.skillCount + ' 技能）' }
          }
          return { kind: 'error', text: '未知子命令：' + head + '（可用 status / apply / distill / adopt / undo / on / off / export）' }
        } catch (error) {
          return { kind: 'error', text: error && error.message ? error.message : String(error) }
        }
      },
    }), 'dsh-workstyle: command'))
  } catch (error) {
    log('command registration unavailable:', error && error.message ? error.message : String(error))
  }

  /* --- HTTP routes for the Web panel ------------------------------- */
  try {
    ctx.inject(['connection'], (scoped) => {
      const connection = scoped.connection
      if (!connection || !connection.fetch || typeof connection.fetch.register !== 'function') return
      const register = (route) => {
        try {
          scoped.effect(() => connection.fetch.register(route), 'dsh-workstyle: route ' + route.path)
        } catch (error) {
          log('route registration failed for', route.path, error && error.message ? error.message : String(error))
        }
      }
      register({
        path: ROUTE_BASE + '/status',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => jsonResponse(buildStatus()),
      })
      register({
        path: ROUTE_BASE + '/pack',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const idOrDir = new URL(request.url).searchParams.get('id')
          if (!idOrDir) return jsonResponse({ error: 'id is required' }, 400)
          const found = findPack(idOrDir)
          return found.next
            ? jsonResponse({ pack: packDetail(found.next) })
            : jsonResponse({ error: 'unknown pack: ' + idOrDir }, 404)
        },
      })
      register({
        path: ROUTE_BASE + '/reports',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => jsonResponse({ reports: listReportMetadata() }),
      })
      register({
        path: ROUTE_BASE + '/exports',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => jsonResponse({ exports: listExportMetadata() }),
      })
      register({
        path: ROUTE_BASE + '/evidence',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => {
          const report = readLatestReport()
          return jsonResponse(report || { error: 'no report yet' }, report ? 200 : 404)
        },
      })
      register({
        path: ROUTE_BASE + '/apply',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = await readJsonBody(request)
          const packArg = body && typeof body.pack === 'string' ? body.pack.trim() : ''
          if (!packArg) return jsonResponse({ error: 'pack is required' }, 400)
          try {
            const summary = applyPack(packArg)
            return jsonResponse({ applied: summary, status: buildStatus() })
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 404)
          }
        },
      })
      register({
        path: ROUTE_BASE + '/distill',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = await readJsonBody(request)
          const limit = body && Number.isFinite(body.dshSessions) ? Math.max(0, Math.min(50, body.dshSessions)) : 12
          try {
            const { file, report } = await distill({
              dshSessions: limit,
              // The panel distils for the project it is showing, so its rules
              // get measured too.
              keywords: measureKeywords({ cwd: body && body.cwd, sessionId: body && body.sessionId }),
            })
            return jsonResponse({ file, generatedAt: report.generatedAt, suggestedRules: report.suggestedRules.length, sources: report.sources })
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 500)
          }
        },
      })
      register({
        path: ROUTE_BASE + '/adopt',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = await readJsonBody(request)
          const ids = body && Array.isArray(body.ruleIds) ? body.ruleIds.map((id) => String(id)) : []
          const all = !!(body && body.all)
          try {
            const result = adoptRules(ids, all)
            return jsonResponse({ ...result, status: buildStatus() })
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 400)
          }
        },
      })
      register({
        path: ROUTE_BASE + '/unadopt',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = await readJsonBody(request)
          const ruleId = body && typeof body.ruleId === 'string' ? body.ruleId.trim() : ''
          if (!ruleId) return jsonResponse({ error: 'ruleId is required' }, 400)
          try {
            const result = unadoptRule(ruleId)
            return jsonResponse({ ...result, status: buildStatus() })
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 404)
          }
        },
      })
      register({
        path: ROUTE_BASE + '/toggle',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = await readJsonBody(request)
          const kind = body && body.kind
          const id = body && typeof body.id === 'string' ? body.id.trim() : ''
          const enabled = !!(body && body.enabled)
          if (kind !== 'rule' && kind !== 'skill') return jsonResponse({ error: 'kind must be "rule" or "skill"' }, 400)
          if (!id) return jsonResponse({ error: 'id is required' }, 400)
          try {
            const result = toggleItem(kind, id, enabled)
            return jsonResponse({ ...result, status: buildStatus() })
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 404)
          }
        },
      })
      register({
        path: ROUTE_BASE + '/scope',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const query = new URL(request.url).searchParams
          const scope = scopeFor({ cwd: query.get('cwd') || undefined, sessionId: query.get('session') || undefined })
          return jsonResponse({
            cwd: scope.cwd,
            sessionId: scope.sessionId || null,
            project: scope.project,
            session: scope.session,
            counts: scope.counts,
            rules: scope.rules,
            skills: scope.skills,
            presets: scope.presets,
            templates: scope.templates,
            activePreset: scope.activePreset,
            presetScope: scope.presetScope,
            blockedPresets: scope.blockedPresets,
          })
        },
      })
      register({
        path: ROUTE_BASE + '/scope',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = await readJsonBody(request)
          const layer = body && body.layer
          const patch = body && body.patch && typeof body.patch === 'object' ? body.patch : {}
          // The panel sends cwd as a real working directory; writing
          // .dsh/workstyle.json into an arbitrary path is not part of the
          // contract, so require an existing directory up front.
          const validCwd = (value) => {
            if (typeof value !== 'string' || !value.trim()) return false
            try { return fs.statSync(value).isDirectory() } catch { return false }
          }
          try {
            if (layer === 'project') {
              if (!body) return jsonResponse({ error: 'request body must be JSON' }, 400)
              if (!body.cwd) return jsonResponse({ error: 'cwd is required' }, 400)
              if (!validCwd(body.cwd)) return jsonResponse({ error: 'cwd must be an existing directory' }, 400)
              writeProjectScope(body.cwd, patch)
            } else if (layer === 'session') {
              if (!body) return jsonResponse({ error: 'request body must be JSON' }, 400)
              if (!body.sessionId) return jsonResponse({ error: 'sessionId is required' }, 400)
              writeSessionScope(body.sessionId, patch)
            } else {
              return jsonResponse({ error: "layer must be 'project' or 'session'" }, 400)
            }
            const scope = scopeFor({ cwd: body.cwd, sessionId: body.sessionId })
            return jsonResponse({ saved: layer, project: scope.project, session: scope.session, counts: scope.counts })
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 400)
          }
        },
      })
      register({
        path: ROUTE_BASE + '/inject',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const query = new URL(request.url).searchParams
          return jsonResponse(injectFor({
            cwd: query.get('cwd') || undefined,
            sessionId: query.get('session') || undefined,
          }))
        },
      })
      register({
        path: ROUTE_BASE + '/metrics',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const query = new URL(request.url).searchParams
          const scope = scopeFor({ cwd: query.get('cwd') || undefined, sessionId: query.get('session') || undefined })
          return jsonResponse(computeMetrics({ rules: scope.rules.filter((rule) => rule.enabled) }))
        },
      })
      register({
        path: ROUTE_BASE + '/rule',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = (await readJsonBody(request)) || {}
          const raw = body.rule && typeof body.rule === 'object' ? body.rule : {}
          const id = typeof raw.id === 'string' ? raw.id.trim() : ''
          if (!id) return jsonResponse({ error: 'rule.id is required' }, 400)
          const target = body.target === 'pack' ? 'pack' : body.target === 'session' ? 'session' : 'project'
          // Same guard as /scope: only write project rules under a real
          // working directory, never an arbitrary path.
          const isDir = (value) => {
            try { return fs.statSync(value).isDirectory() } catch { return false }
          }

          try {
            if (target === 'project') {
              if (!body.cwd) return jsonResponse({ error: 'cwd is required' }, 400)
              if (!isDir(body.cwd)) return jsonResponse({ error: 'cwd must be an existing directory' }, 400)
              if (body.action === 'restore') return jsonResponse({ error: 'project rules have no restore' }, 400)
              const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : id
              const current = readProjectScope(body.cwd)
              const nextRules = current.rules.filter((item) => item.id !== id)
              if (body.remove !== true) {
                if (typeof raw.text !== 'string' || !raw.text.trim()) {
                  return jsonResponse({ error: 'rule.text is required to save a rule' }, 400)
                }
                nextRules.push({ ...raw, id, title, text: raw.text.trim() })
              }
              writeProjectScope(body.cwd, { rules: nextRules })
              return jsonResponse({ saved: body.remove === true ? 'removed' : 'rule', id, revision: null, scope: scopeFor({ cwd: body.cwd }) })
            }

            if (target === 'session') {
              if (!body.sessionId) return jsonResponse({ error: 'sessionId is required' }, 400)
              const current = readSessionScope(body.sessionId)
              writeSessionScope(body.sessionId, {
                enabledRules: body.remove === true || body.action === 'restore'
                  ? current.enabledRules.filter((ruleId) => ruleId !== id)
                  : [...new Set([...current.enabledRules, id])],
                disabledRules: body.remove === true
                  ? [...new Set([...current.disabledRules, id])]
                  : current.disabledRules.filter((ruleId) => ruleId !== id),
              })
              return jsonResponse({
                saved: body.action === 'restore' ? 'restored' : body.remove === true ? 'disabled' : 'enabled',
                id, revision: null, scope: scopeFor({ sessionId: body.sessionId }),
              })
            }

            /* target === 'pack' */
            const targetPack = packs.find((pack) => pack.id === (body.packId || active.id))
            if (!targetPack) return jsonResponse({ error: 'unknown pack: ' + (body.packId || active.id) }, 404)
            const known = baseRulesFor(targetPack).find((rule) => rule.id === id)
            if (!known && body.action !== 'restore') return jsonResponse({ error: 'unknown rule: ' + id }, 404)
            /* Ownership routes the write: only the pack's own rules belong to
               its file; adopted/distilled ones stay in the machine overlay. */
            const owned = (targetPack.rules || []).some((rule) => rule.id === id)
            const write = owned && isUserPack(targetPack)
              ? { scope: 'pack', file: path.join(targetPack.dir, 'workstyle.json') }
              : { scope: 'overlay' }

            if (write.scope === 'overlay') {
              const state = readState()
              if (body.action === 'restore') {
                writeOverlay(restoreOverlay(state, targetPack.id, id), 'rule-restore:' + id)
                return jsonResponse({ saved: 'restored', id, revision: null, scope: scopeFor({}) })
              }
              if (body.remove === true) {
                writeOverlay(removeOverlay(state, targetPack.id, id), 'rule-remove:' + id)
                return jsonResponse({ saved: 'removed', id, revision: null, scope: scopeFor({}) })
              }
              if (typeof raw.text !== 'string' || !raw.text.trim()) {
                return jsonResponse({ error: 'rule.text is required to save a rule' }, 400)
              }
              const next = patchOverlay(state, targetPack.id, id, { title: raw.title, text: raw.text })
              writeOverlay(next, 'rule-patch:' + id)
              return jsonResponse({ saved: 'rule', id, revision: null, scope: scopeFor({}) })
            }

            /* user pack: edit workstyle.json in place */
            if (body.remove !== true && (typeof raw.text !== 'string' || !raw.text.trim())) {
              return jsonResponse({ error: 'rule.text is required to save a rule' }, 400)
            }
            const file = write.file
            const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
            const rules = Array.isArray(manifest.rules) ? [...manifest.rules] : []
            const index = rules.findIndex((rule) => rule && rule.id === id)
            if (body.remove === true) {
              if (index >= 0) rules.splice(index, 1)
            } else if (index >= 0) {
              rules[index] = { ...rules[index], title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : rules[index].title, text: raw.text.trim() }
            } else {
              rules.push({ id, title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : id, text: raw.text.trim() })
            }
            const result = commit(file, { ...manifest, rules }, { reason: 'rule:' + id })
            const refreshed = refreshPacks()
            if (!refreshed.ok) {
              return jsonResponse({ error: refreshed.error || 'failed to reload packs' }, 500)
            }
            return jsonResponse({ saved: body.remove === true ? 'removed' : 'rule', id, revision: result.revision, scope: scopeFor({}) })
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 400)
          }
        },
      })
      register({
        path: ROUTE_BASE + '/preset',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = (await readJsonBody(request)) || {}
          const action = typeof body.action === 'string' ? body.action : 'save'
          try {
            if (action === 'use') {
              const presetId = checkPresetId(body.preset)
              if (!body.cwd && !body.sessionId) return jsonResponse({ error: 'cwd or sessionId is required to switch preset' }, 400)
              if (body.cwd) writeProjectScope(body.cwd, { preset: presetId })
              else writeSessionScope(body.sessionId, { preset: presetId })
              return jsonResponse({ used: presetId, scope: scopeFor({ cwd: body.cwd, sessionId: body.sessionId }) })
            }
            if (action === 'save') {
              const preset = body.preset && typeof body.preset === 'object' ? body.preset : {}
              const presetId = checkPresetId(preset.id)
              const state = readState()
              const list = Array.isArray(state.presets) ? state.presets.filter((item) => item && item.id !== presetId) : []
              list.push({
                id: presetId,
                title: typeof preset.title === 'string' && preset.title.trim() ? preset.title.trim() : presetId,
                description: typeof preset.description === 'string' ? preset.description : '',
                rules: Array.isArray(preset.rules) ? preset.rules.filter((r) => typeof r === 'string') : [],
                skills: Array.isArray(preset.skills) ? preset.skills.filter((s) => typeof s === 'string') : [],
                templates: Array.isArray(preset.templates) ? preset.templates.filter((t) => typeof t === 'string') : [],
              })
              writeState({ presets: list })
              return jsonResponse({ saved: presetId, presets: list })
            }
            return jsonResponse({ error: "action must be 'save' or 'use'" }, 400)
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 400)
          }
        },
      })
      register({
        path: ROUTE_BASE + '/export',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = await readJsonBody(request)
          const packArg = body && typeof body.pack === 'string' && body.pack.trim() ? body.pack.trim() : undefined
          if (body && body.withProject === true && !(typeof body.cwd === 'string' && body.cwd.trim())) {
            return jsonResponse({ error: 'cwd is required when withProject is true' }, 400)
          }
          try {
            const projectSnapshot = body && body.withProject === true ? projectSnapshotFor(path.resolve(body.cwd.trim())) : undefined
            return jsonResponse(exportActivePack(packArg, projectSnapshot))
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 400)
          }
        },
      })
    })
  } catch (error) {
    log('connection service unavailable:', error && error.message ? error.message : String(error))
  }

  log('ready; routes:', ROUTE_BASE + '/status')
}

