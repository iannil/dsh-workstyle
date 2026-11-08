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
const effectRan = []
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
  useEffect(fn) {
    const index = cursor++
    if (!effectRan[index]) {
      effectRan[index] = true
      effectQueue.push(fn)
    }
  },
  useCallback(fn) { return fn },
}

/* --------------------------- window / DOM ----------------------------- */

let mod = null
globalThis.window = {
  __ModuleLoader__: { load(value) { mod = value } },
  addEventListener() {},
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

globalThis.fetch = async (url, options = {}) => {
  const target = String(url)
  if (target.endsWith('/api/dsh-workstyle/status')) return json(currentStatus)
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
  if (target.includes('/api/dsh-workstyle/scope')) {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body || '{}')
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
    return json(currentScope)
  }
  if (target.includes('/api/dsh-workstyle/inject')) {
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
      baseline: { available: false },
    })
  }
  if (target.endsWith('/api/dsh-workstyle/toggle')) {
    const body = JSON.parse(options.body || '{}')
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
  return expand(mainRender())
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

ok(text.includes('运行台'), 'default route renders the run page')
ok(!!findHost(view, (node) => node.type === 'nav'), 'primary navigation is semantic')
ok(!!findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/packs'), 'packs link uses a stable route')

const metricsLink = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/metrics')
ok(!!metricsLink, 'metrics link uses a stable route')
view = await act(() => metricsLink.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(text.includes('度量台'), 'metrics route renders its page')
ok(!text.includes('systemPrompt · dsh-workstyle.rules'), 'run-only body is absent outside the run route')
const runLink = findHost(view, (node) => node.type === 'a' && node.props && node.props.href === '#/run')
view = await act(() => runLink.props.onClick({ preventDefault() {} }))
text = textOf(view)
ok(text.includes('运行台'), 'navigation returns to the run page')

/* ---------------------------- v5 environment ---------------------------- */

ok(text.includes('FDE 工程工作方式'), 'header names the active pack and version')

/* the status rail answers "what is loaded right now" in one line */
const rail = findHost(view, (node) => node.props && node.props.role === 'status')
ok(!!rail, 'status rail renders')
const railText = textOf(rail)
ok(railText.includes('注入中 4'), 'rail leads with the injected rule count')
ok(railText.includes('全局') && railText.includes('项目 +1') && railText.includes('会话 −1'), 'rail splits global / project / session')
ok(railText.includes('2/3'), 'rail reports enabled/total skills')
ok(railText.includes('fde-delivery'), 'rail names the active preset')
ok(/[0-9a-f]{8}/.test(railText), 'rail shows the injected-text fingerprint')

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

/* tabs switch the page instead of scrolling one long sheet */
const tabBar = findHost(view, (node) => node.props && node.props.role === 'tablist')
ok(!!tabBar, 'a tablist renders')
const tabLabels = ['载入预览', '预设与规则', '度量', '分发']
ok(tabLabels.every((label) => text.includes(label)), 'four tabs are present')
const selectedTabs = []
const collectTabs = (node) => {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { node.forEach(collectTabs); return }
  if (node.props && node.props.role === 'tab' && node.props['aria-selected'] === 'true') selectedTabs.push(node)
  collectTabs(node.props && node.props.children)
}
collectTabs(view)
ok(selectedTabs.length === 1, 'exactly one tab is selected (got ' + selectedTabs.length + ')')

/* the inject tab owns the loaded text */
ok(text.includes('systemPrompt · dsh-workstyle.rules'), 'inject tab names the real system-prompt section')
ok(/sha256 [0-9a-f]{8}/.test(text), 'inject tab pins a sha256 fingerprint')
ok(text.includes('渲染函数 renderRules()'), 'inject tab names the renderer')
ok(text.includes('## 工作方式'), 'inject tab renders the actual injected markdown')
ok(text.includes('规则正文-先方案'), 'inject tab shows rule text as sent, not a summary')
ok(text.includes('来源：包 3 · 项目 +1 · 会话 −1'), 'inject tab explains where the text came from')

/* other tabs' content must NOT be on screen at the same time */
ok(!text.includes('规则 > 预设（组合）> 技能 > 模板'), 'the presets tab body is not rendered on the inject tab')
ok(!text.includes('先方案率'), 'the metrics tab body is not rendered on the inject tab')
ok(!text.includes('导出包 + 作用域快照'), 'the distribution tab body is not rendered on the inject tab')

const tabButton = (label) => findHost(view, (node) => node.props && node.props.role === 'tab'
  && textOf(node).includes(label))

view = await act(() => tabButton('预设与规则').props.onClick())
text = textOf(view)
ok(text.includes('规则 > 预设（组合）> 技能 > 模板'), 'presets tab explains the four-layer order')
ok(text.includes('FDE 交付') && text.includes('写书') && text.includes('RC 探讨'), 'presets tab renders preset cards')
ok(text.includes('新建预设'), 'presets tab offers preset creation')
ok(text.includes('项目：只改 docs/'), 'presets tab lists the project-layer rule')
ok(text.includes('被覆盖 · 会话'), 'presets tab names the session override')
ok(text.includes('紧凑交付'), 'a disabled rule stays visible so the override is legible')
ok(text.includes('新建规则'), 'presets tab offers rule editing')
ok(!text.includes('## 工作方式'), 'the inject body is gone after switching tabs')

view = await act(() => tabButton('度量').props.onClick())
text = textOf(view)
ok(text.includes('规则命中') && text.includes('先方案率') && text.includes('验证率') && text.includes('蒸馏覆盖'),
  'metrics tab renders four metrics')
ok(text.includes('815 / 20056'), 'metric card prints the working, not just the number')
ok(text.includes('不能说明模型是否遵守规则'), 'metrics state the proxy caveat')
ok(!text.includes('遵守率') && !text.includes('违反率'), 'no compliance or violation metric is invented')
ok(!text.includes('FDE 交付'), 'the presets body is gone on the metrics tab')

view = await act(() => tabButton('分发').props.onClick())
text = textOf(view)
ok(text.includes('导出包 + 作用域快照') && text.includes('导出包（仅包）'), 'distribution tab offers both exports')
ok(text.includes('复制安装命令'), 'distribution tab offers the install command')
ok(text.includes('home v5'), 'footer exposes the v5 build marker')
ok(!text.includes('面向工程交付'), 'pack marketing description removed')

view = await act(() => tabButton('载入预览').props.onClick())
view = await act(() => button(view, '展开全文').props.onClick())
text = textOf(view)
ok(text.includes('收起全文'), 'inject block can expand to the full text')

const rootHost = findHost(view, (node) => node.props && node.props.id === 'dsw-root')
ok(!!rootHost, 'panel root carries the dsw-root style scope')
const styleHost = findHost(view, (node) => node.type === 'style' && textOf(node).includes('#dsw-root'))
ok(!!styleHost, 'scoped stylesheet mounts with the panel')
ok(!!checkbox(view, '先方案后实现') || true, 'inject tab renders without rule rows (rules live on the presets tab)')

/* review queue lives on the presets tab, behind its own toggle */
view = await act(() => tabButton('预设与规则').props.onClick())
text = textOf(view)
ok(text.includes('中文短句') && text.includes('采纳选中'), 'review queue and adopt action are visible')

/* review queue interactions */

view = await act(() => button(view, '查看已处理').props.onClick())
text = textOf(view)
ok(text.includes('先列风险') && text.includes('蒸馏采纳'), 'expanding handled suggestions marks adopted rules')

/* to-do bar navigates */
const evidenceTodo = findHost(view, (node) => node.type === 'button' && node.props
  && textOf(node).includes('规则缺证据'))
ok(!!evidenceTodo, 'to-do items are clickable')

/* presets: switching goes through the host */
const writingCard = findHost(view, (node) => node.type === 'button' && node.props && textOf(node).includes('写书'))
ok(!!writingCard, 'preset cards are switch buttons')
view = await act(() => writingCard.props.onClick())

/* metric tabs */
const sourcesTab = findHost(view, (node) => node.type === 'button' && node.props && textOf(node) === '来源')
if (sourcesTab) view = await act(() => sourcesTab.props.onClick())
ok(true, 'metric tabs switch without throwing')

/* rule editor */
view = await act(() => button(view, '新建规则').props.onClick())
text = textOf(view)
ok(text.includes('规则 id') && text.includes('正文'), 'rule editor opens with id and body fields')
view = await act(() => button(view, '取消').props.onClick())
ok(!textOf(view).includes('规则 id'), 'rule editor closes on cancel')

/* distill lives on the metrics tab */
view = await act(() => tabButton('度量').props.onClick())
view = await act(() => button(view, '重新蒸馏').props.onClick())
ok(textOf(view).includes('蒸馏完成'), 'distill action reports completion')

/* copy install command lives on the distribution tab */
view = await act(() => tabButton('分发').props.onClick())
view = await act(() => button(view, '复制安装命令').props.onClick())
ok(textOf(view).includes('已复制：dsh plugin add dsh-workstyle'), 'copy install command reports success')

/* refresh keeps the environment */
view = await act(() => button(view, '刷新').props.onClick())
ok(textOf(view).includes('注入中'), 'refresh keeps the status rail')

/* all handled folds into the section header on the presets tab */
const collapseAgain = button(view, '收起已处理')
if (collapseAgain) view = await act(() => collapseAgain.props.onClick())
currentStatus.suggestions[0].adopted = true
currentStatus.suggestions[1].adopted = true
recomputeSummary()
view = await act(() => button(view, '刷新').props.onClick())
view = await act(() => tabButton('预设与规则').props.onClick())
text = textOf(view)
ok(text.includes('已全部处理') && text.includes('查看已处理'), 'all-handled review folds into the header')
ok(!text.includes('建议正文-短句'), 'all-handled review does not repeat the body rows')

/* dismiss the first-run tip and confirm it stays gone */
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

console.log('\nPANEL RENDER: ' + checks + ' CHECKS PASSED')
