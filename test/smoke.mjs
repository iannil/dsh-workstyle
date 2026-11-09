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
ok(registeredPaths.size === 17, '17 HTTP route paths registered (' + [...registeredPaths].length + ')')
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

/* ---------------- preset lifecycle: duplicate / delete / block / unblock ---------------- */

console.log('preset lifecycle:')
const lifecyclePackFile = path.join(referencePath, 'workstyle.json')
const lifecyclePackBefore = fs.readFileSync(lifecyclePackFile, 'utf8')
const lifecycleManifestBefore = JSON.parse(lifecyclePackBefore)
const lifecycleStatBefore = fs.statSync(referencePath).mtimeMs

const duplicate = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'duplicate', preset: 'smoke-slice', newId: 'smoke-slice-copy' },
})
ok(duplicate.status === 200, 'preset duplicate succeeds')
const afterDuplicate = (await callRoute('/api/dsh-workstyle/scope')).data.presets
ok(afterDuplicate.some((preset) => preset.id === 'smoke-slice-copy'), 'duplicated preset is listed')
ok(afterDuplicate.find((preset) => preset.id === 'smoke-slice-copy').builtin === false,
  'a duplicated preset is a local copy')

const delPreset = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'delete', preset: 'smoke-slice-copy' } })
ok(delPreset.status === 200 && delPreset.data.removed === 'local', 'local preset delete removes it')
ok(!(await callRoute('/api/dsh-workstyle/scope')).data.presets.some((preset) => preset.id === 'smoke-slice-copy'), 'deleted local preset is gone')

const blockBuiltin = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'block', preset: 'writing', packId: 'fde-engineering' } })
ok(blockBuiltin.status === 200 && blockBuiltin.data.removed === 'blocked', 'bundled preset delete becomes a block')
ok(!(await callRoute('/api/dsh-workstyle/scope')).data.presets.some((preset) => preset.id === 'writing'), 'blocked preset is hidden')
const blockedState = JSON.parse(fs.readFileSync(path.join(home, 'workstyle', 'state.json'), 'utf8'))
ok((blockedState.presetBlocked['fde-engineering'] || []).includes('writing'),
  'block records presetBlocked in state.json')
ok(fs.readFileSync(lifecyclePackFile, 'utf8') === lifecyclePackBefore, 'blocking never rewrites the bundled pack')
ok(fs.statSync(referencePath).mtimeMs === lifecycleStatBefore, 'blocking leaves pack/reference mtime alone')

const useBlocked = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'use', preset: 'writing', cwd: projectDir } })
ok(useBlocked.status === 400, 'using a blocked preset is rejected')

const unblock = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'unblock', preset: 'writing', packId: 'fde-engineering' } })
ok(unblock.status === 200, 'unblock restores the bundled preset')
ok((await callRoute('/api/dsh-workstyle/scope')).data.presets.some((preset) => preset.id === 'writing'), 'unblocked preset is listed again')
const unblockedState = JSON.parse(fs.readFileSync(path.join(home, 'workstyle', 'state.json'), 'utf8'))
ok(!unblockedState.presetBlocked || !unblockedState.presetBlocked['fde-engineering'],
  'unblock empties presetBlocked for the pack')

/* delete on a shipped preset is a block, never an edit of the pack file */
const deleteShipped = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'delete', preset: 'fde-delivery', packId: 'fde-engineering' } })
ok(deleteShipped.status === 200 && deleteShipped.data.removed === 'blocked',
  'deleting a bundled preset blocks it instead of editing the pack')
ok(!(await callRoute('/api/dsh-workstyle/scope')).data.presets.some((preset) => preset.id === 'fde-delivery'),
  'the deleted bundled preset is hidden')
const unblockShipped = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'unblock', preset: 'fde-delivery', packId: 'fde-engineering' } })
ok(unblockShipped.status === 200, 'unblocking the deleted bundled preset succeeds')
ok((await callRoute('/api/dsh-workstyle/scope')).data.presets.some((preset) => preset.id === 'fde-delivery'),
  'the unblocked bundled preset is listed again')

const lifecycleManifestAfter = JSON.parse(fs.readFileSync(lifecyclePackFile, 'utf8'))
ok(lifecycleManifestAfter.rules.length === lifecycleManifestBefore.rules.length
  && lifecycleManifestAfter.presets.length === lifecycleManifestBefore.presets.length,
  'the bundled pack keeps its rule and preset counts')
ok(fs.readFileSync(lifecyclePackFile, 'utf8') === lifecyclePackBefore, 'the bundled pack bytes are unchanged')
ok(fs.statSync(referencePath).mtimeMs === lifecycleStatBefore, 'the bundled pack mtime is unchanged')

const badPresetJson = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: null })
ok(badPresetJson.status === 400, 'preset rejects a missing body')

const unknownPresetUse = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'use', preset: 'no-such-preset', cwd: projectDir },
})
ok(unknownPresetUse.status === 404, 'using an unknown preset is a 404')
const unknownPackSave = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'save', packId: 'no-such-pack', preset: { id: 'smoke-unowned', title: '无主预设' } },
})
ok(unknownPackSave.status === 404, 'saving into an unknown pack is a 404')

/* a user pack owns its presets: save and delete edit its workstyle.json */
const userPackPresetSave = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'save', packId: 'smoke-pack', preset: { id: 'smoke-owned-preset', title: '包内预设', rules: ['smoke-owned'] } },
})
ok(userPackPresetSave.status === 200 && userPackPresetSave.data.revision, 'saving a preset into a user pack returns a revision')
const userPackPresetManifest = JSON.parse(fs.readFileSync(path.join(userPackDir, 'workstyle.json'), 'utf8'))
ok((userPackPresetManifest.presets || []).some((preset) => preset.id === 'smoke-owned-preset'),
  'a user pack preset lands in the pack file')
const userPackPresetDelete = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'delete', packId: 'smoke-pack', preset: 'smoke-owned-preset' },
})
ok(userPackPresetDelete.status === 200 && userPackPresetDelete.data.removed === 'pack',
  'deleting a user pack preset edits the pack file')
const userPackAfterDelete = JSON.parse(fs.readFileSync(path.join(userPackDir, 'workstyle.json'), 'utf8'))
ok(!(userPackAfterDelete.presets || []).some((preset) => preset.id === 'smoke-owned-preset'),
  'the deleted user pack preset is gone from the pack file')

/* ------------------- preset contract: review fixes ---------------------- */

const readStateFile = () => JSON.parse(fs.readFileSync(path.join(home, 'workstyle', 'state.json'), 'utf8'))
const postPreset = (body) => callRoute('/api/dsh-workstyle/preset', { method: 'POST', body })

/* R1: `use` resolves against the ACTIVE pack; a non-active packId is refused */
const useForOtherPack = await postPreset({ action: 'use', packId: 'smoke-pack', preset: 'smoke-owned-preset', cwd: projectDir })
ok(useForOtherPack.status === 400 && useForOtherPack.data.error === 'apply that pack before using its presets',
  'using a preset of a non-active pack is refused, not silently ignored')
const useActivePresetViaOtherPack = await postPreset({ action: 'use', packId: 'smoke-pack', preset: 'writing', cwd: projectDir })
ok(useActivePresetViaOtherPack.status === 400 && useActivePresetViaOtherPack.data.error === 'apply that pack before using its presets',
  'a preset the active pack ships is not reported as unknown for another pack')
const scopeAfterRefusedUse = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir))
ok(scopeAfterRefusedUse.data.activePreset?.id === 'smoke-slice',
  'a refused use leaves the scope preset untouched')
const useActivePresetExplicitly = await postPreset({ action: 'use', packId: 'fde-engineering', preset: 'writing', cwd: projectDir })
ok(useActivePresetExplicitly.status === 200 && useActivePresetExplicitly.data.used === 'writing',
  'naming the active pack explicitly still uses its preset')
const useBackToProjectPreset = await postPreset({ action: 'use', preset: 'smoke-slice', cwd: projectDir })
ok(useBackToProjectPreset.status === 200, 'the project preset can be restored')

/* R2: delete drops the local override before applying the shipped policy */
const overrideForShipped = await postPreset({ action: 'save', preset: { id: 'writing', title: '我的写作', rules: [] } })
ok(overrideForShipped.status === 200, 'a shipped preset can carry a local override')
const deleteOverriddenShipped = await postPreset({ action: 'delete', packId: 'fde-engineering', preset: 'writing', cwd: projectDir })
ok(deleteOverriddenShipped.status === 200 && deleteOverriddenShipped.data.removed === 'blocked' && deleteOverriddenShipped.data.local === true,
  'deleting an overridden shipped preset removes the override and blocks it')
const stateAfterOverriddenDelete = readStateFile()
ok(!(stateAfterOverriddenDelete.presets || []).some((preset) => preset.id === 'writing'),
  'the local override is gone from the state file')
const scopeAfterOverriddenDelete = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir))
ok(!(scopeAfterOverriddenDelete.data.presets || []).some((preset) => preset.id === 'writing'),
  'the blocked preset is gone from the scope presets')
const unblockShippedAgain = await postPreset({ action: 'unblock', packId: 'fde-engineering', preset: 'writing' })
ok(unblockShippedAgain.status === 200, 'the blocked shipped preset can be unblocked')
const scopeAfterRepairUnblock = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir))
const restoredShipped = (scopeAfterRepairUnblock.data.presets || []).find((preset) => preset.id === 'writing')
ok(restoredShipped && restoredShipped.title === '写书',
  'unblocking returns the shipped preset, not the deleted local copy')

/* R2 + M1: a user pack preset with a local override; overlay target writes state only */
const packShareSave = await postPreset({ action: 'save', packId: 'smoke-pack', preset: { id: 'smoke-shared', title: '包内共享', rules: ['smoke-owned'] } })
ok(packShareSave.status === 200 && packShareSave.data.revision, 'saving a user pack preset defaults to the pack file')
const userPackBytesBeforeOverlay = fs.readFileSync(path.join(userPackDir, 'workstyle.json'), 'utf8')
const overlayOverPack = await postPreset({ action: 'save', target: 'overlay', packId: 'smoke-pack', preset: { id: 'smoke-shared', title: '本机共享', rules: [] } })
ok(overlayOverPack.status === 200 && overlayOverPack.data.saved === 'smoke-shared',
  "target:'overlay' saves a user pack preset into the overlay")
ok(fs.readFileSync(path.join(userPackDir, 'workstyle.json'), 'utf8') === userPackBytesBeforeOverlay,
  "target:'overlay' leaves a user pack file untouched")
ok((readStateFile().presets || []).some((preset) => preset.id === 'smoke-shared'),
  'the overlaid user pack preset lands in the state file')
const deleteOverriddenPackPreset = await postPreset({ action: 'delete', packId: 'smoke-pack', preset: 'smoke-shared' })
ok(deleteOverriddenPackPreset.status === 200 && deleteOverriddenPackPreset.data.removed === 'pack'
  && deleteOverriddenPackPreset.data.local === true && deleteOverriddenPackPreset.data.revision,
  'deleting an overridden user pack preset clears the override and edits the pack file')
ok(!(readStateFile().presets || []).some((preset) => preset.id === 'smoke-shared'),
  'the user pack preset override is gone from the state file')
ok(!(JSON.parse(fs.readFileSync(path.join(userPackDir, 'workstyle.json'), 'utf8')).presets || []).some((preset) => preset.id === 'smoke-shared'),
  'the user pack preset is gone from the pack file')

/* R3: block only accepts shipped presets; unblock only restores real blocks */
const localOnlySave = await postPreset({ action: 'save', preset: { id: 'smoke-local-only', title: '仅本机' } })
ok(localOnlySave.status === 200, 'a purely local preset can be saved')
const blockLocalOnly = await postPreset({ action: 'block', packId: 'fde-engineering', preset: 'smoke-local-only' })
ok(blockLocalOnly.status === 404 && blockLocalOnly.data.error === 'unknown preset: smoke-local-only',
  'blocking a purely local preset is a 404')
const blockGhost = await postPreset({ action: 'block', packId: 'fde-engineering', preset: 'ghost-preset' })
ok(blockGhost.status === 404 && blockGhost.data.error === 'unknown preset: ghost-preset',
  'blocking an unknown preset is a 404')
const blockedAfterGhosts = readStateFile().presetBlocked || {}
ok(!(blockedAfterGhosts['fde-engineering'] || []).includes('smoke-local-only')
  && !(blockedAfterGhosts['fde-engineering'] || []).includes('ghost-preset'),
  'a refused block leaves no phantom presetBlocked entry')
const unblockUnblocked = await postPreset({ action: 'unblock', packId: 'fde-engineering', preset: 'fde-delivery' })
ok(unblockUnblocked.status === 404, 'unblocking a preset that is not blocked is a 404')
const unblockUnknownPack = await postPreset({ action: 'unblock', packId: 'no-such-pack', preset: 'writing' })
ok(unblockUnknownPack.status === 404, 'unblocking on an unknown pack is a 404')

/* R4: block refuses the preset currently in use */
const useWritingNow = await postPreset({ action: 'use', preset: 'writing', cwd: projectDir })
ok(useWritingNow.status === 200, 'the shipped preset can be used for this project')
const blockInUse = await postPreset({ action: 'block', packId: 'fde-engineering', preset: 'writing', cwd: projectDir })
ok(blockInUse.status === 400 && blockInUse.data.error === 'preset is in use: writing; switch preset first',
  'blocking the preset in use is refused')
const injectAfterRefusedBlock = await callRoute('/api/dsh-workstyle/inject?cwd=' + encodeURIComponent(projectDir))
ok(injectAfterRefusedBlock.data.preset === 'writing',
  'a refused block leaves the effective preset unchanged')
ok(!(readStateFile().presetBlocked?.['fde-engineering'] || []).includes('writing'),
  'a refused block leaves no presetBlocked entry')
const useProjectPresetAgain = await postPreset({ action: 'use', preset: 'smoke-slice', cwd: projectDir })
ok(useProjectPresetAgain.status === 200, 'the project preset can be restored after the refusal')

/* R5: duplicate refuses to overwrite an existing preset */
const dupSourceSave = await postPreset({ action: 'save', preset: { id: 'smoke-dup-src', title: '来源预设', rules: [] } })
const dupTargetSave = await postPreset({ action: 'save', preset: { id: 'smoke-dup-dst', title: '既有预设', rules: ['plan-first'] } })
ok(dupSourceSave.status === 200 && dupTargetSave.status === 200, 'duplicate fixtures are saved')
const duplicateOntoLocal = await postPreset({ action: 'duplicate', preset: 'smoke-dup-src', newId: 'smoke-dup-dst' })
ok(duplicateOntoLocal.status === 400 && duplicateOntoLocal.data.error === 'preset already exists: smoke-dup-dst',
  'duplicating onto an existing local preset is refused')
const duplicateOntoShipped = await postPreset({ action: 'duplicate', preset: 'smoke-dup-src', newId: 'writing' })
ok(duplicateOntoShipped.status === 400 && duplicateOntoShipped.data.error === 'preset already exists: writing',
  'duplicating onto a shipped preset is refused')
const scopeAfterDuplicateRefusals = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir))
const untouchedDupTarget = (scopeAfterDuplicateRefusals.data.presets || []).find((preset) => preset.id === 'smoke-dup-dst')
ok(untouchedDupTarget && untouchedDupTarget.title === '既有预设'
  && JSON.stringify(untouchedDupTarget.rules) === JSON.stringify(['plan-first']),
  'a refused duplicate leaves the existing preset untouched')
const duplicateFresh = await postPreset({ action: 'duplicate', preset: 'smoke-dup-src' })
ok(duplicateFresh.status === 200 && duplicateFresh.data.saved === 'smoke-dup-src-copy',
  'duplicating to a free id still works with the default copy id')
const duplicateFreshAgain = await postPreset({ action: 'duplicate', preset: 'smoke-dup-src' })
ok(duplicateFreshAgain.status === 400 && duplicateFreshAgain.data.error === 'preset already exists: smoke-dup-src-copy',
  'the default copy id is protected on the second duplicate')

/* M1: target:'pack' is refused for bundled packs; bad targets are rejected */
const packTargetBuiltin = await postPreset({ action: 'save', target: 'pack', packId: 'fde-engineering', preset: { id: 'smoke-write-attempt' } })
ok(packTargetBuiltin.status === 400 && packTargetBuiltin.data.error === 'bundled packs are read-only: fde-engineering',
  "target:'pack' on a bundled pack is refused")
ok(fs.readFileSync(lifecyclePackFile, 'utf8') === lifecyclePackBefore,
  'the bundled pack file is byte-identical after a refused pack write')
const badTarget = await postPreset({ action: 'save', target: 'elsewhere', preset: { id: 'smoke-bad-target' } })
ok(badTarget.status === 400, 'an unknown save target is rejected')

/* M3: `use` validates cwd like the other routes */
const notADirectory = path.join(home, 'not-a-dir')
fs.writeFileSync(notADirectory, 'x')
const useBadCwd = await postPreset({ action: 'use', preset: 'writing', cwd: notADirectory })
ok(useBadCwd.status === 400 && useBadCwd.data.error === 'cwd must be an existing directory',
  'use with a non-directory cwd is a clean 400')

/* ---------------- session-scoped preset is a real layer ---------------- */

console.log('session preset:')
const sessionPreset = 'preset-session-' + Date.now()
const useInSession = await postPreset({ action: 'use', preset: 'writing', sessionId: sessionPreset })
ok(useInSession.status === 200, 'session preset use succeeds')
const sessionScope = await callRoute('/api/dsh-workstyle/scope?session=' + sessionPreset)
ok(sessionScope.data.activePreset && sessionScope.data.activePreset.id === 'writing',
  'session preset takes effect')
ok(sessionScope.data.presetScope === 'session',
  'session preset is attributed to the session layer')
const sessionInject = await callRoute('/api/dsh-workstyle/inject?session=' + sessionPreset)
ok(sessionInject.data.preset === 'writing',
  'session preset reaches the injected text')
/* an unrelated session write must not drop the preset */
await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'session', sessionId: sessionPreset, rule: { id: 'plan-first' }, remove: true },
})
const sessionScope2 = await callRoute('/api/dsh-workstyle/scope?session=' + sessionPreset)
ok(sessionScope2.data.activePreset && sessionScope2.data.activePreset.id === 'writing',
  'session preset survives an unrelated session write')
/* project beats session; an explicit argument would beat both */
const projectOverSession = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir) + '&session=' + sessionPreset)
ok(projectOverSession.data.activePreset && projectOverSession.data.activePreset.id === 'smoke-slice',
  'a project preset outranks the session preset')
ok(projectOverSession.data.presetScope === 'project',
  'the project layer is credited with that choice')

/* an emptied session still deletes its file, preset key included */
const emptySessionId = 'preset-empty-' + Date.now()
const emptySessionFile = path.join(home, 'workstyle', 'sessions', emptySessionId + '.json')
await postPreset({ action: 'use', preset: 'writing', sessionId: emptySessionId })
ok(fs.existsSync(emptySessionFile), 'a session preset writes the session file')
await callRoute('/api/dsh-workstyle/scope', {
  method: 'POST',
  body: { layer: 'session', sessionId: emptySessionId, patch: { preset: '' } },
})
ok(!fs.existsSync(emptySessionFile), 'an emptied session deletes its file even after holding a preset')

/* ---------------- delete applies the same in-use guard as block ---------------- */

console.log('preset delete guard:')
const useWritingForDelete = await postPreset({ action: 'use', preset: 'writing', cwd: projectDir })
ok(useWritingForDelete.status === 200, 'the shipped preset is in use for the delete guard test')
const injectBeforeDeleteGuard = await callRoute('/api/dsh-workstyle/inject?cwd=' + encodeURIComponent(projectDir))
ok(injectBeforeDeleteGuard.data.preset === 'writing', 'the effective preset is the shipped one')
const deleteShippedInUse = await postPreset({ action: 'delete', packId: 'fde-engineering', preset: 'writing', cwd: projectDir })
ok(deleteShippedInUse.status === 400
  && deleteShippedInUse.data.error === 'preset is in use: writing; switch preset first',
  'deleting the effective shipped preset is refused')
const injectAfterRefusedDelete = await callRoute('/api/dsh-workstyle/inject?cwd=' + encodeURIComponent(projectDir))
ok(injectAfterRefusedDelete.data.preset === 'writing'
  && injectAfterRefusedDelete.data.fingerprint === injectBeforeDeleteGuard.data.fingerprint,
  'a refused delete leaves the prompt unchanged')
ok(!(readStateFile().presetBlocked?.['fde-engineering'] || []).includes('writing'),
  'a refused delete leaves no presetBlocked entry')

/* the guard covers the local-only branch too */
const guardLocalSave = await postPreset({ action: 'save', preset: { id: 'smoke-guard-local', title: '守卫预设', rules: [] } })
ok(guardLocalSave.status === 200, 'a local preset can be saved for the guard test')
const useGuardLocal = await postPreset({ action: 'use', preset: 'smoke-guard-local', cwd: projectDir })
ok(useGuardLocal.status === 200, 'the local preset is in use')
const deleteLocalInUse = await postPreset({ action: 'delete', packId: 'fde-engineering', preset: 'smoke-guard-local', cwd: projectDir })
ok(deleteLocalInUse.status === 400
  && deleteLocalInUse.data.error === 'preset is in use: smoke-guard-local; switch preset first',
  'deleting the effective local preset is refused')
const restoreProjectPreset = await postPreset({ action: 'use', preset: 'smoke-slice', cwd: projectDir })
ok(restoreProjectPreset.status === 200, 'the project preset is restored after the guard tests')

/* ---------------- a preset any session chose is in use ----------------
 * The in-request guard only sees the context the request names, so delete and
 * block must also refuse an id another session is pointing at: otherwise that
 * session keeps a dangling preset and its excluded rules are silently
 * re-admitted. */

console.log('preset guard across sessions:')
const sessionsDirPath = path.join(home, 'workstyle', 'sessions')
fs.mkdirSync(sessionsDirPath, { recursive: true })
const crossSessionId = 'preset-cross-' + Date.now()
fs.writeFileSync(path.join(sessionsDirPath, crossSessionId + '.json'),
  JSON.stringify({ preset: 'writing' }) + '\n')
const deleteUsedElsewhere = await postPreset({ action: 'delete', packId: 'fde-engineering', preset: 'writing' })
ok(deleteUsedElsewhere.status === 400
  && Array.isArray(deleteUsedElsewhere.data.sessions)
  && deleteUsedElsewhere.data.sessions.includes(crossSessionId),
  'deleting a preset another session chose is refused and names that session')
ok(/^preset is in use by session .+; switch preset first$/.test(deleteUsedElsewhere.data.error || ''),
  'the cross-session refusal explains the session-level use')
ok(!(readStateFile().presetBlocked?.['fde-engineering'] || []).includes('writing'),
  'a refused cross-session delete leaves no presetBlocked entry')
const blockUsedElsewhere = await postPreset({ action: 'block', packId: 'fde-engineering', preset: 'writing' })
ok(blockUsedElsewhere.status === 400
  && (blockUsedElsewhere.data.sessions || []).includes(crossSessionId),
  'blocking a preset another session chose is refused too')
ok(!(readStateFile().presetBlocked?.['fde-engineering'] || []).includes('writing'),
  'a refused cross-session block leaves no presetBlocked entry')
const deleteInNamedSession = await postPreset({ action: 'delete', packId: 'fde-engineering', preset: 'writing', sessionId: crossSessionId })
ok(deleteInNamedSession.status === 400
  && deleteInNamedSession.data.error === 'preset is in use: writing; switch preset first',
  'a session named in the request still gets the in-request in-use message')

/* a hand-written session preset is trimmed on read, so it still composes */
const paddedSessionId = 'preset-padded-' + Date.now()
fs.writeFileSync(path.join(sessionsDirPath, paddedSessionId + '.json'),
  JSON.stringify({ preset: ' writing ' }) + '\n')
const paddedScope = await callRoute('/api/dsh-workstyle/scope?session=' + paddedSessionId)
ok(paddedScope.data.activePreset && paddedScope.data.activePreset.id === 'writing',
  'a session preset is trimmed on read before composing')

/* ---------------- user pack delete: commit first, prune the block ---------------- */

console.log('preset delete ordering:')
const orderPackDir = path.join(home, 'workstyle', 'packs', 'order-pack')
fs.mkdirSync(path.join(orderPackDir, 'skills'), { recursive: true })
fs.writeFileSync(path.join(orderPackDir, 'workstyle.json'), JSON.stringify({
  id: 'order-pack', name: 'order-pack', displayName: 'Order Pack', version: '0.1.0',
  rules: [{ id: 'order-owned', title: '顺序规则', text: '先提交包文件。' }],
  presets: [{ id: 'order-shipped', title: '顺序预设', rules: ['order-owned'], skills: [], templates: [] }],
}, null, 2) + '\n')
const applyOrderPack = await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'order-pack' } })
ok(applyOrderPack.status === 200, 'the ordering fixture pack applies')
const orderOverride = await postPreset({ action: 'save', target: 'overlay', packId: 'order-pack', preset: { id: 'order-shipped', title: '本机覆盖', rules: [] } })
ok(orderOverride.status === 200, 'the user pack preset carries a local override')
const blockOrderPreset = await postPreset({ action: 'block', packId: 'order-pack', preset: 'order-shipped' })
ok(blockOrderPreset.status === 200, 'the user pack preset can be blocked')

const orderPackFile = path.join(orderPackDir, 'workstyle.json')
const orderPackBytes = fs.readFileSync(orderPackFile, 'utf8')
const stateBeforeFailedDelete = readStateFile()
/* A failed pack read must not move any state. Replacing the manifest with a
 * directory fails the read on every platform and under any uid, unlike a chmod
 * 0555 parent, which root ignores and which therefore skipped this block. */
const orderPackBackup = orderPackFile + '.bak'
fs.renameSync(orderPackFile, orderPackBackup)
fs.mkdirSync(orderPackFile)
try {
  const failedDelete = await postPreset({ action: 'delete', packId: 'order-pack', preset: 'order-shipped' })
  ok(failedDelete.status === 400, 'an unreadable pack manifest surfaces as a 400')
  const stateAfterFailedDelete = readStateFile()
  ok(JSON.stringify(stateAfterFailedDelete.presets) === JSON.stringify(stateBeforeFailedDelete.presets),
    'a failed pack commit leaves the local override untouched')
  ok(JSON.stringify(stateAfterFailedDelete.presetBlocked) === JSON.stringify(stateBeforeFailedDelete.presetBlocked),
    'a failed pack commit leaves presetBlocked untouched')
  ok(fs.statSync(orderPackFile).isDirectory(),
    'a failed pack commit does not rewrite the manifest')
} finally {
  fs.rmdirSync(orderPackFile)
  fs.renameSync(orderPackBackup, orderPackFile)
}
ok(fs.readFileSync(orderPackFile, 'utf8') === orderPackBytes,
  'the restored pack manifest is byte-identical')

const deleteOrderPreset = await postPreset({ action: 'delete', packId: 'order-pack', preset: 'order-shipped' })
ok(deleteOrderPreset.status === 200 && deleteOrderPreset.data.removed === 'pack'
  && deleteOrderPreset.data.local === true,
  'deleting a shipped+overridden user pack preset edits the pack file')
const orderPackAfterDelete = JSON.parse(fs.readFileSync(orderPackFile, 'utf8'))
ok(!(orderPackAfterDelete.presets || []).some((preset) => preset.id === 'order-shipped'),
  'the deleted preset is gone from the user pack file')
const orderStateAfterDelete = readStateFile()
ok(!(orderStateAfterDelete.presets || []).some((preset) => preset.id === 'order-shipped'),
  'the local override is gone from the state file')
ok(!(orderStateAfterDelete.presetBlocked?.['order-pack'] || []).includes('order-shipped'),
  'deleting a pack preset prunes its stale block entry')
const unblockVanished = await postPreset({ action: 'unblock', packId: 'order-pack', preset: 'order-shipped' })
ok(unblockVanished.status === 404, 'unblocking a vanished preset is a 404')

/* ---------------- a pristine user-pack delete is a true no-op ----------------
 * With no local override and no stale block entry there is nothing to drop in
 * the overlay, so state.json must keep its bytes and its revision history. */

console.log('preset delete no-op:')
const stateFilePath = path.join(home, 'workstyle', 'state.json')
const newestStateRevision = () => {
  try {
    const index = JSON.parse(fs.readFileSync(path.join(home, 'workstyle', 'revisions', 'index.json'), 'utf8'))
    const entry = Object.values(index.files || {}).find((row) => row && path.resolve(row.path) === stateFilePath)
    return entry && entry.entries.length ? entry.entries[0].id : null
  } catch { return null }
}
const noopPackDir = path.join(home, 'workstyle', 'packs', 'noop-pack')
fs.mkdirSync(path.join(noopPackDir, 'skills'), { recursive: true })
fs.writeFileSync(path.join(noopPackDir, 'workstyle.json'), JSON.stringify({
  id: 'noop-pack', name: 'noop-pack', displayName: 'Noop Pack', version: '0.1.0',
  rules: [{ id: 'noop-owned', title: '空转规则', text: '删除空转预设不应改写状态文件。' }],
  presets: [{ id: 'noop-shipped', title: '空转预设', rules: ['noop-owned'], skills: [], templates: [] }],
}, null, 2) + '\n')
const applyNoopPack = await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'noop-pack' } })
ok(applyNoopPack.status === 200, 'the no-op fixture pack applies')
const stateBytesBeforeNoop = fs.readFileSync(stateFilePath, 'utf8')
const stateRevisionBeforeNoop = newestStateRevision()
ok(stateRevisionBeforeNoop !== null, 'the state file has a recorded revision to compare against')
const noopDelete = await postPreset({ action: 'delete', packId: 'noop-pack', preset: 'noop-shipped' })
ok(noopDelete.status === 200 && noopDelete.data.removed === 'pack' && noopDelete.data.local === undefined,
  'deleting a pristine shipped user-pack preset edits only the pack file')
ok(fs.readFileSync(stateFilePath, 'utf8') === stateBytesBeforeNoop,
  'a no-op delete leaves state.json byte-identical')
ok(newestStateRevision() === stateRevisionBeforeNoop,
  'a no-op delete records no state revision')
const noopDeleteAgain = await postPreset({ action: 'delete', packId: 'noop-pack', preset: 'noop-shipped' })
ok(noopDeleteAgain.status === 404 && noopDeleteAgain.data.error === 'unknown preset: noop-shipped',
  'deleting an already-gone preset is a 404')
ok(fs.readFileSync(stateFilePath, 'utf8') === stateBytesBeforeNoop
  && newestStateRevision() === stateRevisionBeforeNoop,
  'the second delete leaves state.json and its revisions alone')

/* ---------------------------------------------------------------------------
 * pack lifecycle: POST /pack create / duplicate / rename / delete / restore /
 * import. A pack is a directory under $DSH_HOME/workstyle/packs; deleting one
 * is a reversible move into $DSH_HOME/workstyle/trash.
 * ------------------------------------------------------------------------- */

console.log('pack lifecycle:')
const packsDir = path.join(home, 'workstyle', 'packs')
const trashPath = path.join(home, 'workstyle', 'trash')
const postPack = (body) => callRoute('/api/dsh-workstyle/pack', { method: 'POST', body })
const readPackManifest = (id) => JSON.parse(fs.readFileSync(path.join(packsDir, id, 'workstyle.json'), 'utf8'))
const statusPackIds = async () => (await callRoute('/api/dsh-workstyle/status')).data.packs.map((pack) => pack.id)
const lifecycleShape = (data, action) => data && data.action === action
  && typeof data.packId === 'string'
  && Array.isArray(data.packs)
  && typeof data.activePackId === 'string'
/* Every pack-shaped directory on disk, whether it ships json or yaml. */
const packsOnDisk = () => {
  let names = []
  try { names = fs.readdirSync(packsDir) } catch { return [] }
  return names.filter((name) => {
    const dir = path.join(packsDir, name)
    try {
      return fs.statSync(dir).isDirectory()
        && (fs.existsSync(path.join(dir, 'workstyle.json')) || fs.existsSync(path.join(dir, 'workstyle.yaml')))
    } catch { return false }
  }).sort()
}

/* ---- create ---- */

const createBadAction = await postPack({ action: 'explode' })
ok(createBadAction.status === 400
  && ['apply', 'create', 'duplicate', 'rename', 'delete', 'restore', 'import']
    .every((name) => (createBadAction.data.error || '').includes("'" + name + "'")),
  'an unknown pack action is refused and lists every supported action')

const createdPack = await postPack({ action: 'create', id: 'smoke-created', displayName: '新建包' })
ok(createdPack.status === 200 && lifecycleShape(createdPack.data, 'create'),
  'pack create succeeds and returns the lifecycle shape')
const createdManifest = readPackManifest('smoke-created')
ok(createdManifest.id === 'smoke-created' && createdManifest.displayName === '新建包',
  'the created manifest carries the id and the display name')
ok(Array.isArray(createdManifest.rules) && createdManifest.rules.length === 0
  && Array.isArray(createdManifest.presets) && createdManifest.presets.length === 0
  && Array.isArray(createdManifest.templates) && createdManifest.templates.length === 0,
  'the created pack has empty rules, presets and templates')
ok(fs.existsSync(path.join(packsDir, 'smoke-created', 'skills'))
  && fs.existsSync(path.join(packsDir, 'smoke-created', 'README.md')),
  'the created pack has a skills directory and a README')
ok(Object.prototype.hasOwnProperty.call(createdPack.data, 'revision'),
  'create reports the manifest revision slot')
ok(createdPack.data.packs.some((pack) => pack.id === 'smoke-created'),
  'the create response lists the new pack')
ok((await statusPackIds()).includes('smoke-created'), 'the created pack shows up in /status')

const createExisting = await postPack({ action: 'create', id: 'smoke-created' })
ok(createExisting.status === 400 && createExisting.data.error === 'pack already exists: smoke-created',
  'creating an id that already exists is refused')
const createBadId = await postPack({ action: 'create', id: 'Bad Id' })
ok(createBadId.status === 400 && /must be lowercase letters, digits and dashes/.test(createBadId.data.error || ''),
  "creating an invalid id is refused with checkPackId's message")
const createNoId = await postPack({ action: 'create' })
ok(createNoId.status === 400 && createNoId.data.error === 'pack id is required',
  'creating without an id is refused')

/* apply through the /pack route keeps the historical payload */
const applyViaPackRoute = await postPack({ action: 'apply', pack: 'smoke-created' })
ok(applyViaPackRoute.status === 200 && applyViaPackRoute.data.action === 'apply'
  && applyViaPackRoute.data.applied.id === 'smoke-created'
  && applyViaPackRoute.data.status && applyViaPackRoute.data.status.activePackId === 'smoke-created',
  'POST /pack apply keeps the {action, applied, status} payload')
const applyWithoutPack = await postPack({ action: 'apply' })
ok(applyWithoutPack.status === 400 && applyWithoutPack.data.error === 'pack is required',
  'POST /pack apply without a pack is refused')
const applyUnknownPack = await postPack({ action: 'apply', pack: 'ghost-pack' })
ok(applyUnknownPack.status === 400 && /unknown pack: ghost-pack/.test(applyUnknownPack.data.error || ''),
  'POST /pack apply on an unknown pack is a 400')

/* ---- duplicate ---- */

const dupDefault = await postPack({ action: 'duplicate', from: 'smoke-created' })
ok(dupDefault.status === 200 && lifecycleShape(dupDefault.data, 'duplicate')
  && dupDefault.data.packId === 'smoke-created-copy',
  'duplicate defaults to <from>-copy')
const dupDefaultManifest = readPackManifest('smoke-created-copy')
ok(dupDefaultManifest.id === 'smoke-created-copy' && dupDefaultManifest.name === 'smoke-created-copy',
  'the duplicate rewrites id and name in the copied manifest')
ok(dupDefaultManifest.displayName === '新建包 copy', 'the duplicate marks its display name as a copy')
ok(JSON.stringify(dupDefaultManifest.rules) === JSON.stringify(createdManifest.rules),
  'the duplicate copies the rule list verbatim')

const dupExplicit = await postPack({ action: 'duplicate', from: 'smoke-pack', id: 'smoke-pack-copy' })
ok(dupExplicit.status === 200 && dupExplicit.data.packId === 'smoke-pack-copy',
  'duplicate accepts an explicit id')
const dupRulesManifest = readPackManifest('smoke-pack-copy')
const sourcePackManifest = readPackManifest('smoke-pack')
ok(JSON.stringify(dupRulesManifest.rules) === JSON.stringify(sourcePackManifest.rules),
  'duplicating a pack with rules copies them verbatim')
ok(dupRulesManifest.displayName === 'Smoke Pack copy', 'the duplicate derives the copy name from displayName')
const dupClash = await postPack({ action: 'duplicate', from: 'smoke-created', id: 'smoke-pack-copy' })
ok(dupClash.status === 400 && dupClash.data.error === 'pack already exists: smoke-pack-copy',
  'duplicating onto an existing id is refused')
const dupNoFrom = await postPack({ action: 'duplicate' })
ok(dupNoFrom.status === 400 && /from is required/.test(dupNoFrom.data.error || ''),
  'duplicating without a source is refused')
const dupUnknownFrom = await postPack({ action: 'duplicate', from: 'ghost-pack' })
ok(dupUnknownFrom.status === 400 && /unknown pack: ghost-pack/.test(dupUnknownFrom.data.error || ''),
  'duplicating an unknown pack is refused')

/* ---- rename ---- */

const renameBeforeRules = fs.readFileSync(path.join(packsDir, 'smoke-created-copy', 'workstyle.json'), 'utf8')
const renamedPack = await postPack({ action: 'rename', id: 'smoke-created-copy', displayName: '复制包' })
ok(renamedPack.status === 200 && lifecycleShape(renamedPack.data, 'rename')
  && renamedPack.data.packId === 'smoke-created-copy',
  'pack rename succeeds')
ok(renamedPack.data.revision && typeof renamedPack.data.revision.id === 'string',
  'rename reports the manifest revision')
const renamedManifest = readPackManifest('smoke-created-copy')
ok(renamedManifest.displayName === '复制包', 'rename writes the new display name')
ok(renamedManifest.id === 'smoke-created-copy', 'rename leaves the pack id alone')
ok(JSON.stringify(renamedManifest.rules) === JSON.stringify(JSON.parse(renameBeforeRules).rules),
  'rename leaves the rule list byte-identical')
const renameBundled = await postPack({ action: 'rename', id: 'fde-engineering', displayName: '改名' })
ok(renameBundled.status === 400 && /read-only/.test(renameBundled.data.error || ''),
  'renaming a bundled pack is refused as read-only')
const renameNoDisplayName = await postPack({ action: 'rename', id: 'smoke-created-copy' })
ok(renameNoDisplayName.status === 400 && renameNoDisplayName.data.error === 'displayName is required',
  'rename without a displayName is refused')
const renameNoId = await postPack({ action: 'rename', displayName: '无 id' })
ok(renameNoId.status === 400 && renameNoId.data.error === 'pack id is required',
  'rename without an id is refused')

/* a YAML user pack has no workstyle.json to rewrite */
const yamlPackDir = path.join(packsDir, 'smoke-yaml')
fs.mkdirSync(path.join(yamlPackDir, 'skills'), { recursive: true })
fs.writeFileSync(path.join(yamlPackDir, 'workstyle.yaml'), [
  'id: smoke-yaml',
  'name: smoke-yaml',
  'displayName: YAML Pack',
  'version: 0.1.0',
  'rules:',
  '  - id: yaml-owned',
  '    title: YAML 规则',
  '    text: YAML 包里的规则正文。',
  '',
].join('\n'))
const renameYaml = await postPack({ action: 'rename', id: 'smoke-yaml', displayName: 'YAML 改名' })
ok(renameYaml.status === 400 && /only json packs can be renamed/.test(renameYaml.data.error || ''),
  'renaming a YAML user pack is refused')

/* ---- delete the active pack (and persist the switch: item B) ---- */

const applyCopyPack = await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'smoke-created-copy' } })
ok(applyCopyPack.status === 200, 'the duplicate applies before the delete test')
/* Give the pack a preset, then point the workspace default at it, so the
 * delete has a dangling preset id to drop. */
const copyManifestPath = path.join(packsDir, 'smoke-created-copy', 'workstyle.json')
const copyManifest = JSON.parse(fs.readFileSync(copyManifestPath, 'utf8'))
copyManifest.presets = [{ id: 'copy-preset', title: '复制预设', rules: [], skills: [], templates: [] }]
fs.writeFileSync(copyManifestPath, JSON.stringify(copyManifest, null, 2) + '\n')
await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'smoke-created-copy' } })
ok((await callRoute('/api/dsh-workstyle/status')).data.activePackId === 'smoke-created-copy',
  'the duplicate is the active pack before it is deleted')
fs.writeFileSync(stateFilePath, JSON.stringify({
  ...readStateFile(), activePack: 'smoke-created-copy', activePreset: 'copy-preset',
}, null, 2) + '\n')

const deletedActive = await postPack({ action: 'delete', id: 'smoke-created-copy' })
ok(deletedActive.status === 200 && lifecycleShape(deletedActive.data, 'delete'),
  'deleting the active pack succeeds')
ok(deletedActive.data.activePackId !== 'smoke-created-copy', 'deleting the active pack switches away')
ok(typeof deletedActive.data.trash === 'string' && fs.existsSync(deletedActive.data.trash),
  'delete reports the trash path it moved the pack to')
const persistedAfterDelete = readStateFile()
ok(persistedAfterDelete.activePack === deletedActive.data.activePackId,
  'the active pack switch is persisted to state.json')
ok((await statusPackIds()).includes(persistedAfterDelete.activePack),
  'the persisted active pack id is a live pack')
ok(!('activePreset' in persistedAfterDelete),
  'a workspace preset that belonged to the deleted pack is dropped')
ok(!(await statusPackIds()).includes('smoke-created-copy'), 'the deleted pack is gone from /status')
ok(fs.existsSync(trashPath) && fs.readdirSync(trashPath).some((name) => name.startsWith('smoke-created-copy-')),
  'the deleted pack directory is kept under trash/')
ok(!fs.existsSync(path.join(packsDir, 'smoke-created-copy')), 'the deleted pack directory left packs/')

/* ---- trash listing (GET /pack without an id) ---- */

const packDetailWithId = await callRoute('/api/dsh-workstyle/pack?id=fde-engineering')
ok(packDetailWithId.status === 200 && !!packDetailWithId.data.pack && !('trash' in packDetailWithId.data),
  'GET /pack?id= keeps the pack-detail contract unchanged')

const olderTrash = path.join(trashPath, 'smoke-older-2026-11-08T00-00-00-000Z')
fs.mkdirSync(olderTrash, { recursive: true })
const trashListing = await callRoute('/api/dsh-workstyle/pack')
ok(trashListing.status === 200 && Array.isArray(trashListing.data.trash) && trashListing.data.dir === trashPath,
  'GET /pack without an id lists the trash instead of demanding an id')
const listedDeleted = trashListing.data.trash.find((row) => row.id === 'smoke-created-copy')
ok(!!listedDeleted && listedDeleted.name.startsWith('smoke-created-copy-')
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(listedDeleted.at || ''),
  'a trashed pack is listed with its directory name and the delete timestamp')
const listedOlder = trashListing.data.trash.find((row) => row.id === 'smoke-older')
ok(!!listedOlder && listedOlder.name === 'smoke-older-2026-11-08T00-00-00-000Z'
  && listedOlder.at === '2026-11-08T00:00:00.000Z',
  'the trash id is the name up to its ISO stamp')
ok(trashListing.data.trash[0].id === 'smoke-created-copy'
  && trashListing.data.trash.findIndex((row) => row.id === 'smoke-older') > 0,
  'the newest trash entry is listed first')
fs.rmSync(olderTrash, { recursive: true, force: true })

const deleteBundled = await postPack({ action: 'delete', id: 'fde-engineering' })
ok(deleteBundled.status === 400 && /read-only/.test(deleteBundled.data.error || ''),
  'deleting a bundled pack is refused as read-only')
const deleteUnknown = await postPack({ action: 'delete', id: 'ghost-pack' })
ok(deleteUnknown.status === 400 && /unknown pack: ghost-pack/.test(deleteUnknown.data.error || ''),
  'deleting an unknown pack is refused')
const deleteNoId = await postPack({ action: 'delete' })
ok(deleteNoId.status === 400 && deleteNoId.data.error === 'pack id is required',
  'deleting without an id is refused')

/* ---- restore ---- */

const restoredPack = await postPack({ action: 'restore', id: 'smoke-created-copy' })
ok(restoredPack.status === 200 && lifecycleShape(restoredPack.data, 'restore')
  && restoredPack.data.packId === 'smoke-created-copy',
  'pack restore succeeds')
ok((await statusPackIds()).includes('smoke-created-copy'), 'the restored pack is back in /status')
ok(readPackManifest('smoke-created-copy').displayName === '复制包',
  'restore brings the edited manifest back unchanged')
const restoreAgain = await postPack({ action: 'restore', id: 'smoke-created-copy' })
ok(restoreAgain.status === 400 && restoreAgain.data.error === 'pack already exists: smoke-created-copy',
  'restoring an id that is live again is refused as a clash')
const restoreUnknown = await postPack({ action: 'restore', id: 'ghost-pack' })
ok(restoreUnknown.status === 404 && restoreUnknown.data.error === 'no trashed pack: ghost-pack',
  'restoring an id with no trash entry is a 404')
fs.rmSync(trashPath, { recursive: true, force: true })
const emptyTrashListing = await callRoute('/api/dsh-workstyle/pack')
ok(emptyTrashListing.status === 200 && Array.isArray(emptyTrashListing.data.trash)
  && emptyTrashListing.data.trash.length === 0 && emptyTrashListing.data.dir === trashPath,
  'GET /pack lists an empty trash as [] rather than a 404')
const restoreEmptyTrash = await postPack({ action: 'restore', id: 'ghost-pack' })
ok(restoreEmptyTrash.status === 404 && restoreEmptyTrash.data.error === 'trash is empty',
  'restoring with no trash directory is a 404')

/* ---- import ---- */

const importSource = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-import-'))
fs.mkdirSync(path.join(importSource, 'skills'), { recursive: true })
fs.writeFileSync(path.join(importSource, 'workstyle.json'), JSON.stringify({
  id: 'smoke-imported', name: 'smoke-imported', displayName: 'Imported', version: '0.1.0',
  rules: [{ id: 'imported-rule', title: '导入规则', text: '导入正文。' }],
}, null, 2) + '\n')
const importSourceBytes = fs.readFileSync(path.join(importSource, 'workstyle.json'), 'utf8')

const importedPack = await postPack({ action: 'import', path: importSource })
ok(importedPack.status === 200 && lifecycleShape(importedPack.data, 'import')
  && importedPack.data.packId === 'smoke-imported',
  'pack import from a directory succeeds')
ok((await statusPackIds()).includes('smoke-imported'), 'the imported pack is listed')
const importedDetail = await callRoute('/api/dsh-workstyle/pack?id=smoke-imported')
ok(importedDetail.status === 200 && importedDetail.data.pack.rules.some((rule) => rule.id === 'imported-rule'),
  'the imported pack keeps its rule')
ok(fs.existsSync(path.join(packsDir, 'smoke-imported', 'skills')), 'import copies the pack subdirectories')
ok(fs.readFileSync(path.join(importSource, 'workstyle.json'), 'utf8') === importSourceBytes
  && fs.statSync(importSource).isDirectory(),
  'import does not mutate the source directory')
const importClash = await postPack({ action: 'import', path: importSource })
ok(importClash.status === 400 && importClash.data.error === 'pack already exists: smoke-imported',
  'importing the same pack twice is refused as a clash')
const importMissingPath = await postPack({ action: 'import', path: path.join(os.tmpdir(), 'dsh-workstyle-nope-' + Date.now()) })
ok(importMissingPath.status === 400 && importMissingPath.data.error === 'path must be an existing directory',
  'importing a missing path is refused')
const importNoPath = await postPack({ action: 'import' })
ok(importNoPath.status === 400 && importNoPath.data.error === 'path must be an existing directory',
  'importing without a path is refused')
const importFilePath = path.join(os.tmpdir(), 'dsh-workstyle-import-file-' + Date.now())
fs.writeFileSync(importFilePath, 'not a pack\n')
const importAFile = await postPack({ action: 'import', path: importFilePath })
ok(importAFile.status === 400 && importAFile.data.error === 'path must be an existing directory',
  'importing a file instead of a directory is refused')
const noManifestSource = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-empty-'))
const importNoManifest = await postPack({ action: 'import', path: noManifestSource })
ok(importNoManifest.status === 400 && /no workstyle\.json or workstyle\.yaml/.test(importNoManifest.data.error || ''),
  'importing a directory without a manifest is refused')
/* a source that contains the destination cannot be copied into itself */
const packsRootManifest = path.join(packsDir, 'workstyle.json')
fs.writeFileSync(packsRootManifest, JSON.stringify({
  id: 'self-import', name: 'self-import', version: '0.1.0', rules: [],
}, null, 2) + '\n')
const packsRootBytes = fs.readFileSync(packsRootManifest, 'utf8')
try {
  const importIntoSelf = await postPack({ action: 'import', path: packsDir })
  ok(importIntoSelf.status === 400 && importIntoSelf.data.error === 'cannot import a pack into itself',
    'importing a pack into itself is refused')
  ok(fs.readFileSync(packsRootManifest, 'utf8') === packsRootBytes,
    'a refused self-import leaves the source manifest alone')
} finally {
  fs.rmSync(packsRootManifest, { force: true })
}
fs.rmSync(importSource, { recursive: true, force: true })
fs.rmSync(importFilePath, { force: true })
fs.rmSync(noManifestSource, { recursive: true, force: true })

/* ---- item A: a YAML user pack must not advertise an unwritable json file ---- */

console.log('pack YAML writable (item A):')
const applyYamlPack = await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'smoke-yaml' } })
ok(applyYamlPack.status === 200, 'the YAML user pack applies')
const yamlStatus = await callRoute('/api/dsh-workstyle/status')
const yamlRule = yamlStatus.data.rules.find((rule) => rule.id === 'yaml-owned')
ok(yamlRule && yamlRule.writable.scope === 'pack' && yamlRule.writable.packId === 'smoke-yaml'
  && yamlRule.writable.file === null,
  'a YAML pack rule advertises no writable json file')
const yamlRuleEdit = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'smoke-yaml', rule: { id: 'yaml-owned', text: '改正文。' } },
})
ok(yamlRuleEdit.status === 400
  && yamlRuleEdit.data.error === 'pack uses workstyle.yaml; edit the file by hand: smoke-yaml',
  'editing a YAML pack rule points at the yaml file instead of failing with ENOENT')
ok(fs.existsSync(path.join(yamlPackDir, 'workstyle.yaml'))
  && !fs.existsSync(path.join(yamlPackDir, 'workstyle.json')),
  'a refused YAML edit writes no json manifest')

/* the json user pack path still writes through */
const yamlThenJson = await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'smoke-pack' } })
ok(yamlThenJson.status === 200, 'a json user pack still applies after the YAML pack')
const jsonRuleEdit = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'smoke-pack', rule: { id: 'smoke-owned', text: '仍写 json。' } },
})
ok(jsonRuleEdit.status === 200, 'a json user pack rule still writes into its manifest')
await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'fde-engineering' } })

/* ---- /rule target:'overlay': explicit overlay writes, never the pack file ---- */

console.log("rule target=overlay:")
const overlayPackFile = path.join(root, 'pack', 'reference', 'workstyle.json')
const overlayPackRefDir = path.join(root, 'pack', 'reference')
const overlayPackBytes = fs.readFileSync(overlayPackFile, 'utf8')
const overlayPackMtime = fs.statSync(overlayPackRefDir).mtimeMs
const yamlPackFile = path.join(yamlPackDir, 'workstyle.yaml')
const yamlPackBytes = fs.readFileSync(yamlPackFile, 'utf8')
const yamlPackMtime = fs.statSync(yamlPackFile).mtimeMs
const jsonPackManifest = path.join(packsDir, 'smoke-pack', 'workstyle.json')
const jsonPackBytes = fs.readFileSync(jsonPackManifest, 'utf8')

const overlayEdit = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'overlay', packId: 'fde-engineering', rule: { id: 'plan-first', title: '本机改写', text: '本机正文。' } },
})
ok(overlayEdit.status === 200 && overlayEdit.data.saved === 'rule',
  "target:'overlay' edits a bundled rule")
ok(readStateFile().rulePatches['fde-engineering']['plan-first'].text === '本机正文。',
  'the overlay edit lands in state.rulePatches')
ok(overlayEdit.data.writable && overlayEdit.data.writable.scope === 'overlay'
  && overlayEdit.data.writable.packId === 'fde-engineering',
  'the response names the overlay as the write target')
ok((await callRoute('/api/dsh-workstyle/status')).data.rules.find((rule) => rule.id === 'plan-first').text === '本机正文。',
  '/status shows the overlay text')
ok((await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first').text === '本机正文。',
  '/scope shows the overlay text')
ok(fs.readFileSync(overlayPackFile, 'utf8') === overlayPackBytes,
  'the bundled pack file is byte-identical after an overlay edit')
ok(fs.statSync(overlayPackRefDir).mtimeMs === overlayPackMtime,
  'pack/reference mtime is unchanged after an overlay edit')

const overlayRemove = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'overlay', packId: 'fde-engineering', rule: { id: 'plan-first' }, remove: true },
})
ok(overlayRemove.status === 200 && overlayRemove.data.saved === 'removed',
  "target:'overlay' removes a bundled rule")
const overlayTombstone = (await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first')
ok(overlayTombstone && overlayTombstone.removed === true,
  'the overlay removal is a visible tombstone in /scope')
ok(fs.readFileSync(overlayPackFile, 'utf8') === overlayPackBytes,
  'the bundled pack file is still byte-identical after an overlay removal')

const overlayRestore = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'overlay', packId: 'fde-engineering', action: 'restore', rule: { id: 'plan-first' } },
})
ok(overlayRestore.status === 200 && overlayRestore.data.saved === 'restored',
  "target:'overlay' restores a bundled rule")
ok((await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first').text === '本机正文。',
  'restore returns the patched text, not the pristine pack text')
ok(readStateFile().rulePatches['fde-engineering']['plan-first'].text === '本机正文。',
  'restoring keeps the overlay patch in state.rulePatches')

const yamlOverlayEdit = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'overlay', packId: 'smoke-yaml', rule: { id: 'yaml-owned', title: 'YAML 本机改写', text: 'YAML 本机正文。' } },
})
ok(yamlOverlayEdit.status === 200 && yamlOverlayEdit.data.saved === 'rule',
  "target:'overlay' is legal for a YAML user pack")
ok(readStateFile().rulePatches['smoke-yaml']['yaml-owned'].text === 'YAML 本机正文。',
  'a YAML pack overlay edit lands in state.rulePatches')
ok(fs.readFileSync(yamlPackFile, 'utf8') === yamlPackBytes && fs.statSync(yamlPackFile).mtimeMs === yamlPackMtime,
  'the YAML pack file is byte-identical after an overlay edit')
const yamlPackTarget = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'smoke-yaml', rule: { id: 'yaml-owned', text: '不该写 yaml。' } },
})
ok(yamlPackTarget.status === 400,
  "target:'pack' still refuses a YAML pack, so the overlay route is the only edit path")

const jsonOverlayEdit = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'overlay', packId: 'smoke-pack', rule: { id: 'smoke-owned', title: 'JSON 本机改写', text: 'JSON 本机正文。' } },
})
ok(jsonOverlayEdit.status === 200 && jsonOverlayEdit.data.saved === 'rule',
  "target:'overlay' is legal for a user JSON pack")
ok(readStateFile().rulePatches['smoke-pack']['smoke-owned'].text === 'JSON 本机正文。',
  'a user JSON pack overlay edit lands in state.rulePatches')
ok(fs.readFileSync(jsonPackManifest, 'utf8') === jsonPackBytes,
  'a user JSON pack file is byte-identical after an overlay edit')

const overlayUnknownPack = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'overlay', packId: 'nope', rule: { id: 'plan-first' } },
})
ok(overlayUnknownPack.status === 404 && overlayUnknownPack.data.error === 'unknown pack: nope',
  "target:'overlay' with an unknown pack is a 404")
const overlayUnknownRule = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'overlay', packId: 'fde-engineering', rule: { id: 'nope' } },
})
ok(overlayUnknownRule.status === 404 && overlayUnknownRule.data.error === 'unknown rule: nope',
  "target:'overlay' with an unknown rule is a 404")

const bogusRuleTarget = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'bogus' },
})
ok(bogusRuleTarget.status === 400
  && bogusRuleTarget.data.error === "target must be 'pack', 'overlay', 'project' or 'session'",
  'an unknown rule target is a 400 with the four-target message')

/* ---- /status must agree with the packs directory ---- */

console.log('pack status matches the filesystem:')
const onDisk = packsOnDisk()
const statusPacks = (await callRoute('/api/dsh-workstyle/status')).data.packs
/* Bundled packs live in the package, so only compare the user-pack directory. */
const statusUserIds = statusPacks
  .filter((pack) => pack.dir.startsWith(packsDir + path.sep))
  .map((pack) => pack.id)
  .sort()
ok(JSON.stringify(statusUserIds) === JSON.stringify(onDisk),
  '/status lists exactly the user pack directories on disk (' + onDisk.length + ')')
ok(statusUserIds.includes('smoke-yaml') && statusUserIds.includes('smoke-imported')
  && statusUserIds.includes('smoke-created'),
  'the lifecycle fixtures are all present on disk and in /status')

/* ---- item E: force escape hatch for a preset pinned by a stale session ---- */

console.log('preset delete force (item E):')
const forceSessionId = 'preset-force-' + Date.now()
fs.mkdirSync(sessionsDirPath, { recursive: true })
fs.writeFileSync(path.join(sessionsDirPath, forceSessionId + '.json'),
  JSON.stringify({ preset: 'writing' }) + '\n')
const deletePinnedPreset = await postPreset({ action: 'delete', packId: 'fde-engineering', preset: 'writing' })
ok(deletePinnedPreset.status === 400
  && (deletePinnedPreset.data.sessions || []).includes(forceSessionId),
  'a preset pinned by a session still refuses delete without force')
const deleteForcedPreset = await postPreset({ action: 'delete', packId: 'fde-engineering', preset: 'writing', force: true })
ok(deleteForcedPreset.status === 200 && deleteForcedPreset.data.removed === 'blocked',
  'force: true skips the cross-session guard')
ok((readStateFile().presetBlocked?.['fde-engineering'] || []).includes('writing'),
  'a forced delete still blocks the preset')
const forcedInNamedSession = await postPreset({
  action: 'delete', packId: 'fde-engineering', preset: 'writing', force: true, sessionId: forceSessionId,
})
ok(forcedInNamedSession.status === 400
  && forcedInNamedSession.data.error === 'preset is in use: writing; switch preset first',
  'force never skips the in-request in-use guard')
const unblockForcedPreset = await postPreset({ action: 'unblock', packId: 'fde-engineering', preset: 'writing' })
ok(unblockForcedPreset.status === 200, 'the forced block is cleaned up')

const forceBlockSessionId = 'preset-force-block-' + Date.now()
fs.writeFileSync(path.join(sessionsDirPath, forceBlockSessionId + '.json'),
  JSON.stringify({ preset: 'fde-delivery' }) + '\n')
const blockPinnedPreset = await postPreset({ action: 'block', packId: 'fde-engineering', preset: 'fde-delivery' })
ok(blockPinnedPreset.status === 400
  && (blockPinnedPreset.data.sessions || []).includes(forceBlockSessionId),
  'a pinned preset refuses block without force')
const blockForcedPreset = await postPreset({ action: 'block', packId: 'fde-engineering', preset: 'fde-delivery', force: true })
ok(blockForcedPreset.status === 200 && blockForcedPreset.data.removed === 'blocked',
  'force: true skips the cross-session guard for block')
const unblockForcedBlock = await postPreset({ action: 'unblock', packId: 'fde-engineering', preset: 'fde-delivery' })
ok(unblockForcedBlock.status === 200, 'the forced block for block is cleaned up')

await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'fde-engineering' } })

/* ---------------- revisions ---------------- */

console.log('revisions:')

const revList = await callRoute('/api/dsh-workstyle/revisions')
ok(revList.status === 200 && Array.isArray(revList.data.revisions), 'GET /revisions lists snapshots')
const firstRev = revList.data.revisions.find((rev) => rev.reason && rev.reason.startsWith('preset-save:'))
ok(!!firstRev, 'preset edits leave revisions behind')
ok(typeof firstRev.file === 'string' && firstRev.file.length > 0, 'revision rows report the file they belong to')

const revByFile = await callRoute('/api/dsh-workstyle/revisions?file=' + encodeURIComponent(firstRev.file))
ok(revByFile.status === 200 && revByFile.data.revisions.every((rev) => rev.file === firstRev.file), 'GET /revisions filters by file')

const revUnknownFile = await callRoute('/api/dsh-workstyle/revisions?file=' + encodeURIComponent(path.join(home, 'not-a-workstyle-file.json')))
ok(revUnknownFile.status === 200 && revUnknownFile.data.revisions.length === 0,
  'an unknown file filters to an empty list, never an error')

const restoreRev = await callRoute('/api/dsh-workstyle/revisions', { method: 'POST', body: { action: 'restore', id: firstRev.id } })
ok(restoreRev.status === 200, 'POST /revisions restores a snapshot')
ok(restoreRev.data.restored.file === firstRev.file, 'restore reports the file it wrote')
ok(typeof restoreRev.data.restored.revision === 'string', 'restore snapshots the overwritten content')

const revRestoreUnknown = await callRoute('/api/dsh-workstyle/revisions', { method: 'POST', body: { action: 'restore', id: 'no-such-revision' } })
ok(revRestoreUnknown.status === 404, 'unknown revision id is a 404')
const revRestoreBad = await callRoute('/api/dsh-workstyle/revisions', { method: 'POST', body: { action: 'nope' } })
ok(revRestoreBad.status === 400, 'unknown revision action is a 400')
const revRestoreNoId = await callRoute('/api/dsh-workstyle/revisions', { method: 'POST', body: { action: 'restore' } })
ok(revRestoreNoId.status === 400, 'restore without an id is a 400')
const revPostRoute = registered.routes.get('/api/dsh-workstyle/revisions POST')
assert.ok(revPostRoute, 'route missing: /api/dsh-workstyle/revisions POST')
const badJsonBody = await revPostRoute.fetch(new Request('http://localhost/api/dsh-workstyle/revisions', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":',
}))
const badJsonData = await badJsonBody.json()
ok(badJsonBody.status === 400 && typeof badJsonData.error === 'string', 'a malformed JSON body is a 400')

/* ---- state rollback: what the panel's restore button actually does ---- */

console.log('state rollback:')
await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'fde-engineering' } })
const pristineRule = (await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first')
const beforePatchFingerprint = (await callRoute('/api/dsh-workstyle/inject')).data.fingerprint
const patchBefore = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', rule: { id: 'plan-first', title: '回滚前标题', text: '回滚前正文。' } },
})
ok(patchBefore.status === 200, 'a bundled rule patch lands in state.json')
ok((await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first').title === '回滚前标题',
  '/scope shows the patched title before the rollback')
/* Move the active pack away: the rollback must re-resolve it from the restored
 * state, not keep whatever was active before the restore. */
ok((await callRoute('/api/dsh-workstyle/apply', { method: 'POST', body: { pack: 'smoke-pack' } })).status === 200,
  'the active pack moves to smoke-pack before the rollback')

const stateRevs = await callRoute('/api/dsh-workstyle/revisions?file=' + encodeURIComponent(stateFilePath))
/* Newest first: this is the snapshot the patch took before it overwrote
 * state.json, so replaying it drops the patch and restores the fde-engineering
 * active pack at that moment. Asserting the exact row (not just "some
 * revisions exist") is what makes a missing pre-write snapshot go red. */
const patchRev = stateRevs.data.revisions[0]
ok(stateRevs.status === 200 && !!patchRev && patchRev.reason === 'rule-patch:plan-first',
  'revisions[0] of state.json is the snapshot this rule patch took before writing')
const rollback = await callRoute('/api/dsh-workstyle/revisions', { method: 'POST', body: { action: 'restore', id: patchRev.id } })
ok(rollback.status === 200 && rollback.data.restored.file === stateFilePath, 'restoring a state.json revision succeeds')
ok(rollback.data.status && rollback.data.status.activePackId === 'fde-engineering',
  'the rollback response re-resolves the active pack from the restored state')
const afterRollback = (await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first')
ok(afterRollback.title === pristineRule.title && afterRollback.text === pristineRule.text,
  '/scope serves the pre-patch rule text again')
ok((await callRoute('/api/dsh-workstyle/inject')).data.fingerprint === beforePatchFingerprint,
  'rolling back the patch returns the fingerprint the prompt had before it')
ok((await callRoute('/api/dsh-workstyle/status')).data.activePackId === 'fde-engineering',
  '/status names the pack the restored state points at')

/* ---- the first overlay edit on a virgin $DSH_HOME is undoable ----
 * The README promises "edit a bundled rule, then roll it back". On a fresh
 * install state.json does not exist yet, so the pre-write snapshot must be
 * taken against a seeded file, not skipped. This needs its own throwaway home:
 * the shared fixture above has been written many times and cannot show it. */

console.log('virgin home rollback:')
const virginHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-virgin-'))
const virginStateFile = path.join(virginHome, 'workstyle', 'state.json')
const warmHome = process.env.DSH_HOME
try {
  process.env.DSH_HOME = virginHome
  ok(!fs.existsSync(virginStateFile), 'a fresh DSH_HOME starts without state.json')
  const virginFirstFingerprint = (await callRoute('/api/dsh-workstyle/inject')).data.fingerprint
  const firstOverlayEdit = await callRoute('/api/dsh-workstyle/rule', {
    method: 'POST',
    body: { target: 'overlay', packId: 'fde-engineering', rule: { id: 'plan-first', title: '首次改写', text: '首次改写的正文。' } },
  })
  ok(firstOverlayEdit.status === 200 && fs.existsSync(virginStateFile),
    'the first overlay edit on a fresh home writes state.json')
  const revsAfterFirst = await callRoute('/api/dsh-workstyle/revisions?file=' + encodeURIComponent(virginStateFile))
  ok(revsAfterFirst.status === 200 && revsAfterFirst.data.revisions.length === 1
    && revsAfterFirst.data.revisions[0].reason === 'rule-patch:plan-first',
  'the first overlay edit on a fresh home records a rollback revision')
  const firstOverlayFingerprint = (await callRoute('/api/dsh-workstyle/inject')).data.fingerprint
  ok(firstOverlayFingerprint !== virginFirstFingerprint,
    'the first overlay edit changes the injected fingerprint')

  const secondOverlayEdit = await callRoute('/api/dsh-workstyle/rule', {
    method: 'POST',
    body: { target: 'overlay', packId: 'fde-engineering', rule: { id: 'plan-first', title: '第二次改写', text: '第二次改写的正文。' } },
  })
  ok(secondOverlayEdit.status === 200, 'the second overlay edit on a fresh home lands')
  const revsAfterSecond = await callRoute('/api/dsh-workstyle/revisions?file=' + encodeURIComponent(virginStateFile))
  ok(revsAfterSecond.data.revisions.length === 2,
    'two overlay edits on a fresh home leave exactly two state.json revisions')
  const oldestVirginRev = revsAfterSecond.data.revisions[revsAfterSecond.data.revisions.length - 1]
  ok(oldestVirginRev.reason === 'rule-patch:plan-first' && oldestVirginRev.id !== revsAfterSecond.data.revisions[0].id,
    'the oldest revision is the snapshot taken before the first edit')
  const virginRollback = await callRoute('/api/dsh-workstyle/revisions', {
    method: 'POST', body: { action: 'restore', id: oldestVirginRev.id },
  })
  ok(virginRollback.status === 200 && virginRollback.data.restored.file === virginStateFile,
    'restoring the oldest revision of a fresh home succeeds')
  const virginAfterRollback = (await callRoute('/api/dsh-workstyle/inject')).data
  ok(virginAfterRollback.fingerprint === virginFirstFingerprint,
    'restoring the oldest revision returns the pre-first-edit fingerprint')
} finally {
  process.env.DSH_HOME = warmHome
}

/* ---- a snapshot that vanished is data damage, not a client error ---- */

const damagedList = await callRoute('/api/dsh-workstyle/revisions')
const doomedRev = damagedList.data.revisions[0]
const doomedSnapshot = path.join(home, 'workstyle', 'revisions', doomedRev.id.slice(0, 10), doomedRev.id.slice(11) + '.json')
assert.ok(fs.existsSync(doomedSnapshot), 'expected snapshot file missing: ' + doomedSnapshot)
fs.rmSync(doomedSnapshot, { force: true })
const revMissingSnapshot = await callRoute('/api/dsh-workstyle/revisions', { method: 'POST', body: { action: 'restore', id: doomedRev.id } })
ok(revMissingSnapshot.status === 500 && /revision file is missing/.test(revMissingSnapshot.data.error || ''),
  'a snapshot file that vanished is a 500, not a 404')

/* ---------------- export keeps presets and templates ---------------- */

console.log('export presets/templates:')
const exportWithPresets = await callRoute('/api/dsh-workstyle/export', { method: 'POST', body: {} })
ok(exportWithPresets.status === 200, 'export succeeds')
const exportExtract = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-presets-'))
execFileSync('tar', ['-xzf', exportWithPresets.data.file, '-C', exportExtract])
const exportedManifest = JSON.parse(fs.readFileSync(path.join(exportExtract, 'workstyle.json'), 'utf8'))
ok(Array.isArray(exportedManifest.presets) && exportedManifest.presets.some((preset) => preset.id === 'writing'), 'exported pack keeps its presets')
ok(['writing', 'fde-delivery', 'rc-discussion'].every((id) => exportedManifest.presets.some((preset) => preset.id === id)),
  'exported pack ships all three bundled presets')
ok(Array.isArray(exportedManifest.templates) && exportedManifest.templates.length >= 3, 'exported pack keeps its templates')
ok(exportedManifest.presets.every((preset) => preset && typeof preset.id === 'string'), 'exported presets are normalized')
const exportedMeta = JSON.parse(fs.readFileSync(path.join(exportExtract, 'manifest.json'), 'utf8'))
ok(exportedMeta.overlay && typeof exportedMeta.overlay.patched === 'number', 'manifest records overlay counts')

/* ---------------- export merges the overlay: patched, removed, blocked, local ---------------- */

console.log('export overlay merge:')
const exportLocalPreset = 'export-local-preset'
const exportPresetSave = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'save', preset: { id: exportLocalPreset, title: '导出本地预设', rules: ['plan-first'] } },
})
ok(exportPresetSave.status === 200, 'a local preset can be added before export')
const exportBlock = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'block', packId: 'fde-engineering', preset: 'rc-discussion' },
})
ok(exportBlock.status === 200 && exportBlock.data.removed === 'blocked', 'a bundled preset can be blocked before export')
const exportPatch = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'fde-engineering', rule: { id: 'plan-first', title: '导出合并标题', text: '导出合并后的本机正文。' } },
})
ok(exportPatch.status === 200, 'a bundled rule can be patched before export')
const exportRemove = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'fde-engineering', rule: { id: 'scope-guard' }, remove: true },
})
ok(exportRemove.status === 200 && exportRemove.data.saved === 'removed', 'a bundled rule can be removed before export')

const mergedExport = await callRoute('/api/dsh-workstyle/export', { method: 'POST', body: {} })
ok(mergedExport.status === 200, 'overlay-aware export succeeds')
const mergedExtract = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-overlay-'))
execFileSync('tar', ['-xzf', mergedExport.data.file, '-C', mergedExtract])
const mergedManifest = JSON.parse(fs.readFileSync(path.join(mergedExtract, 'workstyle.json'), 'utf8'))
const mergedPatched = mergedManifest.rules.find((rule) => rule.id === 'plan-first')
ok(mergedPatched && mergedPatched.text === '导出合并后的本机正文。', 'exported rules carry the overlay-patched text')
ok(!mergedManifest.rules.some((rule) => rule.id === 'scope-guard'), 'exported rules drop an overlay-removed rule')
ok(mergedManifest.presets.some((preset) => preset.id === exportLocalPreset), 'exported presets include a locally added preset')
ok(!mergedManifest.presets.some((preset) => preset.id === 'rc-discussion'), 'exported presets drop a blocked preset')
const mergedMeta = JSON.parse(fs.readFileSync(path.join(mergedExtract, 'manifest.json'), 'utf8'))
ok(mergedMeta.overlay.patched === 1, 'manifest overlay.patched counts the patched rule')
ok(mergedMeta.overlay.removed === 1, 'manifest overlay.removed counts the removed rule')

/* put the fixture back so nothing after this point inherits it */
await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'fde-engineering', action: 'restore', rule: { id: 'scope-guard' } },
})
await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'unblock', packId: 'fde-engineering', preset: 'rc-discussion' } })
await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'delete', preset: exportLocalPreset } })

/* ------------------------------- cleanup ------------------------------- */


fs.rmSync(home, { recursive: true, force: true })
fs.rmSync(virginHome, { recursive: true, force: true })
fs.rmSync(extract, { recursive: true, force: true })
fs.rmSync(scopedExtract, { recursive: true, force: true })
fs.rmSync(exportExtract, { recursive: true, force: true })
fs.rmSync(mergedExtract, { recursive: true, force: true })
console.log('\nALL ' + checks + ' CHECKS PASSED')
