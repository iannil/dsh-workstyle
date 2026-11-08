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
  renderRules, reportsDir, workstyleHome, writeState,
} from './lib/pack.js'
import { distill, readLatestReport } from './lib/distill.js'
import { exportPack } from './lib/export.js'

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

  const effectiveActive = () => ({ ...active, rules: mergeRules(active, adoptedRulesFor(active.id)) })

  const findPack = (idOrDir) => {
    const packsNow = loadAllPacks()
    let next = packsNow.find((pack) => pack.id === idOrDir)
    if (!next) {
      const byDir = loadPackAt(path.resolve(idOrDir))
      if (byDir) next = withSkills(byDir)
    }
    return { packsNow, next }
  }

  const buildStatus = () => {
    const latest = readLatestReport()
    const effective = effectiveActive()
    const packRuleIds = new Set(active.rules.map((rule) => rule.id))
    const adopted = adoptedRulesFor(active.id)
    const adoptedIds = new Set(adopted.map((rule) => rule.id))
    return {
      plugin: {
        name, version: VERSION, home: workstyleHome(),
        reports: reportsDir(), exports: exportsDir(),
      },
      activePackId: active.id,
      activePack: packSummary(effective),
      packs: packs.map(packSummary),
      rules: effective.rules,
      adoptions: adopted.map((rule) => ({
        id: rule.id, title: rule.title, text: rule.text,
        evidence: rule.evidence || '', adoptedAt: rule.adoptedAt,
      })),
      suggestions: latest && Array.isArray(latest.suggestedRules)
        ? latest.suggestedRules.map((rule) => ({
            id: rule.id,
            title: rule.title,
            text: rule.text,
            evidence: rule.evidence || '',
            confidence: rule.confidence || 'medium',
            adopted: adoptedIds.has(rule.id),
            present: packRuleIds.has(rule.id),
          }))
        : [],
      skills: effective.skillList.map((skill) => ({ name: skill.name, description: skill.description, whenToUse: skill.whenToUse })),
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
    if (added.length) writeAdoptionsFor(active.id, [...existing, ...added])
    log('adopted rules:', added.map((rule) => rule.id).join(', ') || '(none)')
    return { added: added.map((rule) => rule.id), skipped, ruleCount: effectiveActive().rules.length }
  }

  const unadoptRule = (ruleId) => {
    const existing = adoptedRulesFor(active.id)
    const next = existing.filter((rule) => rule.id !== ruleId)
    if (next.length === existing.length) throw new Error('rule not adopted: ' + ruleId)
    writeAdoptionsFor(active.id, next)
    log('revoked adopted rule:', ruleId)
    return { removed: ruleId, ruleCount: effectiveActive().rules.length }
  }

  const exportActivePack = (idOrDir) => {
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
      text: () => renderRules(effectiveActive()),
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
            for (const skill of pack.skillList || []) {
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
        skillCount: status.activePack.skillCount,
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
      return {
        activePack: active.id,
        ruleCount: effective.rules.length,
        adoptedRules: adoptedRulesFor(active.id).map((rule) => rule.id),
        packs: packs.map(packSummary),
        skills: effective.skillList.map((skill) => ({ name: skill.name, description: skill.description })),
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
      const { file, report } = await distill({ dshSessions: limit })
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
      description: '工作方式包：/workstyle status | apply <pack> | distill | adopt <id|all> | undo <id> | export',
      input: { hint: 'status | apply <pack> | distill | adopt <id|all> | undo <id> | export' },
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
            const { file, report } = await distill({})
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
          if (head === 'export') {
            const out = exportActivePack(rest.join(' ') || undefined)
            return { kind: 'success', text: '已导出：' + out.file + '（' + out.ruleCount + ' 规则 / ' + out.skillCount + ' 技能）' }
          }
          return { kind: 'error', text: '未知子命令：' + head + '（可用 status / apply / distill / adopt / undo / export）' }
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
            const { file, report } = await distill({ dshSessions: limit })
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
        path: ROUTE_BASE + '/export',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = await readJsonBody(request)
          const packArg = body && typeof body.pack === 'string' && body.pack.trim() ? body.pack.trim() : undefined
          try {
            return jsonResponse(exportActivePack(packArg))
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

