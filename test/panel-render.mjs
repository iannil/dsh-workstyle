/**
 * dsh-workstyle panel render test — no browser, no harness.
 *
 * Loads client.js with a tiny React/JSX shim, feeds it a sample status payload,
 * and asserts the v4 console: no marketing copy, run status first, review queue
 * on top, searchable/filterable rule and skill lists with per-item toggles,
 * folded evidence, distribution block and build marker.
 *
 * Run: ELECTRON_RUN_AS_NODE=1 "<DeepSeek Harness binary>" test/panel-render.mjs
 *      (or any Node.js >= 20)
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname))

/* ----------------------------- React shim ----------------------------- */

const stateStore = []
const refStore = []
const callbackStore = []
const callbackDeps = []
const effectRan = []
const effectDeps = []
let cursor = 0
let effectQueue = []
let dirty = false

const React = {
  createElement(type, props, ...children) {
    return {
      type,
      props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
    }
  },
  useState(initial) {
    const index = cursor++
    if (!(index in stateStore)) {
      stateStore[index] = typeof initial === 'function' ? initial() : initial
    }
    return [stateStore[index], (next) => {
      stateStore[index] = typeof next === 'function' ? next(stateStore[index]) : next
      dirty = true
    }]
  },
  useRef(initial) {
    const index = cursor++
    if (!(index in refStore)) refStore[index] = { current: initial }
    return refStore[index]
  },
  useEffect(fn, deps) {
    const index = cursor++
    const previous = effectDeps[index]
    const changed = !effectRan[index] || !Array.isArray(deps)
      ? !effectRan[index]
      : !previous || deps.length !== previous.length || deps.some((value, i) => !Object.is(value, previous[i]))
    if (changed) {
      effectRan[index] = true
      effectDeps[index] = Array.isArray(deps) ? deps.slice() : undefined
      effectQueue.push(fn)
    }
  },
  useCallback(fn, deps) {
    const index = cursor++
    const previous = callbackDeps[index]
    const changed = !previous || (Array.isArray(deps) && (deps.length !== previous.length
      || deps.some((value, i) => !Object.is(value, previous[i]))))
    if (changed) {
      callbackDeps[index] = Array.isArray(deps) ? deps.slice() : []
      callbackStore[index] = fn
    }
    return callbackStore[index]
  },
}

/* --------------------------- window / DOM ----------------------------- */

let mod = null
let hashChange = null
globalThis.window = {
  __ModuleLoader__: { load(value) { mod = value } },
  addEventListener(name, fn) { if (name === 'hashchange') hashChange = fn },
  removeEventListener() {},
}
const route = { hash: '#/run' }
globalThis.location = route
const memoryStore = Object.create(null)
globalThis.window.localStorage = {
  getItem(key) { return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null },
  setItem(key, value) { memoryStore[key] = String(value) },
  removeItem(key) { delete memoryStore[key] },
}
globalThis.document = { body: null }
globalThis.getComputedStyle = () => ({ backgroundColor: 'rgb(255, 255, 255)' })
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { clipboard: { writeText: async () => {} } },
    configurable: true,
  })
} catch (err) { /* Node exposes a read-only navigator; copy() falls back to an error notice */ }

/* ------------------------------ payload ------------------------------- */

const sampleStatus = {
  plugin: { name: 'dsh-workstyle', version: '0.1.0' },
  activePack: {
    id: 'fde-engineering', name: 'fde', displayName: 'FDE 工程工作方式', version: '0.1.0',
    format: 'json', dir: '/tmp/dsh-workstyle/pack', description: '面向工程交付的默认工作方式：先方案、证据优先。',
    ruleCount: 4, skillCount: 3,
  },
  packs: [
    { id: 'fde-engineering', displayName: 'FDE 工程工作方式', version: '0.1.0' },
    { id: 'minimal', displayName: '极简工作方式', version: '0.2.0' },
  ],
  rules: [
    { id: 'plan-first', title: '先方案后实现', text: '规则正文-先方案', severity: 'high', evidence: '证据-1', enabled: true, origin: 'pack' },
    { id: 'evidence-first', title: '证据优先', text: '规则正文-证据', severity: 'high', enabled: true, origin: 'pack' },
    { id: 'verify-first', title: '验证后才宣称完成', text: '规则正文-验证', severity: 'medium', evidence: '证据-3', enabled: true, origin: 'distilled' },
    { id: 'compact-delivery', title: '紧凑交付', text: '规则正文-紧凑', severity: 'medium', enabled: false, origin: 'pack' },
  ],
  suggestions: [
    { id: 'short-sentences', title: '中文短句', text: '建议正文-短句', evidence: '证据-2', confidence: 'high', adopted: false, present: false },
    { id: 'adopted-before', title: '先列风险', text: '建议正文-风险', evidence: '证据-4', confidence: 'medium', adopted: true, present: false },
  ],
  skills: [
    { name: 'fde-job', description: '从零构建一个完整项目', whenToUse: '用户要完整项目时', enabled: true, origin: 'pack' },
    { name: 'fde-qa', description: '按风险执行验收', whenToUse: '交付前验收时', enabled: false, origin: 'pack' },
    { name: 'fde-inspector', description: '审查变更的架构合理性', whenToUse: '收到代码变更时', enabled: true, origin: 'pack' },
  ],
  adoptions: [{ id: 'verify-first' }],
  summary: {
    ruleCount: 4, enabledRuleCount: 3, disabledRuleCount: 1,
    skillCount: 3, enabledSkillCount: 2, disabledSkillCount: 1,
    adoptedRuleCount: 1, pendingSuggestionCount: 1, noEvidenceRuleCount: 1,
  },
  sources: {
    claude: '/tmp/claude', codex: '/tmp/codex', dsh: '/tmp/dsh', pi: '/tmp/pi',
  },
  latestDistill: { generatedAt: '2026-11-07T17:00:00.000Z', file: '/tmp/report.json' },
}

const currentStatus = JSON.parse(JSON.stringify(sampleStatus))
const detailControl = { delayed: false, fail: false, pending: [] }
const envControl = { delayed: false, pending: [] }
const statusControl = { delayed: false, fail: false, noActive: false, pending: [] }
const detailPacks = {
  'fde-engineering': {
    id: 'fde-engineering', displayName: 'FDE 工程工作方式', version: '0.1.0', format: 'json',
    ruleCount: 4, skillCount: 3,
    rules: [{ id: 'plan-first', title: '先方案后实现', text: '规则正文-先方案' }],
    skills: [{ name: 'fde-job', description: 'FDE 技能', whenToUse: '工程项目' }],
    presets: [{ id: 'fde-delivery', title: 'FDE 交付', description: '工程交付', rules: [], skills: [], templates: [] }],
    templates: [{ id: 'tpl-a', title: '验收模板', text: '验收' }],
  },
  minimal: {
    id: 'minimal', displayName: '极简工作方式', version: '0.2.0', format: 'json',
    ruleCount: 1, skillCount: 1,
    rules: [{ id: 'minimal-rule', title: '极简规则 B', text: 'B 包规则正文' }],
    skills: [{ name: 'minimal-skill', description: 'B 包技能', whenToUse: 'B 包场景' }],
    presets: [{ id: 'minimal-default', title: 'B 包预设', description: 'B 包预设说明', rules: [], skills: [], templates: [] }],
    templates: [{ id: 'minimal-template', title: 'B 包模板', text: 'B 模板正文' }],
  },
}

/* v5 environment payloads: a project layer and a session layer are present,
   so the panel has something real to explain. */
const fpOf = (text) => {
  // Same shape as the host: 12 hex chars derived from the text.
  let hash = 0
  for (const ch of text) hash = (hash * 31 + ch.codePointAt(0)) >>> 0
  return hash.toString(16).padStart(8, '0').slice(0, 8) + 'beef'
}

const currentScope = {
  cwd: '/tmp/project-huan',
  sessionId: 'sess-abc',
  project: {
    present: true,
    file: '/tmp/project-huan/.dsh/workstyle.json',
    rules: [{ id: 'project-docs-only', title: '项目：只改 docs/', text: '本项目只改 docs/。', severity: 'medium', source: 'project' }],
    disabledRules: [],
    disabledSkills: [],
    preset: 'fde-delivery',
  },
  session: { present: true, file: '/tmp/sessions/sess-abc.json', enabledRules: [], disabledRules: [], enabledSkills: [], disabledSkills: ['fde-qa'] },
  rules: [
    { id: 'plan-first', title: '先方案后实现', text: '规则正文-先方案', severity: 'high', evidence: '证据-1', origin: 'pack', textScope: 'workspace', enabled: true },
    { id: 'evidence-first', title: '证据优先', text: '规则正文-证据', severity: 'high', origin: 'pack', textScope: 'workspace', enabled: true },
    { id: 'verify-first', title: '验证后才宣称完成', text: '规则正文-验证', severity: 'medium', evidence: '证据-3', origin: 'distilled', textScope: 'workspace', enabled: true },
    { id: 'project-docs-only', title: '项目：只改 docs/', text: '本项目只改 docs/。', severity: 'medium', origin: 'project', textScope: 'project', enabled: true },
    { id: 'plan-first', title: '项目覆盖：先方案后实现', text: '项目覆盖正文', severity: 'medium', origin: 'project', textScope: 'project', enabled: true },
    { id: 'compact-delivery', title: '紧凑交付', text: '规则正文-紧凑', severity: 'medium', origin: 'pack', textScope: 'workspace', enabled: false, disabledBy: 'session' },
  ],
  skills: [
    { name: 'fde-job', description: '从零构建一个完整项目', whenToUse: '用户要完整项目时', enabled: true, inPreset: true, rank: 0 },
    { name: 'fde-qa', description: '按风险执行验收', whenToUse: '交付前验收时', enabled: false, disabledBy: 'session', inPreset: false, rank: 1001 },
    { name: 'fde-inspector', description: '审查变更的架构合理性', whenToUse: '收到代码变更时', enabled: true, inPreset: true, rank: 3 },
  ],
  presets: [
    { id: 'fde-delivery', title: 'FDE 交付', description: '工程交付：先方案、证据优先。', rules: ['plan-first', 'verify-first'], skills: ['fde-job', 'fde-inspector'], templates: ['tpl-a', 'tpl-b'], builtin: true },
    { id: 'writing', title: '写书', description: '书稿审计与润色：保留论证。', rules: ['evidence-first'], skills: ['fde-qa'], templates: ['tpl-c'], builtin: true },
    { id: 'rc', title: 'RC 探讨', description: '先给判断再给建议。', rules: [], skills: [], templates: [], builtin: true },
  ],
  templates: [
    { id: 'tpl-a', title: '验收标准模板', text: '1. 目标 2. 改动点 3. 验收 4. 风险', builtin: true },
    { id: 'tpl-c', title: '审读报告模板', text: '先把问题列清楚，再给建议。', builtin: true },
  ],
  counts: { injected: 4, total: 5, workspace: 3, project: 1, disabled: 1, skills: 2, skillTotal: 3 },
  activePreset: { id: 'fde-delivery', title: 'FDE 交付', description: '工程交付：先方案、证据优先。', rules: ['plan-first', 'verify-first'], skills: ['fde-job', 'fde-inspector'], templates: ['tpl-a', 'tpl-b'] },
  presetScope: 'project',
}

const recomputeSummary = () => {
  const rules = currentStatus.rules
  const skills = currentStatus.skills
  currentStatus.summary.enabledRuleCount = rules.filter((rule) => rule.enabled !== false).length
  currentStatus.summary.disabledRuleCount = rules.length - currentStatus.summary.enabledRuleCount
  currentStatus.summary.enabledSkillCount = skills.filter((skill) => skill.enabled !== false).length
  currentStatus.summary.disabledSkillCount = skills.length - currentStatus.summary.enabledSkillCount
  currentStatus.summary.pendingSuggestionCount = currentStatus.suggestions.filter((rule) => !(rule.adopted || rule.present)).length
  currentStatus.summary.noEvidenceRuleCount = rules.filter((rule) => !rule.evidence).length
  currentStatus.summary.ruleCount = rules.length
  currentStatus.summary.skillCount = skills.length
}

const json = (data) => ({ ok: true, json: async () => data })

/* Test levers: fetchLog records every URL the panel requested; failEnv makes
   one environment route fail while the others succeed. */
const fetchLog = []
const exportCalls = []
const mutationCalls = []
const exportControl = { fail: false, delayed: false, pending: [], failHistory: false, failReports: false }
const failEnv = { scope: false, inject: false, metrics: false, emptyMetrics: false, adopt: false }
/* Preset actions answer like the host route: `sessions` refuses a delete with
   a recoverable 400, `blockedIds` are bundled presets (delete ⇒ block),
   `duplicateExists` forces the duplicate-id conflict. */
const presetControl = { sessions: [], blockedIds: [], duplicateExists: false }

globalThis.fetch = async (url, options = {}) => {
  const target = String(url)
  fetchLog.push(target)
  if (target.endsWith('/api/dsh-workstyle/reports')) {
    if (exportControl.failReports) return { ok: false, json: async () => ({}) }
    // Metadata only, same shape as the host route: no report bodies, no prompt text.
    return json({ reports: [
      { file: 'report-2026-11-07.json', generatedAt: '2026-11-07T17:00:00.000Z', sources: { claude: true, codex: true, dsh: true, pi: false }, suggestionCount: 2 },
      { file: 'report-2026-11-06.json', generatedAt: '2026-11-06T09:30:00.000Z', sources: { claude: true, codex: false, dsh: false, pi: false }, suggestionCount: 0 },
    ] })
  }
  if (target.endsWith('/api/dsh-workstyle/exports')) {
    if (exportControl.failHistory) return { ok: false, json: async () => ({}) }
    return json({ exports: [
      { file: 'fde-engineering-v0.1.0-2026-11-08T01-00-00-000Z.tar.gz', modifiedAt: '2026-11-08T01:00:00.000Z', bytes: 12345, packId: 'fde-engineering', packVersion: '0.1.0' },
    ] })
  }
  if (target.endsWith('/api/dsh-workstyle/export')) {
    const body = JSON.parse(options.body || '{}')
    exportCalls.push(body)
    const respond = () => {
      if (exportControl.fail) return { ok: false, json: async () => ({ error: 'export rejected' }) }
      return json({ file: '/tmp/exports/fde-engineering-v0.1.0-new.tar.gz', bytes: 4567, files: 6, packId: 'fde-engineering', ruleCount: 4, skillCount: 3 })
    }
    if (exportControl.delayed) return new Promise((resolve) => exportControl.pending.push(() => resolve(respond())))
    return respond()
  }
  if (target.endsWith('/api/dsh-workstyle/adopt')) {
    if (failEnv.adopt) return { ok: false, json: async () => ({ error: 'adopt rejected' }) }
    const body = JSON.parse(options.body || '{}')
    const ids = body.all
      ? currentStatus.suggestions.filter((rule) => !(rule.adopted || rule.present)).map((rule) => rule.id)
      : (Array.isArray(body.ruleIds) ? body.ruleIds : [])
    for (const id of ids) {
      const rule = currentStatus.suggestions.find((item) => item.id === id)
      if (rule && !rule.present) rule.adopted = true
    }
    recomputeSummary()
    return json({ added: ids.filter((id) => {
      const rule = currentStatus.suggestions.find((item) => item.id === id)
      return rule && rule.adopted
    }), skipped: [], status: currentStatus })
  }
  if (target.endsWith('/api/dsh-workstyle/unadopt')) {
    const body = JSON.parse(options.body || '{}')
    const rule = currentStatus.suggestions.find((item) => item.id === body.ruleId)
    if (rule) rule.adopted = false
    recomputeSummary()
    return json({ ruleCount: currentStatus.summary.ruleCount, status: currentStatus })
  }
  if (target.endsWith('/api/dsh-workstyle/status')) {
    if (statusControl.fail) return { ok: false, json: async () => ({}) }
    const response = json(statusControl.noActive
      ? { ...currentStatus, activePack: null }
      : currentStatus)
    if (statusControl.delayed) return new Promise((resolve) => statusControl.pending.push(() => resolve(response)))
    return response
  }
  if (target.endsWith('/api/dsh-workstyle/evidence')) {
    return json(currentStatus.latestDistill
      ? {
        generatedAt: currentStatus.latestDistill.generatedAt,
        sources: {
          claude: { prompts: 20056, chinese: 8000, planKeywords: 815 },
          codex: { sessions: 12, latest: '2026-10-01T00:00:00.000Z' },
          dsh: { sessions: 8, sampled: 6, toolCalls: 120 },
          pi: { sessions: 3, messages: 40 },
        },
      }
      : null)
  }
  if (target.includes('/api/dsh-workstyle/pack?id=')) {
    const id = new URL(target, 'http://panel.test').searchParams.get('id')
    if (detailControl.fail) return { ok: false, json: async () => ({ error: 'pack detail rejected' }) }
    const pack = detailPacks[id]
    const response = pack ? json({ pack }) : { ok: false, json: async () => ({ error: 'unknown pack: ' + id }) }
    if (detailControl.delayed) return new Promise((resolve) => detailControl.pending.push(() => resolve(response)))
    return response
  }
  if (target.includes('/api/dsh-workstyle/scope')) {
    if (failEnv.scope) return { ok: false, json: async () => ({}) }
    if (options.method === 'POST') {
      const body = JSON.parse(options.body || '{}')
      mutationCalls.push({ path: 'scope', body })
      if (body.layer === 'session' && body.patch && Array.isArray(body.patch.disabledRules)) {
        currentScope.session.disabledRules = body.patch.disabledRules.slice()
        for (const rule of currentScope.rules) {
          const off = currentScope.session.disabledRules.includes(rule.id)
          rule.enabled = off ? false : rule.enabled !== false
          if (off) rule.disabledBy = 'session'
          else delete rule.disabledBy
        }
        currentScope.counts.injected = currentScope.rules.filter((rule) => rule.enabled !== false).length
      }
      return json({ saved: body.layer, project: currentScope.project, session: currentScope.session, counts: currentScope.counts })
    }
    const scope = { ...currentScope, cwd: new URL(target, 'http://panel.test').searchParams.get('cwd') || currentScope.cwd }
    if (envControl.delayed) return new Promise((resolve) => envControl.pending.push(() => resolve(json(scope))))
    return json(scope)
  }
  if (target.includes('/api/dsh-workstyle/inject')) {
    if (failEnv.inject) return { ok: false, json: async () => ({}) }
    const rules = currentScope.rules.filter((rule) => rule.enabled !== false)
    const textLines = ['## 工作方式：' + currentStatus.activePack.displayName + '（dsh-workstyle / fde-engineering v0.1.0）', '']
      .concat(rules.map((rule) => '- **' + rule.title + '**：' + rule.text))
    const injectedText = textLines.join('\n')
    return json({
      text: injectedText,
      fingerprint: fpOf(injectedText),
      chars: [...injectedText].length,
      ruleCount: rules.length,
      skillCount: currentScope.counts.skills,
      section: 'dsh-workstyle.rules',
      counts: currentScope.counts,
      projectFile: currentScope.project.file,
    })
  }
  if (target.includes('/api/dsh-workstyle/metrics')) {
    if (failEnv.metrics) return { ok: false, json: async () => ({}) }
    if (failEnv.emptyMetrics) return json({ available: false, metrics: [], sources: [] })
    return json({
      available: true,
      generatedAt: '2026-11-07T17:00:00.000Z',
      scanned: 'Claude Code 共读到 20056 条 prompt',
      sources: [
        { key: 'claude', label: 'Claude Code', available: true },
        { key: 'codex', label: 'Codex', available: true },
        { key: 'dsh', label: 'DeepSeek Harness', available: true },
        { key: 'pi', label: 'Pi', available: false },
      ],
      metrics: [
        { id: 'rule-hits', label: '规则命中', value: '2', unit: '/3', ratio: 66.7, formula: '规则命中 = 命中规则数 / 可测量规则数', denominator: '分母只算可测量的规则。' },
        { id: 'plan-rate', label: '先方案率', value: '4.1', unit: '%', ratio: 4.1, formula: '先方案率 = 含方案词的 prompt / prompt 总数 = 815 / 20056', denominator: '分母是用户 prompt 总数。' },
        { id: 'verify-rate', label: '验证率', value: '3', unit: '%', ratio: 3, formula: '验证率 = 含验证词的 prompt / prompt 总数 = 601 / 20056', denominator: '只看用户 prompt 侧。' },
        { id: 'coverage', label: '蒸馏覆盖', value: '3', unit: '/4', ratio: 75, formula: '蒸馏覆盖 = 可用源数 / 4', denominator: 'claude ✓ · codex ✓ · dsh ✓ · pi ✗' },
      ],
      caveat: '这些是代理指标：能说明提示里出现过什么，不能说明模型是否遵守规则。',
      baseline: {
        available: true,
        planRate: { previous: 3.5, delta: 0.6 },
        verifyRate: { previous: 3.2, delta: -0.2 },
        note: '对比上一次报告窗口，不说明因果。',
      },
    })
  }
  if (target.endsWith('/api/dsh-workstyle/rule')) {
    const body = JSON.parse(options.body || '{}')
    mutationCalls.push({ path: 'rule', body })
    const rule = body.rule || {}
    currentScope.project.rules = (currentScope.project.rules || []).filter((item) => item.id !== rule.id)
    currentScope.rules = currentScope.rules.filter((item) => item.id !== rule.id)
    if (body.remove !== true) {
      const saved = { id: rule.id, title: rule.title, text: rule.text, origin: 'project', textScope: 'project', enabled: true, severity: 'medium' }
      currentScope.project.rules.push({ ...saved, source: 'project' })
      currentScope.rules.push(saved)
    }
    currentScope.counts.project = currentScope.rules.filter((item) => item.origin === 'project').length
    currentScope.counts.total = currentScope.rules.length
    currentScope.counts.injected = currentScope.rules.filter((item) => item.enabled !== false).length
    return json({ saved: body.remove === true ? 'removed' : 'rule', id: rule.id, scope: currentScope })
  }
  if (target.endsWith('/api/dsh-workstyle/preset')) {
    const body = JSON.parse(options.body || '{}')
    mutationCalls.push({ path: 'preset', body })
    if (body.action === 'use') {
      currentScope.activePreset = { id: body.preset, title: body.preset, rules: [], skills: [], templates: [] }
      return json({ used: body.preset, scope: currentScope })
    }
    if (body.action === 'save') {
      const preset = body.preset || {}
      const list = (currentScope.presets || []).filter((item) => item.id !== preset.id)
      list.push({ ...preset })
      currentScope.presets = list
      return json({ saved: preset.id, presets: list })
    }
    if (body.action === 'duplicate') {
      const newId = body.newId || (body.preset + '-copy')
      const list = currentScope.presets || []
      if (presetControl.duplicateExists || list.some((item) => item.id === newId)) {
        return { ok: false, json: async () => ({ error: 'preset already exists: ' + newId }) }
      }
      const source = list.find((item) => item.id === body.preset)
      currentScope.presets = [...list, {
        ...(source || { id: body.preset, rules: [], skills: [], templates: [] }),
        id: newId,
        title: (source ? source.title : body.preset) + ' copy',
      }]
      return json({ saved: newId, from: body.preset })
    }
    if (body.action === 'unblock') {
      currentScope.blockedPresets = (currentScope.blockedPresets || []).filter((entry) => entry.id !== body.preset)
      return json({ restored: body.preset })
    }
    if (body.action === 'delete' || body.action === 'block') {
      if (presetControl.sessions.length && !body.force) {
        const sessions = presetControl.sessions.slice()
        return {
          ok: false,
          json: async () => ({ error: 'preset is in use by session ' + sessions.join(', ') + '; switch preset first', sessions }),
        }
      }
      if (body.action === 'delete' && presetControl.blockedIds.includes(body.preset)) {
        return json({ removed: 'blocked', id: body.preset })
      }
      currentScope.presets = (currentScope.presets || []).filter((item) => item.id !== body.preset)
      return json({ removed: 'local', id: body.preset })
    }
    return json({ saved: body.preset && body.preset.id, presets: [] })
  }
  if (target.endsWith('/api/dsh-workstyle/toggle')) {
    const body = JSON.parse(options.body || '{}')
    mutationCalls.push({ path: 'toggle', body })
    if (body.kind === 'rule') {
      const rule = currentStatus.rules.find((item) => item.id === body.id)
      if (rule) rule.enabled = body.enabled
    } else if (body.kind === 'skill') {
      const skill = currentStatus.skills.find((item) => item.name === body.id)
      if (skill) skill.enabled = body.enabled
    }
    recomputeSummary()
    return json({ kind: body.kind, id: body.id, enabled: body.enabled, status: currentStatus })
  }
  if (target.endsWith('/api/dsh-workstyle/distill')) {
    currentStatus.latestDistill = { generatedAt: '2026-11-08T01:00:00.000Z', file: '/tmp/new-report.json' }
    recomputeSummary()
    return json({ file: '/tmp/new-report.json', status: currentStatus })
  }
  return { ok: false, json: async () => ({}) }
}

/* ------------------------------- boot --------------------------------- */

await import(pathToFileURL(path.join(root, 'client.js')).href)
assert.ok(mod, 'client.js registered a module')
assert.equal(mod.id, 'dsh-workstyle')

let dictionaries = null
let mainRender = null
const slots = {
  inject(_name, fn) { return fn() },
  register(spec, render) {
    if (spec.name === 'main') mainRender = render
    return () => {}
  },
}

const ctx = {
  effect(fn) { return fn() },
  locale: {
    register(ns, dicts) { dictionaries = dicts; return () => {} },
    bind() { return (key) => (dictionaries.zh && dictionaries.zh[key]) || key },
  },
  slots,
}

const api = mod.factory((id) => {
  assert.equal(id, 'react')
  return React
})
api.apply(ctx)
assert.ok(mainRender, 'main slot registered')

/* ----------------------------- renderer ------------------------------- */

function expand(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(expand)
  if (typeof node.type === 'function') return expand(node.type(node.props))
  const children = node.props && node.props.children
  return {
    ...node,
    props: {
      ...node.props,
      children: children === undefined ? undefined : (Array.isArray(children) ? children.map(expand) : expand(children)),
    },
  }
}

function renderPass() {
  cursor = 0
  effectQueue = []
  return expand(mainRender(hostContext))
}

/* What the live host hands the main slot renderer on every render pass. */
const hostContext = {
  cwd: '/tmp/live-cwd',
  sessionId: 'sess-abc',
  sessionIds: ['sess-abc'],
}

async function settle(passes = 8) {
  for (let i = 0; i < passes; i += 1) {
    dirty = false
    const view = renderPass()
    const queued = effectQueue
    effectQueue = []
    for (const fn of queued) await fn()
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (!dirty) return view
  }
  return renderPass()
}

function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  return textOf(node.props && node.props.children)
}

function findHost(node, predicate) {
  if (node === null || node === undefined || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findHost(child, predicate)
      if (hit) return hit
    }
    return null
  }
  if (predicate(node)) return node
  return findHost(node.props && node.props.children, predicate)
}

const button = (view, label) => findHost(view, (node) => node.type === 'button'
  && node.props && textOf(node) === label)
const chip = (view, label) => findHost(view, (node) => node.type === 'button'
  && node.props && textOf(node) === label)
const checkbox = (view, ariaLabel) => findHost(view, (node) => node.type === 'input'
  && node.props && node.props.type === 'checkbox' && node.props['aria-label'] === ariaLabel)
const input = (view, placeholder) => findHost(view, (node) => node.type === 'input'
  && node.props && node.props.placeholder === placeholder)

async function act(fn) {
  fn()
  await new Promise((resolve) => setTimeout(resolve, 0))
  return settle()
}

/* ------------------------------ checks -------------------------------- */

let checks = 0
function ok(condition, label) {
  checks += 1
  assert.ok(condition, label)
  console.log('  ✓ ' + label)
}

let view = await settle()
let text = textOf(view)

ok(text.includes('运行台'), 'default legacy #/run route renders metrics page with the run console')
ok(!!findHost(view, (node) => node.type === 'nav' && node.props && node.props['aria-label']), 'primary navigation is semantic with aria-label')
ok(!!findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/overview'), 'overview link uses a stable route')
ok(text.includes('工作包') && !text.includes('状态轨'), 'pack navigation uses the work-package label')

const metricsLink = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/metrics')
ok(!!metricsLink, 'metrics link uses a stable route')
view = await act(() => metricsLink.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(text.includes('指标与运行'), 'metrics route renders its page')
ok(text.includes('运行台'), 'run console rides the metrics page as its lower section')
const overviewLink = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/overview')
view = await act(() => overviewLink.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(text.includes('概览'), 'navigation returns to the overview page')
const suggestionCard = findHost(view, (node) => node.type === 'a' && node.props
  && node.props.href === '#/distill' && node.props.className === 'dsw-stat-card')
ok(!!suggestionCard, 'overview pending-suggestions stat is a link')
ok(textOf(suggestionCard).includes('待审查建议') && textOf(suggestionCard).includes('1'),
  'pending-suggestions stat shows the pending count')
view = await act(() => suggestionCard.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(text.includes('建议审阅') && text.includes('中文短句'), 'suggestion stat opens the distill review queue')
const metricsBackLink = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/metrics')
view = await act(() => metricsBackLink.props.onClick({ preventDefault() {} }))
text = textOf(view)

/* ---------------------------- v5 environment ---------------------------- */

ok(text.includes('FDE 工程工作方式'), 'header names the active pack and version')

/* the host context reaches every environment fetch */
ok(fetchLog.some((url) => url.includes('/api/dsh-workstyle/scope?cwd=%2Ftmp%2Flive-cwd&session=sess-abc')),
  'environment fetches forward the live host cwd and session id')
ok(fetchLog.some((url) => url.includes('/api/dsh-workstyle/inject?cwd=%2Ftmp%2Flive-cwd&session=sess-abc')),
  'inject preview is fetched for the active context')
ok(fetchLog.some((url) => url.includes('/api/dsh-workstyle/metrics?cwd=%2Ftmp%2Flive-cwd&session=sess-abc')),
  'metrics are fetched for the active context')

/* the status rail answers "what is loaded right now" in one line */
const rail = findHost(view, (node) => node.props && node.props.role === 'status')
ok(!!rail, 'status rail renders')
const railText = textOf(rail)
ok(railText.includes('注入中 4'), 'rail leads with the injected rule count')
ok(railText.includes('全局') && railText.includes('项目 +1') && railText.includes('会话 −1'), 'rail splits global / project / session')
ok(railText.includes('2/3'), 'rail reports enabled/total skills')
ok(railText.includes('fde-delivery'), 'rail names the active preset')
ok(/[0-9a-f]{8}/.test(railText), 'rail shows the injected-text fingerprint')

/* a partial environment failure keeps the last good data and names the route */
failEnv.metrics = true
view = await act(() => button(view, '刷新').props.onClick())
text = textOf(view)
ok(text.includes('环境视图不可用：metrics failed to load'), 'partial environment failure names the failed route')
const metricsRouteLink = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/metrics')
view = await act(() => metricsRouteLink.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(text.includes('先方案率') && text.includes('规则命中'), 'stale metrics stay visible after a failed metrics refresh')
failEnv.metrics = false
const metricsReturnLink = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/metrics')
view = await act(() => metricsReturnLink.props.onClick({ preventDefault() {} }))
view = await act(() => button(view, '刷新').props.onClick())
text = textOf(view)
ok(!text.includes('环境视图不可用'), 'a successful refresh clears the failure banner')

/* to-do bar replaces the four static tiles */
const todoLabels = ['蒸馏建议待审', '规则缺证据', '作用域冲突', '未验证宣称']
ok(todoLabels.every((label) => text.includes(label)), 'to-do bar lists the four actionable counts')
ok(!text.includes('最近蒸馏'), 'the v4 static tiles are gone')

/* first-run onboarding tip */
ok(text.includes('3 分钟上手'), 'first-run tip heading is visible on cold start')
ok(text.includes('注入指纹'), 'tip step 1 points at the fingerprint')
ok(text.includes('新开一个对话'), 'tip step 2 asks for a new chat proof')
const dismiss = button(view, '知道了')
ok(!!dismiss, 'tip has a dismiss button')

/* run page keeps the operational surface compact */
ok(!findHost(view, (node) => node.props && node.props.role === 'tablist'), 'run page has no full tab shell')
ok(!text.includes('规则 > 预设（组合）> 技能 > 模板'), 'run page omits the full preset/rule inventory')
ok(!text.includes('fde-job') && !text.includes('fde-qa'), 'run page omits the full skill inventory')
ok(text.includes('systemPrompt · dsh-workstyle.rules'), 'run page names the real system-prompt section')
ok(/sha256 [0-9a-f]{8}/.test(text), 'run page pins a sha256 fingerprint')
ok(text.includes('渲染函数 renderRules()'), 'run page names the renderer')
ok(text.includes('## 工作方式'), 'run page renders the actual injected markdown')
ok(text.includes('规则正文-先方案'), 'run page shows rule text as sent, not a summary')
ok(text.includes('来源：包 3 · 项目 +1 · 会话 −1'), 'run page explains where the text came from')

const todoLinks = ['#/distill', '#/pack/fde-engineering', '#/metrics']
for (const href of todoLinks) {
  ok(!!findHost(view, (node) => node.type === 'a' && node.props && node.props.href === href), 'to-do bar links to ' + href)
}
const evidenceTodo = findHost(view, (node) => node.type === 'a' && node.props
  && node.props.href === '#/pack/fde-engineering' && textOf(node).includes('规则缺证据'))
ok(!!evidenceTodo, 'evidence to-do is a semantic route link')
ok(!evidenceTodo.props.role, 'todo links keep native anchor semantics (no listitem role)')

const quickPreset = findHost(view, (node) => node.type === 'button' && node.props && textOf(node).includes('写书'))
ok(!!quickPreset, 'run page exposes a quick preset switch')
view = await act(() => quickPreset.props.onClick())
ok(fetchLog.some((url) => url.endsWith('/api/dsh-workstyle/preset')), 'quick preset switch calls the host preset action')

/* injection failure keeps the last successful proof visible and offers retry */
failEnv.inject = true
view = await act(() => button(view, '刷新').props.onClick())
text = textOf(view)
ok(text.includes('环境视图不可用：inject failed to load'), 'inject failure names the failed route')
ok(/sha256 [0-9a-f]{8}/.test(text), 'inject failure keeps the previous fingerprint visible')
const retry = findHost(view, (node) => node.type === 'button' && textOf(node) === '刷新')
ok(!!retry, 'environment failure exposes a retry button')
failEnv.inject = false
view = await act(() => retry.props.onClick())
text = textOf(view)
ok(!text.includes('环境视图不可用：inject failed to load'), 'retry clears the inject failure')

const rootHost = findHost(view, (node) => node.props && node.props.id === 'dsw-root')
ok(!!rootHost, 'panel root carries the dsw-root style scope')
const styleHost = findHost(view, (node) => node.type === 'style' && textOf(node).includes('#dsw-root'))
ok(!!styleHost, 'scoped stylesheet mounts with the panel')
ok(textOf(styleHost).includes('prefers-reduced-motion: reduce'), 'reduced-motion CSS remains scoped')
ok(textOf(styleHost).includes('a:focus-visible'), 'scoped stylesheet styles link focus')
const runRefresh = findHost(view, (node) => node.type === 'button' && textOf(node) === '刷新')
ok(!!runRefresh, 'refresh remains a keyboard reachable button')

/* dedicated routes keep the deep inventories the run page omits */
const packsTodoLink = findHost(view, (node) => node.type === 'a' && node.props
  && node.props.href === '#/pack/fde-engineering' && textOf(node).includes('规则缺证据'))
view = await act(() => packsTodoLink.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(text.includes('规则 > 预设（组合）> 技能 > 模板'), 'pack route keeps the four-layer order')
ok(text.includes('FDE 交付') && text.includes('写书') && text.includes('RC 探讨'), 'pack route renders preset cards')
ok(text.includes('新建预设'), 'pack route offers preset creation')
ok(text.includes('项目：只改 docs/'), 'pack route lists the project-layer rule')
ok(text.includes('被覆盖 · 会话'), 'pack route names the session override')
ok(text.includes('紧凑交付'), 'a disabled rule stays visible on the pack route')
ok(text.includes('中文短句') && text.includes('采纳选中'), 'review queue and adopt action live on the pack route')
ok(!!checkbox(view, '先方案后实现'), 'rule toggles live on the pack route')

const projectOnlyToggle = checkbox(view, '项目：只改 docs/')
view = await act(() => projectOnlyToggle.props.onChange({ target: { checked: false } }))
const projectToggleCall = mutationCalls.at(-1)
ok(projectToggleCall && projectToggleCall.path === 'scope' && projectToggleCall.body.layer === 'project', 'project-only rule toggle writes the project scope')
ok(projectToggleCall && projectToggleCall.body.cwd === '/tmp/live-cwd', 'project-only toggle uses the current project cwd')
ok(!mutationCalls.some((entry) => entry.path === 'toggle' && entry.body.id === 'project-docs-only'), 'project-only toggle never calls the pack toggle route')

const shadowedProjectToggle = checkbox(view, '项目覆盖：先方案后实现')
view = await act(() => shadowedProjectToggle.props.onChange({ target: { checked: false } }))
const shadowedToggleCall = mutationCalls.at(-1)
ok(shadowedToggleCall && shadowedToggleCall.path === 'scope' && shadowedToggleCall.body.layer === 'project', 'shadowed project rule toggle writes the project scope')
ok(!mutationCalls.some((entry) => entry.path === 'toggle' && entry.body.id === 'plan-first'), 'shadowed project toggle never mutates the pack layer')

view = await act(() => button(view, '查看已处理').props.onClick())
text = textOf(view)
ok(text.includes('先列风险') && text.includes('蒸馏采纳'), 'expanding handled suggestions marks adopted rules')

view = await act(() => button(view, '新建规则').props.onClick())
text = textOf(view)
ok(text.includes('规则 id') && text.includes('正文'), 'rule editor opens on the pack route')
view = await act(() => button(view, '取消').props.onClick())
ok(!textOf(view).includes('规则 id'), 'rule editor closes on cancel')

/* the metrics route owns the metric cards and their source sub-tab */
const metricsNav = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/metrics')
view = await act(() => metricsNav.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(text.includes('规则命中') && text.includes('先方案率') && text.includes('验证率') && text.includes('蒸馏覆盖'),
  'metrics route renders four metrics')
ok(text.includes('815 / 20056'), 'metric card prints the working, not just the number')
ok(text.includes('不能说明模型是否遵守规则'), 'metrics state the proxy caveat')
ok(!text.includes('遵守率') && !text.includes('违反率'), 'no compliance or violation metric is invented')
const sourcesTab = findHost(view, (node) => node.type === 'button' && node.props && textOf(node) === '来源')
ok(!!sourcesTab, 'metrics route exposes the sources sub-tab')
view = await act(() => sourcesTab.props.onClick())
text = textOf(view)
ok(text.includes('✗'), 'sources sub-tab marks unavailable sources')
ok(!text.includes('规则命中'), 'metric cards give way to the source list')
const metricsSubTab = findHost(view, (node) => node.type === 'button' && node.props && textOf(node) === '度量')
ok(!!metricsSubTab, 'metrics sub-tab is reachable again')
view = await act(() => metricsSubTab.props.onClick())
text = textOf(view)
ok(text.includes('规则命中'), 'metric cards return after switching back')

/* the distill route owns the distill action */
const distillNav = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/distill')
view = await act(() => distillNav.props.onClick({ preventDefault() {} }))
view = await act(() => button(view, '蒸馏证据').props.onClick())
ok(textOf(view).includes('蒸馏完成'), 'distill route reports completion')

/* the distribute route owns exports and the install command */
const distributeNav = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/distribute')
view = await act(() => distributeNav.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(text.includes('导出包 + 作用域快照') && text.includes('导出包（仅包）'), 'distribute route offers both exports')
ok(text.includes('最近导出') && text.includes('fde-engineering-v0.1.0-2026-11-08T01-00-00-000Z.tar.gz'), 'distribute route renders export history metadata')
ok(/12,?345 bytes/.test(text) && text.includes('fde-engineering v0.1.0'), 'export history shows size and pack version')
view = await act(() => button(view, '复制安装命令').props.onClick())
text = textOf(view)
ok(text.includes('已复制：dsh plugin add dsh-workstyle'), 'copy install command reports success')
view = await act(() => button(view, '导出包 + 作用域快照').props.onClick())
ok(exportCalls.some((body) => body.withProject === true && body.cwd === '/tmp/live-cwd'), 'scoped export sends cwd and withProject=true')
ok(/4,?567 bytes/.test(textOf(view)) && !!button(view, '复制路径'), 'successful export shows archive metadata and copy path')
view = await act(() => button(view, '导出包（仅包）').props.onClick())
ok(exportCalls.some((body) => body.withProject === false), 'pack-only export sends withProject=false')
exportControl.fail = true
view = await act(() => button(view, '导出包 + 作用域快照').props.onClick())
text = textOf(view)
ok(text.includes('export rejected'), 'export failure is visible')
ok(button(view, '导出包 + 作用域快照') && !button(view, '导出包 + 作用域快照').props.disabled, 'failed export keeps the selected action available for retry')
exportControl.fail = false

/* Fix round 2: export in-flight state is dedicated — finishing another action
   (here a failed header-pack apply) must not clear it, and the sibling export
   stays disabled so exports cannot overlap. */
exportControl.delayed = true
view = await act(() => button(view, '导出包（仅包）').props.onClick())
const inFlightExport = button(view, '导出中…')
ok(inFlightExport && inFlightExport.props.disabled === true, 'export button disables while an export is in flight')
const siblingExport = button(view, '导出包 + 作用域快照')
ok(siblingExport && siblingExport.props.disabled === true, 'sibling export stays disabled so exports cannot overlap')
const headerSelect = findHost(view, (node) => node.type === 'select' && node.props && node.props.onChange)
ok(!!headerSelect, 'header pack select remains reachable during an export')
view = await act(() => headerSelect.props.onChange({ target: { value: 'minimal' } }))
const stillInFlight = button(view, '导出中…')
ok(stillInFlight && stillInFlight.props.disabled === true, 'switching the header pack cannot clear the export in-flight state')
exportControl.delayed = false
view = await act(() => exportControl.pending.shift()())
const reEnabledExport = button(view, '导出包（仅包）')
ok(reEnabledExport && reEnabledExport.props.disabled !== true, 'export actions re-enable after the export resolves')
ok(/4,?567 bytes/.test(textOf(view)), 'resolved export still reports its archive metadata')

/* Fix round 2: a failed history refresh is not an export failure — the
   success result and the previous history rows stay visible, with no error. */
exportControl.failHistory = true
view = await act(() => button(view, '导出包（仅包）').props.onClick())
text = textOf(view)
ok(/4,?567 bytes/.test(text) && !!button(view, '复制路径'), 'export success keeps its result when the history refresh fails')
ok(!text.includes('export rejected') && !text.includes('export failed'), 'history refresh failure does not surface as an export error')
ok(text.includes('最近导出') && text.includes('fde-engineering-v0.1.0-2026-11-08T01-00-00-000Z.tar.gz'), 'history keeps the previous metadata when its refresh fails')
exportControl.failHistory = false

/* Fix round 3: the in-flight guard must be synchronous — state updates are
   async, so two onClicks in the same tick before a rerender must yield one
   POST, not two. */
const syncDoubleBefore = exportCalls.length
const syncPackOnly = button(view, '导出包（仅包）')
const syncScoped = button(view, '导出包 + 作用域快照')
view = await act(() => {
  syncPackOnly.props.onClick()
  syncScoped.props.onClick()
})
ok(exportCalls.length === syncDoubleBefore + 1, 'a synchronous second export cannot start before rerender')
ok(!button(view, '导出中…') && /4,?567 bytes/.test(textOf(view)), 'the double invocation resolves to a single export result')

/* Context transition regression: stale A scope remains visible while B loads,
   but project mutations and scoped exports must wait for B's identity. */
const ruleCallsBeforeTransition = mutationCalls.length
const exportsBeforeTransition = exportCalls.length
hostContext.cwd = '/tmp/project-b'
hostContext.sessionId = 'sess-b'
envControl.delayed = true
view = renderPass()
await settle(1)
const packsDuringTransition = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/overview')
view = await act(() => packsDuringTransition.props.onClick({ preventDefault() {} }))
const overviewSwitcher = button(view, '切换包 ▾')
ok(!!overviewSwitcher, 'overview header offers the pack switcher')
view = await act(() => overviewSwitcher.props.onClick())
const packDetailDuringTransition = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/pack/fde-engineering')
view = await act(() => packDetailDuringTransition.props.onClick({ preventDefault() {} }))
const newRuleButton = button(view, '新建规则')
ok(!!newRuleButton, 'project editor remains mounted during a context transition')
view = await act(() => newRuleButton.props.onClick())
const idField = input(view, 'my-project-rule')
const titleField = input(view, '标题')
const textField = findHost(view, (node) => node.type === 'textarea' && node.props && node.props.placeholder === '正文')
idField.props.onChange({ target: { value: 'b-rule' } })
titleField.props.onChange({ target: { value: 'B rule' } })
textField.props.onChange({ target: { value: 'B text' } })
view = await act(() => button(view, '保存').props.onClick())
ok(mutationCalls.length === ruleCallsBeforeTransition, 'project save is blocked while the new context is loading')
ok(textOf(view).includes('环境正在加载'), 'blocked project save reports a retryable context-loading error')
const distributeDuringTransition = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/distribute')
view = await act(() => distributeDuringTransition.props.onClick({ preventDefault() {} }))
const scopedDuringTransition = button(view, '导出包 + 作用域快照')
view = await act(() => scopedDuringTransition.props.onClick())
ok(exportCalls.length === exportsBeforeTransition, 'scoped export is blocked while the new context is loading')
ok(textOf(view).includes('环境正在加载'), 'blocked scoped export reports a retryable context-loading error')
envControl.delayed = false
while (envControl.pending.length) await act(() => envControl.pending.shift()())
view = await settle()
view = await act(() => button(view, '刷新').props.onClick())
const bPacksLink = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/overview')
view = await act(() => bPacksLink.props.onClick({ preventDefault() {} }))
const bSwitcher = button(view, '切换包 ▾')
view = await act(() => bSwitcher.props.onClick())
const bRuleButton = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/pack/fde-engineering')
view = await act(() => bRuleButton.props.onClick({ preventDefault() {} }))
view = await act(() => button(view, '新建规则').props.onClick())
const bIdField = input(view, 'my-project-rule')
const bTitleField = input(view, '标题')
const bTextField = findHost(view, (node) => node.type === 'textarea' && node.props && node.props.placeholder === '正文')
view = await act(() => bIdField.props.onChange({ target: { value: 'b-rule' } }))
view = await act(() => input(view, '标题').props.onChange({ target: { value: 'B rule' } }))
view = await act(() => findHost(view, (node) => node.type === 'textarea' && node.props && node.props.placeholder === '正文').props.onChange({ target: { value: 'B text' } }))
view = await act(() => button(view, '保存').props.onClick())
const bRuleCall = mutationCalls.at(-1)
ok(bRuleCall && bRuleCall.path === 'rule' && bRuleCall.body.cwd === '/tmp/project-b', 'project save uses the loaded B context after transition')

ok(text.includes('home v5'), 'footer exposes the v5 build marker')
ok(!text.includes('面向工程交付'), 'pack marketing description removed')

/* returning to run keeps the compact surface */
const runNav = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/metrics')
view = await act(() => runNav.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(!text.includes('规则 > 预设（组合）> 技能 > 模板'), 'rule inventory stays off the run page')
view = await act(() => button(view, '展开全文').props.onClick())
text = textOf(view)
ok(text.includes('收起全文'), 'inject block can expand to the full text')

/* refresh keeps the environment */
view = await act(() => button(view, '刷新').props.onClick())
ok(textOf(view).includes('注入中'), 'refresh keeps the status rail')

/* all handled folds into the review header on the pack route */
currentStatus.suggestions[0].adopted = true
currentStatus.suggestions[1].adopted = true
recomputeSummary()
view = await act(() => button(view, '刷新').props.onClick())
const packsNav = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/overview')
view = await act(() => packsNav.props.onClick({ preventDefault() {} }))
const packsSwitcher = button(view, '切换包 ▾')
view = await act(() => packsSwitcher.props.onClick())
const packListLink = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/pack/fde-engineering')
ok(!!packListLink, 'packs route lists installed packs')
view = await act(() => packListLink.props.onClick({ preventDefault() {} }))
const collapseAgain = button(view, '收起已处理')
if (collapseAgain) view = await act(() => collapseAgain.props.onClick())
text = textOf(view)
ok(text.includes('已全部处理') && text.includes('查看已处理'), 'all-handled review folds into the header')
ok(!text.includes('建议正文-短句'), 'all-handled review does not repeat the body rows')

/* dismiss the first-run tip and confirm it stays gone (tip lives on run) */
const runNavAgain = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/metrics')
view = await act(() => runNavAgain.props.onClick({ preventDefault() {} }))
const tipDismiss = button(view, '知道了')
ok(!!tipDismiss, 'tip dismiss button still available before close')
view = await act(() => tipDismiss.props.onClick())
text = textOf(view)
ok(!text.includes('3 分钟上手'), 'dismissing the tip hides it')
ok(memoryStore['dsw-workstyle:onboarding-v1'] === 'done', 'dismiss writes onboarding-v1=done')

/* remount with storage already done */
stateStore.length = 0
effectRan.length = 0
view = await settle()
text = textOf(view)
ok(!text.includes('3 分钟上手'), 'tip stays hidden after remount when storage says done')

/* Reset hook state for a fresh mount from other suites: hooks re-run with
   their initial values, refs keep their current values. */
function remount() {
  stateStore.length = 0
  effectRan.length = 0
}

/* --- semantic tokens (Notion refresh) --- */
const src = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
const tokenDef = src.match(/const TOKENS = \{[\s\S]*?\n\}/)
assert.ok(tokenDef, 'TOKENS map must exist in client.js')
for (const key of ['bg','surface','sel','border','ink','ink2','ink3','accent','danger','ok']) {
  assert.ok(tokenDef[0].includes(key), 'token missing: ' + key)
}
const legacyOutside = src.replace(tokenDef[0], '')
for (const hex of ['#14171C','#F4F0E8','#FBF9F5','#E3A660','#95550F','#47739A','#A44A3F']) {
  assert.ok(!legacyOutside.includes(hex), 'legacy color leaked outside TOKENS: ' + hex)
}
console.log('  ✓ semantic TOKENS layer replaces legacy colors')

// --- shared state components ---
assert.ok(/function Card\(/.test(src), 'Card component missing')
assert.ok(/function Chip\(/.test(src), 'Chip component missing')
const emptyStateBody = src.match(/function EmptyState\([\s\S]*?\n    \}/)?.[0] || ''
assert.ok(emptyStateBody.includes("scopedT('emptyPrefix')") && emptyStateBody.includes("scopedT('emptySuffix')") && emptyStateBody.includes("scopedT('emptyOr')"), 'EmptyState must render connectors via i18n keys, no hardcoded Chinese')
assert.ok(!/[\u4e00-\u9fff]/.test(emptyStateBody), 'EmptyState must not hardcode Chinese literals')
console.log('  ✓ shared state components (Card / Chip / EmptyState)')

// --- overview page ---
const overview = src.match(/route\.page === 'overview'[\s\S]*?(?=\n      : )/)
assert.ok(overview && /切换包|t\('packSwitch'\)/.test(overview[0]), 'overview pack switcher missing')
assert.ok(overview && (overview[0].match(/Card\(/g) || []).length >= 3, 'overview needs >=3 stat cards')

// --- rules page ---
assert.ok(/scopeFilter/.test(src), 'scopeFilter state missing')
const rulesCase = src.match(/route\.page === 'rules'[\s\S]*?(?=\n\s+: route\.page === 'presets')/)
assert.ok(rulesCase && /EmptyState\(/.test(rulesCase[0]), 'rules empty state missing')
assert.ok(rulesCase && /Chip\(/.test(rulesCase[0]), 'rules scope chips missing')
assert.ok(rulesCase && /setScopeFilter\(/.test(rulesCase[0]), 'rules scope chips must drive scopeFilter')

// --- standalone presets & skills pages ---
assert.ok(/route\.page === 'presets'/.test(src), 'presets route missing')
assert.ok(/route\.page === 'skills'/.test(src), 'skills route missing')
const presetsCase = src.match(/route\.page === 'presets'[\s\S]*?(?=\n\s+: route\.page === 'skills')/)
assert.ok(presetsCase && /presetNew/.test(presetsCase[0]), 'presets page header must offer the new-preset action')
assert.ok(presetsCase && /presetsBody/.test(presetsCase[0]) && /S\.presetGrid/.test(src), 'presets page must render the preset card grid')
const skillsCase = src.match(/route\.page === 'skills'[\s\S]*?(?=\n\s+: route\.page === 'distill')/)
assert.ok(skillsCase && /skillsBody/.test(skillsCase[0]) && /skillsUnit/.test(skillsCase[0]), 'skills page must render the skill list with a count')
assert.ok(/S\.skillName/.test(src) && /T\.ink/.test(src.match(/skillName: \{[^}]*\}/)[0]) && /WebkitLineClamp: 2/.test(src.match(/skillDesc: \{[^}]*\}/)[0]), 'skill rows must be doc-list styled (600/T.ink name, T.ink2 two-line desc)')
console.log('  ✓ standalone presets & skills pages')

// --- distill / metrics / distribute reskin ---
assert.ok(!/route\.page === 'run'/.test(src), 'standalone run page must be merged into metrics')
const metricsCase = src.match(/route\.page === 'metrics'[\s\S]*?(?=\n\s+: h\('section', \{ 'aria-labelledby': 'dsw-distribute-title')/)
assert.ok(metricsCase && /dsw-run/.test(metricsCase[0]), 'metrics page must carry the run console section')
console.log('  ✓ distill / metrics / distribute pages reskinned (run merged into metrics)')

// --- sidebar IA ---
assert.ok(/const NAV_GROUPS = \[/.test(src), 'NAV_GROUPS missing')
assert.ok(/function Sidebar\(/.test(src), 'Sidebar component missing')
assert.ok(src.includes("'run': 'metrics'") || src.includes("run: 'metrics'"), 'legacy run→metrics alias missing')
assert.ok(src.includes('overview'), 'overview route missing')
console.log('  ✓ sidebar IA (NAV_GROUPS / Sidebar / legacy route aliases)')

/* --- rules page behavior: empty data renders the EmptyState copy --- */
{
  const originalScopeRules = currentScope.rules
  const originalScopeCounts = currentScope.counts
  currentScope.rules = []
  currentScope.counts = { injected: 0, total: 0, project: 0, disabled: 0, skills: 0, skillTotal: 3 }
  try {
    // Load the emptied payload through the panel's own refresh path.
    await act(() => button(view, '刷新').props.onClick())
    route.hash = '#/rules'
    hashChange()
    const rulesView = await settle(10)
    const rulesText = textOf(rulesView)
    assert.ok(rulesText.includes('暂无'), 'rules page with empty data must render 「暂无」via EmptyState')
    assert.ok(rulesText.includes('+ 新规则'), 'rules empty state must offer the new-rule action')
    console.log('  ✓ rules page empty data renders EmptyState (暂无 / + 新规则)')
  } finally {
    currentScope.rules = originalScopeRules
    currentScope.counts = originalScopeCounts
    route.hash = '#/run'
    hashChange()
    await act(() => button(view, '刷新').props.onClick())
  }
}

/* --- Task 9: rules page edit / remove / restore across write scopes --- */
{
  const originalRules = currentScope.rules
  const originalProjectRules = currentScope.project.rules
  const originalPreset = currentScope.activePreset
  const overlayTarget = { scope: 'overlay', packId: 'fde-engineering', file: '/tmp/state/overrides.json' }
  const packTarget = { scope: 'pack', packId: 'fde-engineering', file: '/tmp/dsh-workstyle/pack/workstyle.json' }
  const fixtures = [
    { id: 'owned-overlay', title: '覆盖层规则', text: '覆盖层正文', severity: 'low', origin: 'distilled', textScope: 'workspace', enabled: true, writable: overlayTarget },
    { id: 'owned-pack', title: '包内规则', text: '包正文', severity: 'low', origin: 'pack', textScope: 'workspace', enabled: true, writable: packTarget },
    { id: 'tombstone', title: '墓碑规则', text: '墓碑正文', severity: 'low', origin: 'pack', textScope: 'workspace', removed: true, enabled: false, writable: overlayTarget },
    { id: 'outside', title: '预设外规则', text: '预设外正文', severity: 'low', origin: 'pack', textScope: 'workspace', enabled: false, outsidePreset: 'writing', writable: packTarget },
    { id: 'yaml-only', title: 'YAML 包规则', text: 'YAML 正文', severity: 'low', origin: 'pack', textScope: 'workspace', enabled: true, writable: { scope: 'pack', packId: 'fde-engineering', file: null } },
  ]
  const rowOf = (v, title) => findHost(v, (node) => node.type === 'div'
    && node.props && node.props.className === 'dsw-row' && textOf(node).includes(title))
  const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected)
  const callsSince = (path, since) => mutationCalls.slice(since).filter((call) => call.path === path)
  const goRules = async () => {
    route.hash = '#/rules'
    if (hashChange) hashChange()
    return settle(12)
  }
  const freshRules = async () => {
    currentScope.rules = originalRules.concat(fixtures.map((rule) => ({ ...rule })))
    view = await act(() => button(view, '刷新').props.onClick())
    return goRules()
  }
  try {
    // An earlier preset-switch test emptied the active preset; give it a
    // stable membership so the append assertion has something to keep.
    currentScope.activePreset = { id: 'fde-delivery', title: 'FDE 交付', description: '工程交付', rules: ['plan-first', 'verify-first'], skills: [], templates: [] }
    view = await freshRules()
    const tombRow = rowOf(view, '墓碑规则')
    ok(!!tombRow, 'rules page still lists a removed rule')
    ok(!!findHost(tombRow, (node) => node.type === 'span' && textOf(node) === '已移除'), 'removed rule carries the 已移除 chip')
    ok(!!button(tombRow, '恢复'), 'removed rule offers 恢复')
    ok(!button(tombRow, '移除'), 'removed rule hides 移除')

    const outsideRow = rowOf(view, '预设外规则')
    ok(!!findHost(outsideRow, (node) => node.type === 'span' && textOf(node) === '不在当前预设 · writing'), 'outside-preset rule names the preset it is missing from')
    ok(!!button(outsideRow, '加入当前预设'), 'outside-preset rule offers 加入当前预设')

    let since = mutationCalls.length
    view = await act(() => button(outsideRow, '加入当前预设').props.onClick())
    let calls = callsSince('preset', since)
    ok(calls.length === 1 && calls[0].body.action === 'save' && calls[0].body.packId === 'fde-engineering', '加入当前预设 saves the composed preset for the active pack')
    ok(calls.length === 1 && same(calls[0].body.preset.rules, ['plan-first', 'verify-first', 'outside']), '加入当前预设 keeps members and appends the rule')

    view = await freshRules()
    view = await act(() => button(rowOf(view, '覆盖层规则'), '编辑').props.onClick())
    ok(textOf(view).includes('将写入') && textOf(view).includes('本机覆盖层'), 'editor names the overlay as the write target')
    since = mutationCalls.length
    view = await act(() => button(view, '保存').props.onClick())
    calls = callsSince('rule', since)
    ok(calls.length === 1 && same(calls[0].body, { target: 'overlay', packId: 'fde-engineering', rule: { id: 'owned-overlay', title: '覆盖层规则', text: '覆盖层正文' } }), 'editor save posts the overlay target')

    view = await freshRules()
    view = await act(() => button(rowOf(view, '包内规则'), '编辑').props.onClick())
    ok(textOf(view).includes('将写入') && textOf(view).includes('包文件'), 'editor names the pack file as the write target')
    since = mutationCalls.length
    view = await act(() => button(view, '保存').props.onClick())
    calls = callsSince('rule', since)
    ok(calls.length === 1 && same(calls[0].body, { target: 'pack', packId: 'fde-engineering', rule: { id: 'owned-pack', title: '包内规则', text: '包正文' } }), 'editor save posts the pack target')

    view = await freshRules()
    view = await act(() => button(rowOf(view, 'YAML 包规则'), '编辑').props.onClick())
    const saveButton = button(view, '保存')
    ok(!!saveButton && saveButton.props.disabled === true, 'editor disables Save when the write target has no file')
    ok(textOf(view).includes('workstyle.yaml'), 'editor explains the YAML-only write target')
    view = await act(() => button(view, '取消').props.onClick())

    view = await freshRules()
    since = mutationCalls.length
    view = await act(() => button(rowOf(view, '包内规则'), '移除').props.onClick())
    calls = callsSince('rule', since)
    ok(calls.length === 1 && same(calls[0].body, { target: 'pack', packId: 'fde-engineering', rule: { id: 'owned-pack' }, remove: true }), 'pack-owned removal posts the pack target')

    view = await freshRules()
    since = mutationCalls.length
    view = await act(() => button(rowOf(view, '覆盖层规则'), '移除').props.onClick())
    calls = callsSince('rule', since)
    ok(calls.length === 1 && same(calls[0].body, { target: 'overlay', packId: 'fde-engineering', rule: { id: 'owned-overlay' }, remove: true }), 'overlay-owned removal posts the overlay target')

    view = await freshRules()
    since = mutationCalls.length
    view = await act(() => button(rowOf(view, '项目：只改 docs/'), '移除').props.onClick())
    calls = callsSince('rule', since)
    ok(calls.length === 1 && same(calls[0].body, { cwd: '/tmp/project-b', rule: { id: 'project-docs-only' }, remove: true }), 'project rule removal keeps the cwd form')

    view = await freshRules()
    since = mutationCalls.length
    view = await act(() => button(rowOf(view, '墓碑规则'), '恢复').props.onClick())
    calls = callsSince('rule', since)
    ok(calls.length === 1 && same(calls[0].body, { target: 'overlay', packId: 'fde-engineering', rule: { id: 'tombstone' }, action: 'restore' }), '恢复 posts the restore action to the original scope')

    view = await freshRules()
    route.hash = '#/pack/fde-engineering'
    if (hashChange) hashChange()
    view = await settle(12)
    view = await act(() => button(rowOf(view, '覆盖层规则'), '编辑').props.onClick())
    ok(textOf(view).includes('将写入') && textOf(view).includes('本机覆盖层'), 'pack detail edit carries the row write scope')
    console.log('  ✓ rules page edit / remove / restore across scopes')
  } finally {
    // The last check left an editor open; close it so later suites mount clean.
    const cancel = button(view, '取消')
    if (cancel) view = await act(() => cancel.props.onClick())
    currentScope.rules = originalRules
    currentScope.project.rules = originalProjectRules
    currentScope.activePreset = originalPreset
    route.hash = '#/run'
    if (hashChange) hashChange()
    view = await act(() => button(view, '刷新').props.onClick())
  }
}

/* --- pack detail reskin + locale coverage (Task 8) --- */
assert.ok(!/S\.tile\b|S\.tileSub\b|dsw-tile-click|noMetricsYet/.test(src), 'dead tile styles/refs must be removed from client.js')
const packCase = src.match(/const packDetailPageBody[\s\S]*?\n\n      const DistributionPage/)
assert.ok(packCase, 'packDetailPageBody block missing')
assert.ok(!/S\.tile/.test(packCase[0]), 'pack detail page must not use the tile style')
assert.ok(/S\.sectionHead/.test(packCase[0]) && /S\.sectionLabel/.test(packCase[0]), 'pack detail header must use the sectionHead block style')

// --- locale coverage ---
// The zh/en dictionaries are registered inline via ctx.locale.register and
// captured above; the scan matches the brief's t() key extraction verbatim.
const zh = dictionaries.zh
const en = dictionaries.en
assert.ok(zh && en, 'zh/en dictionaries must be registered')
const used = [...src.matchAll(/t\('([a-zA-Z0-9]+)'\)/g)].map(m => m[1])
const missing = [...new Set(used)].filter(k => !(k in zh))
assert.deepEqual(missing, [], 'missing locale keys: ' + missing.join(','))
const missingEn = [...new Set(used)].filter(k => !(k in en))
assert.deepEqual(missingEn, [], 'missing en locale keys: ' + missingEn.join(','))
const zhOnly = Object.keys(zh).filter(k => !(k in en))
const enOnly = Object.keys(en).filter(k => !(k in zh))
assert.deepEqual(zhOnly.concat(enOnly), [], 'zh/en dictionaries must have identical key sets: ' + zhOnly.concat(enOnly).join(','))
console.log('  ✓ pack detail reskin + full locale coverage (' + new Set(used).size + ' t() keys covered in zh/en)')

/* --- Task 10: preset editor with delete / block / duplicate --- */
{
  const originalPresets = currentScope.presets
  const originalBlocked = currentScope.blockedPresets
  const originalActivePreset = currentScope.activePreset
  const presetFixtures = () => ([
    { id: 'fde-delivery', title: 'FDE 交付', description: '工程交付：先方案、证据优先。', rules: ['plan-first', 'verify-first'], skills: ['fde-job', 'fde-inspector'], templates: ['tpl-a'], builtin: true },
    { id: 'writing', title: '写书', description: '书稿审计与润色。', rules: ['evidence-first'], skills: [], templates: [], builtin: true },
    { id: 'rc', title: 'RC 探讨', description: '先给判断再给建议。', rules: [], skills: [], templates: [], builtin: true },
  ])
  const resetPresets = async (blocked) => {
    currentScope.presets = presetFixtures()
    currentScope.blockedPresets = blocked || []
    view = await act(() => button(view, '刷新').props.onClick())
    route.hash = '#/presets'
    if (hashChange) hashChange()
    return settle(12)
  }
  const presetCalls = (from) => mutationCalls.slice(from).filter((call) => call.path === 'preset')
  const cardOf = (v, id) => findHost(v, (node) => node.type === 'div'
    && node.props && node.props['data-preset'] === id)
  const testId = (v, id) => findHost(v, (node) => node.props && node.props['data-testid'] === id)
  try {
    presetControl.sessions = []
    presetControl.blockedIds = []
    presetControl.duplicateExists = false
    view = await resetPresets()
    ok(!!cardOf(view, 'fde-delivery') && !!cardOf(view, 'writing'), 'presets page renders one card per preset')

    /* Opening the editor is a local action: nothing may be written yet. */
    let since = mutationCalls.length
    view = await act(() => button(view, '+ 新建预设').props.onClick())
    ok(presetCalls(since).length === 0, 'opening the preset editor posts nothing')
    ok(!!input(view, 'my-preset'), 'new-preset editor renders the identifier field')
    ok(textOf(view).includes('只有勾选的规则会被注入'), 'preset editor explains that rules are a whitelist')

    view = await act(() => input(view, 'my-preset').props.onChange({ target: { value: 'my-slice' } }))
    view = await act(() => input(view, '标题').props.onChange({ target: { value: '我的切片' } }))
    since = mutationCalls.length
    view = await act(() => button(view, '保存').props.onClick())
    let calls = presetCalls(since)
    ok(calls.length === 1 && calls[0].body.action === 'save' && calls[0].body.target === 'overlay'
      && calls[0].body.packId === 'fde-engineering', 'preset save posts the overlay target for the active pack')
    ok(calls.length === 1 && calls[0].body.preset.id === 'my-slice' && calls[0].body.preset.title === '我的切片'
      && Array.isArray(calls[0].body.preset.rules), 'preset save carries the drafted id, title and whitelist')

    /* Editing an existing preset locks the id and keeps its membership. */
    view = await resetPresets()
    view = await act(() => button(cardOf(view, 'fde-delivery'), '编辑').props.onClick())
    const lockedId = input(view, 'my-preset')
    ok(!!lockedId && lockedId.props.disabled === true, 'an existing preset id is not editable')
    view = await act(() => input(view, '标题').props.onChange({ target: { value: 'FDE 交付 v2' } }))
    since = mutationCalls.length
    view = await act(() => button(view, '保存').props.onClick())
    calls = presetCalls(since)
    ok(calls.length === 1 && calls[0].body.preset.id === 'fde-delivery' && calls[0].body.preset.title === 'FDE 交付 v2',
      'editing a preset saves under its existing id')
    ok(calls.length === 1 && JSON.stringify(calls[0].body.preset.rules) === JSON.stringify(['plan-first', 'verify-first']),
      'editing keeps the preset rule membership')

    /* Deleting a local preset is a plain delete, not a block. */
    view = await resetPresets()
    since = mutationCalls.length
    view = await act(() => button(cardOf(view, 'rc'), '删除').props.onClick())
    calls = presetCalls(since)
    ok(calls.length === 1 && JSON.stringify(calls[0].body) === JSON.stringify({ action: 'delete', preset: 'rc', packId: 'fde-engineering' }),
      'delete posts the preset id and pack id')
    ok(!textOf(view).includes('已屏蔽'), 'a local delete is not reported as a block')

    /* A cross-session refusal names the sessions and asks before forcing. */
    presetControl.sessions = ['sess-a', 'sess-b']
    view = await resetPresets()
    view = await act(() => button(cardOf(view, 'writing'), '删除').props.onClick())
    text = textOf(view)
    ok(text.includes('sess-a') && text.includes('sess-b'), 'an in-use refusal names the sessions holding the preset')
    const forcePanel = testId(view, 'dsw-preset-force')
    ok(!!forcePanel, 'an in-use refusal offers a deliberate override')
    since = mutationCalls.length
    view = await act(() => button(forcePanel, '删除').props.onClick())
    calls = presetCalls(since)
    ok(calls.length === 1 && calls[0].body.force === true && calls[0].body.preset === 'writing',
      'the override re-posts the delete with force=true')
    presetControl.sessions = []

    /* A bundled preset cannot be deleted: the host blocks it instead. */
    presetControl.blockedIds = ['writing']
    view = await resetPresets()
    since = mutationCalls.length
    view = await act(() => button(cardOf(view, 'writing'), '删除').props.onClick())
    ok(presetCalls(since).length === 1 && textOf(view).includes('已屏蔽'),
      'deleting a bundled preset reports a block, not a delete')
    presetControl.blockedIds = []

    /* Duplicate creates <id>-copy and surfaces a conflict verbatim. */
    view = await resetPresets()
    since = mutationCalls.length
    view = await act(() => button(cardOf(view, 'writing'), '复制').props.onClick())
    calls = presetCalls(since)
    ok(calls.length === 1 && calls[0].body.action === 'duplicate' && calls[0].body.newId === 'writing-copy',
      'duplicate posts the <id>-copy identifier')
    presetControl.duplicateExists = true
    view = await resetPresets()
    view = await act(() => button(cardOf(view, 'writing'), '复制').props.onClick())
    ok(textOf(view).includes('preset already exists: writing-copy'), 'duplicate conflict surfaces the host error verbatim')
    presetControl.duplicateExists = false

    /* Blocked presets get their own card and a restore action. */
    view = await resetPresets([{ id: 'rc', packId: 'fde-engineering' }])
    const blockedCard = testId(view, 'dsw-preset-blocked')
    ok(!!blockedCard && textOf(blockedCard).includes('已屏蔽预设') && textOf(blockedCard).includes('rc'),
      'blocked presets render their own card with the id')
    since = mutationCalls.length
    view = await act(() => button(blockedCard, '恢复').props.onClick())
    calls = presetCalls(since)
    ok(calls.length === 1 && calls[0].body.action === 'unblock' && calls[0].body.preset === 'rc',
      'restore posts the unblock action for the blocked id')

    const presetKeys = ['editPreset', 'duplicatePreset', 'deletePreset', 'restorePreset', 'savePreset',
      'presetEditorTitle', 'presetIdLabel', 'presetDescLabel', 'presetWhitelistHint', 'presetDanglingRules',
      'presetIdRequired', 'presetSaved', 'presetDeleted', 'presetDeletedLocal', 'presetBlockedNotice',
      'presetDuplicated', 'presetRestored', 'presetBlockedTitle', 'presetBlockedHint', 'presetForceTitle', 'presetForceBody']
    ok(presetKeys.every((key) => typeof zh[key] === 'string' && zh[key]
      && typeof en[key] === 'string' && en[key] && en[key] !== zh[key]),
      'every new preset key exists in both dictionaries with an English label')
    console.log('  ✓ preset editor / delete / block / duplicate flow')
  } finally {
    presetControl.sessions = []
    presetControl.blockedIds = []
    presetControl.duplicateExists = false
    const cancel = button(view, '取消')
    if (cancel) view = await act(() => cancel.props.onClick())
    currentScope.presets = originalPresets
    currentScope.blockedPresets = originalBlocked
    currentScope.activePreset = originalActivePreset
    route.hash = '#/run'
    if (hashChange) hashChange()
    view = await act(() => button(view, '刷新').props.onClick())
  }
}

console.log('\nPANEL RENDER: ' + checks + ' CHECKS PASSED')

export { route, hashChange, settle, act, remount, textOf, findHost, button, input, checkbox, currentStatus, detailPacks, detailControl, envControl, statusControl, exportControl, exportCalls, hostContext, fetchLog, failEnv }
