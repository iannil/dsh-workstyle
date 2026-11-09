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
import { fingerprintOf } from '../lib/inject-text.js'

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
  connection: { fetch: { register(route) { const methods = route.methods && route.methods.length ? route.methods : ['GET']; for (const m of methods) registered.routes.set(route.path + ' ' + m, route); return () => {} } } },
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
  // Routes are keyed by exact path+method; a query string is still the same
  // route, so look it up without one.
  const route = registered.routes.get(routePath.split('?')[0] + ' ' + method)
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
ok(registered.tools.size === 8, '8 tools registered (' + [...registered.tools.keys()].join(', ') + ')')
const registeredPaths = new Set([...registered.routes.keys()].map((key) => key.split(' ')[0]))
ok(registeredPaths.size === 16, '16 HTTP route paths registered (' + [...registeredPaths].length + ')')
ok(registered.commands.has('workstyle'), '/workstyle command registered')
ok(registered.sections.has('dsh-workstyle.rules'), 'system prompt section registered')
ok(registered.providers.length === 1, 'skills provider registered')
ok((await registered.providers[0].list()).candidates.length === 40, 'skills provider lists 40 skills')

const status = lossless(await callTool('workstyle_status', {}), 'workstyle_status')
ok(status.ruleCount === 7, 'status ruleCount = 7 before adoption')
ok(status.enabledRuleCount === 7 && status.disabledRuleCount === 0, 'all 7 rules enabled before any toggle')
ok(status.enabledSkillCount === 40, 'all 40 skills enabled before any toggle')
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

/* ---------------------------- enable / disable -------------------------- */

console.log('toggle:')
const disabled = lossless(await callRoute('/api/dsh-workstyle/toggle', {
  method: 'POST', body: { kind: 'rule', id: 'chinese-terse', enabled: false },
}), 'toggle route off')
ok(disabled.status === 200 && disabled.data.status.summary.enabledRuleCount === 8, 'disabling a rule leaves 8 of 9 enabled')
ok(disabled.data.status.rules.find((rule) => rule.id === 'chinese-terse').enabled === false, 'status marks the rule disabled')
ok(!registered.sections.get('dsh-workstyle.rules').text().includes('中文、短句、先结论'), 'disabled rule leaves the system prompt')

const exportWhileDisabled = lossless(await callTool('workstyle_export', {}), 'export while a rule is disabled')
ok(exportWhileDisabled.ruleCount === 9, 'export still carries the disabled rule (pack files untouched)')

const enabledAgain = lossless(await callTool('workstyle_toggle', { kind: 'rule', id: 'chinese-terse', enabled: true }), 'toggle tool on')
ok(enabledAgain.ruleCount === 9 && enabledAgain.enabled === true, 're-enabling restores 9 effective rules')
ok(registered.sections.get('dsh-workstyle.rules').text().includes('中文、短句、先结论'), 're-enabled rule returns to the system prompt')

const skillOff = lossless(await callTool('workstyle_toggle', { kind: 'skill', id: 'fde-qa', enabled: false }), 'toggle skill off')
ok(skillOff.skillCount === 39, 'disabling a skill leaves 39 enabled')
ok((await registered.providers[0].list()).candidates.length === 39, 'skills provider stops listing the disabled skill')
const skillOn = lossless(await callTool('workstyle_toggle', { kind: 'skill', id: 'fde-qa', enabled: true }), 'toggle skill on')
ok(skillOn.skillCount === 40 && (await registered.providers[0].list()).candidates.length === 40, 're-enabling restores the skill')

await assert.rejects(callTool('workstyle_toggle', { kind: 'rule', id: 'nope', enabled: false }), /unknown rule/, 'toggle rejects unknown rule')
const badToggle = await callRoute('/api/dsh-workstyle/toggle', { method: 'POST', body: { kind: 'nope', id: 'x', enabled: false } })
ok(badToggle.status === 400, 'POST /toggle rejects an unknown kind')

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
const packDetail = await callRoute('/api/dsh-workstyle/pack?id=fde-engineering')
ok(packDetail.status === 200 && packDetail.data.pack.id === 'fde-engineering', 'GET /pack returns a pack detail')
ok(JSON.stringify(Object.keys(packDetail.data.pack).sort()) === JSON.stringify([
  'description', 'displayName', 'format', 'id', 'license', 'name', 'presets', 'ruleCount', 'rules', 'skillCount', 'skills', 'templates', 'version',
]), 'pack detail exposes only portable top-level fields')
ok(!/(?:^|[" :])\/(?:Users|var|tmp|private|home)\//.test(JSON.stringify(packDetail.data.pack)),
  'pack detail contains no absolute filesystem paths')
ok(!/(?:"(?:dir|file|frontmatter)"\s*:)/.test(JSON.stringify(packDetail.data.pack)),
  'pack detail contains no host-only path or frontmatter fields')
ok(Array.isArray(packDetail.data.pack.rules), 'pack detail includes rules')
const detailSkill = packDetail.data.pack.skills[0]
ok(detailSkill && typeof detailSkill.name === 'string' && typeof detailSkill.description === 'string' && typeof detailSkill.whenToUse === 'string',
  'pack detail skills expose portable metadata')
ok(detailSkill && !('dir' in detailSkill) && !('file' in detailSkill) && !('frontmatter' in detailSkill),
  'pack detail skills hide local paths and frontmatter')
const reportList = await callRoute('/api/dsh-workstyle/reports')
ok(reportList.status === 200 && Array.isArray(reportList.data.reports), 'GET /reports returns report metadata only')
ok(!JSON.stringify(reportList.data).includes('先给方案再写代码'), 'report metadata excludes prompt and rule text')
const exportList = await callRoute('/api/dsh-workstyle/exports')
ok(exportList.status === 200 && Array.isArray(exportList.data.exports), 'GET /exports returns export metadata')
ok(exportList.data.exports.every((item) => item.packId && item.packVersion && typeof item.bytes === 'number'), 'export metadata includes pack id, version and bytes')
const referencePath = path.join(root, 'pack', 'reference')
const referenceBefore = fs.statSync(referencePath).mtimeMs
const exportRoute = await callRoute('/api/dsh-workstyle/export', { method: 'POST', body: { withProject: false } })
ok(exportRoute.status === 200 && fs.existsSync(exportRoute.data.file), 'POST /export pack-only')
const defaultEntries = execFileSync('tar', ['-tzf', exportRoute.data.file], { encoding: 'utf8' }).trim().split('\n')
ok(!defaultEntries.includes('project.workstyle.json'), 'pack-only export has no project snapshot')
ok(fs.statSync(referencePath).mtimeMs === referenceBefore, 'exports do not write pack/reference')
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
const offText = await command.handler({ rawInput: 'off chinese-terse' })
ok(offText.kind === 'success' && offText.text.includes('已停用'), '/workstyle off <id>')
const onText = await command.handler({ rawInput: 'on chinese-terse' })
ok(onText.kind === 'success' && onText.text.includes('已启用'), '/workstyle on <id>')

/* ------------------------- v5: scope / inject / metrics ----------------- */

console.log('scope:')
const projectDir = fs.mkdtempSync(path.join(home, 'proj-'))
const projectFile = path.join(projectDir, '.dsh', 'workstyle.json')
const sessionId = 'smoke-session'

const scopeBase = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir))
ok(scopeBase.status === 200 && scopeBase.data.project.present === false, 'GET /scope: no project file yet')
ok(scopeBase.data.project.file === projectFile, 'GET /scope reports the project file path')
const baseInjected = scopeBase.data.counts.injected

const savedRule = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { cwd: projectDir, rule: { id: 'smoke-project', title: '项目规则', text: '本项目只改 docs/。' } },
})
ok(savedRule.status === 200 && savedRule.data.scope.project.rules.length === 1, 'POST /rule writes a project rule')
ok(fs.existsSync(projectFile), 'project rule persisted to <cwd>/.dsh/workstyle.json')
const missingProjectCwd = await callRoute('/api/dsh-workstyle/export', { method: 'POST', body: { withProject: true } })
ok(missingProjectCwd.status === 400, 'POST /export withProject requires cwd')
const scopedExport = await callRoute('/api/dsh-workstyle/export', {
  method: 'POST', body: { withProject: true, cwd: projectDir },
})
ok(scopedExport.status === 200 && fs.existsSync(scopedExport.data.file), 'POST /export withProject writes an archive')
const scopedEntries = execFileSync('tar', ['-tzf', scopedExport.data.file], { encoding: 'utf8' }).trim().split('\n')
ok(scopedEntries.some((entry) => entry.trim() === 'project.workstyle.json'), 'scoped export includes project.workstyle.json')
const scopedExtract = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-scoped-'))
execFileSync('tar', ['-xzf', scopedExport.data.file, '-C', scopedExtract])
const scopedSnapshot = JSON.parse(fs.readFileSync(path.join(scopedExtract, 'project.workstyle.json'), 'utf8'))
ok(scopedSnapshot.rules.length === 1 && scopedSnapshot.rules[0].id === 'smoke-project', 'project snapshot contains only normalized scope rules')
ok(!scopedEntries.some((entry) => entry.startsWith('pack/reference/')), 'scoped export never copies pack/reference')
const projectLayer = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir))
ok(projectLayer.data.counts.project === 1, 'project rule counted in scope.counts.project')
ok(projectLayer.data.counts.injected === baseInjected + 1, 'project rule raises the injected count')
const projectRule = projectLayer.data.rules.find((rule) => rule.id === 'smoke-project')
ok(projectRule && projectRule.textScope === 'project', 'project rule carries textScope=project')

const sessionSave = await callRoute('/api/dsh-workstyle/scope', {
  method: 'POST',
  body: { layer: 'session', sessionId, patch: { disabledRules: ['smoke-project'] } },
})
ok(sessionSave.status === 200 && sessionSave.data.session.disabledRules.includes('smoke-project'), 'POST /scope layer=session saves a session disable')
const layered = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir) + '&session=' + sessionId)
const layeredRule = layered.data.rules.find((rule) => rule.id === 'smoke-project')
ok(layeredRule && layeredRule.enabled === false && layeredRule.disabledBy === 'session', 'session layer disables the project rule and names the layer')
ok(layered.data.counts.injected === baseInjected, 'session disable brings the count back to baseline')

const forceOn = await callRoute('/api/dsh-workstyle/scope', {
  method: 'POST',
  body: { layer: 'session', sessionId, patch: { disabledRules: ['smoke-project'], enabledRules: ['chinese-terse'] } },
})
ok(forceOn.status === 200, 'POST /scope can force a globally disabled rule on')
const forced = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir) + '&session=' + sessionId)
const terse = forced.data.rules.find((rule) => rule.id === 'chinese-terse')
ok(terse && terse.enabled === true, 'session enable wins over the workspace disable')

const badLayer = await callRoute('/api/dsh-workstyle/scope', { method: 'POST', body: { layer: 'galaxy' } })
ok(badLayer.status === 400, 'POST /scope rejects an unknown layer')

console.log('inject:')
const inject = await callRoute('/api/dsh-workstyle/inject?cwd=' + encodeURIComponent(projectDir))
ok(inject.status === 200 && inject.data.section === 'dsh-workstyle.rules', 'GET /inject names the system prompt section')
ok(typeof inject.data.fingerprint === 'string' && /^[0-9a-f]{12}$/.test(inject.data.fingerprint), 'fingerprint is 12 hex chars')
ok(inject.data.text.includes('## 工作方式'), 'inject text is the real renderRules output')
ok(inject.data.fingerprint === fingerprintOf(inject.data.text), 'fingerprint is sha256 of the shown text')
ok(inject.data.chars === [...inject.data.text].length, 'chars matches the text it describes')
ok(inject.data.ruleCount === inject.data.counts.injected, 'ruleCount equals the injected count')

const liveSection = registered.sections.get('dsh-workstyle.rules').text()
const liveInject = await callRoute('/api/dsh-workstyle/inject')
ok(fingerprintOf(liveSection) === liveInject.data.fingerprint,
  'live system prompt section and /inject render the same bytes')

const beforeInject = inject.data.fingerprint
await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { cwd: projectDir, rule: { id: 'smoke-second', title: '第二条', text: '第二条项目规则。' } },
})
const afterInject = await callRoute('/api/dsh-workstyle/inject?cwd=' + encodeURIComponent(projectDir))
ok(afterInject.data.fingerprint !== beforeInject, 'adding a project rule moves the fingerprint')

const removed = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { cwd: projectDir, rule: { id: 'smoke-second' }, remove: true },
})
ok(removed.status === 200 && removed.data.saved === 'removed', 'POST /rule remove deletes a project rule')
const restoredInject = await callRoute('/api/dsh-workstyle/inject?cwd=' + encodeURIComponent(projectDir))
ok(restoredInject.data.fingerprint === beforeInject, 'removing it restores the original fingerprint')

console.log('presets:')
const presetSave = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'save', preset: { id: 'smoke-preset', title: '冒烟预设', rules: ['plan-first'], skills: ['fde-coach'] } },
})
ok(presetSave.status === 200 && presetSave.data.saved === 'smoke-preset', 'POST /preset action=save stores a preset')
const presetUse = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'use', preset: 'smoke-preset', cwd: projectDir },
})
ok(presetUse.status === 200 && presetUse.data.scope.activePreset.id === 'smoke-preset', 'POST /preset action=use selects it')
ok(presetUse.data.scope.presetScope === 'project', 'preset chosen in a project is recorded at project scope')
const presetBad = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'use', preset: 'Bad Id' } })
ok(presetBad.status === 400, 'POST /preset rejects an invalid preset id')

console.log('metrics:')
const metrics = await callRoute('/api/dsh-workstyle/metrics')
ok(metrics.status === 200, 'GET /metrics returns 200')
ok(metrics.data.available === true, 'metrics available once a report exists')
const ids = metrics.data.metrics.map((metric) => metric.id)
ok(ids.join(',') === 'rule-hits,plan-rate,verify-rate,coverage', 'metrics are rule-hits, plan-rate, verify-rate, coverage')
ok(metrics.data.metrics.every((metric) => metric.formula && metric.denominator), 'every metric carries its formula and denominator')
ok(!JSON.stringify(metrics.data).match(/遵守率|违反率|compliance/), 'metrics never claim a compliance or violation rate')
ok(metrics.data.caveat.includes('不能说明模型是否遵守规则'), 'metrics state the proxy caveat')
const hitMetric = metrics.data.metrics.find((metric) => metric.id === 'rule-hits')
ok(typeof hitMetric.ratio === 'number' && hitMetric.denominator.includes('分母'), 'rule-hits ratio is a number with a stated denominator')

const prevReport = JSON.parse(fs.readFileSync(path.join(home, 'workstyle', 'reports', 'latest.json'), 'utf8'))
prevReport.generatedAt = '2026-01-01T00:00:00.000Z'
prevReport.sources.claude.prompts = 10
prevReport.sources.claude.planKeywords = 1
fs.writeFileSync(path.join(home, 'workstyle', 'reports', 'report-2026-01-01.json'), JSON.stringify(prevReport, null, 2))
const withBaseline = await callRoute('/api/dsh-workstyle/metrics')
ok(withBaseline.data.baseline.available === true, 'baseline appears when two reports exist')
ok(withBaseline.data.baseline.note.includes('不说明因果'), 'baseline refuses to claim causality')

/* rule hits must count real keywords, not silently report 0/0 */
const { distill: distillAgain, readLatestReport: readAgain } = await import(path.join(root, 'lib/distill.js'))
const corpusHome = process.env.DSH_HOME
const corpusFile = path.join(corpusHome, 'hit-corpus.jsonl')
fs.writeFileSync(corpusFile, [
  JSON.stringify({ display: '先给我一个方案再动手', timestamp: 1 }),
  JSON.stringify({ display: '这个先方案后实现', timestamp: 2 }),
  JSON.stringify({ display: '跑一下测试验证', timestamp: 3 }),
].join('\n') + '\n')
await distillAgain({ sources: { claude: corpusFile }, keywords: ['方案', '验证'], dshSessions: 0 })
const corpusReport = readAgain()
ok(corpusReport.sources.claude.ruleHits && corpusReport.sources.claude.ruleHits['方案'] === 2,
  'distillation records per-keyword hit counts')
ok(!JSON.stringify(corpusReport).includes('先给我一个方案再动手'),
  'the report stores tallies, never prompt text')
const measuredRules = [
  { id: 'plan-first', title: '先方案后实现', measures: ['方案'], enabled: true },
  { id: 'verify', title: '验证后才宣称完成', measures: ['验证'], enabled: true },
  { id: 'unmetered', title: '没有测量词', enabled: true },
]
const { computeMetrics: recompute } = await import(path.join(root, 'lib/metrics.js'))
const measured = recompute({ rules: measuredRules })
const measuredHit = measured.metrics.find((metric) => metric.id === 'rule-hits')
ok(measuredHit.value === '2' && measuredHit.unit === '/2',
  'rule hits count measured keywords instead of collapsing to 0/0')
ok(measured.rules.find((rule) => rule.id === 'unmetered').measurable === false,
  'a rule without keywords is unmeasurable, not a miss')

/* a project rule that declares keywords becomes measurable end to end */
const measuredCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-measured-'))
await callRoute('/api/dsh-workstyle/rule', { method: 'POST', body: {
  cwd: measuredCwd,
  rule: { id: 'local-plan', title: '先给方案', text: '先给方案', measures: ['方案', '验证'] },
} })
const measuredScope = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(measuredCwd))
const localRule = measuredScope.data.rules.find((rule) => rule.id === 'local-plan')
ok(Array.isArray(localRule.measures) && localRule.measures.length === 2,
  'a project rule keeps the keywords it was written with')
const measuredCorpus = path.join(home, 'measured.jsonl')
fs.writeFileSync(measuredCorpus, ['先给我方案', '要方案', '验证一下', '无关'].map((text, index) =>
  JSON.stringify({ display: text, timestamp: index })).join('\n') + '\n')
await callRoute('/api/dsh-workstyle/distill', { method: 'POST', body: {
  cwd: measuredCwd, sources: { claude: measuredCorpus }, dshSessions: 0,
} })
const measuredMetrics = await callRoute('/api/dsh-workstyle/metrics?cwd=' + encodeURIComponent(measuredCwd))
const measuredRuleHit = measuredMetrics.data.metrics.find((metric) => metric.id === 'rule-hits')
const measuredLocal = measuredMetrics.data.rules.find((rule) => rule.id === 'local-plan')
ok(measuredLocal && measuredLocal.measurable === true,
  'a project rule carrying keywords becomes measurable')
ok(measuredRuleHit.value !== '0' && measuredRuleHit.unit !== '/0',
  'rule hits find measured rules once distillation records their keywords')

/* pack rules must keep the keywords their manifest declares */
const { loadPackAt: loadReal } = await import(path.join(root, 'lib/pack.js'))
const realPack = loadReal(path.join(root, 'pack', 'reference'))
ok(realPack && realPack.rules.some((rule) => Array.isArray(rule.measures) && rule.measures.length),
  'normalizePack keeps per-rule measures')
ok(realPack && Array.isArray(realPack.presets) && realPack.presets.length === 3,
  'the reference pack ships its presets')
ok(realPack && Array.isArray(realPack.templates) && realPack.templates.length === 3,
  'the reference pack ships its templates')

/* ---------------- preset whitelist, removals, blocked presets ---------------- */

const whitelistSave = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'save', preset: { id: 'smoke-slice', title: '情境切片', rules: ['plan-first'], skills: [], templates: [] } },
})
ok(whitelistSave.status === 200, 'preset save accepts a rule whitelist')

const useWhitelist = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'use', preset: 'smoke-slice', cwd: projectDir },
})
ok(useWhitelist.status === 200, 'whitelist preset can be selected')

const sliced = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir))
const slicedRules = sliced.data.rules
ok(slicedRules.find((rule) => rule.id === 'plan-first').enabled === true, 'whitelisted rule is injected')
ok(slicedRules.filter((rule) => rule.id !== 'plan-first').every((rule) => rule.outsidePreset === 'smoke-slice' || rule.disabledBy),
  'every other rule names the preset that excluded it')
ok(sliced.data.activePreset && sliced.data.activePreset.id === 'smoke-slice', 'activePreset is reported')

const slicedInject = await callRoute('/api/dsh-workstyle/inject?cwd=' + encodeURIComponent(projectDir))
ok(slicedInject.data.counts.injected === 1, 'only the whitelisted rule reaches the prompt')

/* session force-enable pulls an excluded rule back in */
await callRoute('/api/dsh-workstyle/scope', {
  method: 'POST',
  body: { layer: 'session', sessionId: 'smoke-slice-session', patch: { enabledRules: ['smoke-plan'] } },
})
const forcedBack = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir) + '&session=smoke-slice-session')
ok(forcedBack.data.rules.find((rule) => rule.id === 'smoke-plan').enabled === true, 'session force-enable beats the preset whitelist')

await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'use', preset: 'smoke-slice', cwd: projectDir } })

/* ---------------- status carries writable metadata for every rule ---------------- */

console.log('status writable:')
const statusWritable = await callRoute('/api/dsh-workstyle/status')
ok(statusWritable.status === 200 && statusWritable.data.rules.length > 0, 'GET /status returns the rule list')
ok(statusWritable.data.rules.every((rule) => rule.writable && typeof rule.writable.scope === 'string'),
  'every status rule carries writable.scope')
const statusPlanFirst = statusWritable.data.rules.find((rule) => rule.id === 'plan-first')
ok(statusPlanFirst && statusPlanFirst.writable.scope === 'overlay',
  'builtin rule plan-first is writable through the overlay')
ok(statusPlanFirst && statusPlanFirst.writable.packId === 'fde-engineering',
  'status writable names the active pack')

/* ---------------- overlay: patch a bundled rule without touching the pack ---------------- */

const packFile = path.join(root, 'pack', 'reference', 'workstyle.json')
const packBefore = fs.readFileSync(packFile, 'utf8')

const patchRes = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'fde-engineering', rule: { id: 'plan-first', title: '先方案（本机改）', text: '本机覆盖后的正文。' } },
})
ok(patchRes.status === 200, 'patching a bundled rule succeeds')
ok(fs.readFileSync(packFile, 'utf8') === packBefore, 'the bundled pack file is untouched')
ok(fs.statSync(referencePath).mtimeMs === referenceBefore, 'patching a bundled rule leaves pack/reference mtime alone')
const patched = (await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first')
ok(patched.text === '本机覆盖后的正文。', 'the effective rule uses the patched text')

const removedRule = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'fde-engineering', rule: { id: 'plan-first' }, remove: true },
})
ok(removedRule.status === 200, 'removing a bundled rule succeeds')
const afterRemove = await callRoute('/api/dsh-workstyle/scope')
const afterRemovePlanFirst = afterRemove.data.rules.find((rule) => rule.id === 'plan-first')
ok(afterRemovePlanFirst && afterRemovePlanFirst.removed === true, 'removed rule stays visible with removed: true')
ok(afterRemovePlanFirst && afterRemovePlanFirst.enabled === false, 'removed rule is not enabled in the composed scope')
const afterRemoveInject = await callRoute('/api/dsh-workstyle/inject')
ok(!afterRemoveInject.data.text.includes('本机覆盖后的正文。'), 'a removed rule is absent from the injected prompt')
ok(fs.readFileSync(packFile, 'utf8') === packBefore, 'the bundled pack file is still untouched')

const restoredRule = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'fde-engineering', action: 'restore', rule: { id: 'plan-first' } },
})
ok(restoredRule.status === 200, 'restoring a removed rule succeeds')
ok((await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first').removed !== true, 'restored rule is back in the list')

/* ---------------- editing a user pack writes the pack file ---------------- */

const userPackDir = path.join(home, 'workstyle', 'packs', 'smoke-pack')
fs.mkdirSync(path.join(userPackDir, 'skills'), { recursive: true })
fs.writeFileSync(path.join(userPackDir, 'workstyle.json'), JSON.stringify({
  id: 'smoke-pack', name: 'smoke-pack', displayName: 'Smoke Pack', version: '0.1.0',
  rules: [{ id: 'smoke-owned', title: '包内规则', text: '原始正文。' }],
}, null, 2) + '\n')

const applyUserPack = await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'smoke-pack' } })
ok(applyUserPack.status === 200, 'user pack can be applied')

const userPackEdit = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'smoke-pack', rule: { id: 'smoke-owned', title: '包内规则', text: '直接写入包文件。' } },
})
ok(userPackEdit.status === 200, 'editing a user pack rule succeeds')
const userPackManifest = JSON.parse(fs.readFileSync(path.join(userPackDir, 'workstyle.json'), 'utf8'))
ok(userPackManifest.rules.find((rule) => rule.id === 'smoke-owned').text === '直接写入包文件。', 'user pack edits land in the pack file')
ok(userPackEdit.data.revision && userPackEdit.data.revision.id, 'user pack edit returns a revision')

/* adopted (distilled) rules stay in the overlay, even under a user pack */
fs.writeFileSync(reportPath, JSON.stringify(fakeReport, null, 2) + '\n')
const adoptUnderUserPack = await callRoute('/api/dsh-workstyle/adopt', { method: 'POST', body: { ruleIds: ['smoke-plan'] } })
ok(adoptUnderUserPack.status === 200, 'a distilled rule can be adopted while a user pack is active')
const adoptCwd = fs.mkdtempSync(path.join(home, 'adopt-proj-'))
const userPackFile = path.join(userPackDir, 'workstyle.json')
const adoptedRuleIds = () => JSON.parse(fs.readFileSync(userPackFile, 'utf8')).rules.filter((rule) => rule.id === 'smoke-plan').length
const userPackAdoptedCount = adoptedRuleIds()
const adoptedBefore = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(adoptCwd))
const adoptedUnderPack = adoptedBefore.data.rules.find((rule) => rule.id === 'smoke-plan')
ok(adoptedUnderPack && adoptedUnderPack.enabled === true, 'the adopted rule is enabled under the user pack')
ok(adoptedUnderPack && adoptedUnderPack.writable.scope === 'overlay',
  'an adopted rule reports the overlay, not the user pack file')

const removeAdopted = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'smoke-pack', rule: { id: 'smoke-plan' }, remove: true },
})
ok(removeAdopted.status === 200 && removeAdopted.data.saved === 'removed',
  'removing an adopted rule under a user pack succeeds')
const afterAdoptedRemove = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(adoptCwd))
const adoptedRemoved = afterAdoptedRemove.data.rules.find((rule) => rule.id === 'smoke-plan')
ok(!adoptedRemoved || adoptedRemoved.enabled === false, 'a removed adopted rule is no longer enabled')
const afterAdoptedRemoveInject = await callRoute('/api/dsh-workstyle/inject?cwd=' + encodeURIComponent(adoptCwd))
ok(!afterAdoptedRemoveInject.data.text.includes('动手前先写清楚验收标准'),
  'a removed adopted rule is absent from the injected prompt')
ok(adoptedRuleIds() === userPackAdoptedCount, 'removing an adopted rule never touches the user pack file')

const restoreAdopted = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'smoke-pack', action: 'restore', rule: { id: 'smoke-plan' } },
})
ok(restoreAdopted.status === 200 && restoreAdopted.data.saved === 'restored', 'restoring an adopted rule succeeds')
const afterAdoptedRestore = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(adoptCwd))
ok(afterAdoptedRestore.data.rules.find((rule) => rule.id === 'smoke-plan').enabled === true,
  'the restored adopted rule is enabled again')
ok(adoptedRuleIds() === userPackAdoptedCount, 'restoring an adopted rule never touches the user pack file')

await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'fde-engineering' } })

/* ---------------- /rule target=session: enable, disable, restore ---------------- */

const ruleSessionId = 'smoke-rule-session'
const sessionEnable = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'session', sessionId: ruleSessionId, rule: { id: 'plan-first', title: 't', text: 'x' } },
})
ok(sessionEnable.status === 200 && sessionEnable.data.saved === 'enabled', 'POST /rule target=session enables a rule')
const sessionDisable = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'session', sessionId: ruleSessionId, rule: { id: 'plan-first' }, remove: true },
})
ok(sessionDisable.status === 200 && sessionDisable.data.saved === 'disabled', 'POST /rule target=session disables a rule')
const sessionRestore = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'session', sessionId: ruleSessionId, action: 'restore', rule: { id: 'plan-first' } },
})
ok(sessionRestore.status === 200 && sessionRestore.data.saved === 'restored',
  'POST /rule target=session restore reports restored')
const sessionLists = sessionRestore.data.scope.session
ok(!sessionLists.enabledRules.includes('plan-first') && !sessionLists.disabledRules.includes('plan-first'),
  'a restored session rule is absent from both session lists')

/* ------------------------------- cleanup ------------------------------- */


fs.rmSync(home, { recursive: true, force: true })
fs.rmSync(extract, { recursive: true, force: true })
fs.rmSync(scopedExtract, { recursive: true, force: true })
console.log('\nALL ' + checks + ' CHECKS PASSED')
