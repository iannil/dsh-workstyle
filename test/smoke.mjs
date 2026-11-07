/**
 * dsh-workstyle smoke test — no harness required.
 *
 * Boots the host half against a mock Cordis context in a throwaway DSH_HOME,
 * then exercises every tool, HTTP route and the slash command, including the
 * P1 distillation review flow (adopt / revoke) and pack export (tar.gz
 * round-trip verified with the system `tar`).
 *
 * Run: ELECTRON_RUN_AS_NODE=1 "<DeepSeek Harness binary>" test/smoke.mjs
 *      (or any Node.js >= 20)
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-smoke-'))
process.env.DSH_HOME = home

const { apply } = await import(path.join(root, 'index.js'))
const { loadPackAt, listSkills } = await import(path.join(root, 'lib/pack.js'))

/* ------------------------------ mock host ------------------------------ */

const registered = {
  tools: new Map(),
  routes: new Map(),
  commands: new Map(),
  sections: new Map(),
  providers: [],
  log: [],
}

const ctx = {
  effect(fn) { return fn() },
  systemPrompt: {
    getSectionOrder() { return 10 },
    section(spec) { registered.sections.set(spec.name, spec); return () => {} },
  },
  skills: {
    registerProvider(factory) {
      registered.providers.push(factory({ invalidate() {} }))
      return () => {}
    },
  },
  tools: { register(tool) { registered.tools.set(tool.name, tool); return () => {} } },
  commands: { register(command) { registered.commands.set(command.name, command); return () => {} } },
  connection: { fetch: { register(route) { registered.routes.set(route.path, route); return () => {} } } },
  inject(services, callback) { callback(ctx) },
}

apply(ctx)

/* ------------------------------ helpers -------------------------------- */

let checks = 0
function ok(condition, label) {
  checks++
  assert.ok(condition, label)
  console.log('  ✓ ' + label)
}

function lossless(value, label) {
  const text = JSON.stringify(value)
  ok(text !== undefined, label + ': serializable')
  const round = JSON.parse(text)
  ok(JSON.stringify(round) === text, label + ': lossless round-trip')
  return round
}

async function callTool(name, args) {
  const tool = registered.tools.get(name)
  assert.ok(tool, 'tool missing: ' + name)
  return tool.execute(args)
}

async function callRoute(routePath, { method = 'GET', body } = {}) {
  const route = registered.routes.get(routePath)
  assert.ok(route, 'route missing: ' + routePath)
  const init = { method, headers: {} }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers['content-type'] = 'application/json'
  }
  const response = await route.fetch(new Request('http://localhost' + routePath, init))
  const text = await response.text()
  return { status: response.status, data: text ? JSON.parse(text) : undefined }
}

const reportPath = path.join(home, 'workstyle', 'reports', 'latest.json')
fs.mkdirSync(path.dirname(reportPath), { recursive: true })
const now = new Date().toISOString()
const fakeReport = {
  generatedAt: now,
  sources: {
    claude: { available: true, prompts: 10 },
    codex: { available: true, sessions: 2 },
    dsh: { available: true, sampled: 1 },
    pi: { available: true, sessions: 1 },
  },
  suggestedRules: [
    { id: 'plan-first', title: '先方案后实现', text: '先给方案再写代码。', evidence: '已有规则，应被跳过。', confidence: 'high' },
    { id: 'smoke-plan', title: '先写验收标准', text: '动手前先写清楚验收标准，再开始改代码。', evidence: 'smoke 测试规则。', confidence: 'high' },
    { id: 'smoke-verify', title: '改完必须复跑', text: '每次修改后复跑同一组验证命令，并附输出。', evidence: 'smoke 测试规则。', confidence: 'medium' },
  ],
}
fs.writeFileSync(reportPath, JSON.stringify(fakeReport, null, 2) + '\n')

/* ------------------------------ tools ---------------------------------- */

console.log('tools:')
ok(registered.tools.size === 7, '7 tools registered (' + [...registered.tools.keys()].join(', ') + ')')
ok(registered.routes.size === 7, '7 HTTP routes registered')
ok(registered.commands.has('workstyle'), '/workstyle command registered')
ok(registered.sections.has('dsh-workstyle.rules'), 'system prompt section registered')
ok(registered.providers.length === 1, 'skills provider registered')
ok((await registered.providers[0].list()).candidates.length === 40, 'skills provider lists 40 skills')

const status = lossless(await callTool('workstyle_status', {}), 'workstyle_status')
ok(status.ruleCount === 7, 'status ruleCount = 7 before adoption')
ok(status.suggestions.length === 3, 'status exposes 3 suggestions')
ok(status.suggestions.find((rule) => rule.id === 'plan-first').present === true, 'existing rule flagged present')
ok(status.adoptedRules.length === 0, 'no adopted rules yet')

const list = lossless(await callTool('workstyle_list', {}), 'workstyle_list')
ok(list.skills.length === 40, 'list returns 40 skills')

const evidence = lossless(await callTool('workstyle_evidence', {}), 'workstyle_evidence')
ok(evidence.suggestedRules.length === 3, 'evidence returns the report suggestions')

await assert.rejects(callTool('workstyle_apply', { pack: 'nope' }), /unknown pack/, 'apply rejects unknown pack')

/* --------------------------- adopt / revoke ---------------------------- */

console.log('adopt:')
const adoptOne = lossless(await callTool('workstyle_adopt', { ruleIds: ['smoke-plan'] }), 'workstyle_adopt one')
ok(adoptOne.added.length === 1 && adoptOne.added[0] === 'smoke-plan', 'adopted smoke-plan')
ok(adoptOne.ruleCount === 8, 'ruleCount = 8 after one adoption')

const adoptExisting = lossless(await callTool('workstyle_adopt', { ruleIds: ['plan-first'] }), 'workstyle_adopt existing')
ok(adoptExisting.added.length === 0 && adoptExisting.skipped.length === 1, 'skips rule already in pack')

const sectionText = registered.sections.get('dsh-workstyle.rules').text()
ok(sectionText.includes('先写验收标准'), 'adopted rule appears in the system prompt')

const statusAfter = lossless(await callTool('workstyle_status', {}), 'workstyle_status after adopt')
ok(statusAfter.adoptedRules.includes('smoke-plan'), 'status lists adopted rule id')
ok(statusAfter.suggestions.find((rule) => rule.id === 'smoke-plan').adopted === true, 'suggestion flagged adopted')

const adoptAll = lossless(await callTool('workstyle_adopt', { all: true }), 'workstyle_adopt all')
ok(adoptAll.added.includes('smoke-verify'), 'adopt-all picked up smoke-verify')
ok(adoptAll.ruleCount === 9, 'ruleCount = 9 after adopt-all')

const revoked = lossless(await callRoute('/api/dsh-workstyle/unadopt', { method: 'POST', body: { ruleId: 'smoke-plan' } }), 'unadopt route')
ok(revoked.status === 200 && revoked.data.ruleCount === 8, 'unadopt route removes the rule (ruleCount = 8)')
ok(!registered.sections.get('dsh-workstyle.rules').text().includes('先写验收标准'), 'revoked rule leaves the system prompt')

/* ------------------------------- export -------------------------------- */

console.log('export:')
const exported = lossless(await callTool('workstyle_export', {}), 'workstyle_export')
ok(fs.existsSync(exported.file), 'archive exists: ' + exported.file)
ok(exported.ruleCount === 8, 'archive carries 8 effective rules')
ok(exported.skillCount === 40, 'archive carries 40 skills')

const extract = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-extract-'))
execFileSync('tar', ['-xzf', exported.file, '-C', extract])
const entries = execFileSync('tar', ['-tzf', exported.file], { encoding: 'utf8' }).trim().split('\n')
ok(entries.includes('workstyle.json') && entries.includes('manifest.json') && entries.includes('README-EXPORT.md'), 'archive has pack + manifest + readme')
ok(entries.some((entry) => entry === 'skills/fde-cloner/references/contract-extraction.md'), 'archive keeps nested skill files')

const reloaded = loadPackAt(extract)
const reloadedSkills = listSkills(reloaded)
ok(reloaded.id === 'fde-engineering', 'extracted directory reloads as a pack')
ok(reloaded.rules.length === 8, 'extracted pack has 8 rules')
ok(reloadedSkills.length === 40, 'extracted pack has 40 skills')
ok(reloaded.rules.some((rule) => rule.id === 'smoke-verify'), 'adopted rule is exported with the pack')
ok(fs.readFileSync(path.join(extract, 'skills/fde-cloner/references/contract-extraction.md')).length ===
  fs.readFileSync(path.join(root, 'pack/reference/skills/fde-cloner/references/contract-extraction.md')).length, 'skill bytes copied intact')

/* ------------------------------- routes -------------------------------- */

console.log('routes:')
const statusRoute = await callRoute('/api/dsh-workstyle/status')
ok(statusRoute.status === 200 && statusRoute.data.activePackId === 'fde-engineering', 'GET /status')
const evidenceRoute = await callRoute('/api/dsh-workstyle/evidence')
ok(evidenceRoute.status === 200 && evidenceRoute.data.suggestedRules.length === 3, 'GET /evidence')
const adoptRoute = await callRoute('/api/dsh-workstyle/adopt', { method: 'POST', body: { ruleIds: ['smoke-plan'] } })
ok(adoptRoute.status === 200 && adoptRoute.data.ruleCount === 9, 'POST /adopt')
const exportRoute = await callRoute('/api/dsh-workstyle/export', { method: 'POST', body: {} })
ok(exportRoute.status === 200 && fs.existsSync(exportRoute.data.file), 'POST /export')
const applyRoute = await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'nope' } })
ok(applyRoute.status === 404, 'POST /apply unknown pack → 404')
const distillRoute = await callRoute('/api/dsh-workstyle/distill', { method: 'POST', body: { dshSessions: 0 } })
ok(distillRoute.status === 200 && distillRoute.data.file.endsWith('.json'), 'POST /distill (writes a real report)')

/* ------------------------------ command -------------------------------- */

console.log('command:')
const command = registered.commands.get('workstyle')
const statusText = await command.handler({ rawInput: 'status' })
ok(statusText.kind === 'success' && statusText.text.includes('规则'), '/workstyle status')
const exportText = await command.handler({ rawInput: 'export' })
ok(exportText.kind === 'success' && exportText.text.includes('已导出'), '/workstyle export')

/* ------------------------------- cleanup ------------------------------- */

fs.rmSync(home, { recursive: true, force: true })
fs.rmSync(extract, { recursive: true, force: true })
console.log('\nALL ' + checks + ' CHECKS PASSED')
